#!/usr/bin/env node
// ビルド後の _site/_headers を検査する（`npm run headers:check`）。
// ・/* に必要なセキュリティヘッダーが揃っているか、CSP が危険な指定を含んでいないか
// ・/admin/* で付け直すヘッダーを、「! 名前」で取り消し忘れていないか
//   （取り消さないと Cloudflare は値を連結してしまい、CSP などが意図せず二重になる）
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "_site", "_headers");
if (!fs.existsSync(FILE)) {
  console.error("_site/_headers がありません。先に `npx eleventy` でビルドしてください");
  process.exit(1);
}

// 「/パス」の行ごとにブロックへ分ける
const blocks = {};
let cur = null;
for (const raw of fs.readFileSync(FILE, "utf8").split(/\r?\n/)) {
  if (!raw.trim() || raw.trim().startsWith("#")) continue;
  if (!/^\s/.test(raw)) { cur = blocks[raw.trim()] = []; continue; }
  if (cur) cur.push(raw.trim());
}

const errors = [];
const all = blocks["/*"];
const admin = blocks["/admin/*"];
if (!all) errors.push("/* のブロックがありません");
if (!admin) errors.push("/admin/* のブロックがありません");

if (all && admin) {
  const names = (lines) => lines.filter((l) => !l.startsWith("!")).map((l) => l.split(":")[0].trim().toLowerCase());
  const cancelled = admin.filter((l) => l.startsWith("!")).map((l) => l.slice(1).trim().toLowerCase());
  const val = (lines, n) => (lines.find((l) => l.toLowerCase().startsWith(n.toLowerCase() + ":")) || "").split(/:(.*)/s)[1]?.trim() || "";

  for (const n of ["x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy", "strict-transport-security", "content-security-policy"]) {
    if (!names(all).includes(n)) errors.push(`/* に ${n} がありません`);
  }
  // /admin/* で付け直すヘッダーは、先に取り消さないと /* の値と連結される
  for (const n of names(admin)) {
    if (names(all).includes(n) && !cancelled.includes(n)) errors.push(`/admin/* で「! ${n}」の取り消しがありません（値が連結されます）`);
  }
  // COOP: same-origin のままだと、GitHub ログインのポップアップから window.opener が使えず管理画面にログインできない
  if (names(all).includes("cross-origin-opener-policy") && !cancelled.includes("cross-origin-opener-policy"))
    errors.push("/admin/* で「! cross-origin-opener-policy」を取り消していません（ログインのポップアップが動かなくなります）");
  if (!names(admin).includes("x-robots-tag")) errors.push("/admin/* に X-Robots-Tag: noindex がありません");

  for (const [label, lines] of [["/*", all], ["/admin/*", admin]]) {
    const csp = val(lines, "content-security-policy");
    if (!csp) continue;
    const d = Object.fromEntries(csp.split(";").map((s) => s.trim()).filter(Boolean).map((s) => [s.split(/\s+/)[0], s.split(/\s+/).slice(1)]));
    // 管理画面の Decap CMS は eval を使うため、/admin/* だけは 'unsafe-eval' を許可する。公開サイト（/*）には付けない
    if (/unsafe-eval/.test(csp) && label !== "/admin/*") errors.push(`${label} の CSP に 'unsafe-eval' があります`);
    if (label === "/admin/*" && !/unsafe-eval/.test(csp)) errors.push(`${label} の CSP に 'unsafe-eval' がありません（管理画面の Decap CMS が「Error loading the CMS configuration」で開けなくなります）`);
    if ((d["script-src"] || []).some((s) => s === "*" || s === "https:" || s === "'unsafe-inline'"))
      errors.push(`${label} の CSP の script-src が広すぎます（${d["script-src"].join(" ")}）`);
    if ((d["script-src"] || []).some((s) => /^https:\/\/[^/]+\/?$/.test(s)))
      errors.push(`${label} の CSP の script-src にホスト全体の許可があります（${d["script-src"].join(" ")}）。フォルダまで絞ってください`);
    if (!(d["object-src"] || []).includes("'none'")) errors.push(`${label} の CSP に object-src 'none' がありません`);
    if (!d["frame-ancestors"]) errors.push(`${label} の CSP に frame-ancestors がありません`);
    if (!d["base-uri"]) errors.push(`${label} の CSP に base-uri がありません`);
    if (/'sha256-undefined|'sha256-'/.test(csp)) errors.push(`${label} の CSP のハッシュが空です`);
  }
}

if (errors.length) {
  console.error("ヘッダー検査に失敗しました:\n - " + errors.join("\n - "));
  process.exit(1);
}
console.log("ヘッダー検査 OK");
