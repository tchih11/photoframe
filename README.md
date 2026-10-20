# PhotoFrame

iPadをデジタルフォトフレームにする、1ファイルだけのWebアプリ（`photoframe.html`）です。

- Googleドライブのフォルダの写真をスライドショー表示（Googleログイン、またはApps Script経由でログインなし）
- 撮影日と、そのときの子どもの年齢（「◯歳◯か月」）を表示
- 年ごとのアルバム／全期間ランダム、ランダム／日付順の切り替え
- 夜間モード（指定した時間帯は画面を暗くする）
- 授乳パネル（piyolog-dashboard の値を表示、任意）
- ホーム画面用のウィジェット（Scriptable）は [`widget/`](widget/README.md) を参照

## デモ版(読者に触ってもらう用)

note記事の読者に触ってもらう用に、デモをCloudflareのWorker(`photoframe-demo`)で配信できます。家族で使っている `photoframe.html` はそのままで、デモ用の `index.html` はビルド時に作ります（`scripts/build-demo.mjs`）。

- 写真は見本のイラスト(`demo/photos/`、`scripts/generate-demo-photos.mjs` でコードから生成)で、撮影日は開いた日を基準にした架空の日付です。子どもも架空の「おねえちゃん」「おとうと」です
- Googleログイン・GoogleドライブのフォルダID・Apps Scriptの設定はなく、開くとすぐにスライドショーが始まります。設定画面は表示まわり(スライド間隔、夜間モード、子どもの情報、授乳パネル)だけです
- 授乳パネルは見本の値を表示します(ぴよログ・Apps Scriptには接続しません)
- 設定は、それぞれの読者の端末のブラウザ内(localStorage)だけに保存されます。ほかの読者には見えず、サーバーにも送信されません。設定画面の「見本の設定に戻す」で最初の状態に戻せます

### Cloudflareでの初回セットアップ

1. Cloudflareのダッシュボードで **Workers & Pages** → **Create** → **Import an existing Git repository** から `tchih11/photoframe` を選ぶ
2. Worker名を `photoframe-demo` にする
3. ビルド設定を入力:
   - **Build command**: `npm run build:demo`
   - **Deploy command**: `npx wrangler deploy --env demo`
4. デモに反映するブランチ(本番ブランチ)を `demo` にしておくと、`main` に push してもデモは変わらず、`main` を `demo` にマージしたときだけ読者側が更新されます

デモは `https://photo.sanji-no-daddy.com` で配信されます(初回デプロイ時にCloudflareがDNSレコードと証明書を自動で用意します)。workers.dev のURLとプレビューURLは、デモでは無効にしています。

### 手動デプロイ(ローカルから)

```bash
npm install
npm run deploy:demo
```

ローカルで確認するときは `npm run dev:demo` です。
