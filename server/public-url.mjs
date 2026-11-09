// The address this deployment is reached at, for anything that has to name
// itself in full: the MCP endpoint's OAuth metadata, the issuer in a token
// response, the connector URL shown in Settings.
//
// PUBLIC_URL, when set, is the answer and the request is not consulted. Without
// it the address comes from the request: the protocol and host as Express sees
// them, which honour X-Forwarded-Proto and X-Forwarded-Host only when the app
// trusts the proxy (TRUST_PROXY, or always on Vercel, whose edge sets both).
//
// A request can claim any Host it likes. That only changes what is written
// back to the same caller, and every response built from this is no-store,
// so it cannot poison a cache for anyone else. A host that is not a plain
// host[:port] is refused rather than echoed.

const HOST_PATTERN = /^(?:[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*|\[[0-9A-Fa-f:.]+\])(?::\d{1,5})?$/;

/** PUBLIC_URL's origin, or null when it is unset or not an http(s) URL. */
export function configuredOrigin(value = process.env.PUBLIC_URL) {
  if (!value) return null;
  try {
    const url = new URL(String(value).trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** "https://receipts.example.com", with no trailing slash. */
export function publicOrigin(req) {
  const configured = configuredOrigin();
  if (configured) return configured;
  const protocol = req.protocol === "https" ? "https" : "http";
  const host = String(req.host ?? req.headers?.host ?? "");
  return `${protocol}://${HOST_PATTERN.test(host) ? host : "localhost"}`;
}

/** The MCP endpoint's full URL: what a user pastes into Claude. */
export function mcpUrl(req) {
  return `${publicOrigin(req)}/api/mcp`;
}
