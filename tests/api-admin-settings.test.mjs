import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer, JPEG_DATA_URL } from "./helpers/test-server.mjs";
import { recentMonths } from "../server/admin-metrics.mjs";

const server = await startTestServer();
test.after(() => server.close());

const VALID_KEY = "AIza" + "y".repeat(35);

async function receipt(user, overrides = {}) {
  const response = await user.post("/api/receipts", {
    storeName: "Costco",
    category: "Groceries",
    total: 30,
    lines: [
      { clientId: "a", label: "KS WTR", amount: 10, ignored: false, isFood: true, identification: { resolvedName: "Water", confidence: 0.9, source: "ai", alternatives: [], confirmed: false } },
      { clientId: "b", label: "TOWELS", amount: 20, ignored: false }
    ],
    people: [],
    assignments: [],
    ...overrides
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body;
}

test("admin tools are refused to everyone but admins", async () => {
  const user = await server.signUp();
  for (const path of ["/api/admin/overview", "/api/admin/users", `/api/admin/users/${user.user.id}`]) {
    assert.equal((await user.get(path)).status, 403, path);
    assert.equal((await server.client().get(path)).status, 401, path);
  }
  assert.equal((await user.post(`/api/admin/users/${user.user.id}/sign-out`)).status, 403);
});

test("the overview counts accounts, receipts, lines, storage and months", async () => {
  const admin = await server.admin();
  const alice = await server.signUp({ name: "Alice" });
  await alice.put("/api/gemini-key", { apiKey: VALID_KEY });
  await receipt(alice, { imageDataUrl: JPEG_DATA_URL });
  await receipt(alice);
  await alice.post("/api/rent-entries", { year: 2026, month: 3, amount: 800 });

  const overview = await admin.get("/api/v1/admin/overview");
  assert.equal(overview.status, 200);
  const body = overview.body;
  assert.ok(body.users.total >= 2);
  assert.ok(body.users.admins >= 1);
  assert.ok(body.users.newLast7Days >= 2);
  assert.ok(body.users.activeLast30Days >= 2);
  assert.ok(body.users.withOwnGeminiKey >= 1);
  assert.ok(body.receipts.total >= 2);
  assert.ok(body.receipts.withPhotos >= 1);
  assert.ok(body.receipts.lines >= 4);
  assert.ok(body.receipts.identifiedLines >= 2);
  assert.ok(body.receipts.foodLines >= 2);
  assert.ok(body.receipts.totalSpend >= 60);
  assert.ok(body.rent.entries >= 1);
  assert.ok(body.storage.photoBytes > 0);
  assert.equal(body.monthly.length, 12);
  assert.ok(body.monthly.at(-1).receipts >= 2);
  assert.ok(body.monthly.at(-1).signups >= 2);
  assert.equal(body.limits.maxUsers, 20);
});

test("the user list shows usage per account and nothing secret", async () => {
  const admin = await server.admin();
  const bob = await server.signUp({ name: "Bob" });
  await bob.put("/api/gemini-key", { apiKey: VALID_KEY });
  await receipt(bob);

  const list = await admin.get("/api/admin/users");
  assert.equal(list.status, 200);
  const row = list.body.users.find((user) => user.id === bob.user.id);
  assert.equal(row.name, "Bob");
  assert.equal(row.receipts, 1);
  assert.equal(row.lines, 2);
  assert.equal(row.identifiedLines, 1);
  assert.equal(row.spend, 30);
  assert.equal(row.hasOwnGeminiKey, true);
  assert.equal(row.isAdmin, false);
  assert.ok(row.activeSessions >= 1);

  const raw = JSON.stringify(list.body);
  for (const secret of ["passwordHash", "geminiKey", "Ciphertext", "tokenHash", "scrypt$", VALID_KEY]) {
    assert.ok(!raw.includes(secret), `leaked ${secret}`);
  }
});

test("one account's detail: usage, months, and its recent receipts' metadata only", async () => {
  const admin = await server.admin();
  const carol = await server.signUp({ name: "Carol" });
  await receipt(carol, { imageDataUrl: JPEG_DATA_URL });

  const detail = await admin.get(`/api/admin/users/${carol.user.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.photos, 1);
  assert.equal(detail.body.monthly.length, 12);
  assert.equal(detail.body.recentReceipts.length, 1);
  assert.deepEqual(Object.keys(detail.body.recentReceipts[0]).sort(), ["category", "createdAt", "hasImage", "id", "lines", "storeName", "total"]);
  assert.ok(!JSON.stringify(detail.body).includes("imageData"));

  assert.equal((await admin.get("/api/admin/users/nobody")).status, 404);
  assert.equal((await admin.get("/api/admin/users/bad%20id!")).status, 400);
});

test("an admin can sign another account out everywhere, but not themselves", async () => {
  const admin = await server.admin();
  const dave = await server.signUp();
  assert.equal((await dave.get("/api/auth/me")).status, 200);

  const done = await admin.post(`/api/admin/users/${dave.user.id}/sign-out`);
  assert.equal(done.status, 200);
  assert.ok(done.body.revoked >= 1);
  assert.equal((await dave.get("/api/auth/me")).status, 401);

  assert.equal((await admin.post(`/api/admin/users/${admin.user.id}/sign-out`)).status, 400);
  assert.equal((await admin.post("/api/admin/users/nobody/sign-out")).status, 404);
  assert.equal((await admin.post("/api/admin/users/bad%20id!/sign-out")).status, 400);
});

test("profile: change the display name, within limits", async () => {
  const user = await server.signUp({ name: "Old" });
  const renamed = await user.patch("/api/auth/profile", { name: "  New   Name " });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.name, "New Name");
  assert.equal((await user.patch("/api/auth/profile", { name: "" })).body.name, null);
  assert.equal((await user.patch("/api/auth/profile", { name: 5 })).status, 400);
  assert.equal((await user.patch("/api/auth/profile", { name: "x".repeat(81) })).status, 400);
});

test("password change: needs the current one, and signs other sessions out", async () => {
  const user = await server.signUp({ password: "first password" });
  const elsewhere = server.client();
  await elsewhere.post("/api/auth/login", { email: user.user.email, password: "first password" });
  assert.equal((await elsewhere.get("/api/auth/me")).status, 200);

  assert.equal((await user.post("/api/auth/password", { currentPassword: "wrong one", newPassword: "second password" })).status, 403);
  assert.equal((await user.post("/api/auth/password", { currentPassword: "first password", newPassword: "short" })).status, 400);
  assert.equal((await user.post("/api/auth/password", { currentPassword: "first password", newPassword: "x".repeat(201) })).status, 400);
  assert.equal((await user.post("/api/auth/password", { currentPassword: "first password", newPassword: "first password" })).status, 400);

  const changed = await user.post("/api/auth/password", { currentPassword: "first password", newPassword: "second password" });
  assert.equal(changed.status, 200);
  assert.equal((await user.get("/api/auth/me")).status, 200, "this session stays");
  assert.equal((await elsewhere.get("/api/auth/me")).status, 401, "the other one is gone");
  assert.equal((await server.client().post("/api/auth/login", { email: user.user.email, password: "second password" })).status, 200);
});

test("sessions: list them and sign the others out", async () => {
  const user = await server.signUp({ password: "session password" });
  const other = server.client();
  await other.post("/api/auth/login", { email: user.user.email, password: "session password" });

  const list = await user.get("/api/auth/sessions");
  assert.equal(list.body.active, 2);
  assert.equal(list.body.sessions.filter((session) => session.current).length, 1);
  assert.ok(!JSON.stringify(list.body).includes("tokenHash"));

  assert.equal((await user.post("/api/auth/sessions/revoke-others")).body.revoked, 1);
  assert.equal((await other.get("/api/auth/me")).status, 401);
  assert.equal((await user.get("/api/auth/sessions")).body.active, 1);
});

test("an absurdly long password is refused before it is hashed", async () => {
  const long = "p".repeat(10_000);
  assert.equal((await server.client().post("/api/auth/register", { email: "long@test.dev", password: long })).status, 400);
  assert.equal((await server.client().post("/api/auth/login", { email: "long@test.dev", password: long })).status, 401);
});

test("recentMonths counts back across a year boundary", () => {
  assert.deepEqual(recentMonths(3, new Date(Date.UTC(2026, 0, 15))), ["2025-11", "2025-12", "2026-01"]);
});
