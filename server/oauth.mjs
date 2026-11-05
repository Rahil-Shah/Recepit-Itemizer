// OAuth 2.1 for the MCP endpoint, so an app such as claude.ai can be added
// as a connector by pasting one URL: the app discovers this server, registers
// itself, sends the user here to sign in and approve it, and gets tokens.
//
//   GET  /.well-known/oauth-protected-resource[/api/mcp]   RFC 9728
//   GET  /.well-known/oauth-authorization-server           RFC 8414
//   POST /api/oauth/register    dynamic client registration, RFC 7591
//   GET  /api/oauth/authorize   the sign-in and consent page
//   POST /api/oauth/authorize   the user's answer
//   POST /api/oauth/token       authorization_code (PKCE) and refresh_token
//   POST /api/oauth/revoke      RFC 7009
//
// What keeps it safe:
//
//   - Registration is open (the spec expects it), so a client is worth nothing
//     until a signed-in user approves it on a page served from this origin. The
//     page names the app and the site it will send the user back to, and only
//     redirect URIs that are https, or http on the loopback address, are
//     accepted; a redirect URI must match a registered one exactly.
//   - PKCE with S256 is required of every client. Codes last five minutes,
//     are bound to the client, the redirect URI and the challenge, and work
//     once.
//   - The consent form carries a token derived from the session and the exact
//     request (HMAC with AUTH_SESSION_SECRET), and is refused from another
//     origin. The session cookie is SameSite=Lax as well, and the page cannot
//     be framed.
//   - Access tokens last an hour. Refresh tokens rotate on every use, and the
//     one just replaced is remembered: presented again, it means a copy is in
//     someone else's hands, and the whole grant is revoked.
//   - Only hashes of codes and tokens are stored, and the tokens open the MCP
//     endpoint alone (server/api-tokens.mjs).

import crypto from "node:crypto";
import express from "express";
import { generateSessionToken, hashToken } from "./crypto.mjs";
import { isLockedOut } from "./access.mjs";
import {
  ALL_SCOPES,
  SCOPE_READ,
  SCOPE_WRITE,
  generateApiToken,
  normalizeScopes,
  parseScopes
} from "./api-tokens.mjs";
import { publicOrigin } from "./public-url.mjs";

const CODE_TTL_MS = 5 * 60 * 1000;
export const ACCESS_TOKEN_TTL_S = 60 * 60;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Clients that registered and were never approved are swept after a day.
const UNUSED_CLIENT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_REDIRECT_URIS = 5;
const MAX_REDIRECT_URI_LENGTH = 500;
const MAX_CLIENT_NAME = 100;
const MAX_STATE = 1000;
const CLIENT_ID_PATTERN = /^rrc_[A-Za-z0-9_-]{22}$/;
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
const AUTH_METHODS = new Set(["none", "client_secret_post", "client_secret_basic"]);
const SESSION_COOKIE = "rr_session";

export const REGISTER_RATE_LIMIT = { windowMs: 60 * 60 * 1000, max: 30, message: "Too many registrations. Try again later." };
export const TOKEN_ENDPOINT_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 120, message: "Too many token requests. Try again later." };
export const AUTHORIZE_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 120, message: "Too many requests. Try again later." };
export const METADATA_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 300, message: "Too many requests. Try again later." };

const SCOPE_DESCRIPTIONS = {
  [SCOPE_READ]: "See your receipts, their items and prices, the people you split with, and who owes what",
  [SCOPE_WRITE]: "Correct prices, tax and items on your saved receipts, and save new receipts"
};

// --- Small helpers ---------------------------------------------------------------

// A problem shown on the page itself: the client or its redirect URI cannot be
// trusted, so the user is not sent anywhere.
class PageError extends Error {}

class OAuthError extends Error {
  constructor(code, description, status = 400) {
    super(description);
    this.code = code;
    this.status = status;
  }
}

