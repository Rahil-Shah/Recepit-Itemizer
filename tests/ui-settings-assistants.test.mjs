// Settings → Claude & AI assistants, driven in jsdom against the real API:
// the connection URL and setup snippets, creating, copying and revoking a
// personal access token, and disconnecting an app connected through OAuth.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { startTestServer } from "./helpers/test-server.mjs";
import { openApp } from "./helpers/ui-harness.mjs";

const server = await startTestServer();
test.after(() => server.close());

const submit = (ui, selector) => ui.$(selector).dispatchEvent(new ui.window.Event("submit", { bubbles: true, cancelable: true }));

async function openSettings(user, clipboard) {
  const ui = await openApp(server, {
    as: user,
    setup: (ui) => {
      Object.defineProperty(ui.window.navigator, "clipboard", {
        configurable: true,
        value: clipboard ?? { writeText: async () => { throw new Error("denied"); } }
      });
    }
  });
  ui.click("#settingsButton");
  await ui.waitFor(() => !ui.$("#settingsView").classList.contains("hidden"), { message: "settings to open" });
  await ui.waitFor(() => ui.$$("#apiTokenList li").length > 0 && ui.$$("#connectedAppList li").length > 0, { message: "the lists" });
  return ui;
}

/** Connect an app for `user` through the OAuth flow, as claude.ai would. */
async function connectApp(user) {
  const redirect = "https://claude.ai/api/mcp/auth_callback";
  const client = await (await fetch(`${server.baseUrl}/api/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: "Claude", redirect_uris: [redirect], token_endpoint_auth_method: "none" })
  })).json();
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const query = new URLSearchParams({ response_type: "code", client_id: client.client_id, redirect_uri: redirect, code_challenge: challenge, code_challenge_method: "S256" });
  const page = await (await fetch(`${server.baseUrl}/api/oauth/authorize?${query}`, { headers: { Cookie: user.cookie } })).text();
  const form = Object.fromEntries([...page.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)].map((match) => [match[1], match[2].replace(/&amp;/g, "&")]));
  const answer = await fetch(`${server.baseUrl}/api/oauth/authorize`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: user.cookie },
    body: new URLSearchParams({ ...form, decision: "allow" })
  });
  const code = new URL(answer.headers.get("location")).searchParams.get("code");
  const tokens = await (await fetch(`${server.baseUrl}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, code_verifier: verifier, client_id: client.client_id, redirect_uri: redirect })
  })).json();
  return tokens.access_token;
}

