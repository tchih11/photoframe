// ===== デモ版用の上書き =====
// scripts/build-demo.mjs が photoframe.html の本体スクリプトの直後にこのファイルを読み込ませる。
// 本体の関数をここで差し替えて、Googleドライブ・Apps Script・ぴよログに一切アクセスせず、
// demo/photos/ の見本イラストでスライドショーを動かす。
// 読者が変えた設定は、本体と同じく読者のブラウザの localStorage にだけ保存される。
(() => {
  // ---- 見本の写真：[ファイル名, 何日前に撮ったか, 時刻] ----
  // 撮影日は開いた日を基準に相対的に作る（4年ほど前〜最近）
  const DEMO_PHOTOS = [
    ['01-spring-field', 1555, 10], ['05-sakura', 1530, 14], ['02-summer-sea', 1440, 11],
    ['03-autumn-hills', 1350, 15], ['04-snowy-day', 1270, 9],
    ['16-birthday', 1180, 16], ['14-summer-flowers', 1080, 10], ['06-sunset-sea', 1060, 18],
    ['13-autumn-forest', 980, 13], ['15-winter-lake', 900, 11],
    ['19-sakura-night', 800, 19], ['09-dunes', 720, 15], ['10-balloons', 640, 12],
    ['08-forest', 590, 9], ['07-starry-night', 520, 21],
    ['11-lake', 420, 8], ['12-sunset-mountains', 330, 17], ['17-blue-mountains', 230, 10],
    ['18-night-hills', 120, 20], ['20-morning-sea', 30, 7],
  ];
  // 見本の子ども（架空）：生まれてから何日か
  const DEMO_CHILDREN = [
    { name: 'おねえちゃん', daysOld: 1750 },
    { name: 'おとうと', daysOld: 400 },
  ];

  const pad = n => String(n).padStart(2, '0');
  function daysAgo(n, hour = 12) {
    const d = new Date();
    d.setHours(hour, (n * 7) % 60, 0, 0);
    d.setDate(d.getDate() - n);
    return d;
  }
  const exifTime = d => `${d.getFullYear()}:${pad(d.getMonth() + 1)}:${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  const slashDate = d => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;

  function demoPhotos() {
    return DEMO_PHOTOS.map(([file, ago, hour]) => ({
      id: file,
      imageMediaMetadata: { time: exifTime(daysAgo(ago, hour)) },
    }));
  }

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  // ---- 短い案内（トースト）----
  let toastTimer = null;
  function demoToast(msg, ms = 3500) {
    let el = document.getElementById('demo-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('visible'), ms);
  }
  window.demoToast = demoToast;
  const notInDemo = () => demoToast('デモでは使えません（Googleとの連携は本番のみ）');

  // ---- 写真の取得：見本だけを返す ----
  fetchInitialPhotos = async () => ({ photos: demoPhotos(), nextPageToken: '', complete: true });
  fetchPhotosFromGas = async () => ({ photos: demoPhotos(), nextPageToken: '', complete: true });
  fetchPhotosBatch = async () => null;
  fetchRemainingPhotos = async () => {};
  loadFullPhotoList = async () => {};
  getImageUrl = id => `photos/${encodeURIComponent(id)}.svg`;
  loadImageUrl = id => Promise.resolve(getImageUrl(id));
  preloadImage = id => { new Image().src = getImageUrl(id); };

  // ---- Googleログイン：デモでは使わない ----
  startAuth = notInDemo;
  initGSI = () => {};

  // ---- 授乳パネル：見本の値を表示（ぴよログには接続しない）----
  function sampleFeedSummary() {
    const now = Date.now();
    const iso = minAgo => new Date(now - minAgo * 60000).toISOString();
    return {
      babies: [{
        feeding: { lastAt: iso(95), lastCategory: 'formula', lastAmountMl: 120 },
        milpon: { lastAt: iso(9 * 60 + 20) },
      }],
      lastWebhookReceivedAt: iso(2),
      fetchedAt: new Date(),
    };
  }
  fetchFeeding = async () => {
    if (!feedSummary) feedSummary = sampleFeedSummary();
    feedFetchFailed = false;
    renderFeedPanel();
  };
  scheduleFeedFetch = () => {};
  const origRenderFeedPanel = renderFeedPanel;
  renderFeedPanel = () => {
    if (feedSummary) feedSummary.lastWebhookReceivedAt = new Date(Date.now() - 2 * 60000).toISOString();
    origRenderFeedPanel();
    const status = document.getElementById('feed-status');
    status.classList.remove('error');
    status.textContent = '見本の値';
  };

  // ---- スライドショー開始：フォルダID・Apps Scriptなしで始める ----
  const origStartSlideshow = startSlideshow;
  let autoStart = false;
  startSlideshow = async () => {
    const feedBox = document.getElementById('feed-enabled');
    const feedOn = feedBox.checked;
    document.getElementById('folder-id').value = 'demo'; // 写真は見本を使うので中身は使われない
    document.getElementById('gas-url').value = '';
    document.getElementById('gas-key').value = '';
    feedBox.checked = false; // 本体の「授乳パネルにはURLが必要」チェックを避け、あとで見本の値で開く
    storageSet('pf_demo_feed', feedOn ? '1' : '0');

    // 設定画面から開始したときは、入力した夜間モードの時間帯をそのまま試せるようにする
    if (!autoStart) nightManualOverride = null;

    await origStartSlideshow();
    feedBox.checked = feedOn;

    if (document.getElementById('setup').style.display !== 'none') return; // 入力エラー
    if (feedOn) {
      feedEnabled = true;
      startFeedPanel();
    }

    // 開いた直後が夜間の時間帯でも、まずは写真が見えるようにする
    if (autoStart) {
      autoStart = false;
      if (document.getElementById('night-overlay').classList.contains('on')) {
        toggleNight(); // 手動で解除した扱い
        demoToast(`いまは夜間モードの時間帯（${nightStart}時〜${nightEnd}時）です。デモでは写真を表示しています。画面をタップ →「🌙 夜間モード」で暗くできます`, 7000);
      } else {
        demoToast('画面をタップすると、前後の写真・アルバム選択・夜間モード・設定のボタンが出ます', 5000);
      }
    }
  };

  // ---- 設定画面をデモ用に整える ----
  function prepareSetupScreen() {
    const screen = document.getElementById('screen-3');
    // 不要な部分を隠す（Googleドライブ・Apps Script関連）
    screen.querySelector('.steps').style.display = 'none';
    document.getElementById('folder-id').closest('.field').style.display = 'none';
    document.getElementById('gas-url').closest('.field').style.display = 'none';
    document.getElementById('gas-key').closest('.field').style.display = 'none';
    screen.querySelector('.btn.btn-ghost').style.display = 'none'; // 「戻る」（Googleログインの画面へ）
    screen.querySelector('.hint').innerHTML =
      'デモ版です。写真はコードで描いた見本のイラストで、撮影日は今日を基準にした架空の日付です。<br>' +
      '設定はこの端末のブラウザ内だけに保存され、サーバーには送信されません。<br>' +
      'Googleドライブ・Apps Scriptとの連携はデモでは使えません。';

    const cards = screen.querySelectorAll('.card');
    cards[0].querySelector('.card-title').textContent = '表示設定';
    cards[1].querySelector('.card-title').textContent = '授乳パネル（見本の値）';
    const feedLabel = document.getElementById('feed-enabled').closest('label');
    feedLabel.lastChild.textContent = '授乳パネルを表示する（デモでは見本の値。ぴよログには接続しません）';

    // バージョン表示の横に DEMO と出す
    const version = screen.querySelector('.version');
    version.insertAdjacentHTML('beforeend', ' <span class="demo-badge">DEMO</span>');

    // 見本の設定に戻すボタン
    const reset = document.createElement('button');
    reset.className = 'btn btn-ghost';
    reset.textContent = '見本の設定に戻す';
    reset.onclick = () => {
      try {
        Object.keys(localStorage).filter(k => k.startsWith('pf_')).forEach(k => localStorage.removeItem(k));
      } catch (e) {}
      location.reload();
    };
    screen.querySelector('.error-msg').before(reset);

    // 使わない画面（Client ID・Googleログイン）は showScreen(3) で隠れたままになる

    // HUDにデモ表示
    document.querySelector('.hud-info').insertAdjacentHTML('beforeend', '<span class="demo-hud">デモ版・見本のイラスト</span>');
  }

  // 初回だけ見本の設定を入れておく（読者が変えたらそちらを優先）
  function seedDefaults() {
    if (storageGet('pf_children') === null) {
      const kids = DEMO_CHILDREN.map(c => ({ name: c.name, birthday: slashDate(daysAgo(c.daysOld)) }));
      storageSet('pf_children', JSON.stringify(kids));
    }
    if (storageGet('pf_interval') === null) storageSet('pf_interval', '8');
    if (storageGet('pf_demo_feed') === null) {
      // 幅の狭いスマホでは時計と重なるので、最初は出さない
      storageSet('pf_demo_feed', window.innerWidth >= 768 ? '1' : '0');
    }
    if (storageGet('pf_all_mode') === null && storageGet('pf_sort_mode') === null) storageSet('pf_all_mode', '1');
  }

  // ---- 起動 ----
  window.removeEventListener('DOMContentLoaded', init);
  window.addEventListener('DOMContentLoaded', () => {
    seedDefaults();
    prepareSetupScreen();
    init(); // 本体の初期化（保存済みの設定を入力欄に戻す）
    document.getElementById('feed-enabled').checked = storageGet('pf_demo_feed') === '1';
    showScreen(3);
    autoStart = true;
    startSlideshow();
  });

  // ---- デモ用の見た目 ----
  const style = document.createElement('style');
  style.textContent = `
    .demo-badge { display: inline-block; margin-left: 6px; padding: 1px 8px; border-radius: 8px;
      background: var(--accent); color: #0a0a0a; font-size: 10px; letter-spacing: 1px; }
    .demo-hud { display: block; font-size: 11px; color: var(--accent); opacity: 0.8; }
    #demo-toast { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
      max-width: min(520px, calc(100vw - 32px)); padding: 14px 20px; border-radius: 16px;
      background: rgba(20,20,20,0.88); border: 1px solid rgba(255,255,255,0.15);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      font-size: 14px; line-height: 1.7; text-align: center; color: rgba(255,255,255,0.92);
      z-index: 200; opacity: 0; pointer-events: none; transition: opacity 0.4s; }
    #demo-toast.visible { opacity: 1; }
    /* 設定画面が画面より長いとき、上端（ロゴ）までスクロールできるようにする */
    #setup { justify-content: flex-start; }
    #setup .screen.active { margin: auto 0; flex-shrink: 0; }
    @media (max-width: 760px) {
      #clock { top: 16px; left: 16px; padding: 4px 18px; font-size: 44px; }
      #photo-date { left: 16px; bottom: 24px; font-size: 16px; }
      body:has(#hud.visible) #photo-date { opacity: 0; }
      #hud { flex-direction: column; align-items: stretch; gap: 10px; padding: 16px 16px 24px; }
      #hud > div:last-child { flex-wrap: wrap; }
      .hud-btn { flex: 1 1 auto; }
      #album-popup { bottom: 150px; right: 16px; }
      .nav-btn { width: 56px; height: 56px; font-size: 36px; }
      #nav-prev { left: 12px; } #nav-next { right: 12px; }
    }
  `;
  document.head.appendChild(style);
})();
