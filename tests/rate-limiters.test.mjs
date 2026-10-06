import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRateLimiter, createSingleFlight } from "../server/rate-limit.mjs";
import { createRateLimitStore, dbRateLimiter, clientKey } from "../server/rate-limit-db.mjs";

function fakeRes() {
  const res = new EventEmitter();
  res.headers = {};
  res.setHeader = (name, value) => {
    res.headers[name] = value;
  };
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

function run(middleware, req) {
  const res = fakeRes();
  let passed = false;
  const result = middleware(req, res, () => {
    passed = true;
  });
  return Promise.resolve(result).then(() => ({ res, passed }));
}

test("the in-memory limiter counts per address and says when to retry", async () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2, message: "slow down" });
  assert.equal((await run(limiter, { ip: "1.1.1.1" })).passed, true);
  const second = await run(limiter, { ip: "1.1.1.1" });
  assert.equal(second.res.headers["RateLimit-Remaining"], "0");
  const third = await run(limiter, { ip: "1.1.1.1" });
  assert.equal(third.passed, false);
  assert.equal(third.res.statusCode, 429);
  assert.equal(third.res.body.error, "slow down");
  assert.ok(Number(third.res.headers["Retry-After"]) > 0);
  // Another address has its own count; a request with no address still counts.
  assert.equal((await run(limiter, { ip: "2.2.2.2" })).passed, true);
  assert.equal((await run(limiter, { socket: {} })).passed, true);
});

test("the in-memory limiter defaults its window and limit, and resets after the window", async () => {
  const limiter = createRateLimiter();
  assert.equal((await run(limiter, { ip: "9.9.9.9" })).res.headers["RateLimit-Limit"], "100");

  const short = createRateLimiter({ windowMs: 5, max: 1 });
  await run(short, { ip: "3.3.3.3" });
  assert.equal((await run(short, { ip: "3.3.3.3" })).passed, false);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal((await run(short, { ip: "3.3.3.3" })).passed, true);
});

test("the in-memory limiter stays bounded under a flood of addresses", async () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });
  for (let i = 0; i < 20_050; i += 1) {
    await run(limiter, { ip: `10.0.${i >> 8}.${i & 255}` });
  }
  // Still answering, and a new address still gets through.
  assert.equal((await run(limiter, { ip: "fresh" })).passed, true);
});

test("single flight lets one request per key run at a time", async () => {
  const flight = createSingleFlight({ keyOf: (req) => req.userId, message: "busy" });
  const first = await run(flight, { userId: "u1" });
  assert.equal(first.passed, true);
  const second = await run(flight, { userId: "u1" });
  assert.equal(second.res.statusCode, 429);
  assert.equal(second.res.body.error, "busy");
  first.res.emit("close");
  assert.equal((await run(flight, { userId: "u1" })).passed, true);

  const byAddress = createSingleFlight();
  assert.equal((await run(byAddress, { ip: "4.4.4.4" })).passed, true);
  assert.equal((await run(byAddress, { ip: "4.4.4.4" })).res.body.error, "A request is already in progress.");
});

test("the shared store allows the request when the database cannot answer", async () => {
  const broken = { $queryRaw: async () => { throw new Error("down"); }, $executeRaw: async () => { throw new Error("down"); } };
  const store = createRateLimitStore(broken);
  const result = await store.check("k", { windowMs: 1000, max: 1 });
  assert.equal(result.allowed, true);
  assert.equal(result.degraded, true);
  await store.reset("k"); // logs, does not throw
});

test("the shared store counts, refuses past the limit, and the middleware says so", async () => {
  let count = 0;
  const prisma = {
    $queryRaw: async () => [{ count: (count += 1), resetAt: new Date(Date.now() + 30_000) }],
    $executeRaw: async () => 0
  };
  const store = createRateLimitStore(prisma);
  const original = Math.random;
  Math.random = () => 0; // exercise the occasional sweep
  try {
    const limiter = dbRateLimiter(store, { bucket: "b", windowMs: 30_000, max: 1 });
    assert.equal((await run(limiter, { ip: "5.5.5.5" })).passed, true);
    const refused = await run(limiter, { ip: "5.5.5.5" });
    assert.equal(refused.res.statusCode, 429);
    assert.ok(Number(refused.res.headers["Retry-After"]) >= 1);
    assert.equal(refused.res.body.error, "Too many requests. Please slow down.");
  } finally {
    Math.random = original;
  }
  assert.equal(clientKey({ socket: { remoteAddress: "6.6.6.6" } }), "6.6.6.6");
  assert.equal(clientKey({}), "unknown");
});
