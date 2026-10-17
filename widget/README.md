# PhotoFrame 画像API ＆ ホーム画面ウィジェット（iPad）

> v1.6.0 から、フォトフレーム本体（`photoframe.html`）もこの Apps Script 経由で画像を取得します。
> SafariのGoogleログイン状態に左右されずに写真を表示するためです。手順1の後、「1.5 フォトフレーム本体の設定」を行ってください。

フォトフレームと同じGoogleドライブのフォルダから写真を1枚選び、iPadのホーム画面に表示するウィジェットです。
撮影日と子どもの年齢も表示します（フォトフレーム本体と同じ計算）。

```
[iPad ウィジェット (Scriptable)] --HTTPS--> [Google Apps Script ウェブアプリ] --> [Googleドライブのフォルダ]
```

- `apps-script/Code.gs` … 写真を選んで縮小画像を返すAPI（Googleのサーバー上で動く）
- `apps-script/appsscript.json` … Apps Scriptの設定（Drive API・タイムゾーン）
- `scriptable/PhotoFrameWidget.js` … iPadのScriptableアプリで動くウィジェット本体

## 1. Apps Script（API側）の準備

> フォトフレーム専用のGoogleアカウントで作業してください。写真フォルダ以外のデータを触らせないためです。

1. https://script.google.com を開き「新しいプロジェクト」を作成。名前は「PhotoFrame Widget」など
2. 左の「サービス ＋」→「Drive API」を選び、バージョン **v3** で追加
3. 左の「プロジェクトの設定（⚙）」→「『appsscript.json』マニフェスト ファイルをエディタで表示する」にチェック
4. エディタの `appsscript.json` を [`apps-script/appsscript.json`](apps-script/appsscript.json) の内容で置き換え
5. `コード.gs` を [`apps-script/Code.gs`](apps-script/Code.gs) の内容で置き換える（コードには秘密の値を書かない）
   - 左の「プロジェクトの設定（⚙）」→ 一番下の「スクリプト プロパティ」→「スクリプト プロパティを追加」で次を登録
   - `FOLDER_ID` … フォトフレームで使っているフォルダID
   - `SECRET` … 推測されにくい長い文字列（例：パスワード生成ツールで作った32文字以上の英数字）
   - 以後 `コード.gs` を新しい版に丸ごと貼り替えても、これらの値は消えません
6. 関数選択で `test` を選んで「実行」→ 権限の確認が出るので許可
   - ログに「写真の枚数: ○○」と表示されればOK
7. 右上「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
   - 次のユーザーとして実行：**自分**
   - アクセスできるユーザー：**全員**
   - 「デプロイ」→ 表示された **ウェブアプリURL**（`https://script.google.com/macros/s/…/exec`）をコピー

確認：iPadのSafariで `ウェブアプリURL?key=SECRETの値` を開き、`{"id":…,"image":…}` のような文字が出れば成功です。

> 「全員」にしていても、`SECRET` を知らない人には写真は返りません。URLと `SECRET` は他人に教えないでください。漏れたときは `SECRET` を変えて「デプロイを管理」から新しいバージョンをデプロイし直します。

## 1.5 フォトフレーム本体の設定

1. iPadでフォトフレームを開き、Step 3（表示設定）の「画像の取得（Apps Script）」に入力
   - ウェブアプリURL … 手順1-7でコピーしたURL
   - 合言葉（SECRET） … スクリプト プロパティの `SECRET` と同じ値
2. 「フォトフレームを開始」→ 写真が表示されればOK

- 「画像を取得できませんでした」と出たら、URLと合言葉を確認してください（画面タップで設定に戻ります）
- 2つの欄を空にすると、従来の方式（lh3.googleusercontent.com を直接読み込む）に戻ります
- Apps Script のエディタで `test` を実行すると、ログに `source=thumbnail`（縮小画像で取得できている）か `source=original`（原寸で代用）が出ます。`画像の取得に失敗` と出る場合はそのメッセージを確認してください

