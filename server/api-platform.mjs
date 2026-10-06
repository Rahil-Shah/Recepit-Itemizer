// What lets something other than this repo's own page use the API: a separate
// web front end on another origin, or a mobile app.
//
// - Versioned paths. Every route answers at /api/... and at /api/v1/...; a
//   client outside this repo should use /api/v1 so a later breaking change can
//   ship as /api/v2 without stranding it.
// - CORS, for browsers on an allow-listed origin (CORS_ORIGINS).
// - Discovery: GET /api/meta says what this server is and how to sign in, and
//   GET /api/openapi.json describes every route.
//
// Bearer-token sign-in for clients that cannot hold a cookie lives in
// server/auth.mjs.

import { OPENAPI_SPEC } from "./openapi.mjs";

export const API_VERSION = 1;

/**
 * Serve /api/v1/... from the same routes as /api/.... A rewrite rather than a
 * second router, so the rate limits and body parsers mounted on /api paths
 * apply to the versioned path exactly as they do to the plain one.
 */
export function apiVersionAlias() {
  const prefix = `/api/v${API_VERSION}`;
  return (req, _res, next) => {
    if (req.url === prefix || req.url.startsWith(`${prefix}/`) || req.url.startsWith(`${prefix}?`)) {
      req.url = `/api${req.url.slice(prefix.length)}`;
    }
    next();
  };
}

/** The origins allowed to call the API from a browser, from CORS_ORIGINS. */
export function corsOrigins(value = process.env.CORS_ORIGINS) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter((origin) => /^https?:\/\/[^\s/]+$/i.test(origin))
  );
}

const ALLOWED_HEADERS = "Content-Type, Authorization, X-Auth-Mode";
// A browser hides response headers from script unless they are listed: the
// exports name their file in Content-Disposition, and a 429 says when to retry.
const EXPOSED_HEADERS = "Content-Disposition, Retry-After";

/**
 * CORS for the allow-listed origins only. No wildcard: the session cookie is
 * a credential, and `*` cannot be combined with credentials anyway.
 *
 * A preflight is answered here, before any rate limit or auth check, because
 * the browser sends it without credentials and only wants the headers back.
 */
export function corsMiddleware(readOrigins = () => corsOrigins()) {
  return (req, res, next) => {
    if (!req.path.startsWith("/api")) return next();
    const origin = req.headers.origin;
    const allowed = Boolean(origin) && readOrigins().has(String(origin).replace(/\/+$/, ""));

    if (allowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Expose-Headers", EXPOSED_HEADERS);
    }
    res.append("Vary", "Origin");

    if (req.method === "OPTIONS") {
      if (!allowed) return res.status(403).end();
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
      res.setHeader("Access-Control-Max-Age", "600");
      return res.status(204).end();
    }
    next();
  };
}

/** GET /api/meta and GET /api/openapi.json. Public: they describe, not reveal. */
export function registerApiPlatform(app) {
  app.get("/api/meta", (_req, res) => {
    res.json({
      name: "Receipt Ring",
      apiVersion: API_VERSION,
      basePath: `/api/v${API_VERSION}`,
      auth: {
        cookie: "Same-site browsers: sign in and the rr_session cookie is set.",
        bearer:
          "Other clients: sign in with the header X-Auth-Mode: token, keep the returned token, and send it as Authorization: Bearer <token>."
      },
      openapi: `/api/v${API_VERSION}/openapi.json`
    });
  });

  app.get("/api/openapi.json", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(OPENAPI_SPEC);
  });
}
