#!/usr/bin/env node
// 公開中のサイトが「ちゃんと動いているか」を確かめる。`npm run health`（毎日 GitHub Actions でも自動実行）
//
//   確かめること：主要ページが表示できる／トップに問い合わせフォーム（送信先つき）がある／
//                 canonical が site_url と一致している（独自ドメインへ移したあとの直し忘れ防止）／
//                 存在しないURLが 404 になる／sitemap.xml・robots.txt・管理画面が開く
//   確かめないこと：フォームの「実際の送信」（テスト送信は、月1回、人の手で行います → 公開後チェックリスト.md）
//
//   失敗すると終了コード 1 になり、GitHub Actions では失敗として知らせます。
//   使い方: node scripts/health-check.js [https://確認したいアドレス]   （省略時は site.json の site_url）

const fs = require("fs");
const path = require("path");

const site = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "_data", "cms", "site.json"), "utf8"));
const base = String(process.argv[2] || site.site_url || "").replace(/\/+$/, "");
if (!/^https:\/\/[^\s/]+$/.test(base)) {
  console.error("確認するサイトのアドレスがありません。site.json の site_url（https://〜）を設定するか、引数で渡してください。");
  process.exit(1);
}

const failures = [];
const ng = (m) => { failures.push(m); console.error(` ✗ ${m}`); };
const ok = (m) => console.log(` ✓ ${m}`);

async function get(p, opts = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(base + p, { redirect: "follow", signal: ctl.signal, headers: { "user-agent": "iwasaki-site-health-check" }, ...opts });
    return { status: res.status, text: await res.text(), url: res.url };
  } catch (e) {
    return { status: 0, text: "", error: e.name === "AbortError" ? "20秒たっても応答がありません" : String(e.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  console.log(`サイトの確認: ${base}`);

  // 主要ページ
  const pages = ["/", "/shinchiku", "/reform", "/services", "/company", "/staff", "/privacy", "/thanks"];
  const got = {};
  for (const p of pages) {
    const r = (got[p] = await get(p));
    if (r.status === 200) ok(`${p} が表示できる`);
    else ng(`${p} が表示できません（${r.error || "HTTP " + r.status}）`);
  }

  // トップ：フォーム・canonical
  const home = got["/"];
  if (home.status === 200) {
    const action = String(site.form_action || "");
    if (!/id="cform"/.test(home.text)) ng("トップページに問い合わせフォーム（id=\"cform\"）がありません");
    else if (!action || !home.text.includes(`action="${action}"`)) ng(`フォームの送信先が site.json の form_action と一致しません（${action || "未設定"}）`);
    else ok("問い合わせフォームがあり、送信先も正しい");
    if (!/name="hp_note"/.test(home.text)) ng("迷惑送信対策の欄（hp_note）がフォームにありません");
    const canon = (home.text.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
    if (!canon) ng("canonical がありません（site.json の site_url が空？）");
    else if (canon !== base + "/") ng(`canonical（${canon}）が、いま確認しているアドレス（${base}/）と違います。独自ドメインに移したときは、site_url を直してください（npm run set-domain）`);
    else ok("canonical が正しい");
  }

  // 存在しないURLは 404
  const nf = await get("/ここにページはありません-health-check");
  if (nf.status === 404) ok("存在しないURLは 404 になる");
  else ng(`存在しないURLが 404 になりません（${nf.error || "HTTP " + nf.status}）`);

  // sitemap / robots / 管理画面
  const sm = await get("/sitemap.xml");
  if (sm.status === 200 && sm.text.includes("<loc>" + base + "/</loc>")) ok("sitemap.xml が正しい");
  else ng(`sitemap.xml が正しくありません（${sm.error || "HTTP " + sm.status}。<loc> は ${base}/ で始まる必要があります）`);
  const rb = await get("/robots.txt");
  if (rb.status === 200 && rb.text.includes("Sitemap: " + base + "/sitemap.xml")) ok("robots.txt が正しい");
  else ng(`robots.txt が正しくありません（${rb.error || "HTTP " + rb.status}）`);
  const ad = await get("/admin/");
  if (ad.status === 200) ok("管理画面（/admin/）が開く");
  else ng(`管理画面（/admin/）が開きません（${ad.error || "HTTP " + ad.status}）`);

  if (failures.length) {
    console.error(`\n確認の結果：${failures.length} 件の問題があります。`);
    process.exit(1);
  }
  console.log("\n確認の結果：問題ありません。");
})();
