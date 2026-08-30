import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createRateLimiter } from "../server/rate-limit.mjs";

// Stands up a real listening server so the ordering of middleware is exercised
// the way Express actually runs it, rather than asserted about by reading.
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

test("the parse limiter refuses once the window's allowance is spent", async () => {
  await withServer(
    (app) => {
      app.use("/api/gemini/parse", createRateLimiter({ windowMs: 60_000, max: 3 }));
      app.use(express.json());
      app.post("/api/gemini/parse", (_req, res) => res.json({ ok: true }));
    },
    async (base) => {
      const statuses = [];
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await fetch(`${base}/api/gemini/parse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: "x" })
        });
        statuses.push(response.status);
      }

      assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
    }
  );
});

test("a refused parse never reaches the body parser", async () => {
  let bodiesParsed = 0;

  await withServer(
    (app) => {
      // The real ordering: limiter first, then the 16mb parser.
      app.use("/api/gemini/parse", createRateLimiter({ windowMs: 60_000, max: 1 }));
      app.use("/api/gemini/parse", (req, res, next) => {
        express.json({ limit: "16mb" })(req, res, () => {
          bodiesParsed += 1;
          next();
        });
      });
      app.post("/api/gemini/parse", (_req, res) => res.json({ ok: true }));
    },
    async (base) => {
      // A megabyte of payload, twice. The second must be turned away before
      // the server ever buffers it.
      const body = JSON.stringify({ imageBase64: "A".repeat(1024 * 1024) });
      const send = () =>
        fetch(`${base}/api/gemini/parse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body
        });

      assert.equal((await send()).status, 200);
      assert.equal((await send()).status, 429);
      assert.equal(bodiesParsed, 1, "the rejected request's body should never have been parsed");
    }
  );
});

test("the refusal explains itself and says to wait", async () => {
  await withServer(
    (app) => {
      app.use(
        "/api/gemini/parse",
        createRateLimiter({
          windowMs: 60_000,
          max: 1,
          message: "Too many receipt scans in a row. Give it a minute and try again."
        })
      );
      app.post("/api/gemini/parse", (_req, res) => res.json({ ok: true }));
    },
    async (base) => {
      await fetch(`${base}/api/gemini/parse`, { method: "POST" });
      const refused = await fetch(`${base}/api/gemini/parse`, { method: "POST" });

      assert.equal(refused.status, 429);
      assert.match((await refused.json()).error, /Give it a minute/);
      // Retry-After lets a client back off on fact rather than on a guess.
      assert.ok(Number(refused.headers.get("retry-after")) > 0);
    }
  );
});
