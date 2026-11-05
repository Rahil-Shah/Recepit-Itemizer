// Credentials for an AI assistant: personal access tokens, and the OAuth
// grants an app such as claude.ai holds after the user approves it
// (server/oauth.mjs). Both open the MCP endpoint (server/mcp.mjs) and nothing
// else -- every other route takes a session -- so a token handed to an
// assistant cannot read a photo, touch the bank side, change the password or
// mint more tokens.
//
// Tokens are 32 random bytes behind a fixed prefix that says what they are
// (rr_pat_ personal, rr_oat_ OAuth access, rr_ort_ OAuth refresh), which also
// lets a secret scanner recognise one pasted somewhere it should not be. Only
// the SHA-256 of a token is stored; the token itself is shown once.
//
// Scopes: receipts:read lets the assistant look; receipts:write also lets it
// correct prices and save new receipts. Changing the password revokes every
// token and grant the account holds, as it signs out every other session.

import { generateSessionToken, hashToken } from "./crypto.mjs";
import { isAdmin, isLockedOut } from "./access.mjs";
import { publicOrigin } from "./public-url.mjs";

export const SCOPE_READ = "receipts:read";
export const SCOPE_WRITE = "receipts:write";
export const ALL_SCOPES = [SCOPE_READ, SCOPE_WRITE];

export const TOKEN_PREFIX = { personal: "rr_pat_", access: "rr_oat_", refresh: "rr_ort_" };
const BEARER_PATTERN = /^Bearer\s+(rr_(?:pat|oat)_[A-Za-z0-9_-]{43})$/;

export const MAX_TOKENS_PER_USER = 10;
export const TOKEN_LIFETIMES_DAYS = [7, 30, 90, 365];
const MAX_TOKEN_NAME = 80;
// lastUsedAt is for the owner's eyes ("used 2 minutes ago"), not an audit
// log, so it is written at most once a minute rather than on every call.
const LAST_USED_RESOLUTION_MS = 60 * 1000;
const ID_PATTERN = /^[\w-]{1,64}$/;

export const TOKEN_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many tokens created. Give it a few minutes."
};

/** A fresh token of the given kind ("personal", "access" or "refresh"). */
export function generateApiToken(kind) {
  return TOKEN_PREFIX[kind] + generateSessionToken();
}

/** Scopes as stored ("a b") to a list, keeping only ones this server knows. */
export function parseScopes(value) {
  const known = new Set(ALL_SCOPES);
  return [...new Set(String(value ?? "").split(/\s+/).filter((scope) => known.has(scope)))];
}

/** Write access implies read: an assistant that may fix a price has to see it. */
export function normalizeScopes(scopes) {
  const set = new Set(scopes);
  if (set.has(SCOPE_WRITE)) set.add(SCOPE_READ);
  return ALL_SCOPES.filter((scope) => set.has(scope));
}

export function cleanTokenName(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const tokenSelect = { id: true, name: true, prefix: true, scopes: true, expiresAt: true, lastUsedAt: true, createdAt: true };

function serializeToken(token) {
  return {
    id: token.id,
    name: token.name,
    prefix: token.prefix,
    scopes: parseScopes(token.scopes),
    expiresAt: token.expiresAt,
    lastUsedAt: token.lastUsedAt,
    createdAt: token.createdAt
  };
}

function serializeGrant(grant) {
  return {
    id: grant.id,
    name: grant.client.name,
    scopes: parseScopes(grant.scopes),
    connectedAt: grant.createdAt,
    lastUsedAt: grant.lastUsedAt,
    // The app keeps working for as long as it can refresh.
    expiresAt: grant.refreshExpiresAt
  };
}

/**
 * Remove every token and grant the account holds. Takes a transaction client
 * (or the Prisma client itself) so a caller can make it part of a larger
 * change, such as a password change.
 */
export function revokeAllApiAccess(client, userId) {
  return [
    client.apiToken.deleteMany({ where: { userId } }),
    client.oAuthGrant.deleteMany({ where: { userId } }),
    client.oAuthCode.deleteMany({ where: { userId } })
  ];
}

/** Settings: create, list and revoke personal tokens; list and disconnect apps. */
export function registerApiTokens(app, requireAuth, prisma, { createLimiters = [] } = {}) {
  app.get("/api/tokens", requireAuth, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const tokens = await prisma.apiToken.findMany({
        where: { userId: req.userId, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        select: tokenSelect
      });
      res.json(tokens.map(serializeToken));
    } catch (error) {
      console.error("Failed to list API tokens:", error);
      res.status(500).json({ error: "Could not load your tokens." });
    }
  });

  app.post("/api/tokens", requireAuth, ...createLimiters, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const body = req.body ?? {};
    const name = cleanTokenName(body.name);
    if (!name || name.length > MAX_TOKEN_NAME) {
      return res.status(400).json({ error: `Give the token a name of 1-${MAX_TOKEN_NAME} characters.` });
    }
    if (!TOKEN_LIFETIMES_DAYS.includes(body.expiresInDays)) {
      return res.status(400).json({ error: `A token can last ${TOKEN_LIFETIMES_DAYS.join(", ")} days.` });
    }
    if (typeof body.canWrite !== "boolean") {
      return res.status(400).json({ error: "canWrite must be true or false." });
    }

    try {
      const now = new Date();
      // Tokens that ran out are no use to anyone; this keeps the table small
      // and stops them counting against the limit below.
      await prisma.apiToken.deleteMany({ where: { userId: req.userId, expiresAt: { lte: now } } });
      const live = await prisma.apiToken.count({ where: { userId: req.userId } });
      if (live >= MAX_TOKENS_PER_USER) {
        return res.status(400).json({
          error: `You can have up to ${MAX_TOKENS_PER_USER} tokens. Revoke one you no longer use first.`
        });
      }

      const token = generateApiToken("personal");
      const created = await prisma.apiToken.create({
        data: {
          userId: req.userId,
          name,
          tokenHash: hashToken(token),
          prefix: token.slice(0, TOKEN_PREFIX.personal.length + 4),
          scopes: normalizeScopes(body.canWrite ? [SCOPE_WRITE] : [SCOPE_READ]).join(" "),
          expiresAt: new Date(now.getTime() + body.expiresInDays * 24 * 60 * 60 * 1000)
        },
        select: tokenSelect
      });
      // The one time the token can be told: only its hash is kept.
      res.status(201).json({ ...serializeToken(created), token });
    } catch (error) {
      console.error("Failed to create API token:", error);
      res.status(500).json({ error: "Could not create the token." });
    }
  });

  app.delete("/api/tokens/:id", requireAuth, async (req, res) => {
    if (!ID_PATTERN.test(req.params.id)) return res.status(404).json({ error: "Token not found." });
    try {
      const { count } = await prisma.apiToken.deleteMany({ where: { id: req.params.id, userId: req.userId } });
      if (count === 0) return res.status(404).json({ error: "Token not found." });
      res.status(204).end();
    } catch (error) {
      console.error("Failed to revoke API token:", error);
      res.status(500).json({ error: "Could not revoke the token." });
    }
  });

  app.get("/api/connected-apps", requireAuth, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const grants = await prisma.oAuthGrant.findMany({
        where: { userId: req.userId, refreshExpiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        include: { client: { select: { name: true } } }
      });
      res.json(grants.map(serializeGrant));
    } catch (error) {
      console.error("Failed to list connected apps:", error);
      res.status(500).json({ error: "Could not load your connected apps." });
    }
  });

  app.delete("/api/connected-apps/:id", requireAuth, async (req, res) => {
    if (!ID_PATTERN.test(req.params.id)) return res.status(404).json({ error: "App not found." });
    try {
      const { count } = await prisma.oAuthGrant.deleteMany({ where: { id: req.params.id, userId: req.userId } });
      if (count === 0) return res.status(404).json({ error: "App not found." });
      res.status(204).end();
    } catch (error) {
      console.error("Failed to disconnect app:", error);
      res.status(500).json({ error: "Could not disconnect the app." });
    }
  });
}

