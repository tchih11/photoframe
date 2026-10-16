// ===== PhotoFrame Widget API (Google Apps Script) =====
// Googleドライブのフォルダの写真を、縮小画像としてJSONで返すWebアプリ。
// - iPadのScriptableウィジェット（widget/scriptable/PhotoFrameWidget.js）：ランダムに1枚
// - フォトフレーム本体（photoframe.html）：id=ファイルID で指定した1枚

// ===== 設定 =====
const FOLDER_ID = 'ここにフォルダIDを入力';        // フォトフレームと同じフォルダID
const SECRET = 'ここに長いランダムな文字列を入力';   // ウィジェット側と同じ値にする
const DEFAULT_SIZE = 1000;                          // 返す画像の長辺(px)
const MAX_SIZE = 2048;
const LIST_CACHE_SECONDS = 6 * 60 * 60;             // 写真一覧のキャッシュ時間（最大6時間）
const FALLBACK_MAX_BYTES = 3 * 1024 * 1024;         // サムネイル取得失敗時に原寸を返す上限

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.key !== SECRET) return json_({ error: 'unauthorized' });

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

function toImage_(blob, source) {
  return {
    mime: blob.getContentType() || 'image/jpeg',
    source,
    base64: Utilities.base64Encode(blob.getBytes())
  };
}

// 写真一覧 [[id, exifTime], ...] をキャッシュ付きで取得
function getPhotoList_() {
  const cache = CacheService.getScriptCache();
  const count = parseInt(cache.get('list_chunks'), 10);
  if (count > 0) {
    const keys = [];
    for (let i = 0; i < count; i++) keys.push('list_' + i);
    const got = cache.getAll(keys);
    if (Object.keys(got).length === count) {
      return keys.reduce((acc, k) => acc.concat(JSON.parse(got[k])), []);
    }
  }

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

function fetchPhotoList_() {
  const photos = [];
  let pageToken;
  do {
    const res = Drive.Files.list({
      q: `'${FOLDER_ID}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: 'nextPageToken, files(id, imageMediaMetadata(time))',
      pageSize: 1000,
      pageToken
    });
    (res.files || []).forEach(f => {
      photos.push([f.id, (f.imageMediaMetadata && f.imageMediaMetadata.time) || '']);
    });
    pageToken = res.nextPageToken;
  } while (pageToken);
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

// 動作確認用：エディタから実行してログを見る
function test() {
  const photos = getPhotoList_();
  console.log('写真の枚数: ' + photos.length);
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