/** A single string parameter; repeated or structured values are refused. */
function param(source, name) {
  const value = source?.[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new OAuthError("invalid_request", `${name} must be given once, as a string.`);
  return value;
}

function sendOAuthError(res, error) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  if (error.status === 401) res.setHeader("WWW-Authenticate", 'Basic realm="Receipt Ring"');
  res.status(error.status).json({ error: error.code, error_description: error.message });
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const base64url = (buffer) => buffer.toString("base64url");
const pkceChallenge = (verifier) => base64url(crypto.createHash("sha256").update(verifier).digest());

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

/** A redirect URI this server will send a code to: https, or http on loopback. */
export function isAllowedRedirectUri(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_REDIRECT_URI_LENGTH) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

/**
 * Whether an Origin header is absent, opaque ("null"), or this site. Compared
 * by host, so a proxy that does not say it terminated TLS does not lock the
 * user out of their own consent page.
 */
function isSameSiteOrigin(req, origin) {
  if (origin === undefined || origin === "null") return true;
  try {
    return new URL(origin).host === new URL(publicOrigin(req)).host;
  } catch {
    return false;
  }
}

/** RFC 8707: a resource must be this server (its MCP endpoint, or the origin). */
function checkResource(req, resource) {
  if (resource === undefined) return;
  let url;
  try {
    url = new URL(resource);
  } catch {
    throw new OAuthError("invalid_target", "resource must be this server's URL.");
  }
  if (url.origin !== publicOrigin(req) || url.hash) throw new OAuthError("invalid_target", "resource must be this server's URL.");
}

function requestedScopes(value) {
  if (value === undefined || value.trim() === "") return [...ALL_SCOPES];
  const asked = value.split(/\s+/).filter(Boolean);
  const known = parseScopes(value);
  if (known.length !== new Set(asked).size) throw new OAuthError("invalid_scope", `Scopes offered: ${ALL_SCOPES.join(" ")}.`);
  return normalizeScopes(known);
}

// --- Metadata ----------------------------------------------------------------

export function protectedResourceMetadata(req) {
  const origin = publicOrigin(req);
  return {
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    scopes_supported: ALL_SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: "Receipt Ring",
    resource_documentation: `${origin}/`
  };
}

export function authorizationServerMetadata(req) {
  const origin = publicOrigin(req);
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/api/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    revocation_endpoint: `${origin}/api/oauth/revoke`,
    scopes_supported: ALL_SCOPES,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: [...AUTH_METHODS],
    revocation_endpoint_auth_methods_supported: [...AUTH_METHODS],
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${origin}/`
  };
}

// --- The consent page --------------------------------------------------------------

/**
 * Everything an authorization request says, checked. Throws a PageError
 * (shown on the page, never redirected) when the client or redirect URI is
 * not to be trusted, and an OAuthError (sent back to the client) otherwise.
 */
async function readAuthorizationRequest(prisma, req, source) {
  let clientId;
  let redirectParam;
  try {
    clientId = param(source, "client_id");
    redirectParam = param(source, "redirect_uri");
  } catch {
    throw new PageError("This sign-in link is not valid.");
  }
  if (!clientId || !CLIENT_ID_PATTERN.test(clientId)) throw new PageError("This app is not registered with Receipt Ring.");
  const client = await prisma.oAuthClient.findUnique({ where: { clientId } });
  if (!client) throw new PageError("This app is not registered with Receipt Ring.");

  // Never send anyone to an address the client did not register: with the
  // redirect URI in doubt, an error is shown here instead.
  const redirectUri = redirectParam ?? (client.redirectUris.length === 1 ? client.redirectUris[0] : undefined);
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    throw new PageError("This app asked to be sent somewhere it did not register.");
  }

  const request = { client, redirectUri, state: undefined };
  try {
    request.state = param(source, "state");
    if (request.state !== undefined && request.state.length > MAX_STATE) throw new OAuthError("invalid_request", "state is too long.");
    if (param(source, "response_type") !== "code") throw new OAuthError("unsupported_response_type", "Only response_type=code is supported.");
    const challenge = param(source, "code_challenge");
    const method = param(source, "code_challenge_method");
    if (!challenge || method !== "S256" || !CHALLENGE_PATTERN.test(challenge)) {
      throw new OAuthError("invalid_request", "PKCE is required: send a code_challenge with code_challenge_method=S256.");
    }
    request.codeChallenge = challenge;
    request.scopes = requestedScopes(param(source, "scope"));
    checkResource(req, param(source, "resource"));
    request.resource = param(source, "resource");
  } catch (error) {
    if (error instanceof OAuthError) error.request = request;
    throw error;
  }
  return request;
}

function redirectWith(res, req, redirectUri, values) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  url.searchParams.set("iss", publicOrigin(req));
  res.setHeader("Cache-Control", "no-store");
  res.redirect(303, url.toString());
}

/** The signed-in user, from the session cookie only (never a bearer token). */
async function sessionUser(prisma, req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{20,200}$/.test(token)) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, user: { select: { email: true, name: true } } }
  });
  if (!session || session.expiresAt < new Date() || isLockedOut(session.user.email)) return null;
  return session;
}

/** Ties the consent form to this session and this exact request. */
function consentToken(sessionId, request) {
  const secret = process.env.AUTH_SESSION_SECRET ?? "";
  return crypto
    .createHmac("sha256", secret)
    .update(["oauth-consent", sessionId, request.client.clientId, request.redirectUri, request.codeChallenge, request.state ?? "", request.scopes.join(" "), request.resource ?? ""].join("\n"))
    .digest("base64url");
}

function pageHeaders(res, nonce, formTarget) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'none'",
      `script-src 'nonce-${nonce}'`,
      `style-src 'nonce-${nonce}' https://fonts.googleapis.com`,
      "font-src https://fonts.gstatic.com",
      "img-src 'self'",
      "connect-src 'self'",
      // Browsers apply form-action to where the answer redirects as well.
      `form-action 'self'${formTarget ? ` ${formTarget}` : ""}`,
      "frame-ancestors 'none'",
      "base-uri 'none'"
    ].join("; ")
  );
  res.type("html");
}

