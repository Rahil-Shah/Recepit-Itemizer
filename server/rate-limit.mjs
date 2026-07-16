// Minimal dependency-free in-memory rate limiter (fixed window per client IP).
//
// This blunts brute force, credential stuffing, mass account creation, and
// general request floods. It is per-process; for multi-instance deployments
// put a shared limiter (or the platform's) in front as well.

export function createRateLimiter({ windowMs, max, message } = {}) {
  const limit = Number(max) || 100;
  const window = Number(windowMs) || 60_000;
  const hits = new Map(); // ip -> { count, reset }

  function sweep(now) {
    for (const [key, entry] of hits) {
      if (now > entry.reset) hits.delete(key);
    }
  }

  return function rateLimit(req, res, next) {
    const now = Date.now();
    // Bound memory: occasionally drop expired entries.
    if (hits.size > 5000) sweep(now);

    const key = req.ip || req.socket?.remoteAddress || "unknown";
    let entry = hits.get(key);
    if (!entry || now > entry.reset) {
      entry = { count: 0, reset: now + window };
      hits.set(key, entry);
    }
    entry.count += 1;

    res.setHeader("RateLimit-Limit", String(limit));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, limit - entry.count)));

    if (entry.count > limit) {
      res.setHeader("Retry-After", String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: message || "Too many requests. Please slow down." });
    }
    next();
  };
}
