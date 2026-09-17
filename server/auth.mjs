// Authentication: registration, login, logout, and a requireAuth middleware.
//
// Sessions are opaque random tokens stored as an httpOnly, SameSite=Lax cookie.
// Only the SHA-256 hash of the token is persisted, so a database leak does not
// expose usable sessions. Login is rate-limited in memory to blunt brute force.

import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashToken,
  dummyPasswordHash
} from "./crypto.mjs";

const SESSION_COOKIE = "rr_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// Naive in-memory login throttle: max attempts per key within a rolling window.
const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map();

// Entries used to be removed only by clearAttempts() on a *successful* login,
// so every failed attempt against a non-existent account leaked a map entry
// for the life of the process. Expire them on a timer instead.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    if (now - entry.first > ATTEMPT_WINDOW_MS) loginAttempts.delete(key);
  }
}, ATTEMPT_WINDOW_MS).unref();

function tooManyAttempts(key) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.first > ATTEMPT_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, first: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

function clearAttempts(key) {
  loginAttempts.delete(key);
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name };
}

export function createAuth(prisma) {
  // Built once at startup so login can compare against something real when
  // there is no account (or no stored hash) to compare against.
  const dummyHash = dummyPasswordHash();

  // Temporary lock while the app is reachable through a public tunnel: with
  // ALLOWED_LOGIN_EMAIL set, registration is closed and only that account can
  // log in or keep using a session. Remove it from .env to reopen the app.
  const allowedEmail = process.env.ALLOWED_LOGIN_EMAIL?.trim().toLowerCase() || null;
  const isLockedOut = (email) => allowedEmail !== null && email !== allowedEmail;
  if (allowedEmail) console.log(`Auth locked: registration closed, only ${allowedEmail} can sign in.`);

  // Expired sessions were only ever deleted if that exact token was presented
  // again after expiry -- which a browser never does, because the cookie's
  // maxAge matches the session TTL and it drops the cookie first. So the table
  // grew by one unreachable row per login, forever. Purge on a timer.
  const purgeExpiredSessions = async () => {
    try {
      const { count } = await prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } }
      });
      if (count > 0) console.log(`Purged ${count} expired session(s).`);
    } catch (error) {
      console.error("Failed to purge expired sessions:", error);
    }
  };
  setInterval(purgeExpiredSessions, 60 * 60 * 1000).unref();
  void purgeExpiredSessions();

  function cookieOptions(req) {
    const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
    return { httpOnly: true, sameSite: "lax", secure, maxAge: SESSION_TTL_MS, path: "/" };
  }

  async function startSession(req, res, userId) {
    const token = generateSessionToken();
    await prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS)
      }
    });
    res.cookie(SESSION_COOKIE, token, cookieOptions(req));
  }

  const requireAuth = async (req, res, next) => {
    try {
      const token = req.cookies?.[SESSION_COOKIE];
      if (!token) return res.status(401).json({ error: "Authentication required." });

      const session = await prisma.session.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { user: { select: { email: true } } }
      });
      if (!session || session.expiresAt < new Date()) {
        if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
        res.clearCookie(SESSION_COOKIE, { path: "/" });
        return res.status(401).json({ error: "Session expired." });
      }
      // Sessions other accounts already hold must stop working too.
      if (isLockedOut(session.user.email)) {
        res.clearCookie(SESSION_COOKIE, { path: "/" });
        return res.status(401).json({ error: "Authentication required." });
      }

      req.userId = session.userId;
      next();
    } catch (error) {
      console.error("Auth check failed:", error);
      res.status(500).json({ error: "Authentication check failed." });
    }
  };

  // Registers routes only. The cookie parser requireAuth depends on is mounted
  // by the server alongside the other global middleware, because requireAuth is
  // also used to gate middleware that runs before any route.
  function register(app) {
    app.post("/api/auth/register", async (req, res) => {
      if (allowedEmail) {
        return res.status(403).json({ error: "Registration is closed." });
      }
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      const password = String(req.body?.password ?? "");
      const name = req.body?.name ? String(req.body.name).trim() : null;

      if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ error: "A valid email is required." });
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
      }

      try {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
          return res.status(409).json({ error: "An account with that email already exists." });
        }
        const user = await prisma.user.create({
          data: { email, name, passwordHash: await hashPassword(password) }
        });
        await startSession(req, res, user.id);
        res.status(201).json(publicUser(user));
      } catch (error) {
        console.error("Registration failed:", error);
        res.status(500).json({ error: "Could not create account." });
      }
    });

    app.post("/api/auth/login", async (req, res) => {
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      const password = String(req.body?.password ?? "");
      const throttleKey = `${req.ip}:${email}`;

      if (tooManyAttempts(throttleKey)) {
        return res.status(429).json({ error: "Too many attempts. Try again later." });
      }

      try {
        const user = await prisma.user.findUnique({ where: { email } });
        // Always run verify to keep timing uniform whether or not the user
        // exists. The stand-in must be a real hash: the previous placeholder
        // ("scrypt$00$00") decoded to a single expected byte, so a random
        // password matched it roughly 1 try in 256 -- which logged an attacker
        // straight into any account whose passwordHash was NULL.
        const stored = user?.passwordHash;
        const ok = await verifyPassword(password, stored ?? (await dummyHash));
        // An account with no password set cannot be logged into with one. While
        // locked, any other account gets the same answer as a wrong password, so
        // the response doesn't reveal which email the app is locked to.
        if (!user || !stored || !ok || isLockedOut(user.email)) {
          return res.status(401).json({ error: "Invalid email or password." });
        }
        clearAttempts(throttleKey);
        await startSession(req, res, user.id);
        res.json(publicUser(user));
      } catch (error) {
        console.error("Login failed:", error);
        res.status(500).json({ error: "Could not log in." });
      }
    });

    app.post("/api/auth/logout", async (req, res) => {
      const token = req.cookies?.[SESSION_COOKIE];
      if (token) {
        await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => {});
      }
      res.clearCookie(SESSION_COOKIE, { path: "/" });
      res.status(204).end();
    });

    app.get("/api/auth/me", requireAuth, async (req, res) => {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!user) return res.status(401).json({ error: "Authentication required." });
        res.json(publicUser(user));
      } catch (error) {
        console.error("Failed to load current user:", error);
        res.status(500).json({ error: "Could not load your account." });
      }
    });
  }

  return { requireAuth, register };
}