const PAGE_STYLE = `
:root { color-scheme: light dark; --paper:#fdfcf8; --surface:#fefefa; --ink:#2c2c24; --ink2:#4a4a40; --ink3:#78786c; --moss:#5d7052; --moss-deep:#4d5e43; --mist:#f3f4f1; --border:#e6dccd; --well:#f0ebe5; --sienna:#a85448; }
@media (prefers-color-scheme: dark) { :root { --paper:#1d1e19; --surface:#25261f; --ink:#ecebe3; --ink2:#cfcdc2; --ink3:#a3a196; --moss:#7f9672; --moss-deep:#9bb08e; --mist:#1d1e19; --border:#3a3b32; --well:#2c2d25; --sienna:#d98a7e; } }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; background: var(--paper); color: var(--ink); font: 16px/1.5 "Nunito", system-ui, sans-serif; }
main { width: 100%; max-width: 440px; background: var(--surface); border: 1px solid var(--border); border-radius: 24px; padding: 28px; box-shadow: 0 10px 30px rgba(44,44,36,.08); }
.brand { display: flex; align-items: center; gap: 10px; font-family: "Fraunces", Georgia, serif; font-weight: 600; font-size: 18px; margin-bottom: 20px; }
.brand img { width: 32px; height: 32px; }
h1 { font-family: "Fraunces", Georgia, serif; font-weight: 600; font-size: 24px; line-height: 1.25; margin: 0 0 8px; }
p { margin: 0 0 14px; color: var(--ink2); }
.who { padding: 10px 14px; border-radius: 14px; background: var(--well); font-size: 14px; margin-bottom: 16px; word-break: break-word; }
ul { margin: 0 0 18px; padding-left: 20px; color: var(--ink2); }
li { margin-bottom: 6px; }
.host { font-weight: 800; color: var(--ink); overflow-wrap: anywhere; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; }
button, .button { flex: 1 1 140px; min-height: 44px; border-radius: 999px; border: 1px solid var(--border); background: transparent; color: var(--ink); font: 700 15px "Nunito", system-ui, sans-serif; cursor: pointer; text-align: center; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
button.primary { background: var(--moss); border-color: var(--moss); color: var(--mist); }
button:focus-visible, input:focus-visible, a:focus-visible { outline: 2px solid var(--moss); outline-offset: 2px; }
label { display: block; font-weight: 700; font-size: 14px; margin: 0 0 6px; }
input { width: 100%; min-height: 44px; padding: 10px 14px; margin-bottom: 14px; border-radius: 14px; border: 1px solid var(--border); background: var(--paper); color: var(--ink); font: inherit; }
.error { color: var(--sienna); font-weight: 700; min-height: 1.5em; }
.fine { font-size: 13px; color: var(--ink3); margin-top: 16px; }
a { color: var(--moss-deep); }
`;

