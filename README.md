# イワサキ住建 / ハウジングひみ　サイト（編集画面つき）

文章と写真を、管理画面（`/admin`）から素人でも編集できるサイトです。**月額0円**（GitHub + Cloudflare）で運用できます。
デザインは元のサイトと同じです（画面を並べて比較し、一致を確認済み）。

- 編集のしかた → `編集マニュアル.md`（編集する人に渡してください）
- このファイル → 最初に1回だけ行う「公開の準備」の手順です

---

## しくみ（ざっくり）

```
管理画面で文章・写真を編集 →「公開」→「公開する」（＝公開） → GitHub（main）に保存 → Cloudflare が自動でサイトを作り直す → 数分で反映
```

## 最初に1回だけやること（所要 30〜40分）

### 1. GitHub にこのフォルダを置く
1. https://github.com で無料アカウントを作る（すでにあれば不要）
2. 「New repository」で新しいリポジトリを作る（名前例: `iwasaki-site`。**Private（非公開）でOK**）
3. このフォルダの中身をすべてアップロードする
   - 画面の「uploading an existing file」から、フォルダの中身をドラッグ＆ドロップ → 「Commit changes」
   - `node_modules` と `_site` フォルダは入れません（入っていなければOK）

### 2. Cloudflare で公開する
（Cloudflare は Pages を Workers に統合しつつあるため、このサイトは Workers 方式で公開します）
1. https://dash.cloudflare.com で無料アカウントを作る
2. トップ画面の「Create app」（または「Workers & Pages」→「Create application」）→「Import a repository」（GitHub 連携）を選ぶ
3. GitHub の連携を許可し、`iwasaki-site` を選んで「Next」
4. 設定は次のとおり
   - Project name: `iwasaki-site`
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`（初期値のまま）
   - Preview command: 初期値のまま
5. 「Deploy」→ 数分で `https://iwasaki-site.（あなたの名前）.workers.dev` が表示されます。これがサイトのアドレスです。

### 3. GitHub ログイン用の「OAuthアプリ」を作る（管理画面のログインに必要）
1. GitHub 右上の自分のアイコン →「Settings」→ 左下「Developer settings」→「OAuth Apps」→「New OAuth App」
2. 入力
   - Application name: 好きな名前（例: イワサキ住建サイト編集）
   - Homepage URL: `https://（サイトのアドレス）`
   - Authorization callback URL: `https://（サイトのアドレス）/api/callback`
3. 「Register application」→「Generate a new client secret」
4. 表示された **Client ID** と **Client secret** を控える（secret は一度しか表示されません）
5. Cloudflare の `iwasaki-site` →「Settings」→「Variables and Secrets」に次の2つを追加
   - `GITHUB_CLIENT_ID` = Client ID
   - `GITHUB_CLIENT_SECRET` = Client secret（「Secret」として保存）
6. 保存すると自動で反映されます（反映されないときは「Deployments」から再デプロイ）

### 4. 設定ファイルの2か所を書き換える
GitHub 上で `src/admin/config.yml` を開き（鉛筆アイコンで編集）、次を自分の値に変えて保存します。

| 書いてある文字 | 書き換え例 |
|---|---|
| `YOUR_GITHUB_USER/YOUR_REPO` | `taro-yamada/iwasaki-site` |
| `YOUR-SITE.pages.dev`（3か所） | `iwasaki-site.pages.dev` |

保存すると自動で再公開されます（数分）。
（このリポジトリの設定ファイルには、すでに自分の値が入っています）

### 5. 編集する人を招待する
1. GitHub のリポジトリ →「Settings」→「Collaborators」→「Add people」
2. 編集する人の GitHub アカウントを追加（権限は Write）
3. 相手が届いた招待メールを承認すれば完了

### 6. 動作確認
`https://（サイトのアドレス）/admin/` を開き、「GitHubでログイン」→ ページを選んで文章を1か所変えて「公開」→「公開する」→ 数分後にサイトに反映されれば成功です。


### 7. ビルド失敗の通知を設定する（おすすめ）
「保存＝公開」のため、入力内容が原因でビルドが失敗しても、古いサイトが表示され続けるだけで誰も気づきません。
Cloudflare ダッシュボードの「Notifications」（通知）→「Add」から、**Workers Builds の失敗**の通知を、制作者のメールアドレスに送る設定にしてください。

---

## 独自ドメイン（任意）
**手順の全体は `公開後チェックリスト.md` の「独自ドメイン」にあります。** サイト内のアドレス（`site_url` と `config.yml`）は、`npm run set-domain -- https://新しいドメイン` でまとめて書き換えられます。

