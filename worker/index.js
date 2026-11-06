// Cloudflare Workers の入口。
// ・/api/auth と /api/callback は、管理画面のGitHubログイン用の処理
// ・それ以外はすべて、作られたサイト（_site）のファイルをそのまま返す

// /api/* の応答に共通で付ける保護ヘッダー（静的ファイルのほうは src/_headers.njk で付けています）
const SECURE = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000",
};

// エラー時の素の応答（日本語のメッセージ。保護ヘッダー付き）
function fail(status, text) {
  return new Response(text, {
    status,
    headers: { ...SECURE, "Content-Type": "text/plain;charset=UTF-8" },
  });
}

function page(status, payload) {
  const msg = `authorization:github:${status}:${JSON.stringify(payload)}`;
  // <script> の中に埋め込むので、"<" "U+2028/2029" を escape して </script> による脱出を防ぐ（payload に GitHub の文言が入るため）
  const safeMsg = JSON.stringify(msg).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  // このページのインラインスクリプトだけを、毎回かわる nonce で許可する（それ以外の読み込み・実行は全部ふさぐ）
  const nonce = btoa(crypto.randomUUID());
  const html = `<!doctype html><html><body><script nonce="${nonce}">
(function () {
  // 管理画面から開かれたポップアップでなければ（直接アクセスなど）、何もしない
  if (!window.opener) return;
  function receive(e) {
    // 管理画面（このサイト自身）以外からのメッセージには、トークンを渡さない
    if (e.origin !== location.origin) return;
    window.opener.postMessage(${safeMsg}, location.origin);
  }
  window.addEventListener("message", receive, false);
  window.opener.postMessage("authorizing:github", "*");
})();
</script></body></html>`;
  return new Response(html, {
    headers: {
      ...SECURE,
      "Content-Type": "text/html;charset=UTF-8",
      "Set-Cookie": "__Host-oauth_state=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0",
      // ログイン結果（トークン）を含むページなので、埋め込み・保存・参照元の送信を禁止する
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,
    },
  });
}

function auth(request, env) {
  if (!env.GITHUB_CLIENT_ID) {
    return fail(500, "GITHUB_CLIENT_ID が設定されていません（README の手順を確認してください）");
  }
  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${url.origin}/api/callback`,
    // 既定は repo。リポジトリが公開(Public)なら、Worker の変数 GITHUB_OAUTH_SCOPE=public_repo にすると、
    // 非公開リポジトリへの権限が付かなくなり、トークンが漏れたときの被害が小さくなります（それ以外の値は無視して repo にします）
    scope: env.GITHUB_OAUTH_SCOPE === "public_repo" ? "public_repo" : "repo",
    state,
  });
  return new Response(null, {
    status: 302,
    headers: {
      ...SECURE,
      Location: `https://github.com/login/oauth/authorize?${params}`,
      "Set-Cookie": `__Host-oauth_state=${state}; HttpOnly; Secure; Path=/; Max-Age=600; SameSite=Lax`,
    },
  });
}

// 文字列の比較に掛かる時間から値が推測されないよう、長さが同じなら最後まで比べる
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function callback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = request.headers.get("Cookie") || "";
  const saved = (cookie.match(/(?:^|;\s*)__Host-oauth_state=([^;]+)/) || [])[1];

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return page("error", { message: "ログインの設定が完了していません（GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET を確認してください）。" });
  }
  if (!code || !state || !saved || !safeEqual(state, saved)) {
    return page("error", { message: "ログインの確認に失敗しました。もう一度お試しください。" });
  }
  let data;
  try {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      // GitHub が応答しないときに Worker が待ち続けないよう、10秒で打ち切る
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    data = await res.json();
  } catch (e) {
    // GitHub が落ちている・HTML のエラーを返した等。Worker を落とさず、日本語のメッセージを出す
    return page("error", { message: "GitHub との通信に失敗しました。少し待ってから、もう一度お試しください。" });
  }
  if (!data || typeof data !== "object" || !data.access_token) {
    return page("error", { message: (data && data.error_description) || "ログインに失敗しました。" });
  }
  return page("success", { token: data.access_token, provider: "github" });
}

export default {
  async fetch(request, env) {
    try {
      const { pathname } = new URL(request.url);
      if (pathname === "/api/auth" || pathname === "/api/callback") {
        // ログイン処理は GET だけ。それ以外のメソッドは受け付けない
        if (request.method !== "GET" && request.method !== "HEAD") {
          return new Response("Method Not Allowed", {
            status: 405,
            headers: { ...SECURE, Allow: "GET, HEAD", "Content-Type": "text/plain;charset=UTF-8" },
          });
        }
        return pathname === "/api/auth" ? auth(request, env) : await callback(request, env);
      }
      if (pathname.startsWith("/api/")) return fail(404, "Not Found");
      return await env.ASSETS.fetch(request);
    } catch (e) {
      // 想定外のエラーでも Worker を落とさず、利用者には日本語のメッセージだけを返す（詳細はログに残す）
      console.error("worker error:", e);
      return fail(500, "一時的なエラーが発生しました。少し待ってから、もう一度お試しください。");
    }
  },
};
