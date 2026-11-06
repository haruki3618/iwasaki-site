/* 管理画面の補助（公開したあとのお知らせ）
 *
 * 「公開する」を押したあと、画面の下に「3〜5分で反映されます」と出します。
 * Decap CMS 公式のイベント（postPublish / postSave）を使っています。
 * 万一このファイルが動かなくても、編集・公開そのものには影響しません。
 */
(function () {
  if (!window.CMS || typeof CMS.registerEventListener !== "function") return;
  var last = 0;

  function show() {
    var now = Date.now();
    if (now - last < 3000) return; // 同時に2回出ないように
    last = now;
    var old = document.getElementById("ui-toast");
    if (old) old.remove();
    var box = document.createElement("div");
    box.id = "ui-toast";
    box.setAttribute("role", "status");
    var msg = document.createElement("div");
    msg.className = "ui-toast-msg";
    var b = document.createElement("b");
    b.textContent = "✔ 公開しました。";
    msg.appendChild(b);
    msg.appendChild(document.createTextNode("サイトに反映されるまで、3〜5分ほどかかります。しばらくしてから、サイトを開いて確認してください（開いたあとは、ページを再読み込みしてください）。"));
    var a = document.createElement("a");
    a.href = "/";
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "サイトを開く ↗";
    var x = document.createElement("button");
    x.type = "button";
    x.setAttribute("aria-label", "閉じる");
    x.textContent = "×";
    x.addEventListener("click", function () { box.remove(); });
    box.appendChild(msg);
    box.appendChild(a);
    box.appendChild(x);
    document.body.appendChild(box);
    setTimeout(function () { if (box.parentNode) box.remove(); }, 30000);
  }

  ["postPublish", "postSave"].forEach(function (n) {
    CMS.registerEventListener({ name: n, handler: function () { try { show(); } catch (e) {} } });
  });
})();
