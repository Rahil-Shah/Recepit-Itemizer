// Read-only Teller API client.
//
// This module ONLY reads accounts and transactions. There are deliberately no
// payment/transfer functions, so no code path here can move money.
//
// Auth is HTTP Basic with the enrollment access token as the username and an
// empty password. For the "development" and "production" environments Teller
// requires mutual TLS: set TELLER_CERT_PATH and TELLER_KEY_PATH to the client
// certificate/key downloaded from the Teller dashboard. In "sandbox" no client
// certificate is needed, so the agent is created without one. Switching
// environments is therefore configuration only — no code change.

import https from "node:https";
import fs from "node:fs";

const TELLER_HOST = "api.teller.io";

let cachedAgent;

function buildAgent() {
  if (cachedAgent) return cachedAgent;

  const certPath = process.env.TELLER_CERT_PATH;
  const keyPath = process.env.TELLER_KEY_PATH;

  if (certPath && keyPath) {
    cachedAgent = new https.Agent({
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
      keepAlive: true
    });
  } else {
    // Sandbox: no client certificate required.
    cachedAgent = new https.Agent({ keepAlive: true });
  }
  return cachedAgent;
}

/** Public, non-secret config safe to expose to the browser for Teller Connect. */
export function tellerConfig() {
  return {
    applicationId: process.env.TELLER_APPLICATION_ID || "",
    environment: process.env.TELLER_ENVIRONMENT || "sandbox"
  };
}

function request(pathname, token) {
  const auth = "Basic " + Buffer.from(`${token}:`).toString("base64");
  const options = {
    host: TELLER_HOST,
    path: pathname,
    method: "GET",
    agent: buildAgent(),
    headers: { Authorization: auth, Accept: "application/json" }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        const status = res.statusCode ?? 0;
        if (status < 200 || status >= 300) {
          return reject(new Error(`Teller request failed (${status}) for ${pathname}: ${body.slice(0, 300)}`));
        }
        try {
          resolve(body ? JSON.parse(body) : null);
        } catch (error) {
          reject(new Error(`Teller returned invalid JSON for ${pathname}: ${error.message}`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("Teller request timed out.")));
    req.end();
  });
}

/** List the accounts reachable with this access token. */
export function listAccounts(token) {
  return request("/accounts", token);
}

/** List transactions for a single account (read-only). */
export function listTransactions(token, accountId) {
  return request(`/accounts/${encodeURIComponent(accountId)}/transactions`, token);
}
