import test from "node:test";
import assert from "node:assert/strict";
import { createAuth } from "../server/auth.mjs";

// createAuth only touches the database from its routes and its purge timer,
// neither of which runs here, so a stub that answers the purge is enough.
const prismaStub = { session: { deleteMany: async () => ({ count: 0 }) } };

function fakeResponse() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

test("requireAdmin lets an admin through and refuses everyone else with a 403", () => {
  const { requireAdmin } = createAuth(prismaStub);

  let passed = false;
  const okRes = fakeResponse();
  requireAdmin({ isAdmin: true }, okRes, () => {
    passed = true;
  });
  assert.equal(passed, true);
  assert.equal(okRes.body, null);

  const deniedRes = fakeResponse();
  let calledNext = false;
  requireAdmin({ isAdmin: false }, deniedRes, () => {
    calledNext = true;
  });
  assert.equal(calledNext, false);
  assert.equal(deniedRes.statusCode, 403);
  assert.match(deniedRes.body.error, /admin accounts/);

  // An unauthenticated request never gets this far, but a missing flag must
  // still read as "not an admin", never as "admin by omission".
  const noFlag = fakeResponse();
  requireAdmin({}, noFlag, () => {});
  assert.equal(noFlag.statusCode, 403);
});
