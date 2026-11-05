// Cloudflare Workers の入口。
// ・/api/auth と /api/callback は、管理画面のGitHubログイン用の処理
// ・それ以外はすべて、作られたサイト（_site）のファイルをそのまま返す

function page(status, payload) {
  const msg = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const html = `<!doctype html><html><body><script>
(function () {
  function receive(e) {
    window.opener.postMessage(${JSON.stringify(msg)}, e.origin);
  }
  window.addEventListener("message", receive, false);
  window.opener.postMessage("authorizing:github", "*");
})();
</script></body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Set-Cookie": "oauth_state=; HttpOnly; Secure; Path=/; Max-Age=0",
    },
  });
}

function auth(request, env) {
  if (!env.GITHUB_CLIENT_ID) {
    return new Response("GITHUB_CLIENT_ID が設定されていません（README の手順を確認してください）", { status: 500 });
  }
  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${url.origin}/api/callback`,
    scope: "repo,user",
    state,
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://github.com/login/oauth/authorize?${params}`,
      "Set-Cookie": `oauth_state=${state}; HttpOnly; Secure; Path=/; Max-Age=600; SameSite=Lax`,
    },
  });
}

async function callback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = request.headers.get("Cookie") || "";
  const saved = (cookie.match(/(?:^|;\s*)oauth_state=([^;]+)/) || [])[1];

  if (!code || !state || state !== saved) {
    return page("error", { message: "ログインの確認に失敗しました。もう一度お試しください。" });
  }
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    return page("error", { message: data.error_description || "ログインに失敗しました。" });
  }
  return page("success", { token: data.access_token, provider: "github" });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/auth") return auth(request, env);
    if (pathname === "/api/callback") return callback(request, env);
    return env.ASSETS.fetch(request);
  },
};
