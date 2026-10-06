import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer } from "./helpers/test-server.mjs";

const server = await startTestServer();
test.after(() => server.close());

test("register, me, logout", async () => {
  const user = await server.signUp();
  const me = await user.get("/api/auth/me");
  assert.equal(me.status, 200);
  assert.equal(me.body.email, user.user.email);
  assert.equal(me.body.isAdmin, false);

  const out = await user.post("/api/auth/logout");
  assert.equal(out.status, 204);
  assert.equal((await user.get("/api/auth/me")).status, 401);
});
