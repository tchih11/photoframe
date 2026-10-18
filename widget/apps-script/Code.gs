// ===== PhotoFrame Widget API (Google Apps Script) =====
// Googleドライブのフォルダの写真を、縮小画像としてJSONで返すWebアプリ。
// - iPadのScriptableウィジェット（widget/scriptable/PhotoFrameWidget.js）：ランダムに1枚
// - フォトフレーム本体（photoframe.html）：id=ファイルID で指定した1枚
// - フォトフレーム本体の授乳パネル：action=feeding で piyolog-dashboard の授乳状況を中継
// - フォトフレーム本体の写真一覧：action=list（フォトフレーム側のGoogleログインが不要になる）

// ===== 設定 =====
// 秘密の値はコードに書かず「プロジェクトの設定（⚙）→ スクリプト プロパティ」に保存する。
// コードを丸ごと貼り替えても値は消えない。
//   FOLDER_ID                    … フォトフレームと同じフォルダID
//   SECRET                       … 合言葉（フォトフレーム・ウィジェット側と同じ値）
//   PIYOLOG_URL                  … 授乳パネル用：piyolog-dashboard のURL（末尾の /api/summary は不要）
//   PIYOLOG_ACCESS_CLIENT_ID     … piyolog-dashboard を Cloudflare Access で保護している場合のサービストークンID
//   PIYOLOG_ACCESS_CLIENT_SECRET … 同シークレット
const PROPS = PropertiesService.getScriptProperties().getProperties();
const FOLDER_ID = PROPS.FOLDER_ID || '';
const SECRET = PROPS.SECRET || '';
const PIYOLOG_URL = PROPS.PIYOLOG_URL || '';
const PIYOLOG_ACCESS_CLIENT_ID = PROPS.PIYOLOG_ACCESS_CLIENT_ID || '';
const PIYOLOG_ACCESS_CLIENT_SECRET = PROPS.PIYOLOG_ACCESS_CLIENT_SECRET || '';

const DEFAULT_SIZE = 1000;                          // 返す画像の長辺(px)
const MAX_SIZE = 2048;
const LIST_CACHE_SECONDS = 2 * 60 * 60;             // 写真一覧のキャッシュ時間（installTrigger で1時間ごとに作り直す）
const QUICK_LIST_SIZE = 300;                        // キャッシュがないとき、起動用にまず返す枚数
const FALLBACK_MAX_BYTES = 3 * 1024 * 1024;         // サムネイル取得失敗時に原寸を返す上限

function doGet(e) {
  const params = (e && e.parameter) || {};
  // SECRET未設定のまま公開すると、空の合言葉で誰でも通れてしまうため拒否
  if (!SECRET || !FOLDER_ID) return json_({ error: 'スクリプト プロパティの FOLDER_ID / SECRET が設定されていません' });
  if (params.key !== SECRET) return json_({ error: 'unauthorized' });

  // action=feeding：授乳状況（ブラウザから piyolog-dashboard を直接読むとCORSで拒否されるため中継）
  if (params.action === 'feeding') {
    try {
      return json_(fetchFeeding_());
    } catch (err) {
      return json_({ error: String(err) });
    }
  }

  // action=list：写真一覧 [[id, exifTime], ...]
  // quick=1：キャッシュがあれば全件、なければ一部だけすぐ返す（残りはフォトフレームが後から全件を取得）
  if (params.action === 'list') {
    try {
      if (params.quick) {
        const cached = getCachedPhotoList_();
        if (cached) return json_({ photos: cached, complete: true });
        return json_({ photos: fetchQuickPhotoList_(), complete: false });
      }
      return json_({ photos: getPhotoList_(), complete: true });
    } catch (err) {
      return json_({ error: String(err) });
    }
  }

  const size = Math.min(parseInt(params.size, 10) || DEFAULT_SIZE, MAX_SIZE);

  // id指定：フォトフレーム本体から、表示する写真を1枚取得
  if (params.id) {
    try {
      const image = fetchImage_(params.id, size, true);
      return json_({ id: params.id, mime: image.mime, source: image.source, image: image.base64 });
    } catch (err) {
      return json_({ error: String(err) });
    }
  }

  const photos = getPhotoList_();
  if (photos.length === 0) return json_({ error: 'no photos' });

  // mode=memories：過去の同じ月日に撮った写真を優先（なければランダム）
  let pool = photos;
  if (params.mode === 'memories') {
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM:dd');
    const matched = photos.filter(p => p[1] && p[1].substring(5, 10) === today);
    if (matched.length > 0) pool = matched;
  }

  const [id, time] = pool[Math.floor(Math.random() * pool.length)];

  try {
    const image = fetchImage_(id, size, false);
    return json_({ id, time, mime: image.mime, source: image.source, image: image.base64 });
  } catch (err) {
    return json_({ error: String(err) });
  }
}

