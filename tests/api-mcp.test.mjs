// The MCP endpoint (server/mcp.mjs), its tools (server/mcp-tools.mjs) and
// the personal access tokens that open it (server/api-tokens.mjs), driven over
// HTTP the way Claude would drive them.
import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer } from "./helpers/test-server.mjs";

const server = await startTestServer();
test.after(() => server.close());

let nextId = 1;

/** POST one JSON-RPC message to the endpoint with a bearer token. */
async function rpc(token, method, params, { headers = {}, path = "/api/mcp" } = {}) {
  const response = await fetch(server.baseUrl + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, ...(params === undefined ? {} : { params }) })
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null };
}

/** Call a tool; returns { data } or { error } from the tool's result. */
async function call(token, name, args = {}) {
  const response = await rpc(token, "tools/call", { name, arguments: args });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const result = response.body.result;
  assert.ok(result, JSON.stringify(response.body));
  const text = result.content[0].text;
  return result.isError ? { error: text } : { data: JSON.parse(text) };
}

async function ok(token, name, args) {
  const result = await call(token, name, args);
  assert.ok(!result.error, `${name} failed: ${result.error}`);
  return result.data;
}

async function createToken(user, { name = "Claude", expiresInDays = 30, canWrite = true } = {}) {
  const created = await user.post("/api/tokens", { name, expiresInDays, canWrite });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  return created.body;
}

/** A user with people, a token, and a split receipt: Trader Joe's, $13 + $1 tax. */
async function setup({ canWrite = true } = {}) {
  const user = await server.signUp({ name: "Rahil" });
  const [me] = (await user.get("/api/people")).body;
  const sam = (await user.post("/api/people", { name: "Sam" })).body;
  const saved = await user.post("/api/receipts", {
    storeName: "Trader Joe's",
    category: "Groceries",
    subtotal: 13,
    tax: 1,
    total: 14,
    people: [{ clientId: me.id }, { clientId: sam.id }],
    lines: [
      { clientId: "a", label: "GV SHRD MOZZ", amount: 4, isFood: true, itemCode: "0012345", identification: { resolvedName: "Shredded Mozzarella", confidence: 0.9, source: "ai" } },
      { clientId: "b", label: "ORGANIC BANANAS", amount: 3 },
      { clientId: "c", label: "DISH SOAP", amount: 6 },
      { clientId: "d", label: "COUPON NOTE", amount: 99, ignored: true }
    ],
    assignments: [
      { lineClientId: "a", personClientId: me.id, mode: "equal", value: 0 },
      { lineClientId: "a", personClientId: sam.id, mode: "equal", value: 0 },
      { lineClientId: "b", personClientId: me.id, mode: "equal", value: 0 },
      { lineClientId: "c", personClientId: sam.id, mode: "percentage", value: 100 }
    ]
  });
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  const { token } = await createToken(user, { canWrite });
  return { user, me, sam, receipt: saved.body, token };
}

// --- Tokens ------------------------------------------------------------------

test("a personal token is shown once, listed without its secret, and can be revoked", async () => {
  const user = await server.signUp();
  const created = await createToken(user, { name: "  My\u0000 laptop  " });
  assert.match(created.token, /^rr_pat_[A-Za-z0-9_-]{43}$/);
  assert.equal(created.name, "My laptop");
  assert.equal(created.prefix, created.token.slice(0, 11));
  assert.deepEqual(created.scopes, ["receipts:read", "receipts:write"]);
  const days = (new Date(created.expiresAt) - Date.now()) / 86_400_000;
  assert.ok(days > 29.9 && days <= 30);

  const listed = await user.get("/api/tokens");
  assert.equal(listed.status, 200);
  assert.equal(listed.headers.get("cache-control"), "no-store");
  assert.equal(listed.body.length, 1);
  assert.equal(listed.body[0].token, undefined);
  assert.ok(!JSON.stringify(listed.body).includes(created.token.slice(11)));

  // The database holds only a hash.
  const row = await server.prisma.apiToken.findUnique({ where: { id: created.id } });
  assert.notEqual(row.tokenHash, created.token);
  assert.equal(row.tokenHash.length, 64);

  assert.equal((await rpc(created.token, "ping")).status, 200);
  assert.equal((await user.delete(`/api/tokens/${created.id}`)).status, 204);
  assert.equal((await rpc(created.token, "ping")).status, 401);
  assert.equal((await user.delete(`/api/tokens/${created.id}`)).status, 404);
});