Cloudflare の「Settings」→「Domains & Routes」から設定できます（ドメイン代は別途）。設定したら、手順3のOAuthアプリのURL2か所と `config.yml` のアドレスも新しいドメインに変えてください。あわせて `src/_data/cms/site.json` の `site_url`（検索エンジン・SNS共有用の公開アドレス。canonical / og:image / sitemap.xml / robots.txt に使われます）も新しいドメインに直してください（管理画面には出ません）。

## 管理画面で変えられないもの
メニューの名前、ボタンの文言の一部、ページのレイアウトは固定です（崩れ防止のため）。変えたい場合は制作者に依頼してください。

## 技術メモ（制作者向け）
- Eleventy（静的サイトジェネレーター）+ Decap CMS。内容は `src/_data/cms/*.json`、見た目は `src/*.njk` と `src/style.css`
- 写真は `src/images`。JPG/PNG/WebP でアップロードしても、ビルド時に幅1600px以内のAVIFへ自動変換されます
- 画像は `{% img %}`（`eleventy.config.js`）が `<picture>` で出力します。ビルド時に幅（480/800/1200/1600px のうち元画像以下）ごとの AVIF・WebP・JPEG（透けのある画像は PNG）を作り、AVIF → WebP → JPEG の順で、画面幅に合う大きさをブラウザが選びます。第4引数が `true` なら `loading="eager"`、`"high"` なら加えて `fetchpriority="high"`（ファーストビューの主役＝トップのヒーロー画像だけ。`<head>` の先読みも `preloadimg` で同じ srcset を使います）、省略すると `loading="lazy"`。第5引数は `sizes`（表示される幅のヒント）で、レイアウトを変えたら各テンプレートの値も直します
- ログイン用の処理は `worker/index.js`（Cloudflare Workers）、設定は `wrangler.jsonc`。トークンは、ポップアップを開いた自分自身のオリジン（このサイト）にだけ渡します。OAuth のスコープは既定で `repo` です。リポジトリが公開(Public)なら、Cloudflare の Worker の変数に `GITHUB_OAUTH_SCOPE` = `public_repo` を足すと、非公開リポジトリへの権限が付かなくなります（足したあとは、管理画面にもう一度ログインし直してください）（編集者の GitHub アカウントは、できればこのサイト専用のものを使ってください。トークンは、そのアカウントがアクセスできる全リポジトリに及びます）。ローカル確認用の `.dev.vars` は `.gitignore` 済みです。GitHub との通信に失敗したとき（10秒で打ち切り）や、Worker 内で想定外のエラーが起きたときも、日本語のエラーを出します（`/api/auth`・`/api/callback` は GET のみ受け付けます）
- ローカル確認: `npm install` → `npm start`（http://localhost:8080）
- 管理画面の項目を増やす/変えるときは `src/admin/config.yml` と対応する JSON・テンプレートを両方直します
- 管理画面は「保存＝公開」のシンプルな流れです（`publish_mode: simple`）。「保存」で `main` に直接コミットされ、Cloudflare が自動でビルド・公開します。下書き／レビュー用のブランチやプルリクエストは作られません
- 編集する人の GitHub アカウントには、リポジトリへの書き込み権限（Write）が必要です
- 入力ミスの自動補正：`src/admin/normalize.js`（Decap CMS の `preSave` イベント）が、保存時に電話・FAX・郵便番号の全角数字・全角ハイフン・空白を半角に直し、URL の全角英数字と空白も直します。`config.yml` の入力チェック（`pattern`）は、補正前の全角も通すようにしてあります。補正する項目を増やすときは、`normalize.js` の `RULES`（ファイル名 → 項目名）に足し、`pattern` も合わせて直します
- サイト内リンクは、拡張子なしの `/shinchiku` 形式にそろえています（Cloudflare が `/shinchiku.html` を `/shinchiku` に転送するため、`.html` 付きだと毎回転送が入ります）。トップは `/`。ルート相対（`/` から始まる）にしてあるのは、`404.html` がどの深さのURLでも表示されるためです。CMS で入れたリンクに古い `xxx.html` があっても、`eleventy.config.js` の `internal` フィルタが自動で直します。ローカル確認（`npm start`）で `/shinchiku` が開かないときは、`/shinchiku.html` を開いてください
- 404ページ：`src/404.njk` と `src/_data/cms/notfound.json`（管理画面の「🚧 ページが見つからないとき」）。`wrangler.jsonc` の `assets.not_found_handling = "404-page"` で、存在しないURLには、このページが404の状態で返ります（`noindex`、sitemap には載せません）
- プライバシーポリシー：`src/privacy.njk` と `src/_data/cms/privacy.json`。フッターとフォームの注記からリンクしています。文面は一般的な書き方です。サイトにアクセス解析などを入れたときは、「Cookie・アクセス解析」の段落を書き直してください
- 下層ページのヒーロー写真：CSS の背景ではなく、`src/_includes/phero.njk` の `{% img %}`（`<picture>`・`fetchpriority="high"`）です。`<head>` で `preloadimg` により先読みします。`sizes` を変えるときは、`base.njk` の `preloadimg` と `phero.njk` の両方を同じ値にしてください（ずれると、先読みした画像が使われず二重に読み込まれます）。写真の上の暗い膜は、`style.css` の `.phero::after` です
- 相談内容の選択肢：`src/_data/topics.json`（`key` と `label`）が元です。フォームの選択肢（`data-key`）と、リンクの `?topic=キー` は、このキーでつながります。表示名（`label`）を直してもリンクは壊れません。送信される値は、これまでどおり表示名です。選択肢を増やすときは、`topics.json` に1行足します。古い `?topic=リフォーム` のような形も、`main.js` が受け付けます
- 迷惑送信（ボット）対策：フォームに、人には見えない欄（`hp_note`）を置いています。何か入っていたら、`main.js` が送信せず `/thanks` に移動します。空のときは、その欄を送信しないので、届くメールには出ません。**ブラウザを通さずフォームの送信先へ直接送ってくるボットには効きません**。それも防ぐには、送信を Worker 経由にして Cloudflare Turnstile で確認する構成が必要です（ssgform 側に迷惑送信対策の設定があれば、あわせて使ってください）
- 構造化データ：`site.json` の `legal_name`（正式な会社名）・`founding_year`（創業年）・`area_served`（対応エリア）と、`address`（都道府県／市区町村／番地に自動で分けます）から作ります。住所の分け方が合わないときは、番地欄に住所全体を出します。営業時間・緯度経度などは未設定です（必要なら `eleventy.config.js` の `ld` に足します）
- 検索・SNS共有：`site.json` の `site_url` から、各ページの `canonical` / `og:url` / `og:image`（そのページのヒーロー画像の JPEG 版。LINE・Facebook は AVIF を表示できないため）、構造化データの `url` / `image` / パンくずの絶対URL、`/sitemap.xml`、`/robots.txt` を出力します。URL は Cloudflare の仕様に合わせて `.html` なしです（`/shinchiku`）。ページを増やしたら `src/sitemap.njk` の一覧にも足します。`site_url` を空にすると、これらは出力されません（構造化データは従来の表記に戻ります）
- 触ると壊れる項目（例：お問い合わせフォームの送信先 `form_action`）は `widget: "hidden"` にして管理画面から隠しています。値は JSON にそのまま残ります。変更するときは `src/_data/cms/site.json` を直接編集します
- Decap CMS のバージョンは `src/admin/index.html` で `3.8.4` に固定しています。上げるときは、数字を書き換えて、保存→公開まで一通り試してから本番に入れてください
- Decap CMS の `<script>` には SRI（`integrity`）を付けています（CDN が改ざんされても、ハッシュが違えばブラウザが実行を拒否します）。バージョンを上げたら、URL を書き換えたあとに `npm run sri` で integrity を更新します（`npm run sri -- --check` で、いまの値が CDN の実ファイルと一致するか確認だけもできます）。未設定のままビルドすると止まります
- セキュリティヘッダーは `src/_headers.njk`（出力は `_headers`）で付けます。`/*`（サイト全体）：CSP（自分自身・Google Fonts・Google マップ・お問い合わせフォームの送信先 `form_action` の origin だけを許可。`<head>` のインラインスクリプトは、ビルド時に計算したハッシュで許可）、`X-Frame-Options: DENY`、`nosniff`、`Referrer-Policy`、`Permissions-Policy`、HSTS。`/admin/*`：管理画面用に、`unpkg.com` の固定バージョンのフォルダ（`index.html` の `decap-cms@x.y.z` から自動で決まります）と `api.github.com` だけを許可した別の CSP（同じヘッダーが重なると連結されるため、先に `! ヘッダー名` で取り消してから付け直しています）。表示が崩れる／動かないときは、開発者ツールの Console の `Refused to ...` を見て、足りない読み込み元だけを CSP に足します。`/api/*` のヘッダーは `worker/index.js` で付けています（ログイン完了ページは nonce 付きの CSP）
- デプロイ後の確認: `curl -sI https://（サイト）/ | grep -i -E "content-security|x-frame|nosniff"`、`curl -sI https://（サイト）/admin/` で、`Content-Security-Policy` が1本だけで `unpkg.com/decap-cms@…/` を含むこと。管理画面が開かない／ログイン後に真っ白のときは、Console の `Refused to load the script` を見てください。あわせて、お問い合わせフォームの送信・地図の表示・管理画面のログインを一度試します
- `npm run build` は最初に `scripts/sri.js --build` を実行します。integrity が未設定／CDN の実ファイルと不一致ならビルドを止め、CDN に接続できないときだけ警告で続けます
- 管理画面の各項目の説明（`hint`）の末尾に「▶ 反映先：…」を入れ、サイトのどの部分に出る項目かが分かるようにしています。項目を足したり、テンプレートの表示場所を変えたりしたときは、`config.yml` の `hint` も合わせて直します
- ビルドに使うパッケージは `package.json` で、バージョンを固定しています（`^` なし）。更新するときは `npm install パッケージ名@バージョン` で上げ、`package-lock.json` も一緒に保存します