function page(nonce, title, body, script = "") {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(title)} · Receipt Ring</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" nonce="${nonce}" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Nunito:wght@400;700;800&display=swap">
<style nonce="${nonce}">${PAGE_STYLE}</style>
</head>
<body>
<main>
<div class="brand"><img src="/favicon.svg" alt="" width="32" height="32">Receipt Ring</div>
${body}
</main>
${script ? `<script nonce="${nonce}">${script}</script>` : ""}
</body>
</html>`;
}

function errorPage(res, message, status = 400) {
  const nonce = base64url(crypto.randomBytes(16));
  pageHeaders(res, nonce, null);
  res.status(status).send(
    page(nonce, "Can't connect", `<h1>This app can't be connected</h1><p>${escapeHtml(message)}</p><p class="fine">Go back to the app and try adding Receipt Ring again.</p>`)
  );
}

function hiddenFields(request) {
  const fields = {
    client_id: request.client.clientId,
    redirect_uri: request.redirectUri,
    response_type: "code",
    code_challenge: request.codeChallenge,
    code_challenge_method: "S256",
    scope: request.scopes.join(" "),
    state: request.state,
    resource: request.resource
  };
  return Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`)
    .join("\n");
}

function consentPage(res, request, session) {
  const nonce = base64url(crypto.randomBytes(16));
  const target = new URL(request.redirectUri);
  pageHeaders(res, nonce, target.origin);
  const who = session.user.name ? `${session.user.name} (${session.user.email})` : session.user.email;
  const scopes = request.scopes.map((scope) => `<li>${escapeHtml(SCOPE_DESCRIPTIONS[scope])}</li>`).join("");
  res.send(
    page(
      nonce,
      "Connect an app",
      `<h1>Connect ${escapeHtml(request.client.name)} to your receipts?</h1>
<div class="who">Signed in as <strong>${escapeHtml(who)}</strong></div>
<p>If you allow it, it will be able to:</p>
<ul>${scopes}</ul>
<p>Afterwards you will be sent to <span class="host">${escapeHtml(target.host)}</span>. Only allow this if you were adding Receipt Ring there yourself.</p>
<form method="post" action="/api/oauth/authorize">
${hiddenFields(request)}
<input type="hidden" name="consent_token" value="${escapeHtml(consentToken(session.id, request))}">
<div class="actions">
<button type="submit" name="decision" value="deny">Cancel</button>
<button type="submit" name="decision" value="allow" class="primary">Allow</button>
</div>
</form>
<p class="fine">You can disconnect it at any time under Settings → Claude &amp; AI assistants. It never sees your password or receipt photos.</p>`
    )
  );
}

// The sign-in form posts to the app's own login route, so it is throttled and
// checked exactly like signing in to the app, then reloads into the consent
// screen with the session cookie set.
const SIGN_IN_SCRIPT = `
const form = document.getElementById("signin");
const error = document.getElementById("signinError");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.textContent = "";
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email.value, password: form.password.value })
    });
    if (response.ok) { window.location.reload(); return; }
    const body = await response.json().catch(() => ({}));
    error.textContent = body.error || "Could not sign in.";
  } catch {
    error.textContent = "Could not reach Receipt Ring. Check your connection.";
  }
  button.disabled = false;
});`;

function signInPage(res, request) {
  const nonce = base64url(crypto.randomBytes(16));
  pageHeaders(res, nonce, null);
  res.send(
    page(
      nonce,
      "Sign in",
      `<h1>Sign in to connect ${escapeHtml(request.client.name)}</h1>
