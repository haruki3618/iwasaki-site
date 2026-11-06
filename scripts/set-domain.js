#!/usr/bin/env node
// 独自ドメインに切り替えるとき、サイト内の「公開アドレス」をまとめて書き換える。
//   node scripts/set-domain.js https://新しいドメイン          （書き換える）
//   node scripts/set-domain.js https://新しいドメイン --dry-run （書き換えずに、何が変わるかだけ表示）
//
// 書き換える場所：src/_data/cms/site.json の site_url、src/admin/config.yml の base_url / logo_url / site_url / display_url
// 書き換えない場所（人の手で）：GitHub の OAuth アプリ、Cloudflare のドメイン設定、フォーム側の設定 → 終了時に一覧を表示します

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const raw = args.find((a) => !a.startsWith("--"));

if (!raw) {
  console.error("使い方: node scripts/set-domain.js https://新しいドメイン [--dry-run]");
  process.exit(1);
}
let next;
try {
  const u = new URL(raw.trim());
  if (u.protocol !== "https:") throw new Error("https:// で始まるアドレスにしてください");
  if (u.pathname !== "/" || u.search || u.hash) throw new Error("ドメインだけを指定してください（/ のあとの文字や ? # は不要です）");
  if (u.username || u.password || u.port) throw new Error("ユーザー名・パスワード・ポート番号は付けないでください");
  next = u.origin; // 小文字・末尾スラッシュなしにそろう
} catch (e) {
  console.error("アドレスが正しくありません: " + (e.message || e));
  process.exit(1);
}

const sitePath = path.join(ROOT, "src", "_data", "cms", "site.json");
const cfgPath = path.join(ROOT, "src", "admin", "config.yml");
const siteText = fs.readFileSync(sitePath, "utf8");
const site = JSON.parse(siteText);
const prev = String(site.site_url || "").replace(/\/+$/, "");

if (prev === next) {
  console.log(`すでに ${next} になっています。変更はありません。`);
  process.exit(0);
}

// site.json：site_url の値だけを差し替える（ほかの行の並び・書式はそのまま）
if (!/"site_url"\s*:\s*"[^"]*"/.test(siteText)) {
  console.error("site.json に site_url の行が見つかりません。");
  process.exit(1);
}
const siteNew = siteText.replace(/("site_url"\s*:\s*)"[^"]*"/, `$1"${next}"`);

// config.yml：旧アドレスをすべて新アドレスに（旧が空・未設定のときは、キーごとに設定）
let cfg = fs.readFileSync(cfgPath, "utf8");
let cfgCount = 0;
if (prev) {
  cfg = cfg.split(prev).join(next);
  cfgCount = (fs.readFileSync(cfgPath, "utf8").split(prev).length - 1);
}
// 旧アドレスで見つからなかった（手で別の値にしていた）キーも、新しい値にそろえる
const KEYS = { base_url: next, logo_url: next + "/images/icon.avif", site_url: next, display_url: next };
for (const [k, v] of Object.entries(KEYS)) {
  const re = new RegExp(`^(\\s*${k}:\\s*)\\S+\\s*$`, "m");
  if (re.test(cfg)) {
    const before = cfg;
    cfg = cfg.replace(re, `$1${v}`);
    if (before !== cfg) cfgCount++;
  } else console.warn(`[警告] config.yml に ${k}: の行が見つかりません（手で確認してください）`);
}
if (/YOUR-SITE|YOUR_GITHUB/.test(cfg)) console.warn("[警告] config.yml に、書き換え前の仮の値（YOUR-SITE など）が残っています");

console.log(`${dry ? "【確認だけ・書き換えません】" : ""}公開アドレス: ${prev || "（未設定）"} → ${next}`);
console.log(` ・src/_data/cms/site.json  site_url`);
console.log(` ・src/admin/config.yml     base_url / logo_url / site_url / display_url（${cfgCount} か所）`);

if (!dry) {
  fs.writeFileSync(sitePath, siteNew);
  fs.writeFileSync(cfgPath, cfg);
}

const host = new URL(next).host;
console.log(`
この先は、人の手で行います（順番どおり）:
  1. Cloudflare：サイトの「Settings」→「Domains & Routes」→ ${host} を追加し、証明書（HTTPS）が有効になるのを待つ
  2. GitHub の OAuth アプリ（管理画面のログイン用）：
       Homepage URL                 → ${next}
       Authorization callback URL   → ${next}/api/callback
     ※ これを直さないと、新しいアドレスの /admin/ にログインできません
  3. フォームのサービス（ssgform）の「送信後に表示するページ」を使っているときは → ${next}/thanks
  4. この変更を GitHub に保存（commit）→ 自動で公開される（数分）
  5. 確認：  npm run health -- ${next}
  6. Google Search Console に ${next} を登録し、sitemap.xml を送信 → 詳しくは「公開後チェックリスト.md」
`);