## 1.6 授乳パネル（任意・ぴよログ連携）

フォトフレームの写真の上に、piyolog-dashboard の「前回の授乳」「前回のミルポン」と経過時間を表示します。

1. Apps Script のスクリプト プロパティに追加
   - `PIYOLOG_URL` … piyolog-dashboard のURL（例：`https://piyolog-dashboard.xxxx.workers.dev`）
   - ダッシュボードを Cloudflare Access（ログイン画面）で保護している場合は、Service Token（Zero Trust → Access controls → Service credentials）の値も追加し、ダッシュボードのAccessアプリに Action「Service Auth」でそのトークンを許可するポリシーを付ける
     - `PIYOLOG_ACCESS_CLIENT_ID` … Client ID（`….access`）
     - `PIYOLOG_ACCESS_CLIENT_SECRET` … Client Secret
2. 関数選択で `testFeeding` を選んで実行 → ログに授乳データが出ればOK（権限の確認が出たら許可）
3. 「デプロイ」→「デプロイを管理」→ 鉛筆アイコン → バージョン「新バージョン」→「デプロイ」（URLは変わりません）
4. フォトフレームの Step 3 で「授乳パネルを表示する（ぴよログ）」にチェックして開始

- 経過時間は30秒ごとに更新、データは毎時01・06・11…分に取得します（ダッシュボードと同じ）
- 授乳3時間・ミルポン24時間を過ぎると赤字になります
- **位置の調整**：パネルを指でドラッグすると移動でき、位置は保存されます。HUDの「📍 授乳パネルを元の位置へ」で右上に戻ります
- 夜間モード中は写真が暗くなり、授乳パネルだけが薄く表示されます
- 右上の小さな表示：`更新 08:12`（正常）／`⚠︎ 取得失敗`（Apps Scriptへの接続失敗）／`⚠︎ ぴよログの送信が止まっています`（Android側の自動送信が20分以上止まっている）

## 2. Scriptable（iPad側）の準備

1. App Storeで「Scriptable」（無料）をインストール
2. Scriptableを開き「＋」で新しいスクリプトを作成し、[`scriptable/PhotoFrameWidget.js`](scriptable/PhotoFrameWidget.js) の内容を貼り付け
3. 冒頭の設定を書き換える
   - `API_URL` … 手順1-7でコピーしたウェブアプリURL
   - `SECRET` … スクリプト プロパティの `SECRET` と同じ値
   - `CHILDREN` … 年齢を表示したい場合に `{ name: '太郎', birthday: '2020/04/01' },` の形式で追加
   - `OPEN_URL` … ウィジェットをタップしたときに開きたいURL（フォトフレームのURLなど。任意）
4. スクリプト名を「PhotoFrame」などに変更し、▶ で実行 → 写真のプレビューが出ればOK

## 3. ホーム画面に追加

1. ホーム画面の何もない所を長押し →「編集」→「ウィジェットを追加」
2. 「Scriptable」を選び、サイズ（小・中・大・特大）を選んで追加
3. 追加したウィジェットを長押し →「ウィジェットを編集」
   - Script：**PhotoFrame**
   - When Interacting：Open URL（`OPEN_URL` を設定した場合）
   - Parameter：空欄ならランダム、`memories` と入れると **過去の同じ月日に撮った写真** を優先表示

## 補足

- 更新タイミングはiPadOSが決めます。`REFRESH_MINUTES`（初期値30分）は目安で、実際は15分〜数時間ごとになります
- 通信できないときは前回表示した写真をそのまま表示します
- 写真一覧はApps Script側で最大6時間キャッシュします。写真を追加してすぐ反映させたいときは、Apps Scriptのエディタで `clearCache` を実行してください
- Apps Scriptの無料枠（URLフェッチは1日2万回など）に対して、ウィジェットの更新回数は十分少ないので通常は問題ありません
- `Code.gs` を書き換えたときは「デプロイを管理」→ 編集（鉛筆）→ バージョン「新バージョン」でデプロイし直すと、同じURLのまま反映されます