const mcpStatus = async (token) =>
  (await fetch(`${server.baseUrl}/api/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" })
  })).status;

test("the section shows the connection URL, the setup steps and empty lists", async () => {
  const user = await server.signUp();
  const copied = [];
  const ui = await openSettings(user, { writeText: async (text) => copied.push(text) });

  assert.equal(ui.text("#mcpUrl"), `${server.baseUrl}/api/mcp`);
  assert.ok(ui.$('.settings-nav a[href="#settingsAssistants"]'));
  assert.match(ui.text("#settingsAssistants .setup-steps"), /Add custom connector/);
  assert.equal(
    ui.text("#claudeCodeCommand"),
    `claude mcp add --transport http receipt-ring ${server.baseUrl}/api/mcp --header "Authorization: Bearer YOUR_TOKEN"`
  );
  const desktop = JSON.parse(ui.$("#desktopConfig").textContent);
  assert.deepEqual(desktop.mcpServers["receipt-ring"].args, ["-y", "mcp-remote", `${server.baseUrl}/api/mcp`, "--header", "Authorization:${RECEIPT_RING_AUTH}"]);
  assert.equal(desktop.mcpServers["receipt-ring"].env.RECEIPT_RING_AUTH, "Bearer YOUR_TOKEN");
  assert.equal(ui.text("#apiTokenList"), "No tokens yet.");
  assert.match(ui.text("#connectedAppList"), /Nothing connected yet/);

  ui.click('[data-copy-target="mcpUrl"]');
  await ui.waitFor(() => copied.length === 1, { message: "the copy" });
  assert.equal(copied[0], `${server.baseUrl}/api/mcp`);
  assert.equal(ui.text('[data-copy-target="mcpUrl"]'), "Copied");
  assert.deepEqual(ui.errors, []);
});

test("creating a token shows it once, fills it into the snippets, and lists it; revoking ends it", async () => {
  const user = await server.signUp();
  const copied = [];
  const ui = await openSettings(user, { writeText: async (text) => copied.push(text) });

  // A name is required.
  submit(ui, "#apiTokenForm");
  assert.match(ui.text("#assistantStatus"), /Give the token a name/);

  ui.type("#apiTokenName", "Claude Code");
  ui.type("#apiTokenExpiry", "30");
  ui.$("#apiTokenCanWrite").checked = false;
  submit(ui, "#apiTokenForm");
  await ui.waitFor(() => !ui.$("#newApiToken").classList.contains("hidden"), { message: "the new token" });
  const token = ui.text("#newApiTokenValue");
  assert.match(token, /^rr_pat_[\w-]{43}$/);
  assert.ok(ui.text("#claudeCodeCommand").endsWith(`Bearer ${token}"`));
  assert.equal(JSON.parse(ui.$("#desktopConfig").textContent).mcpServers["receipt-ring"].env.RECEIPT_RING_AUTH, `Bearer ${token}`);
  assert.equal(ui.$("#apiTokenName").value, "", "the form is reset");
  assert.ok(ui.$("#apiTokenCanWrite").checked, "corrections are on again by default");

  await ui.waitFor(() => ui.$$("#apiTokenList .assistant-item").length === 1, { message: "the token list" });
  const row = ui.text("#apiTokenList .assistant-item");
  assert.match(row, /Claude Code/);
  assert.match(row, /Read only/);
  assert.match(row, /Never used/);
  assert.ok(row.includes(token.slice(0, 11)));
  assert.ok(!row.includes(token.slice(11)), "only the prefix is listed");

  ui.click('[data-copy-target="newApiTokenValue"]');
  await ui.waitFor(() => copied.includes(token), { message: "the token copy" });

  // It works, read-only, and shows as used.
  assert.equal(await mcpStatus(token), 200);

  // Opening Settings again forgets the token.
  ui.click("#closeSettingsButton");
  ui.click("#settingsButton");
  await ui.waitFor(() => /Last used just now/.test(ui.text("#apiTokenList")), { message: "last used" });
  assert.ok(ui.$("#newApiToken").classList.contains("hidden"));
  assert.equal(ui.text("#newApiTokenValue"), "");
  assert.match(ui.text("#claudeCodeCommand"), /YOUR_TOKEN/);

  // Revoking asks first.
  ui.confirmAnswer = false;
  ui.click("#apiTokenList button[data-token-id]");
  await ui.settle();
  assert.equal(await mcpStatus(token), 200);
  ui.confirmAnswer = true;
  ui.click("#apiTokenList button[data-token-id]");
  await ui.waitFor(() => ui.text("#apiTokenList") === "No tokens yet.", { message: "the revoke" });
  assert.equal(await mcpStatus(token), 401);
  assert.deepEqual(ui.errors, []);
});

test("a token the server refuses is reported, and a failed copy selects the text", async () => {
  const user = await server.signUp();
  for (let index = 0; index < 10; index += 1) {
    await user.post("/api/tokens", { name: `t${index}`, expiresInDays: 7, canWrite: true });
  }
  const ui = await openSettings(user);
  ui.type("#apiTokenName", "one too many");
  submit(ui, "#apiTokenForm");
  await ui.waitFor(() => /up to 10 tokens/.test(ui.text("#assistantStatus")), { message: "the limit" });
  assert.ok(ui.$("#assistantStatus").classList.contains("is-error"));

  ui.click('[data-copy-target="mcpUrl"]');
  await ui.waitFor(() => ui.toasts().some((toast) => /Couldn't copy/.test(toast)), { message: "the copy fallback" });
  assert.equal(ui.window.getSelection().toString(), `${server.baseUrl}/api/mcp`);
});

test("an app connected through OAuth is listed and can be disconnected", async () => {
  const user = await server.signUp();
  const accessToken = await connectApp(user);
  assert.equal(await mcpStatus(accessToken), 200);

  const ui = await openSettings(user);
  await ui.waitFor(() => ui.$$("#connectedAppList .assistant-item").length === 1, { message: "the app" });
  assert.match(ui.text("#connectedAppList"), /Claude.*Read & correct.*Connected/);
  ui.confirmAnswer = true;
  ui.click("#connectedAppList button[data-app-id]");
  await ui.waitFor(() => /Nothing connected yet/.test(ui.text("#connectedAppList")), { message: "the disconnect" });
  assert.equal(await mcpStatus(accessToken), 401);
  assert.ok(ui.toasts().some((toast) => /Disconnected Claude/.test(toast)));
});