// 縮小サムネイルを取得（失敗時は小さいファイルに限り原寸）
// checkFolder=true のときは、設定したフォルダ内の画像以外を拒否する
function fetchImage_(id, size, checkFolder) {
  const file = Drive.Files.get(id, { fields: 'thumbnailLink,size,mimeType,parents' });
  if (checkFolder) {
    const inFolder = (file.parents || []).indexOf(FOLDER_ID) >= 0;
    if (!inFolder || !/^image\//.test(file.mimeType || '')) throw new Error('not found');
  }

  if (file.thumbnailLink) {
    const url = file.thumbnailLink.replace(/=s\d+$/, '=s' + size);
    const res = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200) return toImage_(res.getBlob(), 'thumbnail');
  }
  if (Number(file.size) <= FALLBACK_MAX_BYTES) {
    return toImage_(DriveApp.getFileById(id).getBlob(), 'original');
  }
  throw new Error('thumbnail unavailable');
}

// piyolog-dashboard の /api/summary から、授乳パネルで使う項目だけを返す
function fetchFeeding_() {
  if (!PIYOLOG_URL) throw new Error('スクリプト プロパティの PIYOLOG_URL が設定されていません');
  const base = PIYOLOG_URL.replace(/\/+$/, '').replace(/\/api\/summary$/, '');
  const headers = {};
  if (PIYOLOG_ACCESS_CLIENT_ID) {
    headers['CF-Access-Client-Id'] = PIYOLOG_ACCESS_CLIENT_ID;
    headers['CF-Access-Client-Secret'] = PIYOLOG_ACCESS_CLIENT_SECRET;
  }
  const res = UrlFetchApp.fetch(base + '/api/summary', { headers, muteHttpExceptions: true, followRedirects: false });
  const code = res.getResponseCode();
  const text = res.getContentText();
  const location = res.getAllHeaders()['Location'] || res.getAllHeaders()['location'] || '';

  // ログイン画面への転送やHTMLが返ってきた場合は、原因の手がかりをエラーに含める
  if (/cloudflareaccess\.com/.test(location) || /cloudflareaccess\.com|Cloudflare Access/i.test(text)) {
    throw new Error('piyolog-dashboard は Cloudflare Access で保護されています。サービストークンをスクリプト プロパティの PIYOLOG_ACCESS_CLIENT_ID / PIYOLOG_ACCESS_CLIENT_SECRET に設定してください');
  }
  if (code >= 300 && code < 400) throw new Error('piyolog-dashboard が別のURLへ転送しました（' + code + ' → ' + location + '）。PIYOLOG_URL を確認してください');
  if (code !== 200) throw new Error('piyolog-dashboard HTTP ' + code + '：' + text.substring(0, 100));
  let summary;
  try {
    summary = JSON.parse(text);
  } catch (e) {
    const title = (text.match(/<title>([^<]*)<\/title>/i) || [])[1] || text.substring(0, 100);
    throw new Error('JSONではなくHTMLが返りました（ページタイトル：' + title + '）。PIYOLOG_URL がダッシュボードのURLになっているか確認してください。リクエスト先：' + base + '/api/summary');
  }
  return {
    updatedAt: summary.updatedAt || null,
    lastWebhookReceivedAt: summary.lastWebhookReceivedAt || null,
    babies: (summary.babies || []).map(b => ({
      babyName: b.babyName,
      feeding: {
        lastAt: (b.feeding && b.feeding.lastAt) || null,
        lastCategory: (b.feeding && b.feeding.lastCategory) || null,
        lastAmountMl: b.feeding ? b.feeding.lastAmountMl : null,
        lastDurationMin: b.feeding ? b.feeding.lastDurationMin : null
      },
      milpon: { lastAt: (b.milpon && b.milpon.lastAt) || null }
    }))
  };
}

function toImage_(blob, source) {
  return {
    mime: blob.getContentType() || 'image/jpeg',
    source,
    base64: Utilities.base64Encode(blob.getBytes())
  };
}

