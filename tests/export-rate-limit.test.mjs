import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createRateLimiter, createSingleFlight } from "../server/rate-limit.mjs";
import { dbRateLimiter } from "../server/rate-limit-db.mjs";
import { EXPORT_RATE_LIMIT } from "../server/education-export.mjs";

// Real listening server, so the middleware runs the way Express runs it.
async function withServer(configure, run) {
  const app = express();
  configure(app);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

// The shared (Postgres) store, in memory: same contract as
// createRateLimitStore().check.
function fakeStore() {
  const counts = new Map();
  return {
    keys: counts,
    async check(key, { max }) {
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return { allowed: count <= max, remaining: Math.max(0, max - count), retryAfterSeconds: 60 };
    }
  };
}

// Stands in for requireAuth: the user comes from a header.
const fakeAuth = (req, _res, next) => {
  req.userId = req.get("x-user") ?? "anonymous";
  next();
};

test("exports are refused once the window's allowance is spent", async () => {
  let built = 0;
  await withServer(
    (app) => {
      app.use("/api/education-expenses/export", createRateLimiter(EXPORT_RATE_LIMIT));
      app.get("/api/education-expenses/export", (_req, res) => {
        built += 1;
        res.json({ ok: true });
      });
    },
    async (base) => {
      const statuses = [];
      for (let attempt = 0; attempt < EXPORT_RATE_LIMIT.max + 2; attempt += 1) {
        statuses.push((await fetch(`${base}/api/education-expenses/export?month=2026-08`)).status);
      }
      assert.deepEqual(statuses.slice(0, EXPORT_RATE_LIMIT.max), Array(EXPORT_RATE_LIMIT.max).fill(200));
      assert.deepEqual(statuses.slice(EXPORT_RATE_LIMIT.max), [429, 429]);
      assert.equal(built, EXPORT_RATE_LIMIT.max, "a refused export never reaches the builder");

      const refused = await fetch(`${base}/api/education-expenses/export?year=2026`);
      assert.match((await refused.json()).error, /Too many exports/);
      assert.ok(Number(refused.headers.get("retry-after")) > 0);
    }
  );
});

test("the shared limit counts per account, not per address", async () => {
  const store = fakeStore();
  await withServer(
    (app) => {
      app.get(
        "/api/education-expenses/export",
        fakeAuth,
        dbRateLimiter(store, { bucket: "export", ...EXPORT_RATE_LIMIT, max: 2, keyOf: (req) => req.userId }),
        (_req, res) => res.json({ ok: true })
      );
    },
    async (base) => {
      const as = (user) => fetch(`${base}/api/education-expenses/export?month=2026-08`, { headers: { "x-user": user } });
      assert.equal((await as("alice")).status, 200);
      assert.equal((await as("alice")).status, 200);
      assert.equal((await as("alice")).status, 429);
      // Another account from the same address has its own allowance.
      assert.equal((await as("bob")).status, 200);
      assert.deepEqual([...store.keys.keys()].sort(), ["export:alice", "export:bob"]);
    }
  );
});

test("only one export per account runs at a time", async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });

  await withServer(
    (app) => {
      app.get(
        "/api/education-expenses/export",
        fakeAuth,
        createSingleFlight({ keyOf: (req) => req.userId, message: "An export is already being prepared." }),
        async (_req, res) => {
          await gate;
          res.json({ ok: true });
        }
      );
    },
    async (base) => {
      const as = (user) => fetch(`${base}/api/education-expenses/export?year=2026`, { headers: { "x-user": user } });

      const first = as("alice");
      // Let the first request reach the handler before the second arrives.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const second = await as("alice");
      assert.equal(second.status, 429);
      assert.match((await second.json()).error, /already being prepared/);

      // A different account is not held up by alice's export.
      const other = as("bob");
      release();
      assert.equal((await first).status, 200);
      assert.equal((await other).status, 200);

      // Once the first has finished, alice can export again.
      assert.equal((await as("alice")).status, 200);
    }
  );
});

test("a failed export releases its slot", async () => {
  await withServer(
    (app) => {
      app.get(
        "/api/education-expenses/export",
        fakeAuth,
        createSingleFlight({ keyOf: (req) => req.userId }),
        (req, res) => {
          if (req.query.fail) return res.status(500).json({ error: "boom" });
          res.json({ ok: true });
        }
      );
    },
    async (base) => {
      assert.equal((await fetch(`${base}/api/education-expenses/export?fail=1`)).status, 500);
      await new Promise((resolve) => setTimeout(resolve, 20));
      assert.equal((await fetch(`${base}/api/education-expenses/export`)).status, 200);
    }
  );
});