/** Where a client learns how to get a token for the MCP endpoint (RFC 9728). */
export function resourceMetadataUrl(req) {
  return `${publicOrigin(req)}/.well-known/oauth-protected-resource/api/mcp`;
}

function unauthorized(req, res, { error, description }) {
  const params = [`resource_metadata="${resourceMetadataUrl(req)}"`];
  if (error) params.push(`error="${error}"`, `error_description="${description}"`);
  res.setHeader("WWW-Authenticate", `Bearer ${params.join(", ")}`);
  res.setHeader("Cache-Control", "no-store");
  return res.status(401).json({ error: description ?? "Authentication required." });
}

/**
 * Middleware for the MCP endpoint: accepts a personal access token or an
 * OAuth access token, and nothing else -- not a session, so a browser's
 * cookie can never drive it. Sets req.userId, req.userEmail, req.isAdmin,
 * req.scopes (a Set) and req.credential ("personal" or "oauth").
 */
export function createApiTokenAuth(prisma) {
  async function touch(model, id, lastUsedAt) {
    const now = Date.now();
    if (lastUsedAt && now - lastUsedAt.getTime() < LAST_USED_RESOLUTION_MS) return;
    await prisma[model].updateMany({ where: { id }, data: { lastUsedAt: new Date(now) } }).catch((error) => {
      console.warn("Could not record token use:", error?.message ?? error);
    });
  }

  return async function requireApiToken(req, res, next) {
    const header = String(req.headers?.authorization ?? "").trim();
    if (!header) return unauthorized(req, res, {});
    const match = BEARER_PATTERN.exec(header);
    if (!match) return unauthorized(req, res, { error: "invalid_token", description: "The access token is not valid." });

    const token = match[1];
    const now = new Date();
    try {
      let credential;
      if (token.startsWith(TOKEN_PREFIX.personal)) {
        const row = await prisma.apiToken.findUnique({
          where: { tokenHash: hashToken(token) },
          select: { id: true, userId: true, scopes: true, expiresAt: true, lastUsedAt: true, user: { select: { email: true } } }
        });
        if (row && row.expiresAt > now) credential = { kind: "personal", model: "apiToken", ...row };
      } else {
        const row = await prisma.oAuthGrant.findUnique({
          where: { accessTokenHash: hashToken(token) },
          select: { id: true, userId: true, scopes: true, accessExpiresAt: true, lastUsedAt: true, user: { select: { email: true } } }
        });
        if (row && row.accessExpiresAt > now) credential = { kind: "oauth", model: "oAuthGrant", ...row };
      }

      // Expired, revoked, never existed, or the account is no longer allowed
      // in: one answer for all of them.
      if (!credential || isLockedOut(credential.user.email)) {
        return unauthorized(req, res, { error: "invalid_token", description: "The access token is expired or revoked." });
      }

      await touch(credential.model, credential.id, credential.lastUsedAt);
      req.userId = credential.userId;
      req.userEmail = credential.user.email;
      req.isAdmin = isAdmin(credential.user.email);
      req.scopes = new Set(normalizeScopes(parseScopes(credential.scopes)));
      req.credential = credential.kind;
      next();
    } catch (error) {
      console.error("API token check failed:", error);
      res.status(500).json({ error: "Authentication check failed." });
    }
  };
}
