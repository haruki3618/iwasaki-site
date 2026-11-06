const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { imageSize } = require("image-size");
const sharp = require("sharp");

const IMG_DIR = path.join(__dirname, "src");
const CONVERT = /\.(jpe?g|png|webp|gif|tiff?)$/i;
const RASTER = /\.(avif|jpe?g|png|webp|gif|tiff?)$/i;

// レスポンシブ画像：この幅(px)ごとに AVIF / WebP / JPEG(透過があれば PNG) を作る。元画像より大きい幅は作らない
const WIDTHS = [480, 800, 1200, 1600];
const MAX_W = 1600;
const Q = { avif: 55, webp: 78, jpg: 80 };

// <head> の先頭で実行する小さなインラインスクリプト。CSP には、この文字列のハッシュを書く（_headers.njk）
const JS_FLAG = 'document.documentElement.classList.add("js")';

// 画像のパスを「公開されるパス(.avif)」に直す。管理画面からJPG/PNGを入れても自動でAVIFになる
const toPublic = (p) => (p || "").replace(CONVERT, ".avif");

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// 公開パスから拡張子を除いたもの（"/images/foo.avif" → "/images/foo"）
const stemOf = (p) => toPublic(p).replace(/\.avif$/i, "");

// 画像の情報（幅・高さ・透過の有無）。ビルド開始時に src/images を走査して埋める。取れなければ image-size で代用
const meta = new Map();
const infoOf = (src) => {
  let m = meta.get(src);
  if (!m) {
    try {
      const d = imageSize(fs.readFileSync(path.join(IMG_DIR, src.replace(/^\//, ""))));
      m = { w: d.width, h: d.height, alpha: false };
    } catch (e) {
      return null;
    }
  }
  // 公開される幅。JPG/PNG などは 1600px までに縮小される
  const k = CONVERT.test(src) && m.w > MAX_W ? MAX_W / m.w : 1;
  return { w: Math.round(m.w * k), h: Math.round(m.h * k), alpha: m.alpha };
};
const widthsFor = (w) => WIDTHS.filter((x) => x < w).concat(w);
const fbExt = (info) => (info.alpha ? "png" : "jpg");
// 幅 w・形式 fmt の画像の公開パス。いちばん大きい AVIF だけは、元のファイル（foo.avif）をそのまま使う
const variantUrl = (stem, w, full, fmt) => (w === full && fmt === "avif" ? `${stem}.avif` : `${stem}-${w}.${fmt}`);
const srcsetOf = (stem, ws, full, fmt) =>
  ws.map((w) => `${esc(encodeURI(variantUrl(stem, w, full, fmt)))} ${w}w`).join(", ");

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
  );

// 営業時間・定休日（site.json の hours_open / hours_close / closed_days / holiday_extra）。未入力なら空文字（何も表示しない）
const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_JA = { Monday: "月曜", Tuesday: "火曜", Wednesday: "水曜", Thursday: "木曜", Friday: "金曜", Saturday: "土曜", Sunday: "日曜" };
const toHalfTime = (v) =>
  String(v ?? "")
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/：/g, ":")
    .replace(/[\s\u3000]/g, "");
// 開始・終了が両方、8:30 の形で入っているときだけ [開始, 終了] を返す
const hoursParts = (s) => {
  const a = toHalfTime(s && s.hours_open);
  const b = toHalfTime(s && s.hours_close);
  return /^\d{1,2}:\d{2}$/.test(a) && /^\d{1,2}:\d{2}$/.test(b) ? [a, b] : null;
};
const closedText = (s) => {
  const set = new Set(Array.isArray(s && s.closed_days) ? s.closed_days : []);
  const parts = DAY_ORDER.filter((d) => set.has(d)).map((d) => DAY_JA[d]);
  const extra = String((s && s.holiday_extra) || "").trim();
  return (extra ? parts.concat(extra) : parts).join("・");
};
// 検索エンジン向け：定休日の曜日を除いた曜日ぶんの営業時間（祝日などは反映しない）
const openingHoursSpec = (s) => {
  const t = hoursParts(s);
  if (!t) return null;
  const closed = new Set(Array.isArray(s.closed_days) ? s.closed_days : []);
  const days = DAY_ORDER.filter((d) => !closed.has(d));
  if (!days.length) return null;
  const pad = (v) => v.replace(/^(\d):/, "0$1:");
  return [{ "@type": "OpeningHoursSpecification", dayOfWeek: days, opens: pad(t[0]), closes: pad(t[1]) }];
};

module.exports = function (eleventyConfig) {
  eleventyConfig.addFilter("openhours", (s) => {
    const t = hoursParts(s);
    return t ? `${t[0]}〜${t[1]}` : "";
  });
  eleventyConfig.addFilter("closeddays", closedText);

  eleventyConfig.addPassthroughCopy({ "src/style.css": "style.css" });
  eleventyConfig.addPassthroughCopy({ "src/main.js": "main.js" });
  eleventyConfig.addPassthroughCopy({ "src/admin": "admin" });
  // AVIF以外(JPG/PNGなど)はコピーせず、下の after フックでAVIFに変換して出力する
  eleventyConfig.addPassthroughCopy({ "src/images": "images" }, {
    filter: (p) => !CONVERT.test(p),
  });

  // 管理画面の Decap CMS の <script> に integrity（SRI）が付いていないときは、ビルド時に知らせる
  eleventyConfig.on("eleventy.before", () => {
    try {
      const html = fs.readFileSync(path.join(__dirname, "src", "admin", "index.html"), "utf8");
      const tag = (html.match(/<script\b[^>]*decap-cms[^>]*>/) || [""])[0];
      if (!/\bintegrity="sha384-/.test(tag)) {
        console.warn("[警告] src/admin/index.html の Decap CMS に integrity（SRI）が未設定です。`npm run sri` を実行してください");
      }
    } catch (e) {
      // 確認できなくてもビルドは続ける
    }
  });

  // 画像の幅・高さ・透過の有無を調べておく（<picture> の srcset と、JPEG/PNG の選択に使う）
  eleventyConfig.on("eleventy.before", async () => {
    meta.clear();
    const root = path.join(IMG_DIR, "images");
    if (!fs.existsSync(root)) return;
    for (const f of walk(root)) {
      if (!RASTER.test(f)) continue;
      const m = await sharp(f).metadata();
      let alpha = false;
      // 透過チャンネルがあっても、実際に透けていなければ（写真など）JPEG のフォールバックでよい
      if (m.hasAlpha) alpha = !(await sharp(f).stats()).isOpaque;
      meta.set("/" + path.relative(IMG_DIR, f).split(path.sep).join("/"), { w: m.width, h: m.height, alpha });
    }
  });

  // <head> の先頭のインラインスクリプト（CSP にはこの文字列のハッシュを許可として書く）
  eleventyConfig.addShortcode("jsflag", () => `<script>${JS_FLAG}</script>`);
  // 管理画面の CSP 用：unpkg 全体ではなく、index.html で固定している Decap CMS のバージョンのフォルダだけを許可する
  //（バージョンを上げて index.html の URL を直せば、CSP も自動で追従する）
  const adminScriptSrc = () => {
    const html = fs.readFileSync(path.join(__dirname, "src", "admin", "index.html"), "utf8");
    const m = html.match(/\bsrc="(https:\/\/unpkg\.com\/decap-cms@\d+\.\d+\.\d+\/)[^"]*"/);
    if (!m) throw new Error("src/admin/index.html に、バージョン固定（decap-cms@x.y.z）の unpkg の <script> が見つかりません");
    return m[1];
  };
  eleventyConfig.addGlobalData("csp", () => ({
    jsFlagHash: `'sha256-${crypto.createHash("sha256").update(JS_FLAG).digest("base64")}'`,
    adminScriptSrc: adminScriptSrc(),
  }));
  // フォームの送信先（site.json の form_action）の origin。CSP の form-action に使う
  eleventyConfig.addFilter("origin", (u) => {
    try {
      return new URL(u).origin;
    } catch (e) {
      return "";
    }
  });

  // 相談内容（src/_data/topics.json）：キー（shinchiku など）でも、表示名（リフォーム など）でも、キーに直す。見つからなければ空文字
  //   リンクの ?topic=キー と、フォームの選択肢の data-key をつなぐ。表示名を直しても、リンクは壊れない
  const TOPICS = JSON.parse(fs.readFileSync(path.join(__dirname, "src", "_data", "topics.json"), "utf8"));
  eleventyConfig.addFilter("topickey", (v) => {
    const t = TOPICS.find((x) => x.key === v || x.label === v);
    return t ? t.key : "";
  });
  // サイト内リンクを、拡張子なしの「/shinchiku」形式にそろえる（古い「shinchiku.html」「services.html#kaitai」も受け付ける）。外部のアドレスはそのまま
  eleventyConfig.addFilter("internal", (u) => {
    const v = String(u || "").trim();
    const m = v.match(/^\/?([A-Za-z0-9_-]+)\.html(?=$|[#?])(.*)$/);
    if (!m) return v;
    return (m[1] === "index" ? "/" : "/" + m[1]) + m[2];
  });

  // 改行を <br> に（管理画面の「見出し」で Enter を押した所で改行される）
  eleventyConfig.addFilter("br", (s) => esc(s).replace(/\r?\n/g, "<br>"));
  // トップページの内容は複数のファイル（home.json / home_about.json …）に分かれている。1つにまとめて使う
  eleventyConfig.addFilter("merge", (base, ...rest) => Object.assign({}, base, ...rest));
  eleventyConfig.addFilter("pub", toPublic);
  eleventyConfig.addFilter("urlenc", (s) => encodeURIComponent(s));
  // CSS の url() に入れるパス用（日本語・空白などを安全な形にする）
  //（encodeURI は ' ( ) を残すため、CSS の url() から抜け出せてしまう。これらも % 表記にする）
  eleventyConfig.addFilter("urlq", (s) => encodeURI(s || "").replace(/['()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()));
  // 「TEL 0766-74-2679」を電話リンクにする
  eleventyConfig.addFilter("telify", (s) =>
    esc(s).replace(/(TEL\s*)(\d[\d-]+\d)/g, (_, a, n) => `${a}<a href="tel:${n.replace(/-/g, "")}">${n}</a>`)
  );

  // 公開URL（canonical / og:url 用）。Cloudflare は /shinchiku.html を /shinchiku に転送するので、.html は付けない。site_url が空なら空文字
  eleventyConfig.addFilter("canon", (pageUrl, siteUrl) => {
    const base = String(siteUrl || "").replace(/\/+$/, "");
    if (!base) return "";
    let p = String(pageUrl || "/").replace(/index\.html$/, "").replace(/\.html$/, "");
    if (!p.startsWith("/")) p = "/" + p;
    return base + p;
  });
  // 絶対URLにする（og:image 用）。site_url か path が空なら空文字
  eleventyConfig.addFilter("absurl", (p, siteUrl) => {
    const base = String(siteUrl || "").replace(/\/+$/, "");
    return base && p ? base + encodeURI(p) : "";
  });

  // 検索エンジン向けの構造化データ(JSON-LD)を作る
  //   canonUrl / imgUrl は、site.json の site_url があるときだけ渡される（絶対URL。空なら従来どおり）
  eleventyConfig.addFilter("ld", (s, d, isHome, canonUrl, imgUrl) => {
    const intl = (t) => "+81-" + String(t).replace(/^0/, "");
    const base = String(s.site_url || "").replace(/\/+$/, "");
    const homeUrl = base ? base + "/" : "/";
    // 住所を「都道府県 / 市区町村 / 番地」に分ける。分けられなければ、住所全体を番地として出す
    const addr = String(s.address || "");
    const am = addr.match(/^(北海道|東京都|京都府|大阪府|.{2,3}県)(.+?[市区町村])(.*)$/);
    const address = {
      "@type": "PostalAddress",
      postalCode: s.zip,
      ...(am ? { addressRegion: am[1], addressLocality: am[2], streetAddress: am[3] } : { streetAddress: addr }),
      addressCountry: "JP",
    };
    const areaServed = s.area_served || (am ? am[1] + am[2] : "");
    const logoInfo = s.logo && infoOf(s.logo);
    const logoUrl = base && logoInfo ? base + encodeURI(variantUrl(stemOf(s.logo), logoInfo.w, logoInfo.w, fbExt(logoInfo))) : "";
    const hoursSpec = openingHoursSpec(s);
    const data = isHome
      ? {
          "@context": "https://schema.org",
          "@type": "HomeAndConstructionBusiness",
          name: s.name,
          ...(s.legal_name ? { legalName: s.legal_name } : {}),
          description: s.short_description || d.seo_description,
          ...(s.founding_year ? { foundingDate: String(s.founding_year) } : {}),
          ...(areaServed ? { areaServed } : {}),
          telephone: intl(s.tel1),
          faxNumber: intl(s.fax1),
          address,
          ...(hoursSpec ? { openingHoursSpecification: hoursSpec } : {}),
          sameAs: [s.instagram].filter(Boolean),
          ...(canonUrl ? { url: canonUrl } : {}),
          ...(imgUrl ? { image: imgUrl } : {}),
          ...(logoUrl ? { logo: logoUrl } : {}),
        }
      : {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "ホーム", item: homeUrl },
            { "@type": "ListItem", position: 2, name: d.crumb, ...(canonUrl ? { item: canonUrl } : {}) },
          ],
        };
    return JSON.stringify(data).replace(/</g, "\\u003c");
  });

  // {% img "/images/foo.avif", "説明文", "class名", 読み込み, "sizes" %}
  //   読み込み: 空 → loading="lazy"（既定）／ true → loading="eager" ／ "high" → eager + fetchpriority="high"（ファーストビューの主役の画像だけ）
  //   sizes   : 表示される幅のヒント（例 "(max-width:900px) 100vw, 526px"）。省略時は 100vw
  // <picture> で AVIF → WebP → JPEG(PNG) の順に出し分け、srcset で画面幅に合う大きさを選ばせる
  eleventyConfig.addShortcode("img", function (src, alt, cls, eager, sizes) {
    if (!src) return "";
    const info = infoOf(src);
    const c = cls ? ` class="${cls}"` : "";
    const load = eager ? ` loading="eager"` : ` loading="lazy"`;
    const prio = eager === "high" ? ` fetchpriority="high"` : "";
    if (!info) {
      // 画像が見つからないときも、壊れたタグは出さずに素の <img> にする
      return `<img${c} src="${esc(encodeURI(toPublic(src)))}" alt="${esc(alt || "")}"${load}${prio} decoding="async">`;
    }
    const stem = stemOf(src);
    const ws = widthsFor(info.w);
    const fb = fbExt(info);
    const sz = ` sizes="${esc(sizes || "100vw")}"`;
    const set = (fmt) => ` srcset="${srcsetOf(stem, ws, info.w, fmt)}"`;
    const fbSrc = esc(encodeURI(variantUrl(stem, info.w, info.w, fb)));
    return (
      `<picture>` +
      `<source type="image/avif"${set("avif")}${sz}>` +
      `<source type="image/webp"${set("webp")}${sz}>` +
      `<img width="${info.w}" height="${info.h}"${c} src="${fbSrc}"${set(fb)}${sz} alt="${esc(alt || "")}"${load}${prio} decoding="async">` +
      `</picture>`
    );
  });

  // <head> 用：ファーストビューの画像を AVIF の srcset で先読みする（AVIF 非対応のブラウザは先読みしない）
  eleventyConfig.addShortcode("preloadimg", function (src, sizes) {
    const info = src && infoOf(src);
    if (!info) return "";
    const ws = widthsFor(info.w);
    return `<link rel="preload" as="image" type="image/avif" imagesrcset="${srcsetOf(stemOf(src), ws, info.w, "avif")}" imagesizes="${esc(sizes || "100vw")}" fetchpriority="high">`;
  });
  // CSS の背景に使う画像：指定幅以上でいちばん小さい AVIF（なければ最大）
  eleventyConfig.addFilter("imgw", (src, w) => {
    const info = src && infoOf(src);
    if (!info) return toPublic(src);
    const ws = widthsFor(info.w);
    return variantUrl(stemOf(src), ws.find((x) => x >= w) || info.w, info.w, "avif");
  });
  // CSS の背景用：指定幅以上でいちばん小さい画像を、指定の形式（avif / webp / jpg）で返す。透過ありの画像は jpg → png になる
  eleventyConfig.addFilter("imgwf", (src, w, fmt) => {
    const info = src && infoOf(src);
    if (!info) return toPublic(src);
    const ws = widthsFor(info.w);
    const f = fmt === "jpg" ? fbExt(info) : fmt;
    return variantUrl(stemOf(src), ws.find((x) => x >= w) || info.w, info.w, f);
  });
  // AVIF 非対応のブラウザ向け（favicon など）：いちばん大きい JPEG/PNG
  eleventyConfig.addFilter("imgfb", (src) => {
    const info = src && infoOf(src);
    return info ? variantUrl(stemOf(src), info.w, info.w, fbExt(info)) : "";
  });

  // ビルド後：画像を _site/images に書き出す
  //  ・JPG/PNG などは、幅1600px以内のAVIF（公開される本体）に変換
  //  ・全画像で、幅ごとの AVIF / WebP / JPEG(透過ありは PNG) を作る（<picture> の srcset 用）
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    const root = path.join(__dirname, "src", "images");
    if (!fs.existsSync(root)) return;
    const outRoot = path.join(__dirname, dir.output, "images");
    for (const f of walk(root)) {
      if (!RASTER.test(f)) continue;
      const rel = path.relative(root, f);
      const key = "/images/" + rel.split(path.sep).join("/");
      const info = infoOf(key);
      if (!info) continue;
      const stem = path.join(outRoot, rel.replace(RASTER, ""));
      fs.mkdirSync(path.dirname(stem), { recursive: true });
      const at = (w) => sharp(f).rotate().resize({ width: w, withoutEnlargement: true });
      const jobs = [];
      // 本体の AVIF（JPG/PNG などからの変換。元から AVIF のものは上の passthrough でコピー済み）
      if (CONVERT.test(f)) jobs.push(at(MAX_W).avif({ quality: Q.avif }).toFile(stem + ".avif"));
      for (const w of widthsFor(info.w)) {
        const img = () => at(w);
        if (w !== info.w) jobs.push(img().avif({ quality: Q.avif }).toFile(`${stem}-${w}.avif`));
        jobs.push(img().webp({ quality: Q.webp }).toFile(`${stem}-${w}.webp`));
        jobs.push(
          info.alpha
            ? img().png({ compressionLevel: 9 }).toFile(`${stem}-${w}.png`)
            : img().flatten({ background: "#fff" }).jpeg({ quality: Q.jpg, mozjpeg: true }).toFile(`${stem}-${w}.jpg`)
        );
      }
      await Promise.all(jobs);
    }
  });

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    templateFormats: ["njk"],
    htmlTemplateEngine: "njk",
  };
};