- 自動チェック: `.github/workflows/security.yml` が、PR・main への push・毎週月曜に、依存関係の監査（`npm run audit`）・ビルド・ヘッダー検査（`npm run headers:check`）・SRI 検査を実行します。`.github/dependabot.yml` が、依存パッケージの更新を毎週 Pull Request で知らせます。CI の `npm ci` は `--ignore-scripts` で、インストール時のスクリプトを実行しません
- 内容の検査: `scripts/validate-content.js`（`npm run validate`）が、`src/_data/cms/*.json` を `src/admin/config.yml`（項目の定義）とテンプレートに照らして検査します。`npm run build` の最初と CI で自動実行されます。型の違い・枚数制限（`min`/`max`）の違反・`https://` 以外のアドレス（`javascript:` など）・壊れた JSON は **エラーでビルドを止め**（前回公開したサイトはそのまま残ります）、項目の欠落・存在しない写真・空の `alt`・書式が怪しい電話番号は警告だけ出します。管理画面の項目を足したら、`config.yml` に書けば検査の対象になります
- 営業時間・定休日：`site.json` の `hours_open` / `hours_close`（`8:30` の形。全角で入れても保存時に半角へ直ります）、`closed_days`（曜日の選択。`Monday`〜`Sunday`）、`holiday_extra`（祝日・年末年始などの自由記入）。**開始と終了の両方が入っているときだけ**、フッター・トップ下部の連絡先（とフォームの注記）・会社概要に出ます（フィルター `openhours` / `closeddays`）。検索エンジン向けには、トップの構造化データに `openingHoursSpecification`（定休日の曜日を除いた曜日ぶん）を出します。祝日・年末年始は反映しません。値は未入力で渡してあるので、管理画面「会社の基本情報」から入れるまで、何も表示されません（`npm run validate` が、未設定のあいだ警告を出します）
- 会社概要の信頼情報（代表者・建設業許可番号・資本金・従業員数・加盟団体など）は、コードを変えずに、管理画面「会社概要ページ」の「表に項目を追加する」（`extra_rows`）に入れます
- サイトの死活確認：`scripts/health-check.js`（`npm run health` ／引数で別のアドレスも確認できます）。主要ページの表示・フォームの送信先・canonical と `site_url` の一致・404・sitemap.xml・robots.txt・`/admin/` を確かめ、問題があれば終了コード1で失敗します。`.github/workflows/health.yml` が毎日実行し、失敗すると GitHub から通知メールが届きます（一瞬の通信エラーは、1分後に1回だけやり直します）。フォームの「実際の送信」までは確かめません
- フォームのテスト送信のお知らせ：`.github/workflows/form-test-reminder.yml` が、毎月1日に、チェックリスト（`.github/form-test-checklist.md`）つきの Issue を作ります（リポジトリの持ち主が担当になります）。Issues を無効にしているリポジトリでは動きません。公開（Public）のリポジトリでは、60日間リポジトリに動きがないと、定期実行が自動で止まります
- 独自ドメインへの切り替え：`npm run set-domain -- https://新しいドメイン`（`--dry-run` で、書き換えずに確認だけ）。`site.json` の `site_url` と `config.yml` の4か所を書き換え、人の手で行う残りの作業（Cloudflare・OAuthアプリ・ssgform・Search Console）を表示します。手順の全体は `公開後チェックリスト.md`

---

## おまけ：お問い合わせ送信後の「お礼ページ」（任意）

このサイトには、送信完了ページ（`/thanks`）が入っています。表示するには、フォームのサービス（ssgform）の設定で、
「送信後に表示するページ（リダイレクト先）」の欄に `https://（サイトのアドレス）/thanks` を入れてください。
設定しない場合は、これまでどおり、フォームサービス側の完了画面が出ます。文章は、管理画面の「💌 送信完了ページ」で直せます。

## 管理画面のプレビューについて

トップページ（①〜⑤）と送信完了ページは、管理画面の右側にプレビューが出ます（`src/admin/preview.js` と `preview.css`）。
プレビューが崩れても、編集と公開には影響しません。トップページに項目を足したときは、`preview.js` の該当の関数にも足してください。
プレビューで Google Fonts を読むため、管理画面の CSP（`src/_headers.njk`）に `fonts.googleapis.com` / `fonts.gstatic.com` を許可しています。
