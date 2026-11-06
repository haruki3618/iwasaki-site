#!/usr/bin/env node
// 管理画面で編集される内容（src/_data/cms/*.json）を、管理画面の定義（src/admin/config.yml）と
// テンプレート（src/*.njk）に照らして検査する。`npm run validate`。ビルドの最初にも実行される。
//
//   エラー（ビルドを止める）… 型の違い（文字列のはずが配列、など）／枚数の制限（min・max）の違反／
//                              http(s) 以外のアドレス（javascript: など）／JSON が壊れている
//   警告（表示だけ）          … 項目の欠落／存在しない画像／alt（写真の説明）が空／書式が怪しい電話番号・郵便番号／
//                              テンプレートが使っているのに JSON にない項目
//   ビルドを止めるのは「そのまま公開すると表示が壊れる」ものだけです。止まった場合、前回公開したサイトはそのまま残ります。

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const errors = [];
const warns = [];
const err = (w, m) => errors.push(`${w}: ${m}`);
const warn = (w, m) => warns.push(`${w}: ${m}`);

const config = yaml.load(fs.readFileSync(path.join(SRC, "admin", "config.yml"), "utf8"));
const files = (config.collections || []).flatMap((c) => c.files || []);

const kind = (v) => (Array.isArray(v) ? "配列" : v === null ? "null" : typeof v === "object" ? "オブジェクト" : typeof v === "string" ? "文字列" : typeof v === "boolean" ? "真偽値" : typeof v === "number" ? "数値" : typeof v);
const STR = new Set(["string", "text", "image", "markdown", "select"]);
const unsafeUrl = (v) => /^\s*(javascript|data|vbscript):/i.test(v);
const imgExists = (p) => {
  const rel = p.replace(/^\//, "");
  if (fs.existsSync(path.join(SRC, rel))) return true;
  // JPG/PNG などは公開時に .avif になる。元ファイル側（同じ名前の別拡張子）があれば OK
  const stem = path.join(SRC, rel.replace(/\.[a-z0-9]+$/i, ""));
  return ["jpg", "jpeg", "png", "webp", "gif", "tif", "tiff", "avif"].some((e) => fs.existsSync(`${stem}.${e}`));
};

function check(value, f, where) {
  const w = where;
  if (f.widget === "list") {
    if (!Array.isArray(value)) return err(w, `リストのはずが${kind(value)}です`);
    if (f.min != null && value.length < f.min) err(w, `${f.min}件以上必要です（いま${value.length}件）`);
    if (f.max != null && value.length > f.max) err(w, `${f.max}件までです（いま${value.length}件）`);
    value.forEach((item, i) => {
      const at = `${w}[${i + 1}]`;
      if (f.field) return check(item, f.field, at);
      if (!item || typeof item !== "object" || Array.isArray(item)) return err(at, `項目のまとまりのはずが${kind(item)}です`);
      for (const sub of f.fields || []) {
        if (!(sub.name in item)) warn(at, `「${sub.name}」がありません`);
        else check(item[sub.name], sub, `${at}.${sub.name}`);
      }
      if (typeof item.image === "string" && item.image && "alt" in item && !String(item.alt).trim()) warn(at, "写真があるのに「写真の説明（alt）」が空です");
    });
    return;
  }
  // hidden は管理画面に出ない項目。文字列でも真偽値でも数値でもよい（配列・オブジェクトは不可）
  if (f.widget === "hidden") return value !== null && typeof value !== "object" ? undefined : err(w, `${kind(value)}は使えません`);
  if (f.widget === "boolean") return typeof value === "boolean" || err(w, `真偽値のはずが${kind(value)}です`);
  if (f.widget === "number") return typeof value === "number" || err(w, `数値のはずが${kind(value)}です`);
  if (f.widget === "object") {
    if (!value || typeof value !== "object") return err(w, `オブジェクトのはずが${kind(value)}です`);
    for (const sub of f.fields || []) if (sub.name in value) check(value[sub.name], sub, `${w}.${sub.name}`);
    return;
  }
  // 選択式（複数選べる）は文字列の配列
  if (f.widget === "select" && f.multiple) {
    if (!Array.isArray(value)) return err(w, `選択式（複数）のはずが${kind(value)}です`);
    const ok = new Set((f.options || []).map((o) => (typeof o === "string" ? o : o.value)));
    value.forEach((v) => {
      if (typeof v !== "string") err(w, `選択肢は文字列のはずが${kind(v)}です`);
      else if (ok.size && !ok.has(v)) warn(w, `選択肢にない値です（${v}）`);
    });
    return;
  }
  if (STR.has(f.widget)) {
    if (typeof value !== "string") return err(w, `文字列のはずが${kind(value)}です`);
    if (/(^|_)(link|url|action|go)$/.test(f.name) && unsafeUrl(value)) err(w, `使えないアドレスです（${value.slice(0, 30)}）`);
    if (f.widget === "image" && value && !imgExists(value)) warn(w, `写真ファイルが見つかりません（${value}）`);
  }
}

const data = {};
for (const file of files) {
  const rel = file.file;
  const w = path.basename(rel);
  let j;
  try {
    j = JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  } catch (e) {
    err(w, `JSON を読めません（${e.message}）`);
    continue;
  }
  data[file.name] = j;
  for (const f of file.fields || []) {
    if (!(f.name in j)) { warn(w, `「${f.name}」がありません`); continue; }
    check(j[f.name], f, `${w} ${f.name}`);
  }
}

// トップページは home.json と home_*.json に分かれている（テンプレートでは1つにまとめて使う）
if (data.home) for (const n of Object.keys(data)) if (/^home_/.test(n)) data.home = Object.assign({}, data.home, data[n]);

// 書式の確認（site.json）
const site = data.site;
if (site) {
  for (const k of ["instagram", "inos_url", "form_action", "site_url"]) {
    const v = site[k];
    if (v && !/^https:\/\/[^\s]+$/.test(v)) err(`site.json ${k}`, `https:// で始まるアドレスにしてください（${v}）`);
  }
  if (site.zip && !/^\d{3}-?\d{4}$/.test(site.zip)) warn("site.json zip", `郵便番号の書式が違うようです（${site.zip}）`);
  for (const k of ["tel1", "fax1", "tel2", "fax2"]) {
    if (site[k] && !/^0\d{1,4}-\d{1,4}-\d{4}$/.test(site[k])) warn(`site.json ${k}`, `電話番号の書式が違うようです（${site[k]}）。例：0766-74-2679`);
  }
  if (!String(site.name || "").trim()) err("site.json name", "会社名が空です");
  // 営業時間・定休日（未入力でもビルドは止めない。入力を促すだけ）
  const half = (v) => String(v || "").replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/：/g, ":").replace(/[\s\u3000]/g, "");
  const ho = half(site.hours_open), hc = half(site.hours_close);
  const T = /^\d{1,2}:\d{2}$/;
  const days = Array.isArray(site.closed_days) ? site.closed_days : [];
  if (!ho && !hc && !days.length && !String(site.holiday_extra || "").trim()) {
    warn("site.json 営業時間", "営業時間・定休日が未設定です（管理画面「会社の基本情報」で入力すると、フッター・連絡先・会社概要・検索エンジン向けの情報に出ます）");
  } else if (!!ho !== !!hc) {
    warn("site.json 営業時間", "営業時間は「開始」と「終了」の両方が必要です（片方だけだと表示されません）");
  } else if (ho && hc && (!T.test(ho) || !T.test(hc))) {
    warn("site.json 営業時間", `時刻の書式が違うようです（${site.hours_open} 〜 ${site.hours_close}）。例：8:30`);
  }
  if (days.length >= 7) warn("site.json closed_days", "7曜日すべてが定休日になっています。検索エンジン向けの営業時間は出力されません");
}
if (data.company && Array.isArray(data.company.extra_rows) && data.company.extra_rows.length === 0) {
  warn("company.json extra_rows", "会社概要の「表に項目を追加する」が0件です。代表者・建設業許可番号・加盟団体など、信頼につながる情報を入れてください");
}
for (const [name, j] of Object.entries(data)) {
  if (name === "site") continue;
  for (const k of ["seo_title", "seo_description"]) if (k in j && !String(j[k]).trim()) warn(`${name}.json ${k}`, "検索結果に出る文章が空です");
}