// 写真一覧 [[id, exifTime], ...] をキャッシュ付きで取得
function getPhotoList_() {
  const cached = getCachedPhotoList_();
  if (cached) return cached;

  const cache = CacheService.getScriptCache();
  const photos = fetchPhotoList_();
  // CacheServiceは1キー100KBまでなので分割して保存
  const CHUNK = 1000;
  const entries = {};
  let n = 0;
  for (let i = 0; i < photos.length; i += CHUNK) {
    entries['list_' + n++] = JSON.stringify(photos.slice(i, i + CHUNK));
  }
  entries['list_chunks'] = String(n);
  cache.putAll(entries, LIST_CACHE_SECONDS);
  return photos;
}

// キャッシュ済みの写真一覧（なければ null）
function getCachedPhotoList_() {
  const cache = CacheService.getScriptCache();
  const count = parseInt(cache.get('list_chunks'), 10);
  if (!(count > 0)) return null;
  const keys = [];
  for (let i = 0; i < count; i++) keys.push('list_' + i);
  const got = cache.getAll(keys);
  if (Object.keys(got).length !== count) return null;
  return keys.reduce((acc, k) => acc.concat(JSON.parse(got[k])), []);
}

// 起動を速くするため、ドライブの1ページ分だけ取得（キャッシュはしない）
function fetchQuickPhotoList_() {
  const res = Drive.Files.list({
    q: `'${FOLDER_ID}' in parents and mimeType contains 'image/' and trashed = false`,
    fields: 'files(id, md5Checksum, size, imageMediaMetadata(time))',
    pageSize: QUICK_LIST_SIZE
  });
  return dedupePhotos_(res.files || []);
}

function fetchPhotoList_() {
  const files = [];
  let pageToken;
  do {
    const res = Drive.Files.list({
      q: `'${FOLDER_ID}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: 'nextPageToken, files(id, md5Checksum, size, imageMediaMetadata(time))',
      pageSize: 1000,
      pageToken
    });
    (res.files || []).forEach(f => files.push(f));
    pageToken = res.nextPageToken;
  } while (pageToken);
  return dedupePhotos_(files);
}

// 重複を除いて [[id, exifTime], ...] にする（ドライブ上のファイルは消さない）
//  1. 中身がまったく同じファイル（md5Checksum が同じ）
//  2. 撮影日時が秒まで同じ写真（Googleフォト経由の再圧縮コピーなど。連写も1枚になる）
// どちらもファイルサイズが大きい（画質が良い）方を残す
function dedupePhotos_(files) {
  const sorted = files.slice().sort((a, b) => Number(b.size || 0) - Number(a.size || 0));
  const seenMd5 = {};
  const seenTime = {};
  const photos = [];
  sorted.forEach(f => {
    const time = (f.imageMediaMetadata && f.imageMediaMetadata.time) || '';
    if (f.md5Checksum) {
      if (seenMd5[f.md5Checksum]) return;
      seenMd5[f.md5Checksum] = true;
    }
    if (time) {
      if (seenTime[time]) return;
      seenTime[time] = true;
    }
    photos.push([f.id, time]);
  });
  return photos;
}

// 写真一覧のキャッシュを消す（写真を大量に追加した直後などに手動実行）
function clearCache() {
  const cache = CacheService.getScriptCache();
  const count = parseInt(cache.get('list_chunks'), 10) || 0;
  const keys = ['list_chunks'];
  for (let i = 0; i < count; i++) keys.push('list_' + i);
  cache.removeAll(keys);
}

// 授乳パネルの動作確認用：エディタから実行してログを見る
function testFeeding() {
  console.log(JSON.stringify(fetchFeeding_(), null, 2));
}

// 写真一覧を作り直してキャッシュする（トリガーから1時間ごとに実行）
function refreshListCache() {
  clearCache();
  const photos = getPhotoList_();
  console.log('写真一覧を更新しました: ' + photos.length + '枚');
}

// 初回だけエディタから実行：refreshListCache を1時間ごとに動かすトリガーを登録
function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'refreshListCache')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('refreshListCache').timeBased().everyHours(1).create();
  refreshListCache();
  console.log('1時間ごとの写真一覧の更新を登録しました');
}

// 動作確認用：エディタから実行してログを見る
function test() {
  const photos = getPhotoList_();
  console.log('写真の枚数（重複を除く）: ' + photos.length);
  const res = JSON.parse(doGet({ parameter: { key: SECRET } }).getContent());
  if (res.error) {
    console.log('画像の取得に失敗: ' + res.error);
  } else {
    // source が thumbnail なら縮小画像の取得に成功（original は原寸で代用）
    console.log('画像の取得に成功: source=' + res.source + ', ' + Math.round(res.image.length / 1024) + 'KB');
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
