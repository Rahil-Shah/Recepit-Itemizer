import test from "node:test";
import assert from "node:assert/strict";
import {
  adminEmails,
  allowedEmails,
  assertAccessPolicy,
  isAdmin,
  isLocked,
  isLockedOut,
  maxReceiptsPerUser,
  maxUsers,
  mayUseSharedGeminiKey,
  publicSignupAllowed
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

const nothing = {
  ADMIN_EMAILS: undefined,
  ALLOWED_LOGIN_EMAILS: undefined,
  ALLOWED_LOGIN_EMAIL: undefined,
  ALLOW_PUBLIC_SIGNUP: undefined
};
const oneAdmin = { ...nothing, ADMIN_EMAILS: " Owner@Example.com " };
const adminAndGuests = {
  ...nothing,
  ADMIN_EMAILS: "owner@example.com",
  ALLOWED_LOGIN_EMAILS: "Friend@Example.com, partner@example.com;  "
};

test("with nothing configured the app is open and nobody is an admin", () => {
  withEnv(nothing, () => {
    assert.equal(adminEmails().size, 0);
    assert.equal(allowedEmails().size, 0);
    assert.equal(isLocked(), false);
    assert.equal(isLockedOut("anyone@example.com"), false);
    assert.equal(isAdmin("anyone@example.com"), false);
    assert.equal(mayUseSharedGeminiKey("anyone@example.com"), false);
  });
});

test("addresses are trimmed, lowercased, and split on commas, semicolons or whitespace", () => {
  withEnv(adminAndGuests, () => {
    assert.deepEqual([...adminEmails()], ["owner@example.com"]);
    assert.deepEqual([...allowedEmails()].sort(), ["friend@example.com", "owner@example.com", "partner@example.com"]);
    assert.equal(isAdmin("OWNER@example.com"), true);
    assert.equal(isLockedOut("  Friend@EXAMPLE.com "), false);
  });
});

test("an admin list alone locks sign-in to the admins", () => {
  withEnv(oneAdmin, () => {
    assert.equal(isLocked(), true);
    assert.equal(isLockedOut("owner@example.com"), false);
    assert.equal(isLockedOut("other@example.com"), true);
    assert.equal(isLockedOut(""), true);
    assert.equal(isLockedOut(null), true);
    assert.equal(isLockedOut(undefined), true);
  });
});

test("listed non-admins may sign in but may not spend the shared Gemini key", () => {
  withEnv(adminAndGuests, () => {
    assert.equal(isLockedOut("friend@example.com"), false);
    assert.equal(isAdmin("friend@example.com"), false);
    assert.equal(mayUseSharedGeminiKey("friend@example.com"), false);
    assert.equal(mayUseSharedGeminiKey("owner@example.com"), true);
    assert.equal(isLockedOut("stranger@example.com"), true);
  });
});

test("ALLOW_PUBLIC_SIGNUP=true opens sign-in to anyone without making them admins", () => {
  withEnv({ ...adminAndGuests, ALLOW_PUBLIC_SIGNUP: "true" }, () => {
    assert.equal(publicSignupAllowed(), true);
    assert.equal(isLocked(), false);
    assert.equal(isLockedOut("stranger@example.com"), false);
    assert.equal(isAdmin("stranger@example.com"), false);
    assert.equal(isAdmin("owner@example.com"), true);
  });
  // Anything but the literal "true" is not an opt-in.
  withEnv({ ...oneAdmin, ALLOW_PUBLIC_SIGNUP: "yes" }, () => {
    assert.equal(publicSignupAllowed(), false);
    assert.equal(isLockedOut("stranger@example.com"), true);
  });
});

test("the old single-account ALLOWED_LOGIN_EMAIL still counts as an admin", () => {
  withEnv({ ...nothing, ALLOWED_LOGIN_EMAIL: "Owner@Example.com" }, () => {
    assert.equal(isAdmin("owner@example.com"), true);
    assert.equal(isLocked(), true);
    assert.equal(isLockedOut("other@example.com"), true);
  });
});

test("production refuses to start when nobody could sign in", () => {
  withEnv(nothing, () => {
    assert.throws(() => assertAccessPolicy({ production: true }), /No account is allowed to sign in/);
  });
  withEnv(oneAdmin, () => {
    assert.doesNotThrow(() => assertAccessPolicy({ production: true }));
  });
  withEnv({ ...nothing, ALLOWED_LOGIN_EMAILS: "friend@example.com" }, () => {
    assert.doesNotThrow(() => assertAccessPolicy({ production: true }));
  });
  withEnv({ ...nothing, ALLOW_PUBLIC_SIGNUP: "true" }, () => {
    assert.doesNotThrow(() => assertAccessPolicy({ production: true }));
  });
});

test("outside production the policy never blocks startup", () => {
  withEnv(nothing, () => {
    assert.doesNotThrow(() => assertAccessPolicy({ production: false }));
  });
});


test("the caps default to 20 and can be raised or lowered from the environment", () => {
  withEnv({ MAX_USERS: undefined, MAX_RECEIPTS_PER_USER: undefined }, () => {
    assert.equal(maxUsers(), 20);
    assert.equal(maxReceiptsPerUser(), 20);
  });
  withEnv({ MAX_USERS: "50", MAX_RECEIPTS_PER_USER: "5" }, () => {
    assert.equal(maxUsers(), 50);
    assert.equal(maxReceiptsPerUser(), 5);
  });
});

test("a malformed cap falls back to the default rather than removing the limit", () => {
  // Every one of these once meant "no limit" under a plain Number() check,
  // which is the wrong way for a typo in a cap to fail.
  for (const bad of ["", "   ", "0", "-5", "twenty", "20.5", "1e3x"]) {
    withEnv({ MAX_USERS: bad, MAX_RECEIPTS_PER_USER: bad }, () => {
      assert.equal(maxUsers(), 20, `MAX_USERS=${JSON.stringify(bad)}`);
      assert.equal(maxReceiptsPerUser(), 20, `MAX_RECEIPTS_PER_USER=${JSON.stringify(bad)}`);
    });
  }
});