test("creating a token checks its name, lifetime and access, and caps how many there are", async () => {
  const user = await server.signUp();
  for (const body of [
    { name: "", expiresInDays: 30, canWrite: true },
    { name: "x".repeat(81), expiresInDays: 30, canWrite: true },
    { name: "ok", expiresInDays: 0, canWrite: true },
    { name: "ok", expiresInDays: 3650, canWrite: true },
    { name: "ok", expiresInDays: "30", canWrite: true },
    { name: "ok", expiresInDays: 30 },
    { name: "ok", expiresInDays: 30, canWrite: "yes" }
  ]) {
    assert.equal((await user.post("/api/tokens", body)).status, 400, JSON.stringify(body));
  }
  const readOnly = await createToken(user, { canWrite: false, expiresInDays: 7 });
  assert.deepEqual(readOnly.scopes, ["receipts:read"]);
  for (let index = 1; index < 10; index += 1) await createToken(user, { name: `t${index}` });
  const over = await user.post("/api/tokens", { name: "eleventh", expiresInDays: 30, canWrite: true });
  assert.equal(over.status, 400);
  assert.match(over.body.error, /up to 10/);
  // Expired ones do not count.
  await server.prisma.apiToken.updateMany({ where: { userId: user.user.id, name: "t1" }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await createToken(user, { name: "replacement" });
});

test("token routes are for the signed-in owner only", async () => {
  const owner = await server.signUp();
  const other = await server.signUp();
  const { id } = await createToken(owner);
  assert.equal((await server.client().get("/api/tokens")).status, 401);
  assert.equal((await server.client().post("/api/tokens", { name: "x", expiresInDays: 30, canWrite: true })).status, 401);
  assert.equal((await other.delete(`/api/tokens/${id}`)).status, 404);
  assert.equal((await other.get("/api/tokens")).body.length, 0);
  assert.equal((await owner.get("/api/tokens")).body.length, 1);
});

test("a token opens the MCP endpoint and nothing else; a session does not open the MCP endpoint", async () => {
  const user = await server.signUp();
  const { token } = await createToken(user);
  const viaToken = server.client({ token });
  assert.equal((await viaToken.get("/api/receipts")).status, 401);
  assert.equal((await viaToken.get("/api/tokens")).status, 401);
  assert.equal((await viaToken.post("/api/tokens", { name: "x", expiresInDays: 30, canWrite: true })).status, 401);

  const withSession = await rpc(user.sessionToken, "ping");
  assert.equal(withSession.status, 401);
  const withCookie = await fetch(`${server.baseUrl}/api/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: user.cookie },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" })
  });
  assert.equal(withCookie.status, 401);
});

test("an unauthenticated call is told where to get a token", async () => {
  const missing = await rpc(null, "ping");
  assert.equal(missing.status, 401);
  const challenge = missing.headers.get("www-authenticate");
  assert.match(challenge, /^Bearer resource_metadata="http:\/\/127\.0\.0\.1:\d+\/\.well-known\/oauth-protected-resource\/api\/mcp"$/);

  const bogus = await rpc(`rr_pat_${"a".repeat(43)}`, "ping");
  assert.equal(bogus.status, 401);
  assert.match(bogus.headers.get("www-authenticate"), /error="invalid_token"/);
  assert.equal((await rpc("not-a-token", "ping")).status, 401);
});

test("an expired token stops working, and use is recorded", async () => {
  const user = await server.signUp();
  const created = await createToken(user);
  assert.equal((await rpc(created.token, "ping")).status, 200);
  const row = await server.prisma.apiToken.findUnique({ where: { id: created.id } });
  assert.ok(row.lastUsedAt);
  await server.prisma.apiToken.update({ where: { id: created.id }, data: { expiresAt: new Date(Date.now() - 1) } });
  assert.equal((await rpc(created.token, "ping")).status, 401);
  assert.equal((await user.get("/api/tokens")).body.length, 0);
});

test("changing the password revokes every token", async () => {
  const user = await server.signUp({ password: "first password" });
  const { token } = await createToken(user);
  assert.equal((await rpc(token, "ping")).status, 200);
  const changed = await user.post("/api/auth/password", { currentPassword: "first password", newPassword: "second password" });
  assert.equal(changed.status, 200);
  assert.equal((await rpc(token, "ping")).status, 401);
  assert.equal(await server.prisma.apiToken.count({ where: { userId: user.user.id } }), 0);
});

test("an admin signing an account out revokes its tokens too", async () => {
  const admin = await server.admin();
  const user = await server.signUp();
  const { token } = await createToken(user);
  const out = await admin.post(`/api/admin/users/${user.user.id}/sign-out`);
  assert.equal(out.status, 200);
  assert.equal((await rpc(token, "ping")).status, 401);
});

test("a token stops working when its account is locked out of the deployment", async () => {
  const user = await server.signUp();
  const { token } = await createToken(user);
  const saved = { ALLOW_PUBLIC_SIGNUP: process.env.ALLOW_PUBLIC_SIGNUP, ALLOWED_LOGIN_EMAILS: process.env.ALLOWED_LOGIN_EMAILS };
  process.env.ALLOW_PUBLIC_SIGNUP = "false";
  process.env.ALLOWED_LOGIN_EMAILS = "someone-else@test.dev";
  try {
    assert.equal((await rpc(token, "ping")).status, 401);
  } finally {
    Object.assign(process.env, saved);
  }
  assert.equal((await rpc(token, "ping")).status, 200);
});

// --- Protocol ----------------------------------------------------------------

test("initialize negotiates a version and describes the server", async () => {
  const { token } = await setup();
  const init = await rpc(token, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
  assert.equal(init.status, 200);
  assert.equal(init.headers.get("cache-control"), "no-store");
  assert.equal(init.body.jsonrpc, "2.0");
  assert.equal(init.body.result.protocolVersion, "2025-06-18");
  assert.deepEqual(init.body.result.capabilities, { tools: { listChanged: false } });
  assert.equal(init.body.result.serverInfo.name, "receipt-ring");
  assert.match(init.body.result.instructions, /compare_receipt/);
  assert.equal(init.headers.get("mcp-session-id"), null);

  const future = await rpc(token, "initialize", { protocolVersion: "2099-01-01" });
  assert.equal(future.body.result.protocolVersion, "2025-11-25");
  const old = await rpc(token, "initialize", { protocolVersion: "2024-11-05" });
  assert.equal(old.body.result.protocolVersion, "2024-11-05");
});

test("notifications get 202, batches get a list, and malformed messages get JSON-RPC errors", async () => {
  const { token } = await setup();
  const post = (body, headers = {}) =>
    fetch(`${server.baseUrl}/api/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body)
    });

  const notification = await post({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(notification.status, 202);
  assert.equal(await notification.text(), "");

  const batch = await post([
    { jsonrpc: "2.0", id: 1, method: "ping" },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: "two", method: "nope" },
    { id: 3, method: "ping" }
  ]);
  const answers = await batch.json();
  assert.deepEqual(answers.map((answer) => answer.id), [1, "two", 3]);
  assert.deepEqual(answers[0].result, {});
  assert.equal(answers[1].error.code, -32601);
  assert.equal(answers[2].error.code, -32600);

  const broken = await post("{not json");
  assert.equal(broken.status, 400);
  assert.equal((await broken.json()).error.code, -32700);

  const empty = await post([]);
  assert.equal(empty.status, 400);
  const tooMany = await post(Array.from({ length: 21 }, (_, id) => ({ jsonrpc: "2.0", id, method: "ping" })));
  assert.equal(tooMany.status, 400);
  const scalar = await post("42");
  assert.equal(scalar.status, 400);

  const nullId = await post({ jsonrpc: "2.0", id: null, method: "ping" });
  assert.equal((await nullId.json()).error.code, -32600);
  const badParams = await post({ jsonrpc: "2.0", id: 9, method: "tools/list", params: [1] });
  assert.equal((await badParams.json()).error.code, -32602);

  const version = await post({ jsonrpc: "2.0", id: 1, method: "ping" }, { "MCP-Protocol-Version": "1999-01-01" });
  assert.equal(version.status, 400);
  const goodVersion = await post({ jsonrpc: "2.0", id: 1, method: "ping" }, { "MCP-Protocol-Version": "2025-06-18" });
  assert.equal(goodVersion.status, 200);

  const textBody = await post("ping", { "Content-Type": "text/plain" });
  assert.equal(textBody.status, 400);
  assert.equal((await textBody.json()).error.code, -32700);
});

test("only POST is served, under /api and /api/v1", async () => {
  const { token } = await setup();
  for (const method of ["GET", "DELETE"]) {
    const response = await fetch(`${server.baseUrl}/api/mcp`, { method, headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "POST");
  }
  assert.equal((await rpc(token, "ping", undefined, { path: "/api/v1/mcp" })).status, 200);
});

test("a web page on another origin is refused; this site and CORS_ORIGINS are not", async () => {
  const { token } = await setup();
  assert.equal((await rpc(token, "ping", undefined, { headers: { Origin: "https://evil.example" } })).status, 403);
  assert.equal((await rpc(token, "ping", undefined, { headers: { Origin: server.baseUrl } })).status, 200);
  assert.equal((await rpc(token, "ping", undefined, { headers: { Origin: "https://ui.example.test" } })).status, 200);
});

test("tools/list describes the tools; a read-only token sees only the read tools", async () => {
  const { token } = await setup();
  const all = (await rpc(token, "tools/list")).body.result.tools;
  assert.deepEqual(all.map((tool) => tool.name), [
    "list_receipts", "get_receipt", "search_items", "list_people", "person_summary", "who_owes_what", "compare_receipt", "update_receipt", "create_receipt"
  ]);
  for (const tool of all) {
    assert.equal(tool.inputSchema.type, "object");
    assert.ok(tool.description.length > 40);
    assert.equal(typeof tool.annotations.readOnlyHint, "boolean");
  }

  const readOnly = await setup({ canWrite: false });
  const visible = (await rpc(readOnly.token, "tools/list")).body.result.tools.map((tool) => tool.name);
  assert.ok(!visible.includes("update_receipt") && !visible.includes("create_receipt"));
  const refused = await call(readOnly.token, "update_receipt", { receipt_id: readOnly.receipt.id, expected_version: new Date().toISOString(), tax: 2 });
  assert.match(refused.error, /only read/);
  const refusedCreate = await call(readOnly.token, "create_receipt", { items: [{ label: "x", amount: 1 }] });
  assert.match(refusedCreate.error, /only read/);
});

test("unknown methods, unknown tools and bad arguments are reported, not thrown", async () => {
  const { token } = await setup();
  assert.equal((await rpc(token, "sampling/createMessage")).body.error.code, -32601);
  assert.equal((await rpc(token, "tools/call", { name: "drop_tables", arguments: {} })).body.error.code, -32602);
  assert.deepEqual((await rpc(token, "resources/list")).body.result, { resources: [] });
  assert.deepEqual((await rpc(token, "prompts/list")).body.result, { prompts: [] });

  assert.match((await call(token, "get_receipt", { receiptId: "x" })).error, /Unknown argument "receiptId"/);
  assert.match((await call(token, "get_receipt", {})).error, /receipt_id must be an id/);
  assert.match((await call(token, "list_receipts", { limit: 500 })).error, /limit must be a whole number/);
  assert.match((await call(token, "list_receipts", { from: "2026-02-30" })).error, /YYYY-MM-DD/);
  assert.match((await call(token, "list_receipts", { from: "2026-03-02", to: "2026-03-01" })).error, /on or before/);
  const notObject = await rpc(token, "tools/call", { name: "list_people", arguments: [1] });
  assert.equal(notObject.body.result.isError, true);
});

// --- Reading -------------------------------------------------------------------

test("list_receipts filters by store, person, total and date, and pages", async () => {
  const { user, token, receipt } = await setup();
  await user.post("/api/receipts", { storeName: "Costco", category: "Groceries", subtotal: 50, tax: 0, total: 50, lines: [{ clientId: "x", label: "TP", amount: 50 }] });

  const all = await ok(token, "list_receipts");
  assert.equal(all.total_matching, 2);
  assert.equal(all.receipts[0].store, "Costco");
  const tj = all.receipts.find((entry) => entry.receipt_id === receipt.id);
  assert.equal(tj.item_count, 3);
  assert.deepEqual(tj.people, ["Rahil (you)", "Sam"]);
  assert.equal(tj.total, 14);

  assert.equal((await ok(token, "list_receipts", { store: "trader" })).total_matching, 1);
  assert.equal((await ok(token, "list_receipts", { person: "sam" })).receipts[0].receipt_id, receipt.id);
  assert.equal((await ok(token, "list_receipts", { person: "me" })).total_matching, 1);
  assert.match((await call(token, "list_receipts", { person: "Nobody" })).error, /People on this account: .*Sam/);
  assert.equal((await ok(token, "list_receipts", { min_total: 20 })).receipts[0].store, "Costco");
  assert.equal((await ok(token, "list_receipts", { max_total: 20 })).receipts[0].store, "Trader Joe's");
  const today = new Date().toISOString().slice(0, 10);
  assert.equal((await ok(token, "list_receipts", { from: today, to: today })).total_matching, 2);
  assert.equal((await ok(token, "list_receipts", { to: "2000-01-01" })).total_matching, 0);

  const first = await ok(token, "list_receipts", { limit: 1 });
  assert.equal(first.returned, 1);
  assert.equal(first.next_offset, 1);
  const second = await ok(token, "list_receipts", { limit: 1, offset: 1 });
  assert.equal(second.next_offset, undefined);
});

test("one account can never see another's receipts", async () => {
  const mine = await setup();
  const theirs = await setup();
  assert.equal((await ok(mine.token, "list_receipts")).total_matching, 1);
  assert.match((await call(mine.token, "get_receipt", { receipt_id: theirs.receipt.id })).error, /No receipt with id/);
  assert.match((await call(mine.token, "compare_receipt", { receipt_id: theirs.receipt.id, items: [{ label: "x", amount: 1 }] })).error, /No receipt/);
  assert.match(
    (await call(mine.token, "update_receipt", { receipt_id: theirs.receipt.id, expected_version: new Date().toISOString(), tax: 5 })).error,
    /No receipt/
  );
  assert.match((await call(mine.token, "person_summary", { person: theirs.sam.id })).error, /No person/);
  assert.equal((await ok(mine.token, "search_items", { query: "soap" })).returned, 1);
  assert.equal((await ok(mine.token, "who_owes_what")).receipts_read, 1);
});

test("get_receipt gives every item, each share, and who owes what", async () => {
  const { token, receipt } = await setup();
  const detail = await ok(token, "get_receipt", { receipt_id: receipt.id });
  assert.equal(detail.store, "Trader Joe's");
  assert.match(detail.version, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(detail.items.length, 4);
  const mozz = detail.items[0];
  assert.equal(mozz.name, "Shredded Mozzarella");
  assert.equal(mozz.item_code, "0012345");
  assert.deepEqual(mozz.split.map((share) => [share.person, share.share, share.how]), [
    ["Rahil", 2, "Split evenly · 2 people"],
    ["Sam", 2, "Split evenly · 2 people"]
  ]);
  assert.equal(detail.items[2].split[0].how, "Split by % · 100%");
  assert.equal(detail.items[3].ignored, true);
  assert.deepEqual(detail.items[3].split, []);

  // Rahil: 2 + 3 = 5 of 13 in items; Sam: 2 + 6 = 8. Tax $1 follows: 0.38 / 0.62.
  const owes = Object.fromEntries(detail.who_owes_what.map((entry) => [entry.person, entry]));
  assert.equal(owes.Rahil.items, 5);
  assert.equal(owes.Rahil.is_you, true);
  assert.equal(owes.Sam.items, 8);
  assert.equal(owes.Rahil.tax + owes.Sam.tax, 1);
  assert.equal(Math.round((owes.Rahil.total + owes.Sam.total) * 100), 1400);
  assert.equal(owes.Sam.total, 8.62);

  assert.deepEqual(detail.checks, {
    sum_of_items: 13,
    subtotal_matches_items: true,
    total_matches_items_plus_tax: true,
    items_with_nobody_on_them: 0,
    amount_not_assigned_to_anyone: 0
  });
});

test("search_items, list_people, person_summary and who_owes_what answer questions", async () => {
  const { user, token, me, sam } = await setup();
  await user.post("/api/receipts", {
    storeName: "Pizza Place",
    category: "Dining",
    subtotal: 30,
    tax: 3,
    total: 33,
    people: [{ clientId: me.id }, { clientId: sam.id }],
    lines: [
      { clientId: "p", label: "LARGE PIZZA", amount: 20 },
      { clientId: "s", label: "SODA", amount: 10 }
    ],
    assignments: [
      { lineClientId: "p", personClientId: me.id, mode: "equal", value: 0 },
      { lineClientId: "p", personClientId: sam.id, mode: "equal", value: 0 },
      { lineClientId: "s", personClientId: sam.id, mode: "amount", value: 10 }
    ]
  });

  const found = await ok(token, "search_items", { query: "mozzarella" });
  assert.equal(found.returned, 1);
  assert.equal(found.items[0].label, "GV SHRD MOZZ");
  assert.deepEqual(found.items[0].people, ["Rahil", "Sam"]);
  assert.equal((await ok(token, "search_items", { query: "0012345" })).returned, 1);
  assert.equal((await ok(token, "search_items", { query: "pizza", store: "trader" })).returned, 0);

  const people = await ok(token, "list_people");
  assert.deepEqual(people.people.map((person) => [person.name, person.is_you]), [["Rahil", true], ["Sam", false]]);

  const samSummary = await ok(token, "person_summary", { person: "Sam" });
  assert.equal(samSummary.receipts, 2);
  const pizza = samSummary.by_receipt.find((entry) => entry.store === "Pizza Place");
  assert.deepEqual(pizza.items.map((item) => [item.label, item.share, item.how]), [
    ["LARGE PIZZA", 10, "Split evenly · 2 people"],
    ["SODA", 10, "Custom amount"]
  ]);
  assert.equal(pizza.items_total, 20);
  assert.equal(pizza.tax, 2);
  assert.equal(pizza.total, 22);
  assert.equal(samSummary.grand_total, 30.62);
  const one = await ok(token, "person_summary", { person: sam.id, store: "pizza" });
  assert.equal(one.receipts, 1);
  const mine = await ok(token, "person_summary", { person: "me" });
  assert.equal(mine.is_you, true);

  const owed = await ok(token, "who_owes_what");
  assert.equal(owed.receipts_read, 2);
  assert.deepEqual(owed.people.map((entry) => [entry.person, entry.total]), [["Rahil", 16.38], ["Sam", 30.62]]);
  assert.equal(owed.amount_on_nobody, 0);
});

// --- Comparing and correcting --------------------------------------------------

test("compare_receipt pairs scanned items with saved lines and reports what differs", async () => {
  const { token, receipt } = await setup();
  const result = await ok(token, "compare_receipt", {
    receipt_id: receipt.id,
    items: [
      { label: "SHRD MOZZ", amount: 4.29, item_code: "12345" },
      { label: "Organic Bananas", amount: 3 },
      { label: "DISH SOAP LG", amount: 5.49 },
      { label: "PAPER TOWELS", amount: 8.99 }
    ],
    subtotal: 21.77,
    tax: 1.2,
    total: 22.97
  });
  assert.match(result.summary, /2 price difference\(s\), a different tax, 1 scanned item\(s\) not on the saved receipt/);
  assert.deepEqual(result.price_differences.map((entry) => [entry.saved_label, entry.saved_price, entry.scanned_price, entry.difference, entry.matched_by]), [
    ["GV SHRD MOZZ", 4, 4.29, 0.29, "item_code"],
    ["DISH SOAP", 6, 5.49, -0.51, "similar_label"]
  ]);
  assert.equal(result.matched.find((entry) => entry.saved_label === "ORGANIC BANANAS").matched_by, "label");
  assert.deepEqual(result.missing_from_saved, [{ scanned_label: "PAPER TOWELS", scanned_price: 8.99 }]);
  assert.deepEqual(result.not_on_scan, []);
  assert.deepEqual(result.totals.tax, { saved: 1, scanned: 1.2, difference: 0.2 });
  assert.deepEqual(result.totals.sum_of_items, { saved: 13, scanned: 21.77, difference: 8.77 });

  const suggestion = result.suggested_update;
  assert.equal(suggestion.receipt_id, receipt.id);
  assert.equal(suggestion.tax, 1.2);
  assert.equal(suggestion.line_prices.length, 2);
  assert.deepEqual(suggestion.add_lines, [{ label: "PAPER TOWELS", amount: 8.99 }]);

  // Nothing was written.
  const after = await ok(token, "get_receipt", { receipt_id: receipt.id });
  assert.equal(after.total, 14);
  assert.equal(after.version, suggestion.expected_version);
});

test("compare_receipt says so when everything matches, and lists saved lines it could not find", async () => {
  const { token, receipt } = await setup();
  const same = await ok(token, "compare_receipt", {
    receipt_id: receipt.id,
    items: [
      { label: "GV SHRD MOZZ", amount: 4 },
      { label: "ORGANIC BANANAS", amount: 3 },
      { label: "DISH SOAP", amount: 6 }
    ],
    tax: 1
  });
  assert.equal(same.summary, "The scanned items match the saved receipt.");
  assert.equal(same.suggested_update, undefined);

  const partial = await ok(token, "compare_receipt", { receipt_id: receipt.id, items: [{ label: "Shredded Mozzarella", amount: 4 }] });
  assert.deepEqual(partial.not_on_scan.map((line) => line.saved_label), ["ORGANIC BANANAS", "DISH SOAP"]);
  assert.match((await call(token, "compare_receipt", { receipt_id: receipt.id, items: [] })).error, /must not be empty/);
  assert.match((await call(token, "compare_receipt", { receipt_id: receipt.id, items: [{ label: "x", amount: "1" }] })).error, /items\[0\]\.amount/);
});

test("update_receipt applies the suggested corrections and the app sees them", async () => {
  const { user, token, receipt } = await setup();
  const compared = await ok(token, "compare_receipt", {
    receipt_id: receipt.id,
    items: [
      { label: "GV SHRD MOZZ", amount: 4.5 },
      { label: "ORGANIC BANANAS", amount: 3 },
      { label: "DISH SOAP", amount: 6 },
      { label: "PAPER TOWELS", amount: 2 }
    ],
    tax: 1.5
  });
  const suggestion = compared.suggested_update;
  suggestion.add_lines[0].people = ["Sam", "me"];

  const updated = await ok(token, "update_receipt", suggestion);
  assert.equal(updated.updated, true);
  assert.deepEqual(updated.price_changes.map((change) => [change.label, change.old_price, change.new_price]), [["GV SHRD MOZZ", 4, 4.5]]);
  assert.deepEqual(updated.tax_change, { old: 1, new: 1.5 });
  assert.equal(updated.added_items, 1);
  assert.deepEqual(updated.totals, {
    subtotal: { old: 13, new: 15.5 },
    tax: { old: 1, new: 1.5 },
    total: { old: 14, new: 17 }
  });
  assert.notEqual(updated.receipt.version, suggestion.expected_version);
  const towels = updated.receipt.items.find((item) => item.label === "PAPER TOWELS");
  assert.deepEqual(towels.split.map((share) => [share.person, share.share]), [["Sam", 1], ["Rahil", 1]]);

  // The History tab reads the same rows.
  const history = (await user.get("/api/receipts")).body.find((entry) => entry.id === receipt.id);
  assert.equal(history.total, 17);
  assert.equal(history.tax, 1.5);
  assert.equal(history.lines.find((line) => line.label === "GV SHRD MOZZ").amount, 4.5);
  assert.equal(history.lines.find((line) => line.label === "GV SHRD MOZZ").identification.resolvedName, "Shredded Mozzarella");
  assert.deepEqual(history.lines.at(-1).assignments.map((assignment) => assignment.personName).sort(), ["Rahil", "Sam"]);
});

test("update_receipt refuses a stale version and writes nothing", async () => {
  const { user, token, receipt } = await setup();
  const { version } = await ok(token, "get_receipt", { receipt_id: receipt.id });

  // The receipt is edited in the app in the meantime.
  const lines = receipt.lines;
  const edited = await user.put(`/api/receipts/${receipt.id}`, {
    storeName: "Trader Joe's",
    category: "Groceries",
    tax: 1,
    lines: lines.map((line) => ({ clientId: line.id, label: line.label, amount: line.amount, ignored: line.ignored }))
  });
  assert.equal(edited.status, 200);

  const stale = await call(token, "update_receipt", { receipt_id: receipt.id, expected_version: version, tax: 9 });
  assert.match(stale.error, /changed since you read it/);
  assert.equal((await ok(token, "get_receipt", { receipt_id: receipt.id })).tax, 1);
  assert.match((await call(token, "update_receipt", { receipt_id: receipt.id, expected_version: "yesterday", tax: 9 })).error, /expected_version/);
});

test("a failed update rolls back everything, including the version", async () => {
  const one = await setup();
  const other = await setup();
  const { version } = await ok(one.token, "get_receipt", { receipt_id: one.receipt.id });
  const foreignLine = other.receipt.lines[0].id;
  const failed = await call(one.token, "update_receipt", {
    receipt_id: one.receipt.id,
    expected_version: version,
    tax: 3,
    line_prices: [{ line_id: foreignLine, amount: 1 }]
  });
  assert.match(failed.error, /is not on this receipt/);
  const after = await ok(one.token, "get_receipt", { receipt_id: one.receipt.id });
  assert.equal(after.version, version);
  assert.equal(after.tax, 1);
  assert.equal((await ok(other.token, "get_receipt", { receipt_id: other.receipt.id })).items[0].price, 4);
});

test("update_receipt checks its arguments before touching anything", async () => {
  const { token, receipt } = await setup();
  const { version, items } = await ok(token, "get_receipt", { receipt_id: receipt.id });
  const base = { receipt_id: receipt.id, expected_version: version };
  for (const [args, pattern] of [
    [{}, /Nothing to change/],
    [{ line_prices: [{ line_id: items[0].line_id, amount: 1 }, { line_id: items[0].line_id, amount: 2 }] }, /names a line twice/],
    [{ ignore_line_ids: [items[0].line_id], restore_line_ids: [items[0].line_id] }, /both ignored and restored/],
    // JSON has no Infinity: it arrives as null.
    [{ line_prices: [{ line_id: items[0].line_id, amount: Infinity }] }, /amount is required/],
    [{ line_prices: [{ line_id: items[0].line_id, amount: "4.00" }] }, /amount must be a number/],
    [{ line_prices: [{ line_id: items[0].line_id, amount: 1e9 }] }, /amount must be a number/],
    [{ line_prices: [{ line: items[0].line_id, amount: 1 }] }, /Unknown argument "line"/],
    [{ add_lines: [{ label: "", amount: 1 }] }, /label must not be empty/],
    [{ add_lines: [{ label: "x".repeat(201), amount: 1 }] }, /at most 200/],
    [{ add_lines: [{ label: "x", amount: 1, people: ["Sam", "sam"] }] }, /twice/],
    [{ store_name: 5 }, /store_name must be a string/]
  ]) {
    assert.match((await call(token, "update_receipt", { ...base, ...args })).error, pattern, JSON.stringify(args));
  }
  assert.equal((await ok(token, "get_receipt", { receipt_id: receipt.id })).version, version);
});

test("update_receipt can ignore and restore items, rename the store, and warns about custom amounts", async () => {
  const { user, token, me, sam } = await setup();
  const saved = await user.post("/api/receipts", {
    storeName: "Cafe",
    category: "Dining",
    subtotal: 10,
    tax: 0,
    total: 10,
    people: [{ clientId: me.id }, { clientId: sam.id }],
    lines: [{ clientId: "a", label: "LUNCH", amount: 10 }, { clientId: "b", label: "TIP", amount: 0 }],
    assignments: [
      { lineClientId: "a", personClientId: me.id, mode: "amount", value: 4 },
      { lineClientId: "a", personClientId: sam.id, mode: "amount", value: 6 }
    ]
  });
  let detail = await ok(token, "get_receipt", { receipt_id: saved.body.id });
  const [lunch, tip] = detail.items;

  const first = await ok(token, "update_receipt", {
    receipt_id: saved.body.id,
    expected_version: detail.version,
    line_prices: [{ line_id: lunch.line_id, amount: 12 }],
    ignore_line_ids: [tip.line_id],
    store_name: "Corner Cafe"
  });
  assert.equal(first.ignored_items, 1);
  assert.deepEqual(first.store_change, { old: "Cafe", new: "Corner Cafe" });
  assert.match(first.warnings[0], /custom amounts adding up to 10, not the new price 12/);
  assert.equal(first.receipt.checks.amount_not_assigned_to_anyone, 2);

  const second = await ok(token, "update_receipt", {
    receipt_id: saved.body.id,
    expected_version: first.receipt.version,
    restore_line_ids: [tip.line_id],
    line_prices: [{ line_id: lunch.line_id, amount: 12 }]
  });
  assert.equal(second.restored_items, 1);
  assert.deepEqual(second.price_changes, []);
  detail = await ok(token, "get_receipt", { receipt_id: saved.body.id });
  assert.equal(detail.items[1].ignored, false);
});

test("update_receipt adds new people to the account, up to the account's limit", async () => {
  const { user, token, receipt } = await setup();
  let { version } = await ok(token, "get_receipt", { receipt_id: receipt.id });
  const added = await ok(token, "update_receipt", {
    receipt_id: receipt.id,
    expected_version: version,
    add_lines: [{ label: "GUM", amount: 1.25, item_code: "000777", is_food: true, people: ["Priya"] }]
  });
  assert.deepEqual(added.people_added_to_account, ["Priya"]);
  const gum = added.receipt.items.at(-1);
  assert.equal(gum.item_code, "000777");
  assert.equal(gum.is_food, true);
  assert.ok(added.receipt.people.some((person) => person.name === "Priya"));
  version = added.receipt.version;

  for (let index = 0; (await user.get("/api/people")).body.length < 10; index += 1) {
    await user.post("/api/people", { name: `Friend ${index}` });
  }
  const full = await call(token, "update_receipt", {
    receipt_id: receipt.id,
    expected_version: version,
    add_lines: [{ label: "MINTS", amount: 1, people: ["Stranger"] }]
  });
  assert.match(full.error, /already has the most it can/);
});

test("create_receipt saves a new receipt split between people, within the receipt limit", async () => {
  const { token } = await setup();
  const made = await ok(token, "create_receipt", {
    store_name: "Farmers Market",
    category: "Groceries",
    tax: 0.5,
    items: [
      { label: "Apples", amount: 4.99, is_food: true, people: ["me", "Sam"] },
      { label: "Flowers", amount: 10 },
      { label: "Bag fee note", amount: 0.1, ignored: true }
    ]
  });
  assert.equal(made.created, true);
  const receipt = made.receipt;
  assert.equal(receipt.store, "Farmers Market");
  assert.equal(receipt.subtotal, 14.99);
  assert.equal(receipt.total, 15.49);
  assert.deepEqual(receipt.items.map((item) => item.label), ["Apples", "Flowers", "Bag fee note"]);
  assert.deepEqual(receipt.items[0].split.map((share) => share.share).sort(), [2.49, 2.5]);
  assert.equal(receipt.checks.items_with_nobody_on_them, 1);

  assert.match((await call(token, "create_receipt", { items: [{ label: "x", amount: 1 }], category: "Food" })).error, /category must be one of/);
  assert.match((await call(token, "create_receipt", { items: [] })).error, /must not be empty/);

  const saved = process.env.MAX_RECEIPTS_PER_USER;
  process.env.MAX_RECEIPTS_PER_USER = "2";
  try {
    assert.match((await call(token, "create_receipt", { items: [{ label: "x", amount: 1 }] })).error, /limit of 2 saved receipts/);
  } finally {
    process.env.MAX_RECEIPTS_PER_USER = saved;
  }
});

test("an edit through a share link after an MCP read makes the MCP update stale, and the other way round", async () => {
  const { user, token, receipt } = await setup();
  const { version } = await ok(token, "get_receipt", { receipt_id: receipt.id });
  const link = (await user.post(`/api/receipts/${receipt.id}/shares`, { expiresInMinutes: 60, canEdit: true })).body;
  const api = link.path.replace("/r/", "/api/shared-receipts/");
  const shared = (await server.client().get(api)).body;

  const viaMcp = await ok(token, "update_receipt", { receipt_id: receipt.id, expected_version: version, tax: 2 });
  assert.equal(viaMcp.totals.total.new, 15);

  const viaLink = await server.client().put(api, {
    updatedAt: shared.updatedAt,
    storeName: shared.storeName,
    tax: 3,
    lines: shared.lines.map((line) => ({ id: line.id, label: line.name, amount: line.amount, assignments: line.assignments }))
  });
  assert.equal(viaLink.status, 409);
});
