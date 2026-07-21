// Read-only Plaid API client.
//
// This module ONLY creates Link tokens, exchanges public tokens, and reads
// accounts and transactions. There are deliberately no payment/transfer
// functions, so no code path here can move money.
//
// Auth is client_id + secret sent in each request body (no mutual TLS, unlike
// Teller). The environment is selected purely by config: PLAID_ENV picks the
// host (sandbox / development / production), so switching environments is a
// configuration change only — no code change.

import https from "node:https";

const PLAID_HOSTS = {
  sandbox: "sandbox.plaid.com",
  development: "development.plaid.com",
  production: "production.plaid.com"
};

const agent = new https.Agent({ keepAlive: true });

function plaidEnv() {
  const env = (process.env.PLAID_ENV || "sandbox").toLowerCase();
  return PLAID_HOSTS[env] ? env : "sandbox";
}

function credentials() {
  const clientId = process.env.PLAID_CLIENT_ID || "";
  const secret = process.env.PLAID_SECRET || "";
  return { clientId, secret };
}

/** Public, non-secret config the server uses to decide whether Plaid is set up. */
export function plaidConfig() {
  const { clientId, secret } = credentials();
  return {
    environment: plaidEnv(),
    configured: Boolean(clientId && secret)
  };
}

function request(pathname, payload) {
  const { clientId, secret } = credentials();
  const body = JSON.stringify({ client_id: clientId, secret, ...payload });

  const options = {
    host: PLAID_HOSTS[plaidEnv()],
    path: pathname,
    method: "POST",
    agent,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Content-Length": Buffer.byteLength(body)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        const status = res.statusCode ?? 0;
        let parsed = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch (error) {
          return reject(new Error(`Plaid returned invalid JSON for ${pathname}: ${error.message}`));
        }
        if (status < 200 || status >= 300) {
          // Plaid error bodies carry error_code/error_message — surface them
          // for logs without leaking the request body (which holds the secret).
          const detail = parsed?.error_message || parsed?.error_code || raw.slice(0, 300);
          return reject(new Error(`Plaid request failed (${status}) for ${pathname}: ${detail}`));
        }
        resolve(parsed);
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("Plaid request timed out.")));
    req.write(body);
    req.end();
  });
}

/**
 * Create a short-lived Link token used by Plaid Link in the browser. The
 * client_user_id scopes the Item to this app's user.
 */
export function createLinkToken(clientUserId) {
  return request("/link/token/create", {
    user: { client_user_id: String(clientUserId) },
    client_name: "Receipt Ring",
    products: ["transactions"],
    country_codes: ["US"],
    language: "en"
  });
}

/** Exchange the public token from Link for a permanent access token + item id. */
export function exchangePublicToken(publicToken) {
  return request("/item/public_token/exchange", { public_token: publicToken });
}

/** List the accounts reachable with this access token (read-only). */
export function getAccounts(accessToken) {
  return request("/accounts/get", { access_token: accessToken });
}

/**
 * Cursor-based transactions sync (read-only). Returns added/modified/removed
 * batches plus the next cursor; the caller loops while has_more is true.
 */
export function syncTransactions(accessToken, cursor) {
  return request("/transactions/sync", {
    access_token: accessToken,
    cursor: cursor || undefined,
    count: 500
  });
}
