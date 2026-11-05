const fs = require("fs");
const path = require("path");
const { imageSize } = require("image-size");
const sharp = require("sharp");

const IMG_DIR = path.join(__dirname, "src");
const CONVERT = /\.(jpe?g|png|webp|gif|tiff?)$/i;

// 画像のパスを「公開されるパス(.avif)」に直す。管理画面からJPG/PNGを入れても自動でAVIFになる
const toPublic = (p) => (p || "").replace(CONVERT, ".avif");

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/style.css": "style.css" });
  eleventyConfig.addPassthroughCopy({ "src/main.js": "main.js" });
  eleventyConfig.addPassthroughCopy({ "src/admin": "admin" });
  // AVIF以外(JPG/PNGなど)はコピーせず、下の after フックでAVIFに変換して出力する
  eleventyConfig.addPassthroughCopy({ "src/images": "images" }, {
    filter: (p) => !CONVERT.test(p),
  });

  // 改行を <br> に（管理画面の「見出し」で Enter を押した所で改行される）
  eleventyConfig.addFilter("br", (s) => esc(s).replace(/\r?\n/g, "<br>"));
  eleventyConfig.addFilter("pub", toPublic);
  eleventyConfig.addFilter("urlenc", (s) => encodeURIComponent(s));
  // 「TEL 0766-74-2679」を電話リンクにする
  eleventyConfig.addFilter("telify", (s) =>
    esc(s).replace(/(TEL\s*)(\d[\d-]+\d)/g, (_, a, n) => `${a}<a href="tel:${n.replace(/-/g, "")}">${n}</a>`)
  );

  // 検索エンジン向けの構造化データ(JSON-LD)を作る
  eleventyConfig.addFilter("ld", (s, d, isHome) => {
    const intl = (t) => "+81-" + String(t).replace(/^0/, "");
    const data = isHome
      ? {
          "@context": "https://schema.org",
          "@type": "HomeAndConstructionBusiness",
          name: s.name,
          description: s.short_description || d.seo_description,
          foundingDate: "1991",
          areaServed: "富山県氷見市",
          telephone: intl(s.tel1),
          faxNumber: intl(s.fax1),
          address: {
            "@type": "PostalAddress",
            postalCode: s.zip,
            addressRegion: "富山県",
            addressLocality: "氷見市",
            streetAddress: String(s.address).replace("富山県氷見市", ""),
            addressCountry: "JP",
          },
          sameAs: [s.instagram],
        }
      : {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "ホーム", item: "index.html" },
            { "@type": "ListItem", position: 2, name: d.crumb },
          ],
        };
    return JSON.stringify(data).replace(/</g, "\\u003c");
  });

  // {% img "/images/foo.avif", "説明文", "class名", "eager" %}
  eleventyConfig.addShortcode("img", function (src, alt, cls, eager) {
    if (!src) return "";
    const abs = path.join(IMG_DIR, src.replace(/^\//, ""));
    let dims = "";
    try {
      const s = imageSize(fs.readFileSync(abs));
      // 変換後は幅1600pxまでに縮小されるので、表示用のサイズもそれに合わせる
      const k = s.width > 1600 && CONVERT.test(src) ? 1600 / s.width : 1;
      dims = ` width="${Math.round(s.width * k)}" height="${Math.round(s.height * k)}"`;
    } catch (e) {
      // 画像サイズが取れなくても表示はできる
    }
    const c = cls ? ` class="${cls}"` : "";
    const load = eager ? "" : ` loading="lazy"`;
    return `<img${dims}${c} src="${esc(encodeURI(toPublic(src)))}" alt="${esc(alt || "")}"${load} decoding="async">`;
  });

  // ビルド後: JPG/PNG などを幅1600px以内のAVIFに変換して _site/images に出力
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    const walk = (d) =>
      fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
      );
    const root = path.join(__dirname, "src", "images");
    if (!fs.existsSync(root)) return;
    for (const f of walk(root)) {
      if (!CONVERT.test(f)) continue;
      const rel = path.relative(root, f).replace(CONVERT, ".avif");
      const out = path.join(__dirname, dir.output, "images", rel);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      await sharp(f)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .avif({ quality: 55 })
        .toFile(out);
    }
  });

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    templateFormats: ["njk"],
    htmlTemplateEngine: "njk",
  };
};
