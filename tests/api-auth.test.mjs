import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer, ADMIN_EMAIL } from "./helpers/test-server.mjs";

const server = await startTestServer({ MAX_USERS: "50" });
test.after(() => server.close());

test("register signs in with a cookie, and me reports the account", async () => {
  const browser = server.client();
  const registered = await browser.post("/api/auth/register", {
    email: "  New.User@Test.dev ",
    password: "long enough password",
    name: " New "
  });
  assert.equal(registered.status, 201);
  assert.equal(registered.body.email, "new.user@test.dev");
  assert.equal(registered.body.token, undefined, "a cookie client gets no token in the body");
  assert.match(registered.headers.get("set-cookie"), /rr_session=.*HttpOnly/i);

  const me = await browser.get("/api/auth/me");
  assert.equal(me.status, 200);
  assert.equal(me.body.isAdmin, false);
});

test("register refuses bad input and duplicate accounts", async () => {
  const browser = server.client();
  assert.equal((await browser.post("/api/auth/register", { email: "nope", password: "long enough" })).status, 400);
  assert.equal((await browser.post("/api/auth/register", { email: "a@b.dev", password: "short" })).status, 400);
  await browser.post("/api/auth/register", { email: "dupe@test.dev", password: "long enough password" });
  const again = await server.client().post("/api/auth/register", { email: "dupe@test.dev", password: "long enough password" });
  assert.equal(again.status, 409);
});

test("login: right password signs in, wrong one does not, unknown email looks the same", async () => {
  const user = await server.signUp({ email: "login@test.dev", password: "the right password" });
  const browser = server.client();
  const wrong = await browser.post("/api/auth/login", { email: "login@test.dev", password: "the wrong password" });
  assert.equal(wrong.status, 401);
  const unknown = await browser.post("/api/auth/login", { email: "ghost@test.dev", password: "anything at all" });
  assert.equal(unknown.status, 401);
  assert.equal(unknown.body.error, wrong.body.error);

  const right = await browser.post("/api/auth/login", { email: "LOGIN@test.dev", password: "the right password" });
  assert.equal(right.status, 200);
  assert.equal(right.body.id, user.user.id);
  assert.equal((await browser.get("/api/auth/me")).status, 200);
});

test("an account with no password cannot be logged into", async () => {
  await server.prisma.user.create({ data: { email: "nopass@test.dev" } });
  const response = await server.client().post("/api/auth/login", { email: "nopass@test.dev", password: "whatever it is" });
  assert.equal(response.status, 401);
});

test("the admin account is reported as one", async () => {
  const admin = await server.admin();
  const me = await admin.get("/api/auth/me");
  assert.equal(me.body.email, ADMIN_EMAIL);
  assert.equal(me.body.isAdmin, true);
});

test("an expired session is refused and removed", async () => {
  const user = await server.signUp();
  await server.prisma.session.updateMany({ where: { userId: user.user.id }, data: { expiresAt: new Date(0) } });
  const response = await user.get("/api/auth/me");
  assert.equal(response.status, 401);
  assert.equal(response.body.error, "Session expired.");
  assert.equal(await server.prisma.session.count({ where: { userId: user.user.id } }), 0);
});

test("a session whose user is gone is refused", async () => {
  const user = await server.signUp();
  await server.prisma.session.deleteMany({ where: { userId: user.user.id } });
  assert.equal((await user.get("/api/auth/me")).status, 401);
});

test("deleting the account needs the password and takes the receipts with it", async () => {
  const user = await server.signUp({ password: "delete me please" });
  await user.post("/api/receipts", {
    category: "Other",
    lines: [{ clientId: "a", label: "Thing", amount: 1, ignored: false }],
    people: [],
    assignments: []
  });

  const wrong = await user.delete("/api/auth/account", { password: "not it" });
  assert.equal(wrong.status, 403);

  const done = await user.delete("/api/auth/account", { password: "delete me please" });
  assert.equal(done.status, 204);
  assert.equal(await server.prisma.user.count({ where: { id: user.user.id } }), 0);
  assert.equal(await server.prisma.receipt.count({ where: { userId: user.user.id } }), 0);
  assert.equal((await user.get("/api/auth/me")).status, 401);
});

test("logout without a session is still a clean 204", async () => {
  assert.equal((await server.client().post("/api/auth/logout")).status, 204);
});

test("login is throttled per account after repeated failures", async () => {
  await server.signUp({ email: "throttle@test.dev", password: "real password here" });
  const browser = server.client();
  let last;
  for (let attempt = 0; attempt < 11; attempt += 1) {
    last = await browser.post("/api/auth/login", { email: "throttle@test.dev", password: "guess guess guess" });
  }
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get("retry-after")) > 0);
});

test("requests without a session get 401 on every protected route", async () => {
  const anonymous = server.client();
  for (const path of ["/api/receipts", "/api/people", "/api/rent-entries", "/api/gemini-config", "/api/item-aliases"]) {
    assert.equal((await anonymous.get(path)).status, 401, path);
  }
});