// テンプレートが使っている項目が、JSON にあるか
const siteKeys = new Set(Object.keys(data.site || {}));
const allKeys = new Set(Object.values(data).flatMap((j) => Object.keys(j)));
const njk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === "admin" || e.name === "images" ? [] : njk(path.join(dir, e.name))) : e.name.endsWith(".njk") ? [path.join(dir, e.name)] : []));
for (const t of njk(SRC)) {
  const text = fs.readFileSync(t, "utf8");
  const name = path.relative(SRC, t);
  const bound = (text.match(/set d = cms\.(\w+)/) || [])[1];
  const uses = (v) => [...text.matchAll(new RegExp(`(?<![\\w.])${v}\\.([A-Za-z_]\\w*)`, "g"))].map((m) => m[1]);
  for (const k of new Set(uses("s"))) if (data.site && !siteKeys.has(k)) warn(name, `テンプレートが s.${k} を使っていますが site.json にありません`);
  const dk = bound ? new Set(Object.keys(data[bound] || {})) : allKeys;
  for (const k of new Set(uses("d"))) if (Object.keys(data).length && !dk.has(k) && !["length"].includes(k)) warn(name, `テンプレートが d.${k} を使っていますが ${bound ? bound + ".json" : "どの JSON"} にもありません`);
}

for (const m of warns) console.warn(`[警告] ${m}`);
if (errors.length) {
  console.error(`\n内容の検査で ${errors.length} 件のエラーがありました（公開すると表示が壊れる可能性があります）:\n` + errors.map((m) => ` ✗ ${m}`).join("\n"));
  process.exit(1);
}
console.log(`内容の検査 OK（${Object.keys(data).length} ファイル、警告 ${warns.length} 件）`);
