/* 管理画面のプレビュー（トップページ）
 *
 * 入力した内容が、サイトでどう見えるかを右側に表示します（実際のサイトと同じ style.css を使っています）。
 * ・保存していない途中の内容も、その場で反映されます
 * ・プレビューは目安です。実際の表示は、公開後にサイトで確認してください
 * ・万一このファイルが動かなくても、編集・公開そのものには影響しません
 */
(function () {
  if (!window.CMS || typeof CMS.registerPreviewTemplate !== "function") return;
  var h = window.h || (window.React && window.React.createElement);
  if (!h) return;

  CMS.registerPreviewStyle("https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap");
  CMS.registerPreviewStyle("/style.css");
  CMS.registerPreviewStyle("/admin/preview.css");

  function data(props) {
    var d = props.entry && props.entry.get("data");
    return d && d.toJS ? d.toJS() : {};
  }
  // 写真のアドレス。保存前にアップロードした写真（blob）と、すでに公開されている写真の両方に対応
  function img(props, p, alt, cls) {
    if (!p) return null;
    var u = "";
    try { u = String(props.getAsset(p) || ""); } catch (e) { u = ""; }
    if (!u || u.indexOf("[object") === 0) u = String(p).replace(/\.(jpe?g|png|webp|gif)$/i, ".avif");
    return h("img", { src: u, alt: alt || "", className: cls || null });
  }
  function lines(s) {
    var out = [];
    String(s || "").split(/\r?\n/).forEach(function (t, i) { if (i) out.push(h("br", { key: "b" + i })); out.push(t); });
    return out;
  }
  function wrap(children) { return h("div", { className: "prv" }, children); }
  function label(t, extra) { return h("div", { className: "label" + (extra || "") }, t); }

  /* ① 最初の画面 */
  function Hero(props) {
    var d = data(props);
    return wrap([
      h("section", { className: "hero", key: "hero" }, [
        h("div", { className: "hero-bg", key: "bg" }, img(props, d.hero_image, "")),
        h("div", { className: "wrap", key: "w" }, [
          h("div", { className: "hero-tag", key: "t" }, [h("i", { key: "i" }), d.hero_tag]),
          h("h1", { key: "h1" }, [d.hero_title_a, h("em", { key: "em" }, d.hero_title_em), d.hero_title_b]),
          h("p", { className: "sub", key: "s" }, d.hero_sub),
          h("div", { className: "hero-actions", key: "a" }, [
            h("span", { className: "btn btn-lime", key: "1" }, "無料相談・お見積り →"),
            h("span", { className: "btn btn-ghost", key: "2" }, "電話する")
          ])
        ])
      ]),
      h("div", { className: "ribbon", key: "rb" }, h("div", { className: "wrap" },
        (d.ribbon || []).map(function (r, i) {
          return h("div", { className: "rb", key: i }, [h("b", { key: "b" }, r.num), h("span", { key: "s" }, r.label)]);
        })))
    ]);
  }

  /* ② 私たちについて */
  function About(props) {
    var d = data(props);
    return wrap(h("section", { className: "sec" }, h("div", { className: "wrap about-grid" }, [
      h("div", { key: "l" }, [label(d.about_label), h("h2", { className: "title", key: "t" }, lines(d.about_title)),
        h("p", { key: "p" }, d.about_text), h("span", { className: "tlink", key: "a" }, d.about_link)]),
      h("div", { className: "about-img", key: "r" }, [img(props, d.about_image, d.about_alt),
        h("div", { className: "chip", key: "c" }, [h("small", { key: "s" }, d.about_chip_small), d.about_chip])])
    ])));
  }

  /* ③ 事業内容とイノスの家 */
  function Services(props) {
    var d = data(props);
    return wrap(h("section", { className: "sec" }, h("div", { className: "wrap" }, [
      h("div", { className: "svc-head", key: "h" }, [
        h("div", { key: "d" }, [label(d.services_label), h("h2", { className: "title", style: { margin: 0 } }, d.services_title)]),
        h("p", { className: "lead", key: "l" }, d.services_lead)]),
      h("div", { className: "bento", key: "b" }, (d.cards || []).map(function (c, i) {
        return h("div", { key: i, className: "bc b" + (i + 1) + (c.variant === "white" ? " white-bg" : "") }, [
          img(props, c.image, c.alt),
          h("div", { className: "tx", key: "t" }, [h("span", { className: "no", key: "n" }, "0" + (i + 1)), h("h3", { key: "h" }, c.title),
            h("p", { key: "p" }, c.text), h("span", { className: "go", key: "g" }, c.go)]),
          h("span", { className: "arw", key: "a" }, "→")]);
      })),
      h("div", { className: "inos", key: "i" }, [img(props, d.inos_image, d.inos_alt),
        h("div", { className: "tx", key: "t" }, [label(d.inos_label), h("h3", { key: "h" }, d.inos_title), h("p", { key: "p" }, d.inos_text),
          h("span", { className: "btn btn-lime", key: "b" }, d.inos_button)])])
    ])));
  }

  /* ④ 施工事例・ご相談の流れ・お客様の声 */
  function Works(props) {
    var d = data(props), out = [];
    if ((d.works || []).length) out.push(h("section", { className: "sec alt", key: "w" }, h("div", { className: "wrap" }, [
      h("div", { className: "svc-head", key: "h" }, [h("div", { key: "d" }, [label(d.works_label), h("h2", { className: "title", style: { margin: 0 } }, d.works_title)]), h("p", { className: "lead", key: "l" }, d.works_lead)]),
      h("div", { className: "works", key: "g" }, d.works.map(function (w, i) {
        return h("figure", { className: "wk", key: i }, [img(props, w.image, w.alt), h("figcaption", { key: "c" }, [h("b", { key: "b" }, w.title), h("span", { key: "s" }, w.text)])]);
      }))])));
    if ((d.flow || []).length) out.push(h("section", { className: "sec", key: "f" }, h("div", { className: "wrap" }, [
      h("div", { className: "svc-head", key: "h" }, [h("div", { key: "d" }, [label(d.flow_label), h("h2", { className: "title", style: { margin: 0 } }, d.flow_title)]), h("p", { className: "lead", key: "l" }, d.flow_lead)]),
      h("div", { className: "steps flow", key: "s" }, d.flow.map(function (f, i) { return h("div", { className: "step", key: i }, [h("h3", { key: "h" }, f.title), h("p", { key: "p" }, f.text)]); }))])));
    if ((d.voices || []).length) out.push(h("section", { className: "sec alt", key: "v" }, h("div", { className: "wrap" }, [
      label(d.voices_label), h("h2", { className: "title", key: "t" }, d.voices_title),
      h("div", { className: "voices", key: "g" }, d.voices.map(function (v, i) {
        return h("blockquote", { className: "vc", key: i }, [h("p", { key: "p" }, v.text), h("footer", { key: "f" }, [v.name, v.kind ? h("span", { key: "k" }, v.kind) : null])]);
      }))])));
    if (!out.length) out.push(h("p", { className: "prv-note", key: "n" }, "施工事例・流れ・お客様の声が、まだ1つもありません（この場合、サイトにこのコーナーは出ません）。"));
    return wrap(out);
  }

  /* ⑤ お問い合わせ */
  function Contact(props) {
    var d = data(props);
    return wrap(h("section", { className: "sec contact on-dark" }, h("div", { className: "wrap" }, [
      label(d.contact_label), h("h2", { className: "title", key: "t" }, d.contact_title), h("p", { className: "lead", key: "l" }, d.contact_lead),
      h("p", { className: "prv-note on-dark-note", key: "n" }, "（この下に、住所・電話・営業時間・地図・フォームが表示されます）")])));
  }

  /* 送信完了ページ */
  function Thanks(props) {
    var d = data(props);
    return wrap([
      h("section", { className: "phero", key: "p" }, h("div", { className: "wrap" }, [label(d.hero_label), h("h1", { key: "h" }, lines(d.hero_title)), h("p", { key: "l" }, d.hero_lead)])),
      h("section", { className: "sec", key: "s" }, h("div", { className: "wrap" }, h("div", { className: "thanks" }, [
        h("div", { className: "thanks-ic", key: "i" }), h("h2", { className: "title", key: "t" }, d.body_title), h("p", { key: "p" }, lines(d.body_text))])))
    ]);
  }

  /* そのほかのページ：プレビューはありません */
  function None() {
    return h("div", { className: "prv-none" }, [
      h("p", { key: "a" }, "このページには、画面のプレビューはありません。"),
      h("p", { key: "b" }, "公開すると、3〜5分でサイトに反映されます。画面右上の「サイトを見る」から、公開中のサイトを確認できます。")
    ]);
  }

  var T = { home: Hero, home_about: About, home_services: Services, home_works: Works, home_contact: Contact, thanks: Thanks };
  ["site", "home", "home_about", "home_services", "home_works", "home_contact", "shinchiku", "reform", "services", "company", "staff", "thanks"].forEach(function (n) {
    CMS.registerPreviewTemplate(n, T[n] || None);
  });
})();
