// OAuth for the MCP endpoint (server/oauth.mjs): discovery, registration,
// the consent page, code exchange with PKCE, refresh rotation and revocation,
// driven the way claude.ai drives a custom connector.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { startTestServer } from "./helpers/test-server.mjs";

const server = await startTestServer();
test.after(() => server.close());

const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

const pkce = () => {
  const verifier = crypto.randomBytes(32).toString("base64url");
  return { verifier, challenge: crypto.createHash("sha256").update(verifier).digest("base64url") };
};

async function request(method, path, { form, json, cookie, headers = {} } = {}) {
  const init = { method, headers: { ...headers }, redirect: "manual" };
  if (form) {
    init.headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = new URLSearchParams(form).toString();
  }
  if (json !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(json);
  }
  if (cookie) init.headers.Cookie = cookie;
  const response = await fetch(server.baseUrl + path, init);
  const type = response.headers.get("content-type") ?? "";
  const body = type.includes("json") ? await response.json() : await response.text();
  return { status: response.status, headers: response.headers, body };
}

// Registration is limited to 30 an hour from one address, which is every test
// here, so a test that does not care which client it gets shares one.
let sharedClient = null;
async function register(metadata = {}, { fresh = false } = {}) {
  if (!fresh && Object.keys(metadata).length === 0) {
    sharedClient ??= await register({}, { fresh: true });
    return sharedClient;
  }
  const created = await request("POST", "/api/oauth/register", {
    json: { client_name: "Claude", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none", ...metadata }
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  return created.body;
}

function authorizeQuery(client, { challenge, state = "xyz", scope, redirect = REDIRECT, extra = {} } = {}) {
  return new URLSearchParams({
    response_type: "code",
    client_id: client.client_id,
    redirect_uri: redirect,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    ...(scope ? { scope } : {}),
    ...extra
  }).toString();
}

/** The hidden fields of the consent form, as the browser would post them. */
function consentForm(html) {
  const fields = {};
  for (const match of html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)) {
    fields[match[1]] = match[2].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  }
  return fields;
}

/** Sign in, approve, and come back with a code. */
async function approve(user, client, options = {}) {
  const { verifier, challenge } = options.pkce ?? pkce();
  const page = await request("GET", `/api/oauth/authorize?${authorizeQuery(client, { challenge, ...options })}`, { cookie: user.cookie });
  assert.equal(page.status, 200, page.body);
  const answer = await request("POST", "/api/oauth/authorize", {
    form: { ...consentForm(page.body), decision: "allow" },
    cookie: user.cookie,
    headers: { Origin: options.origin ?? "null" }
  });
  assert.equal(answer.status, 303, answer.body);
  const location = new URL(answer.headers.get("location"));
  return { location, code: location.searchParams.get("code"), verifier, page };
}

async function exchange(client, code, verifier, extra = {}) {
  return request("POST", "/api/oauth/token", {
    form: { grant_type: "authorization_code", code, code_verifier: verifier, client_id: client.client_id, redirect_uri: REDIRECT, ...extra }
  });
}

async function mcp(accessToken, method = "tools/list") {
  const response = await fetch(`${server.baseUrl}/api/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method })
  });
  return { status: response.status, body: response.status === 200 ? await response.json() : null };
}

test("discovery: the MCP endpoint names its authorization server, which describes itself", async () => {
  const resource = await request("GET", "/.well-known/oauth-protected-resource/api/mcp");
  assert.equal(resource.status, 200);
  assert.equal(resource.headers.get("access-control-allow-origin"), "*");
  assert.equal(resource.body.resource, `${server.baseUrl}/api/mcp`);
  assert.deepEqual(resource.body.authorization_servers, [server.baseUrl]);
  assert.deepEqual(resource.body.scopes_supported, ["receipts:read", "receipts:write"]);
  assert.deepEqual((await request("GET", "/.well-known/oauth-protected-resource")).body, resource.body);

  const metadata = await request("GET", "/.well-known/oauth-authorization-server");
  assert.equal(metadata.status, 200);
  assert.equal(metadata.body.issuer, server.baseUrl);
  assert.equal(metadata.body.authorization_endpoint, `${server.baseUrl}/api/oauth/authorize`);
  assert.equal(metadata.body.token_endpoint, `${server.baseUrl}/api/oauth/token`);
  assert.equal(metadata.body.registration_endpoint, `${server.baseUrl}/api/oauth/register`);
  assert.deepEqual(metadata.body.code_challenge_methods_supported, ["S256"]);
  assert.equal(metadata.body.authorization_response_iss_parameter_supported, true);

  const preflight = await fetch(`${server.baseUrl}/.well-known/oauth-authorization-server`, { method: "OPTIONS" });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
});

test("PUBLIC_URL, when set, is the address the metadata names", async () => {
  process.env.PUBLIC_URL = "https://receipts.example.com/ignored/path";
  try {
    const metadata = await request("GET", "/.well-known/oauth-authorization-server");
    assert.equal(metadata.body.issuer, "https://receipts.example.com");
  } finally {
    delete process.env.PUBLIC_URL;
  }
  const spoofed = await request("GET", "/.well-known/oauth-authorization-server", { headers: { Host: "evil.example\"><script>" } });
  assert.ok(!JSON.stringify(spoofed.body).includes("<script>"));
});

test("the whole flow: register, sign in, allow, exchange, call, refresh", async () => {
  const user = await server.signUp({ name: "Rahil" });
  const client = await register({}, { fresh: true });
  assert.match(client.client_id, /^rrc_/);
  assert.equal(client.client_secret, undefined);
  assert.equal(client.token_endpoint_auth_method, "none");

  const { verifier, challenge } = pkce();
  const query = authorizeQuery(client, { challenge, extra: { resource: `${server.baseUrl}/api/mcp` } });

  // Signed out: a sign-in form, on a locked-down page.
  const signedOut = await request("GET", `/api/oauth/authorize?${query}`);
  assert.equal(signedOut.status, 200);
  assert.match(signedOut.body, /Sign in to connect Claude/);
  assert.match(signedOut.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(signedOut.headers.get("x-frame-options"), "DENY");
  assert.equal(signedOut.headers.get("cache-control"), "no-store");

  // Signed in: the consent screen names the app, the account and where it goes.
  const page = await request("GET", `/api/oauth/authorize?${query}`, { cookie: user.cookie });
  assert.match(page.body, /Connect Claude to your receipts\?/);
  assert.ok(page.body.includes(user.user.email));
  assert.match(page.body, /claude\.ai/);
  assert.match(page.body, /Correct prices/);
  assert.match(page.headers.get("content-security-policy"), /form-action 'self' https:\/\/claude\.ai/);

  const answer = await request("POST", "/api/oauth/authorize", {
    form: { ...consentForm(page.body), decision: "allow" },
    cookie: user.cookie,
    headers: { Origin: server.baseUrl }
  });
  assert.equal(answer.status, 303);
  const location = new URL(answer.headers.get("location"));
  assert.equal(`${location.origin}${location.pathname}`, REDIRECT);
  assert.equal(location.searchParams.get("state"), "xyz");
  assert.equal(location.searchParams.get("iss"), server.baseUrl);
  const code = location.searchParams.get("code");
  assert.match(code, /^[\w-]{43}$/);
  assert.equal(await server.prisma.oAuthCode.count({ where: { codeHash: code } }), 0, "only a hash is stored");

  const tokens = await exchange(client, code, verifier, { resource: `${server.baseUrl}/api/mcp` });
  assert.equal(tokens.status, 200, JSON.stringify(tokens.body));
  assert.equal(tokens.headers.get("cache-control"), "no-store");
  assert.equal(tokens.body.token_type, "Bearer");
  assert.equal(tokens.body.expires_in, 3600);
  assert.equal(tokens.body.scope, "receipts:read receipts:write");
  assert.match(tokens.body.access_token, /^rr_oat_/);
  assert.match(tokens.body.refresh_token, /^rr_ort_/);

  const listed = await mcp(tokens.body.access_token);
  assert.equal(listed.status, 200);
  assert.ok(listed.body.result.tools.some((tool) => tool.name === "update_receipt"));
  assert.ok((await server.prisma.oAuthGrant.findFirst({ where: { userId: user.user.id } })).lastUsedAt);

  // The code works once.
  assert.equal((await exchange(client, code, verifier)).body.error, "invalid_grant");

  // Refresh rotates both tokens.
  const refreshed = await request("POST", "/api/oauth/token", {
    form: { grant_type: "refresh_token", refresh_token: tokens.body.refresh_token, client_id: client.client_id }
  });
  assert.equal(refreshed.status, 200, JSON.stringify(refreshed.body));
  assert.notEqual(refreshed.body.access_token, tokens.body.access_token);
  assert.notEqual(refreshed.body.refresh_token, tokens.body.refresh_token);
  assert.equal((await mcp(tokens.body.access_token)).status, 401);
  assert.equal((await mcp(refreshed.body.access_token)).status, 200);

  // Settings lists the app, and disconnecting it ends its access.
  const apps = await user.get("/api/connected-apps");
  assert.equal(apps.body.length, 1);
  assert.equal(apps.body[0].name, "Claude");
  assert.deepEqual(apps.body[0].scopes, ["receipts:read", "receipts:write"]);
  assert.equal((await server.signUp().then((other) => other.delete(`/api/connected-apps/${apps.body[0].id}`))).status, 404);
  assert.equal((await user.delete(`/api/connected-apps/${apps.body[0].id}`)).status, 204);
  assert.equal((await mcp(refreshed.body.access_token)).status, 401);
  assert.equal((await user.delete(`/api/connected-apps/${apps.body[0].id}`)).status, 404);
});

test("a refresh token replayed moments after rotation is refused without revoking (a race)", async () => {
  const user = await server.signUp();
  const client = await register();
  const { code, verifier } = await approve(user, client);
  const first = (await exchange(client, code, verifier)).body;
  const refresh = (token) => request("POST", "/api/oauth/token", { form: { grant_type: "refresh_token", refresh_token: token, client_id: client.client_id } });
  const second = (await refresh(first.refresh_token)).body;
  assert.ok(second.access_token);
  const raced = await refresh(first.refresh_token);
  assert.equal(raced.body.error, "invalid_grant");
  assert.equal((await mcp(second.access_token)).status, 200);
  assert.ok((await refresh(second.refresh_token)).body.access_token);
});

test("a refresh token used twice revokes the whole grant", async () => {
  const user = await server.signUp();
  const client = await register();
  const { code, verifier } = await approve(user, client);
  const first = (await exchange(client, code, verifier)).body;
  const second = (await request("POST", "/api/oauth/token", { form: { grant_type: "refresh_token", refresh_token: first.refresh_token, client_id: client.client_id } })).body;
  assert.ok(second.access_token);
  // Two minutes later, as far as the grant can tell.
  await server.prisma.oAuthGrant.updateMany({
    where: { userId: user.user.id },
    data: { accessExpiresAt: new Date(Date.now() + 3600_000 - 120_000) }
  });

  const replay = await request("POST", "/api/oauth/token", { form: { grant_type: "refresh_token", refresh_token: first.refresh_token, client_id: client.client_id } });
  assert.equal(replay.status, 400);
  assert.equal(replay.body.error, "invalid_grant");
  assert.equal((await mcp(second.access_token)).status, 401);
  const after = await request("POST", "/api/oauth/token", { form: { grant_type: "refresh_token", refresh_token: second.refresh_token, client_id: client.client_id } });
  assert.equal(after.body.error, "invalid_grant");
});

test("the code is bound to the verifier, the client and the redirect URI, and expires", async () => {
  const user = await server.signUp();
  const client = await register();
  const other = await register({}, { fresh: true });

  // A wrong verifier uses the code up.
  let approved = await approve(user, client);
  assert.equal((await exchange(client, approved.code, pkce().verifier)).body.error, "invalid_grant");
  assert.equal((await exchange(client, approved.code, approved.verifier)).body.error, "invalid_grant");

  approved = await approve(user, client);
  assert.equal((await exchange(other, approved.code, approved.verifier)).body.error, "invalid_grant");

  approved = await approve(user, client);
  assert.equal((await exchange(client, approved.code, approved.verifier, { redirect_uri: "https://claude.ai/other" })).body.error, "invalid_grant");

  approved = await approve(user, client);
  assert.equal((await exchange(client, approved.code, "short")).body.error, "invalid_grant");
  assert.equal((await exchange(client, approved.code, approved.verifier, { resource: "https://evil.example/api/mcp" })).body.error, "invalid_target");

  approved = await approve(user, client);
  await server.prisma.oAuthCode.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await exchange(client, approved.code, approved.verifier)).body.error, "invalid_grant");

  const missing = await request("POST", "/api/oauth/token", { form: { grant_type: "authorization_code", client_id: client.client_id } });
  assert.equal(missing.body.error, "invalid_request");
  const unsupported = await request("POST", "/api/oauth/token", { form: { grant_type: "password", client_id: client.client_id } });
  assert.equal(unsupported.body.error, "unsupported_grant_type");
  const unknown = await request("POST", "/api/oauth/token", { form: { grant_type: "authorization_code", client_id: "rrc_" + "x".repeat(22), code: "x", code_verifier: "y" } });
  assert.equal(unknown.status, 401);
  assert.equal(unknown.body.error, "invalid_client");
  const repeated = await fetch(`${server.baseUrl}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=refresh_token&refresh_token=a&refresh_token=b&client_id=${client.client_id}`
  });
  assert.equal((await repeated.json()).error, "invalid_request");
});

test("a confidential client must authenticate, by post or by Basic", async () => {
  const user = await server.signUp();
  const client = await register({ token_endpoint_auth_method: "client_secret_basic" });
  assert.ok(client.client_secret);
  const row = await server.prisma.oAuthClient.findUnique({ where: { clientId: client.client_id } });
  assert.notEqual(row.clientSecretHash, client.client_secret);

  let approved = await approve(user, client);
  const noSecret = await exchange(client, approved.code, approved.verifier);
  assert.equal(noSecret.status, 401);
  assert.match(noSecret.headers.get("www-authenticate"), /^Basic/);

  approved = await approve(user, client);
  assert.equal((await exchange(client, approved.code, approved.verifier, { client_secret: "wrong" })).status, 401);

  approved = await approve(user, client);
  const basic = Buffer.from(`${client.client_id}:${client.client_secret}`).toString("base64");
  const viaBasic = await request("POST", "/api/oauth/token", {
    form: { grant_type: "authorization_code", code: approved.code, code_verifier: approved.verifier, redirect_uri: REDIRECT },
    headers: { Authorization: `Basic ${basic}` }
  });
  assert.equal(viaBasic.status, 200, JSON.stringify(viaBasic.body));

  approved = await approve(user, client);
  const viaPost = await exchange(client, approved.code, approved.verifier, { client_secret: client.client_secret });
  assert.equal(viaPost.status, 200);

  // A public client that sends a secret is not that client.
  const publicClient = await register();
  approved = await approve(user, publicClient);
  assert.equal((await exchange(publicClient, approved.code, approved.verifier, { client_secret: "anything" })).status, 401);
});

test("registration only accepts safe redirect URIs and sane metadata", async () => {
  for (const metadata of [
    { redirect_uris: [] },
    { redirect_uris: "https://claude.ai/cb" },
    { redirect_uris: ["http://evil.example/cb"] },
    { redirect_uris: ["javascript:alert(1)"] },
    { redirect_uris: ["https://claude.ai/cb#frag"] },
    { redirect_uris: ["https://user:pass@claude.ai/cb"] },
    { redirect_uris: ["myapp://callback"] },
    { redirect_uris: [`https://claude.ai/${"x".repeat(600)}`] },
    { redirect_uris: Array.from({ length: 6 }, (_, index) => `https://claude.ai/${index}`) },
    { token_endpoint_auth_method: "private_key_jwt" },
    { grant_types: ["client_credentials"] },
    { response_types: ["token"] }
  ]) {
    const response = await request("POST", "/api/oauth/register", { json: { redirect_uris: [REDIRECT], ...metadata } });
    assert.equal(response.status, 400, JSON.stringify(metadata));
    assert.match(response.body.error, /^invalid_/);
  }
  const loopback = await register({ redirect_uris: ["http://localhost:33418/callback", "http://127.0.0.1:9/cb"] });
  assert.equal(loopback.redirect_uris.length, 2);
  const defaulted = await request("POST", "/api/oauth/register", { json: { redirect_uris: [REDIRECT] } });
  assert.equal(defaulted.body.token_endpoint_auth_method, "client_secret_basic");
  assert.ok(defaulted.body.client_secret);
  assert.equal(defaulted.body.client_name, "An unnamed app");
  const broken = await fetch(`${server.baseUrl}/api/oauth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal(broken.status, 400);
});

test("a client nobody approved is swept after a day; an approved one can reconnect after a disconnect", async () => {
  const user = await server.signUp();
  const stale = await register({}, { fresh: true });
  const approved = await register({}, { fresh: true });
  const { code, verifier } = await approve(user, approved);
  await exchange(approved, code, verifier);
  const [app] = (await user.get("/api/connected-apps")).body;
  assert.equal((await user.delete(`/api/connected-apps/${app.id}`)).status, 204);

  const old = new Date(Date.now() - 2 * 86_400_000);
  await server.prisma.oAuthClient.updateMany({ where: { clientId: { in: [stale.client_id, approved.client_id] } }, data: { createdAt: old } });
  await register({}, { fresh: true });
  assert.equal(await server.prisma.oAuthClient.count({ where: { clientId: stale.client_id } }), 0);
  assert.equal(await server.prisma.oAuthClient.count({ where: { clientId: approved.client_id } }), 1);

  const again = await approve(user, approved);
  assert.equal((await exchange(approved, again.code, again.verifier)).status, 200);
});

test("a name with a broken character is stored, not refused by the database", async () => {
  const client = await register({ client_name: "Claude \ud800 test" });
  assert.equal(client.client_name, "Claude \ufffd test");
  const user = await server.signUp();
  const token = await user.post("/api/tokens", { name: "laptop \udc00", expiresInDays: 7, canWrite: false });
  assert.equal(token.status, 201);
  assert.equal(token.body.name, "laptop \ufffd");
});

test("a request that cannot be trusted is answered on the page, never redirected", async () => {
  const user = await server.signUp();
  const client = await register();
  const { challenge } = pkce();
  const unknown = await request("GET", `/api/oauth/authorize?${authorizeQuery({ client_id: "rrc_" + "a".repeat(22) }, { challenge })}`, { cookie: user.cookie });
  assert.equal(unknown.status, 400);
  assert.match(unknown.body, /not registered/);
  const elsewhere = await request("GET", `/api/oauth/authorize?${authorizeQuery(client, { challenge, redirect: "https://evil.example/cb" })}`, { cookie: user.cookie });
  assert.equal(elsewhere.status, 400);
  assert.match(elsewhere.body, /did not register/);
  assert.equal(elsewhere.headers.get("location"), null);
});

test("other problems are sent back to the app with the state", async () => {
  const user = await server.signUp();
  const client = await register();
  const cases = [
    [{ code_challenge: "" }, "invalid_request"],
    [{ code_challenge_method: "plain" }, "invalid_request"],
    [{ response_type: "token" }, "unsupported_response_type"],
    [{ scope: "receipts:read admin" }, "invalid_scope"],
    [{ resource: "https://evil.example/api/mcp" }, "invalid_target"]
  ];
  for (const [override, error] of cases) {
    const query = new URLSearchParams(authorizeQuery(client, { challenge: pkce().challenge }));
    for (const [key, value] of Object.entries(override)) query.set(key, value);
    const response = await request("GET", `/api/oauth/authorize?${query}`, { cookie: user.cookie });
    assert.equal(response.status, 303, JSON.stringify(override));
    const location = new URL(response.headers.get("location"));
    assert.equal(location.searchParams.get("error"), error);
    assert.equal(location.searchParams.get("state"), "xyz");
  }
});

test("the consent form only works from this page, for this session", async () => {
  const user = await server.signUp();
  const intruder = await server.signUp();
  const client = await register();
  const { challenge } = pkce();
  const page = await request("GET", `/api/oauth/authorize?${authorizeQuery(client, { challenge })}`, { cookie: user.cookie });
  const form = { ...consentForm(page.body), decision: "allow" };

  const forged = await request("POST", "/api/oauth/authorize", { form: { ...form, consent_token: "forged" }, cookie: user.cookie });
  assert.equal(forged.status, 403);
  const otherSession = await request("POST", "/api/oauth/authorize", { form, cookie: intruder.cookie });
  assert.equal(otherSession.status, 403);
  const tampered = await request("POST", "/api/oauth/authorize", { form: { ...form, scope: "receipts:read" }, cookie: user.cookie });
  assert.equal(tampered.status, 403);
  const foreign = await request("POST", "/api/oauth/authorize", { form, cookie: user.cookie, headers: { Origin: "https://evil.example" } });
  assert.equal(foreign.status, 403);
  const signedOut = await request("POST", "/api/oauth/authorize", { form });
  assert.equal(signedOut.status, 200);
  assert.match(signedOut.body, /Sign in to connect/);
  assert.equal(await server.prisma.oAuthCode.count({ where: { userId: user.user.id } }), 0);

  const denied = await request("POST", "/api/oauth/authorize", { form: { ...form, decision: "deny" }, cookie: user.cookie });
  assert.equal(denied.status, 303);
  assert.equal(new URL(denied.headers.get("location")).searchParams.get("error"), "access_denied");
});

test("an app's name is shown as text, never as markup", async () => {
  const user = await server.signUp();
  const client = await register({ client_name: '<img src=x onerror=alert(1)> "Claude"' });
  const page = await request("GET", `/api/oauth/authorize?${authorizeQuery(client, { challenge: pkce().challenge })}`, { cookie: user.cookie });
  assert.ok(!page.body.includes("<img src=x"));
  assert.ok(page.body.includes("&lt;img src=x onerror=alert(1)&gt; &quot;Claude&quot;"));
});

test("a read-only grant gets the read tools only and cannot widen on refresh", async () => {
  const user = await server.signUp();
  const client = await register();
  const { code, verifier, page } = await approve(user, client, { scope: "receipts:read" });
  assert.ok(!page.body.includes("Correct prices"));
  const tokens = (await exchange(client, code, verifier)).body;
  assert.equal(tokens.scope, "receipts:read");
  const tools = (await mcp(tokens.access_token)).body.result.tools.map((tool) => tool.name);
  assert.ok(!tools.includes("update_receipt"));
  const widened = await request("POST", "/api/oauth/token", {
    form: { grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: client.client_id, scope: "receipts:write" }
  });
  assert.equal(widened.body.error, "invalid_scope");
});

test("revocation ends the grant; unknown tokens are not an error", async () => {
  const user = await server.signUp();
  const client = await register();
  const { code, verifier } = await approve(user, client);
  const tokens = (await exchange(client, code, verifier)).body;
  const revoked = await request("POST", "/api/oauth/revoke", { form: { token: tokens.refresh_token, client_id: client.client_id } });
  assert.equal(revoked.status, 200);
  assert.equal((await mcp(tokens.access_token)).status, 401);
  assert.equal((await request("POST", "/api/oauth/revoke", { form: { token: "nothing", client_id: client.client_id } })).status, 200);
  assert.equal((await request("POST", "/api/oauth/revoke", { form: { client_id: client.client_id } })).body.error, "invalid_request");
});

test("changing the password disconnects every app; so does deleting the account", async () => {
  const user = await server.signUp({ password: "first password" });
  const client = await register();
  const { code, verifier } = await approve(user, client);
  const tokens = (await exchange(client, code, verifier)).body;
  assert.equal((await mcp(tokens.access_token)).status, 200);
  await user.post("/api/auth/password", { currentPassword: "first password", newPassword: "second password" });
  assert.equal((await mcp(tokens.access_token)).status, 401);
  const refresh = await request("POST", "/api/oauth/token", { form: { grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: client.client_id } });
  assert.equal(refresh.body.error, "invalid_grant");

  const leaving = await server.signUp({ password: "leaving password" });
  const again = await approve(leaving, client);
  const leavingTokens = (await exchange(client, again.code, again.verifier)).body;
  assert.equal((await leaving.delete("/api/auth/account", { password: "leaving password" })).status, 204);
  assert.equal((await mcp(leavingTokens.access_token)).status, 401);
  assert.equal(await server.prisma.oAuthGrant.count({ where: { userId: leaving.user.id } }), 0);
});

test("an expired access token is refused and an expired refresh token cannot renew it", async () => {
  const user = await server.signUp();
  const client = await register();
  const { code, verifier } = await approve(user, client);
  const tokens = (await exchange(client, code, verifier)).body;
  await server.prisma.oAuthGrant.updateMany({ where: { userId: user.user.id }, data: { accessExpiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await mcp(tokens.access_token)).status, 401);
  await server.prisma.oAuthGrant.updateMany({ where: { userId: user.user.id }, data: { refreshExpiresAt: new Date(Date.now() - 1000) } });
  const refresh = await request("POST", "/api/oauth/token", { form: { grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: client.client_id } });
  assert.equal(refresh.body.error, "invalid_grant");
  assert.equal((await user.get("/api/connected-apps")).body.length, 0);
});
