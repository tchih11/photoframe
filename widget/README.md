# PhotoFrame ホーム画面ウィジェット（iPad）

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
5. `コード.gs` を [`apps-script/Code.gs`](apps-script/Code.gs) の内容で置き換え、冒頭の設定を書き換える
   - `FOLDER_ID` … フォトフレームで使っているフォルダID
   - `SECRET` … 推測されにくい長い文字列（例：パスワード生成ツールで作った32文字以上の英数字）
6. 関数選択で `test` を選んで「実行」→ 権限の確認が出るので許可
   - ログに「写真の枚数: ○○」と表示されればOK
7. 右上「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
   - 次のユーザーとして実行：**自分**
   - アクセスできるユーザー：**全員**
   - 「デプロイ」→ 表示された **ウェブアプリURL**（`https://script.google.com/macros/s/…/exec`）をコピー

確認：iPadのSafariで `ウェブアプリURL?key=SECRETの値` を開き、`{"id":…,"image":…}` のような文字が出れば成功です。

> 「全員」にしていても、`SECRET` を知らない人には写真は返りません。URLと `SECRET` は他人に教えないでください。漏れたときは `SECRET` を変えて「デプロイを管理」から新しいバージョンをデプロイし直します。

## 2. Scriptable（iPad側）の準備

1. App Storeで「Scriptable」（無料）をインストール
2. Scriptableを開き「＋」で新しいスクリプトを作成し、[`scriptable/PhotoFrameWidget.js`](scriptable/PhotoFrameWidget.js) の内容を貼り付け
3. 冒頭の設定を書き換える
   - `API_URL` … 手順1-7でコピーしたウェブアプリURL
   - `SECRET` … Code.gs と同じ値
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
