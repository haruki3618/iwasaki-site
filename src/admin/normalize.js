/* 保存するときの「入力ミスの自動補正」
 *
 * 電話番号・FAX・郵便番号に、全角の数字（０７６６）や全角ハイフン（－ ー ‐ など）、
 * 余計な空白が入っていても、「保存」を押した時点で半角（0766-74-2679）に自動で直します。
 * （config.yml 側の入力チェックも、全角を「間違い」としないようにしてあります）
 *
 * Decap CMS 公式の preSave イベントを使っています。
 * 万一このファイルが動かなくても、管理画面の編集そのものには影響しません。
 */
(function () {
  if (!window.CMS || typeof CMS.registerEventListener !== "function") return;

  // 全角数字 → 半角数字
  function digits(s) {
    return s.replace(/[０-９]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
    });
  }

  // ハイフンに見える文字（全角ハイフン・長音「ー」・ダッシュ・マイナスなど）→ 半角ハイフン
  function hyphens(s) {
    return s.replace(/[\u2010-\u2015\u2212\uFE63\uFF0D\u30FC\uFF70\u2043]/g, "-");
  }

  // 空白（全角スペース含む）をすべて取り除く
  function noSpace(s) {
    return s.replace(/[\s\u3000]/g, "");
  }

  // 電話・FAX・郵便番号用
  function number(s) {
    return noSpace(hyphens(digits(s)));
  }

  // 時刻用（営業時間）：全角の数字・コロンを半角にし、空白を取り除く  例：８：３０ → 8:30
  function time(s) {
    return noSpace(digits(s).replace(/[\uFF1A]/g, ":"));
  }

  // URL 用：全角の英数字・記号（！〜～）を半角にし、空白を取り除く
  function url(s) {
    return noSpace(
      s.replace(/[\uFF01-\uFF5E]/g, function (c) {
        return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
      })
    );
  }

  // 補正する項目（「name:」の名前で指定します）
  var RULES = {
    site: {
      zip: number,
      tel1: number,
      fax1: number,
      tel2: number,
      fax2: number,
      hours_open: time,
      hours_close: time,
      instagram: url,
      inos_url: url,
    },
  };

  CMS.registerEventListener({
    name: "preSave",
    handler: function (args) {
      var entry = args.entry;
      var data = entry.get("data");
      try {
        var rules = RULES[entry.get("slug")];
        if (!rules) return data;
        Object.keys(rules).forEach(function (key) {
          var v = data.get(key);
          if (typeof v === "string") data = data.set(key, rules[key](v));
        });
      } catch (e) {
        // 補正に失敗しても、保存そのものは止めない
        console.warn("入力の自動補正をスキップしました", e);
      }
      return data;
    },
  });
})();