<p>Sign in to your Receipt Ring account. You'll be asked to approve the connection next.</p>
<form id="signin" novalidate>
<label for="email">Email</label>
<input id="email" name="email" type="email" autocomplete="email" required>
<label for="password">Password</label>
<input id="password" name="password" type="password" autocomplete="current-password" required>
<p class="error" id="signinError" role="alert"></p>
<div class="actions"><button type="submit" class="primary">Sign in</button></div>
</form>
<p class="fine">No account yet? <a href="/" target="_blank" rel="noopener">Create one in Receipt Ring</a>, then come back and reload this page.</p>`,
      SIGN_IN_SCRIPT
    )
  );
}

// --- Client authentication at the token and revocation endpoints -------------------

async function authenticateClient(prisma, req) {
  let clientId = param(req.body, "client_id");
  let secret = param(req.body, "client_secret");
  const header = String(req.headers.authorization ?? "");
  if (/^Basic\s+/i.test(header)) {
    const decoded = Buffer.from(header.replace(/^Basic\s+/i, ""), "base64").toString("utf8");
    const split = decoded.indexOf(":");
    if (split < 0) throw new OAuthError("invalid_client", "Malformed client credentials.", 401);
    try {
      const basicId = decodeURIComponent(decoded.slice(0, split));
      if (clientId !== undefined && clientId !== basicId) throw new OAuthError("invalid_client", "Conflicting client ids.", 401);
      clientId = basicId;
      secret = decodeURIComponent(decoded.slice(split + 1));
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      throw new OAuthError("invalid_client", "Malformed client credentials.", 401);
    }
  }
  if (!clientId || !CLIENT_ID_PATTERN.test(clientId)) throw new OAuthError("invalid_client", "Unknown client.", 401);
  const client = await prisma.oAuthClient.findUnique({ where: { clientId } });
  if (!client) throw new OAuthError("invalid_client", "Unknown client.", 401);

  if (client.clientSecretHash) {
    if (!secret || !safeEqual(hashToken(secret), client.clientSecretHash)) {
      throw new OAuthError("invalid_client", "Client authentication failed.", 401);
    }
  } else if (secret) {
    // A public client has no secret; one that sends a secret is not this client.
    throw new OAuthError("invalid_client", "This client does not use a secret.", 401);
  }
  return client;
}

async function issueTokens(client, { grantId, userId, clientId, scopes }) {
  const accessToken = generateApiToken("access");
  const refreshToken = generateApiToken("refresh");
  const now = Date.now();
  const data = {
    accessTokenHash: hashToken(accessToken),
    accessExpiresAt: new Date(now + ACCESS_TOKEN_TTL_S * 1000),
    refreshTokenHash: hashToken(refreshToken),
    refreshExpiresAt: new Date(now + REFRESH_TOKEN_TTL_MS)
  };
  if (!grantId) {
    await client.oAuthGrant.create({ data: { userId, clientId, scopes: scopes.join(" "), ...data } });
  }
  return {
    data,
    response: {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_S,
      refresh_token: refreshToken,
      scope: scopes.join(" ")
    }
  };
}

// --- Routes ------------------------------------------------------------------

export function registerOAuth(app, prisma, { registerLimiters = [], tokenLimiters = [], authorizeLimiters = [], metadataLimiters = [] } = {}) {
  // Form posts: the token endpoint (RFC 6749 says form-encoded) and the
  // consent form. Small, flat, and only here.
  app.use("/api/oauth", express.urlencoded({ extended: false, limit: "16kb", parameterLimit: 50 }));

  // Metadata is public and read by clients from other origins.
  const metadata = (build) => [
    ...metadataLimiters,
    (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "no-store");
      res.json(build(req));
    }
  ];
  const corsPreflight = (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "MCP-Protocol-Version");
    res.status(204).end();
  };
  for (const path of [
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/api/mcp",
    "/.well-known/oauth-protected-resource/api/v1/mcp"
  ]) {
    app.get(path, ...metadata(protectedResourceMetadata));
    app.options(path, corsPreflight);
  }
  for (const path of ["/.well-known/oauth-authorization-server", "/.well-known/oauth-authorization-server/api/mcp"]) {
    app.get(path, ...metadata(authorizationServerMetadata));
    app.options(path, corsPreflight);
  }

  app.post("/api/oauth/register", ...registerLimiters, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const body = req.body;
    const fail = (message, code = "invalid_client_metadata") => res.status(400).json({ error: code, error_description: message });
    if (body === null || typeof body !== "object" || Array.isArray(body)) return fail("Send the client metadata as a JSON object.");

    const redirectUris = body.redirect_uris;
    if (!Array.isArray(redirectUris) || redirectUris.length === 0 || redirectUris.length > MAX_REDIRECT_URIS) {
      return fail(`redirect_uris must list 1-${MAX_REDIRECT_URIS} addresses.`, "invalid_redirect_uri");
    }
    if (!redirectUris.every(isAllowedRedirectUri)) {
      return fail("Each redirect URI must be https, or http on localhost, with no fragment.", "invalid_redirect_uri");
    }
    const method = body.token_endpoint_auth_method ?? "client_secret_basic";
    if (!AUTH_METHODS.has(method)) return fail(`token_endpoint_auth_method must be one of ${[...AUTH_METHODS].join(", ")}.`);
    const grantTypes = body.grant_types ?? ["authorization_code", "refresh_token"];
    if (!Array.isArray(grantTypes) || !grantTypes.includes("authorization_code") || grantTypes.some((type) => !["authorization_code", "refresh_token"].includes(type))) {
      return fail("grant_types may be authorization_code and refresh_token.");
    }
    const responseTypes = body.response_types ?? ["code"];
    if (!Array.isArray(responseTypes) || responseTypes.some((type) => type !== "code")) return fail("response_types may only be code.");
    if (body.scope !== undefined && typeof body.scope !== "string") return fail("scope must be a string.");
    const name =
      typeof body.client_name === "string"
        ? body.client_name.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_CLIENT_NAME)
        : "";

    try {
      // Registrations nobody approved within a day are of no use.
      await prisma.oAuthClient.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - UNUSED_CLIENT_TTL_MS) }, grants: { none: {} }, codes: { none: {} } }
      });

      const clientId = `rrc_${base64url(crypto.randomBytes(16))}`;
      const secret = method === "none" ? null : generateSessionToken();
      const client = await prisma.oAuthClient.create({
        data: {
          clientId,
          clientSecretHash: secret ? hashToken(secret) : null,
          name: name || "An unnamed app",
          redirectUris: [...new Set(redirectUris)]
        }
      });
      res.status(201).json({
        client_id: client.clientId,
        client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
        ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
        client_name: client.name,
        redirect_uris: client.redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: method,
        scope: ALL_SCOPES.join(" ")
      });
    } catch (error) {
      console.error("OAuth client registration failed:", error);
      res.status(500).json({ error: "server_error", error_description: "Could not register the client." });
    }
  });

  app.get("/api/oauth/authorize", ...authorizeLimiters, async (req, res) => {
    let request;
    try {
      request = await readAuthorizationRequest(prisma, req, req.query);
    } catch (error) {
      if (error instanceof OAuthError && error.request) {
        return redirectWith(res, req, error.request.redirectUri, { error: error.code, error_description: error.message, state: error.request.state });
      }
      if (error instanceof PageError) return errorPage(res, error.message);
      console.error("OAuth authorize failed:", error);
      return errorPage(res, "Something went wrong. Try again.", 500);
    }
    try {
      const session = await sessionUser(prisma, req);
      if (!session) return signInPage(res, request);
      consentPage(res, request, session);
    } catch (error) {
      console.error("OAuth authorize failed:", error);
      errorPage(res, "Something went wrong. Try again.", 500);
    }
  });

  app.post("/api/oauth/authorize", ...authorizeLimiters, async (req, res) => {
    // A browser on a page with Referrer-Policy: no-referrer (this whole app)
    // sends "Origin: null" with a form post, so null cannot be refused; the
    // consent token below is what proves the form came from this page.
    if (!isSameSiteOrigin(req, req.headers.origin)) return errorPage(res, "This request did not come from Receipt Ring.", 403);

    let request;
    try {
      request = await readAuthorizationRequest(prisma, req, req.body);
    } catch (error) {
      if (error instanceof OAuthError && error.request) {
        return redirectWith(res, req, error.request.redirectUri, { error: error.code, error_description: error.message, state: error.request.state });
      }
      if (error instanceof PageError) return errorPage(res, error.message);
      console.error("OAuth consent failed:", error);
      return errorPage(res, "Something went wrong. Try again.", 500);
    }

    try {
      const session = await sessionUser(prisma, req);
      if (!session) return signInPage(res, request);
      let token;
      let decision;
      try {
        token = param(req.body, "consent_token");
        decision = param(req.body, "decision");
      } catch {
        return errorPage(res, "This approval was not valid. Start again from the app.", 403);
      }
      if (!token || !safeEqual(token, consentToken(session.id, request))) {
        return errorPage(res, "This approval has expired or was not made here. Start again from the app.", 403);
      }
      if (decision !== "allow") {
        return redirectWith(res, req, request.redirectUri, { error: "access_denied", error_description: "The user did not allow access.", state: request.state });
      }

      await prisma.oAuthCode.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      const code = generateSessionToken();
      await prisma.oAuthCode.create({
        data: {
          codeHash: hashToken(code),
          clientId: request.client.id,
          userId: session.userId,
          redirectUri: request.redirectUri,
          codeChallenge: request.codeChallenge,
          scopes: request.scopes.join(" "),
          expiresAt: new Date(Date.now() + CODE_TTL_MS)
        }
      });
      redirectWith(res, req, request.redirectUri, { code, state: request.state });
    } catch (error) {
      console.error("OAuth consent failed:", error);
      errorPage(res, "Something went wrong. Try again.", 500);
    }
  });

  app.post("/api/oauth/token", ...tokenLimiters, async (req, res) => {
    try {
      if (req.body === null || typeof req.body !== "object" || Array.isArray(req.body)) {
        throw new OAuthError("invalid_request", "Send the request form-encoded.");
      }
      const client = await authenticateClient(prisma, req);
      const grantType = param(req.body, "grant_type");
      checkResource(req, param(req.body, "resource"));
      let response;

      if (grantType === "authorization_code") {
        const code = param(req.body, "code");
        const redirectUri = param(req.body, "redirect_uri");
        const verifier = param(req.body, "code_verifier");
        if (!code || !verifier) throw new OAuthError("invalid_request", "code and code_verifier are required.");
        if (!VERIFIER_PATTERN.test(verifier)) throw new OAuthError("invalid_grant", "The code_verifier is not valid.");

        const stored = await prisma.oAuthCode.findUnique({ where: { codeHash: hashToken(code) }, include: { user: { select: { email: true } } } });
        // Used up by the first attempt, right or wrong: whoever deletes it is
        // the one who gets to exchange it, and a failed check leaves nothing
        // to try again with. Deleted outside any transaction for that reason.
        const claimed = stored ? await prisma.oAuthCode.deleteMany({ where: { id: stored.id } }) : { count: 0 };
        if (!stored || claimed.count !== 1) throw new OAuthError("invalid_grant", "The code is not valid.");
        if (stored.expiresAt < new Date()) throw new OAuthError("invalid_grant", "The code has expired.");
        if (stored.clientId !== client.id) throw new OAuthError("invalid_grant", "The code was issued to another client.");
        if ((redirectUri ?? stored.redirectUri) !== stored.redirectUri) throw new OAuthError("invalid_grant", "redirect_uri does not match.");
        if (!safeEqual(pkceChallenge(verifier), stored.codeChallenge)) throw new OAuthError("invalid_grant", "The code_verifier does not match.");
        if (isLockedOut(stored.user.email)) throw new OAuthError("invalid_grant", "This account cannot be used.");
        ({ response } = await issueTokens(prisma, {
          userId: stored.userId,
          clientId: client.id,
          scopes: normalizeScopes(parseScopes(stored.scopes))
        }));
      } else if (grantType === "refresh_token") {
        const refreshToken = param(req.body, "refresh_token");
        if (!refreshToken) throw new OAuthError("invalid_request", "refresh_token is required.");
        const hash = hashToken(refreshToken);
        const asked = param(req.body, "scope");

        const grant = await prisma.oAuthGrant.findUnique({ where: { refreshTokenHash: hash }, include: { user: { select: { email: true } } } });
        if (!grant) {
          // A refresh token that was already rotated away is being replayed:
          // somebody has a copy. End the grant for everyone.
          const reused = await prisma.oAuthGrant.deleteMany({ where: { previousRefreshTokenHash: hash } });
          if (reused.count > 0) console.warn("Revoked an OAuth grant after its old refresh token was presented again.");
          throw new OAuthError("invalid_grant", "The refresh token is not valid.");
        }
        if (grant.clientId !== client.id) throw new OAuthError("invalid_grant", "The refresh token was issued to another client.");
        if (grant.refreshExpiresAt < new Date()) throw new OAuthError("invalid_grant", "The refresh token has expired.");
        if (isLockedOut(grant.user.email)) throw new OAuthError("invalid_grant", "This account cannot be used.");
        const granted = normalizeScopes(parseScopes(grant.scopes));
        let scopes = granted;
        if (asked !== undefined && asked.trim() !== "") {
          scopes = requestedScopes(asked);
          if (scopes.some((scope) => !granted.includes(scope))) throw new OAuthError("invalid_scope", "Cannot widen the scopes of a grant.");
        }

        const { data, response: tokens } = await issueTokens(prisma, { grantId: grant.id, userId: grant.userId, clientId: client.id, scopes });
        // Rotate only if the token is still the current one: two refreshes
        // racing with the same token cannot both succeed.
        const rotated = await prisma.oAuthGrant.updateMany({
          where: { id: grant.id, refreshTokenHash: hash },
          data: { ...data, previousRefreshTokenHash: hash, scopes: scopes.join(" ") }
        });
        if (rotated.count !== 1) throw new OAuthError("invalid_grant", "The refresh token is not valid.");
        response = tokens;
      } else {
        throw new OAuthError("unsupported_grant_type", "grant_type must be authorization_code or refresh_token.");
      }

      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      res.json(response);
    } catch (error) {
      if (error instanceof OAuthError) return sendOAuthError(res, error);
      console.error("OAuth token request failed:", error);
      res.setHeader("Cache-Control", "no-store");
      res.status(500).json({ error: "server_error", error_description: "Could not issue a token." });
    }
  });

  app.post("/api/oauth/revoke", ...tokenLimiters, async (req, res) => {
    try {
      if (req.body === null || typeof req.body !== "object" || Array.isArray(req.body)) {
        throw new OAuthError("invalid_request", "Send the request form-encoded.");
      }
      const client = await authenticateClient(prisma, req);
      const token = param(req.body, "token");
      if (!token) throw new OAuthError("invalid_request", "token is required.");
      const hash = hashToken(token);
      // Either token ends the whole grant. An unknown token is not an error
      // (RFC 7009): there is nothing left to revoke.
      await prisma.oAuthGrant.deleteMany({
        where: { clientId: client.id, OR: [{ accessTokenHash: hash }, { refreshTokenHash: hash }] }
      });
      res.setHeader("Cache-Control", "no-store");
      res.status(200).end();
    } catch (error) {
      if (error instanceof OAuthError) return sendOAuthError(res, error);
      console.error("OAuth revocation failed:", error);
      res.status(500).json({ error: "server_error", error_description: "Could not revoke the token." });
    }
  });

  // A malformed form or JSON body on these routes is answered in OAuth's own
  // error shape rather than the app's.
  app.use("/api/oauth", (error, _req, res, next) => {
    if (res.headersSent || !(error?.type === "entity.parse.failed" || error?.type === "entity.too.large" || error?.type === "parameters.too.many")) {
      return next(error);
    }
    sendOAuthError(res, new OAuthError("invalid_request", "The request body could not be read."));
  });
}
