# イワサキ住建 / ハウジングひみ　サイト（編集画面つき）

文章と写真を、管理画面（`/admin`）から素人でも編集できるサイトです。**月額0円**（GitHub + Cloudflare）で運用できます。
デザインは元のサイトと同じです（画面を並べて比較し、一致を確認済み）。

- 編集のしかた → `編集マニュアル.md`（編集する人に渡してください）
- このファイル → 最初に1回だけ行う「公開の準備」の手順です

---

## しくみ（ざっくり）

```
管理画面で文章・写真を編集 →「公開する」 → GitHub に保存 → Cloudflare が自動でサイトを作り直す → 数分で反映
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

### 5. 編集する人を招待する
1. GitHub のリポジトリ →「Settings」→「Collaborators」→「Add people」
2. 編集する人の GitHub アカウントを追加（権限は Write）
3. 相手が届いた招待メールを承認すれば完了

### 6. 動作確認
`https://（サイトのアドレス）/admin/` を開き、「GitHubでログイン」→ ページを選んで文章を1か所変えて「公開する」→ 数分後にサイトに反映されれば成功です。

---

## 独自ドメイン（任意）
Cloudflare の「Settings」→「Domains & Routes」から設定できます（ドメイン代は別途）。設定したら、手順3のOAuthアプリのURL2か所と `config.yml` のアドレスも新しいドメインに変えてください。

## 管理画面で変えられないもの
メニューの名前、ボタンの文言の一部、ページのレイアウトは固定です（崩れ防止のため）。変えたい場合は制作者に依頼してください。

## 技術メモ（制作者向け）
- Eleventy（静的サイトジェネレーター）+ Decap CMS。内容は `src/_data/cms/*.json`、見た目は `src/*.njk` と `src/style.css`
- 写真は `src/images`。JPG/PNG/WebP でアップロードしても、ビルド時に幅1600px以内のAVIFへ自動変換されます
- ログイン用の処理は `worker/index.js`（Cloudflare Workers）、設定は `wrangler.jsonc`
- ローカル確認: `npm install` → `npm start`（http://localhost:8080）
- 管理画面の項目を増やす/変えるときは `src/admin/config.yml` と対応する JSON・テンプレートを両方直します
