import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedLoginEmail,
  assertAccessPolicy,
  isLocked,
  isLockedOut,
  mayUseSharedGeminiKey
} from "../server/access.mjs";

// Each test sets the environment it needs and puts it back, so the order the
// runner picks cannot leak one test's lock into the next.
function withEnv(values, run) {
  const saved = {};
  for (const [key, value] of Object.entries(values)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const open = { ALLOWED_LOGIN_EMAIL: undefined, ALLOW_PUBLIC_SIGNUP: undefined };
const locked = { ALLOWED_LOGIN_EMAIL: " Owner@Example.com ", ALLOW_PUBLIC_SIGNUP: undefined };

test("an unset or blank ALLOWED_LOGIN_EMAIL leaves the deployment open", () => {
  withEnv(open, () => {
    assert.equal(allowedLoginEmail(), null);
    assert.equal(isLocked(), false);
    assert.equal(isLockedOut("anyone@example.com"), false);
    assert.equal(mayUseSharedGeminiKey("anyone@example.com"), true);
  });
  withEnv({ ...open, ALLOWED_LOGIN_EMAIL: "   " }, () => {
    assert.equal(isLocked(), false);
  });
});

test("the allowed address is normalised, and compared case-insensitively", () => {
  withEnv(locked, () => {
    assert.equal(allowedLoginEmail(), "owner@example.com");
    assert.equal(isLockedOut("OWNER@example.com"), false);
    assert.equal(isLockedOut("  owner@EXAMPLE.com "), false);
  });
});

test("when locked, every other address is locked out of everything", () => {
  withEnv(locked, () => {
    assert.equal(isLocked(), true);
    assert.equal(isLockedOut("other@example.com"), true);
    assert.equal(isLockedOut(""), true);
    assert.equal(isLockedOut(null), true);
    assert.equal(isLockedOut(undefined), true);
    assert.equal(mayUseSharedGeminiKey("other@example.com"), false);
    assert.equal(mayUseSharedGeminiKey("owner@example.com"), true);
  });
});

test("production refuses to start open unless open sign-up is explicit", () => {
  withEnv(open, () => {
    assert.throws(() => assertAccessPolicy({ production: true }), /ALLOWED_LOGIN_EMAIL is not set/);
  });
  withEnv(locked, () => {
    assert.doesNotThrow(() => assertAccessPolicy({ production: true }));
  });
  withEnv({ ...open, ALLOW_PUBLIC_SIGNUP: "true" }, () => {
    assert.doesNotThrow(() => assertAccessPolicy({ production: true }));
  });
  // Anything but the literal "true" is not an opt-in.
  withEnv({ ...open, ALLOW_PUBLIC_SIGNUP: "yes" }, () => {
    assert.throws(() => assertAccessPolicy({ production: true }));
  });
});

test("outside production the policy never blocks startup", () => {
  withEnv(open, () => {
    assert.doesNotThrow(() => assertAccessPolicy({ production: false }));
  });
});
