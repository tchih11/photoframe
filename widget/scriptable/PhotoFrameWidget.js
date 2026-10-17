// ===== PhotoFrame Widget (Scriptable) =====
// iPadのホーム画面にGoogleドライブの写真を表示するウィジェット。
// ウィジェットの「Parameter」に memories と入れると、過去の同じ月日の写真を優先表示。

// ===== 設定 =====
const API_URL = 'https://script.google.com/macros/s/XXXXXXXX/exec'; // Apps ScriptのウェブアプリURL
const SECRET = 'ここに長いランダムな文字列を入力';                    // Code.gsと同じ値
const CHILDREN = [
  // { name: '太郎', birthday: '2020/04/01' },
];
const REFRESH_MINUTES = 30;   // 更新間隔の目安（実際のタイミングはiPadOSが決める）
const OPEN_URL = '';          // タップで開くURL（フォトフレームのURLなど。空なら何もしない）
const SHOW_STATUS = true;     // 右上に更新時刻を表示（動作確認できたら false にしてOK）
// =================

const family = config.widgetFamily || 'large';
const mode = (args.widgetParameter || '').trim() === 'memories' ? 'memories' : 'random';

const fm = FileManager.local();
const cacheDir = fm.joinPath(fm.documentsDirectory(), 'photoframe-widget');
const cacheImagePath = fm.joinPath(cacheDir, 'last.jpg');
const cacheMetaPath = fm.joinPath(cacheDir, 'last.json');

async function fetchPhoto() {
  const size = family === 'small' ? 600 : 1000;
  const url = `${API_URL}?key=${encodeURIComponent(SECRET)}&mode=${mode}&size=${size}`;
  const req = new Request(url);
  req.timeoutInterval = 30;
  const data = await req.loadJSON();
  if (data.error) throw new Error(data.error);
  const img = Image.fromData(Data.fromBase64String(data.image));
  return { img: downscale(img, 1000), time: data.time || '' };
}

// ウィジェットのメモリ上限対策で縮小
function downscale(img, maxPx) {
  const { width, height } = img.size;
  const scale = Math.min(1, maxPx / Math.max(width, height));
  if (scale === 1) return img;
  const ctx = new DrawContext();
  ctx.size = new Size(Math.round(width * scale), Math.round(height * scale));
  ctx.opaque = true;
  ctx.respectScreenScale = false;
  ctx.drawImageInRect(img, new Rect(0, 0, ctx.size.width, ctx.size.height));
  return ctx.getImage();
}

function saveCache(photo) {
  if (!fm.fileExists(cacheDir)) fm.createDirectory(cacheDir, true);
  fm.writeImage(cacheImagePath, photo.img);
  fm.writeString(cacheMetaPath, JSON.stringify({ time: photo.time }));
}

function loadCache() {
  if (!fm.fileExists(cacheImagePath)) return null;
  const meta = fm.fileExists(cacheMetaPath) ? JSON.parse(fm.readString(cacheMetaPath)) : {};
  return { img: fm.readImage(cacheImagePath), time: meta.time || '' };
}

// EXIF形式 "2024:03:15 14:30:00" → "2024年3月15日"
function formatDate(exifTime) {
  const p = exifTime.split(' ')[0].split(':');
  return `${p[0]}年${parseInt(p[1])}月${parseInt(p[2])}日`;
}

// photoframe.html の calcAge と同じ計算
function calcAge(birthdayStr, photoDateStr) {
  try {
    const [yy, mm, dd] = birthdayStr.split('/').map(Number);
    const [py, pm, pd] = photoDateStr.split(' ')[0].split(':').map(Number);
    let years = py - yy;
    let months = pm - mm;
    if (months < 0) { years--; months += 12; }
    if (pd < dd) { months--; if (months < 0) { years--; months += 12; } }
    if (years < 0) return null;
    return `${years}歳${months}か月`;
  } catch (e) {
    return null;
  }
}

function addShadowText(widget, text, size) {
  const t = widget.addText(text);
  t.font = Font.mediumSystemFont(size);
  t.textColor = Color.white();
  t.shadowColor = new Color('#000000', 0.8);
  t.shadowRadius = 3;
  t.shadowOffset = new Point(0, 1);
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.6;
  return t;
}

// 右上に更新時刻を表示（取得失敗時は⚠︎付き）。更新されているかの確認用
function addStatus(widget, error) {
  const row = widget.addStack();
  row.addSpacer();
  const df = new DateFormatter();
  df.dateFormat = 'H:mm';
  const t = row.addText(error ? `⚠︎ ${df.string(new Date())} 取得失敗` : `${df.string(new Date())} 更新`);
  t.font = Font.systemFont(9);
  t.textColor = new Color('#ffffff', 0.85);
  t.shadowColor = new Color('#000000', 0.8);
  t.shadowRadius = 2;
}

function buildWidget(photo, error) {
  const w = new ListWidget();
  w.backgroundColor = new Color('#111111');
  w.refreshAfterDate = new Date(Date.now() + REFRESH_MINUTES * 60 * 1000);
  if (OPEN_URL) w.url = OPEN_URL;

  if (!photo) {
    addShadowText(w, '写真を取得できませんでした', 13);
    if (error) addShadowText(w, String(error.message || error), 10);
    return w;
  }

  w.backgroundImage = photo.img;
  w.setPadding(10, 12, 10, 12);
  if (SHOW_STATUS) addStatus(w, error);
  w.addSpacer();

  if (photo.time) {
    const isSmall = family === 'small';
    addShadowText(w, formatDate(photo.time), isSmall ? 12 : 15);
    if (!isSmall) {
      const ages = CHILDREN
        .filter(c => c.name && c.birthday)
        .map(c => {
          const age = calcAge(c.birthday, photo.time);
          return age ? `${c.name} ${age}` : null;
        })
        .filter(Boolean);
      if (ages.length > 0) addShadowText(w, ages.join('　'), 12);
    }
  }
  return w;
}

let photo;
let error = null;
try {
  photo = await fetchPhoto();
  saveCache(photo);
} catch (e) {
  console.error(e);
  error = e;
  photo = loadCache(); // 通信失敗時は前回の写真を表示
}

const widget = buildWidget(photo, error);
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentLarge();
}
Script.complete();
