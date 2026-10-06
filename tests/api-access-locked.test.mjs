import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer, ADMIN_EMAIL } from "./helpers/test-server.mjs";

// A closed instance: only the listed address (and admins) may hold an account,
// and it holds at most two.
const server = await startTestServer({
  ALLOW_PUBLIC_SIGNUP: "false",
  ALLOWED_LOGIN_EMAILS: "friend@test.dev,second@test.dev",
  MAX_USERS: "1"
});
test.after(() => server.close());

test("an address not on the list cannot register", async () => {
  const response = await server.client().post("/api/auth/register", { email: "stranger@test.dev", password: "long enough password" });
  assert.equal(response.status, 403);
  assert.equal(response.body.error, "Registration is closed.");
});

test("a listed address can, until the account limit; admins are exempt", async () => {
  const first = await server.client().post("/api/auth/register", { email: "friend@test.dev", password: "long enough password" });
  assert.equal(first.status, 201);

  const second = await server.client().post("/api/auth/register", { email: "second@test.dev", password: "long enough password" });
  assert.equal(second.status, 403);
  assert.match(second.body.error, /limit of 1 accounts/);

  const admin = await server.client().post("/api/auth/register", { email: ADMIN_EMAIL, password: "long enough password" });
  assert.equal(admin.status, 201);
  assert.equal(admin.body.isAdmin, true);
});

test("an account that is no longer allowed loses its session", async () => {
  const outsider = await server.signUp({ email: "removed@test.dev" });
  const response = await outsider.get("/api/auth/me");
  assert.equal(response.status, 401);
  const login = await server.client().post("/api/auth/login", { email: "removed@test.dev", password: outsider.password });
  assert.equal(login.status, 401);
});
