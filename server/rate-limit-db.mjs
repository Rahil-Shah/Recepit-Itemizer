// Rate limiting that survives a cold start and is shared between instances.
//
// server/rate-limit.mjs counts in memory, which is the right tool for one
// long-running process and the wrong one here. On a serverless host every
// instance keeps its own counters and every cold start throws them away, so a
// limit of 30 per window is really 30 per instance per lifetime -- which is
// to say, no limit at all to anyone who can cause a few instances to exist.
//
// These counters live in Postgres, so every instance sees the same window.
// The in-memory limiter stays mounted in front as a free local guard: it costs
// no query, and it turns away the easy floods before they reach the database.
//
// The counter is incremented and read in ONE statement. Read-then-write would
// let two concurrent requests both read the same count and both allow it.

// Rows are only touched again if that exact key comes back, so keys that
// appear once (an IP that visits once) would linger forever. There is no timer
// to clean them on a serverless host, so a small share of requests pay for a
// sweep instead.
const CLEANUP_PROBABILITY = 0.02;

/**
 * Increment the counter for `key` and report where it now stands.
 *
 * An expired window is reset in the same statement rather than deleted first,
 * so a key that comes back after its window simply starts a new one.
 */
async function hit(prisma, key, windowMs) {
  const resetAt = new Date(Date.now() + windowMs);
  const rows = await prisma.$queryRaw`
    INSERT INTO rate_limits ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN rate_limits."resetAt" <= now() THEN 1 ELSE rate_limits."count" + 1 END,
      "resetAt" = CASE WHEN rate_limits."resetAt" <= now() THEN ${resetAt} ELSE rate_limits."resetAt" END
    RETURNING "count", "resetAt"
  `;
  const row = rows?.[0];
  return { count: Number(row?.count ?? 1), resetAt: row?.resetAt ?? resetAt };
}

async function sweep(prisma) {
  try {
    await prisma.$executeRaw`DELETE FROM rate_limits WHERE "resetAt" <= now() - interval '1 hour'`;
  } catch (error) {
    console.warn("Rate limit sweep failed:", error?.message ?? error);
  }
}

export function createRateLimitStore(prisma) {
  return {
    /**
     * Whether this key may proceed, and how long until its window resets.
     *
     * A database that cannot answer must not take the whole app down with it,
     * so a failure here allows the request: the in-memory limiter in front is
     * still counting, and refusing every request because the counter is
     * unreachable turns a degraded dependency into an outage.
     */
    async check(key, { windowMs, max }) {
      try {
        const { count, resetAt } = await hit(prisma, key, windowMs);
        if (Math.random() < CLEANUP_PROBABILITY) void sweep(prisma);
        return {
          allowed: count <= max,
          remaining: Math.max(0, max - count),
          retryAfterSeconds: Math.max(1, Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000))
        };
      } catch (error) {
        console.error("Rate limit check failed, allowing the request:", error?.message ?? error);
        return { allowed: true, remaining: max, retryAfterSeconds: 0, degraded: true };
      }
    },

    /** Forget a key. Used when a login succeeds, so one bad guess before a
     *  correct password does not count against the next hour. */
    async reset(key) {
      try {
        await prisma.$executeRaw`DELETE FROM rate_limits WHERE "key" = ${key}`;
      } catch (error) {
        console.warn("Rate limit reset failed:", error?.message ?? error);
      }
    }
  };
}

/** The client address a limit is counted against. */
export function clientKey(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

/**
 * Express middleware counting against the shared store.
 *
 * `bucket` namespaces the key so two routes limiting the same address do not
 * share one counter.
 */
export function dbRateLimiter(store, { bucket, windowMs, max, message, keyOf = clientKey }) {
  return async function rateLimit(req, res, next) {
    const result = await store.check(`${bucket}:${keyOf(req)}`, { windowMs, max });
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(result.remaining));
    if (result.allowed) return next();
    res.setHeader("Retry-After", String(result.retryAfterSeconds));
    res.status(429).json({ error: message || "Too many requests. Please slow down." });
  };
}
