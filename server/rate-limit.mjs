// Minimal dependency-free in-memory rate limiter (fixed window per client IP).
//
// This blunts brute force, credential stuffing, mass account creation, and
// general request floods. It is per-process; for multi-instance deployments
// put a shared limiter (or the platform's) in front as well.

// Hard ceiling on tracked keys. Past this we evict the oldest-resetting entries
// rather than letting the map grow without bound.
const MAX_KEYS = 20_000;

export function createRateLimiter({ windowMs, max, message } = {}) {
  const limit = Number(max) || 100;
  const window = Number(windowMs) || 60_000;
  const hits = new Map(); // ip -> { count, reset }

  function sweep(now) {
    for (const [key, entry] of hits) {
      if (now > entry.reset) hits.delete(key);
    }
  }

  // Sweep on a timer rather than per-request. The old check ran sweep() from
  // the request path whenever the map held more than 5000 entries, but sweep
  // only removes *expired* entries -- so with more than 5000 keys live inside
  // the window it freed nothing, stayed over the threshold, and made every
  // subsequent request walk the whole map. unref() so this never holds the
  // process open.
  setInterval(() => sweep(Date.now()), window).unref();

  return function rateLimit(req, res, next) {
    const now = Date.now();

    const key = req.ip || req.socket?.remoteAddress || "unknown";
    // A flood of distinct keys (trivial on IPv6) can outrun the sweep timer.
    // Evict the entries closest to expiry to keep the map bounded.
    if (hits.size >= MAX_KEYS && !hits.has(key)) {
      sweep(now);
      if (hits.size >= MAX_KEYS) {
        const victims = [...hits.entries()]
          .sort((a, b) => a[1].reset - b[1].reset)
          .slice(0, Math.ceil(MAX_KEYS / 10));
        for (const [victim] of victims) hits.delete(victim);
      }
    }

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

/**
 * Lets one request per key run at a time; another from the same key while the
 * first is still going is turned away with a 429. Meant for routes where a
 * single request is expensive and a second concurrent one can only repeat the
 * work (a double click, a script firing in parallel). Per-process, like the
 * limiter above.
 */
export function createSingleFlight({ keyOf, message } = {}) {
  const running = new Set();
  const keyFor = keyOf ?? ((req) => req.ip || req.socket?.remoteAddress || "unknown");

  return function singleFlight(req, res, next) {
    const key = keyFor(req);
    if (running.has(key)) {
      return res.status(429).json({ error: message || "A request is already in progress." });
    }
    running.add(key);
    // "close" fires however the response ends -- sent, errored, or the client
    // walking away -- so a key can never stay stuck.
    res.once("close", () => running.delete(key));
    next();
  };
}
