#!/usr/bin/env node
// Decap CMS の <script> に SRI（integrity）を付ける／検証する道具。
//
//   npm run sri          … src/admin/index.html の Decap CMS の <script> に integrity を書き込む
//   npm run sri -- --check … いま書かれている integrity が、CDN上の実ファイルと一致するか確かめる（書き換えない）
//   npm run build          … ビルドの最初に `--build` を実行する（下記）
//
//   --build の動き（ビルドに組み込み済み）:
//     ・integrity が未設定 / CDN の実ファイルと不一致 → ビルドを止める（壊れた管理画面や、改ざんされたファイルを公開しないため）
//     ・CDN に接続できず確かめられない                → 警告だけ出してビルドは続ける（CDN の一時的な不調で、編集内容の公開まで止めないため）
//
// CDN からファイルを取得して SHA-384 を計算します（Node 20 以上・ネットワーク接続が必要）。
// 計算した値は index.html に書いてコミットします。以後ブラウザは、CDN のファイルが
// この値と違っていたら（＝改ざんされていたら）実行を拒否します。
// バージョンを上げたときは、URL を書き換えたあとに必ずもう一度実行してください。

const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const FILE = path.join(__dirname, "..", "src", "admin", "index.html");
const TAG = /<script\b[^>]*\bsrc="(https:\/\/unpkg\.com\/decap-cms@\d+\.\d+\.\d+\/[^"]+)"[^>]*>\s*<\/script>/;

function sri(buf) {
  return "sha384-" + crypto.createHash("sha384").update(buf).digest("base64");
}

function build(url, integrity) {
  return `<script src="${url}" integrity="${integrity}" crossorigin="anonymous"></script>`;
}

async function fetchBuf(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`取得に失敗しました: ${url}（HTTP ${res.status}）`);
  return Buffer.from(await res.arrayBuffer());
}

async function main(argv) {
  const isBuild = argv.includes("--build");
  const check = argv.includes("--check") || isBuild;
  const html = fs.readFileSync(FILE, "utf8");
  const m = html.match(TAG);
  if (!m) throw new Error("src/admin/index.html に、バージョン固定（decap-cms@x.y.z）の unpkg の <script> が見つかりません");

  const url = m[1];
  const current = (m[0].match(/\bintegrity="([^"]+)"/) || [])[1];
  if (isBuild && !current) throw new Error("integrity が未設定です。`npm run sri` を実行して、index.html の変更をコミットしてください");
  let actual;
  try {
    actual = sri(await fetchBuf(url));
  } catch (e) {
    if (!isBuild) throw e;
    console.warn(`[警告] SRI を確かめられませんでした（${e.message}）。integrity の書式だけ確認してビルドを続けます`);
    if (!/^sha384-[A-Za-z0-9+/]{64}$/.test(current)) throw new Error(`integrity の書式が正しくありません: ${current}`);
    return;
  }

  if (check) {
    if (!current) throw new Error("integrity が未設定です。`npm run sri` を実行してください");
    if (current !== actual) throw new Error(`integrity が一致しません\n  書かれている値: ${current}\n  実ファイルの値: ${actual}`);
    console.log(`SRI OK: ${url}\n    ${actual}`);
    return;
  }

  fs.writeFileSync(FILE, html.replace(m[0], build(url, actual)));
  console.log(`${current ? "更新" : "追加"}しました: ${url}\n    ${actual}\n内容を確認して、管理画面で動作確認 → コミットしてください`);
}

module.exports = { sri, build, TAG };

if (require.main === module) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
