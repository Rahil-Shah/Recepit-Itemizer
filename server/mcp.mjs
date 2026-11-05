// The Model Context Protocol endpoint: how an AI assistant such as Claude
// reaches the receipts. POST /api/mcp (and /api/v1/mcp).
//
// The Streamable HTTP transport, stateless: every POST carries one JSON-RPC
// message (or, from older clients, a batch) and gets its answer back as
// JSON. No session id and no server-sent event stream -- nothing here ever
// needs to push to the client, and a serverless function cannot hold a
// stream open between requests anyway. GET and DELETE answer 405, which the
// spec allows a server without a stream to do.
//
// Who is calling is decided by the bearer token alone (server/api-tokens.mjs):
// a personal access token from Settings, or an OAuth access token issued to an
// app the user approved (server/oauth.mjs). A browser cookie is never enough,
// so a web page cannot drive the endpoint with a visitor's session; requests
// that say they come from a web page on another origin are refused outright,
// as the spec asks, unless the origin is this site or listed in CORS_ORIGINS.
//
// The tools themselves live in server/mcp-tools.mjs.

import { createApiTokenAuth } from "./api-tokens.mjs";
import { corsOrigins } from "./api-platform.mjs";
import { publicOrigin } from "./public-url.mjs";
import { findTool, listTools, runTool } from "./mcp-tools.mjs";

// Newest first. A client asking for one of these gets it; anything else gets
// the newest, and the client decides whether it can carry on.
export const MCP_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
export const SERVER_INFO = { name: "receipt-ring", title: "Receipt Ring", version: "1.0.0" };
const MAX_BATCH = 20;

export const MCP_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: "Too many requests from this assistant. Give it a few minutes."
};
// Counted per address before any token is looked up. Higher than the per-
// account limit: a hosted assistant (claude.ai) calls from a few shared
// addresses on behalf of everyone who connected it.
export const MCP_ADDRESS_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 1200,
  message: "Too many requests. Give it a few minutes."
};

export const MCP_INSTRUCTIONS = `Receipt Ring holds the user's itemized receipts: every line item and price, and how each item was split between people. The account owner is assumed to have paid each receipt; everyone else's share is what they owe the owner.

Checking a receipt photo: read every line item from the image yourself (the label as printed, the price, any item code), plus the subtotal, tax and total. Find the matching saved receipt with list_receipts (by store, date or total), then call compare_receipt with what you read. Show the user the differences it reports, and call update_receipt with only the corrections they agree to, passing the expected_version you were given. If update_receipt says the receipt changed, read it again before retrying. If the receipt is not saved yet, offer create_receipt.

Questions: use get_receipt for one receipt's items and who owes what, person_summary for everything one person had, who_owes_what for totals per person, and search_items to find an item across receipts. Amounts are in the receipt's currency, as numbers with cents (3.49). Dates are YYYY-MM-DD, the day the receipt was saved.`;

const rpcError = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const rpcResult = (id, result) => ({ jsonrpc: "2.0", id, result });
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isValidId = (id) => typeof id === "string" || (typeof id === "number" && Number.isFinite(id));

function negotiateVersion(requested) {
  return MCP_PROTOCOL_VERSIONS.includes(requested) ? requested : MCP_PROTOCOL_VERSIONS[0];
}

/** Answer one JSON-RPC request. Notifications never reach here. */
export async function handleRequest(message, ctx) {
  const { id, method } = message;
  const params = message.params === undefined ? {} : message.params;
  if (!isObject(params)) return rpcError(id, -32602, "params must be an object.");

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: negotiateVersion(params.protocolVersion),
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: MCP_INSTRUCTIONS
      });
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: listTools(ctx.scopes) });
    case "tools/call": {
      const tool = findTool(params.name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${String(params.name).slice(0, 100)}`);
      const outcome = await runTool(tool, params.arguments, ctx);
      if (outcome.error) {
        return rpcResult(id, { content: [{ type: "text", text: outcome.error }], isError: true });
      }
      return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(outcome.data, null, 2) }] });
    }
    // Not offered (see capabilities), but some clients ask regardless; an
    // empty list is a friendlier answer than an error.
    case "resources/list":
      return rpcResult(id, { resources: [] });
    case "resources/templates/list":
      return rpcResult(id, { resourceTemplates: [] });
    case "prompts/list":
      return rpcResult(id, { prompts: [] });
    default:
      return rpcError(id, -32601, "Method not found.");
  }
}

/**
 * Refuse a request a web page on another site sent: a token is not a cookie,
 * but there is no reason for a stranger's page to reach this endpoint at all.
 * Server-side clients (claude.ai's connector, Claude Code) send no Origin.
 */
function originGuard(req, res, next) {
  const origin = req.headers.origin;
  if (!origin) return next();
  const normalized = String(origin).replace(/\/+$/, "");
  if (corsOrigins().has(normalized)) return next();
  try {
    if (new URL(normalized).host === new URL(publicOrigin(req)).host) return next();
  } catch {
    // "null" or garbage: not this site.
  }
  return res.status(403).json(rpcError(null, -32600, "Requests from this origin are not allowed."));
}

export function registerMcp(app, prisma, { limiters = [] } = {}) {
  const requireApiToken = createApiTokenAuth(prisma);

  app.post("/api/mcp", originGuard, requireApiToken, ...limiters, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");

    const version = req.get("mcp-protocol-version");
    if (version && !MCP_PROTOCOL_VERSIONS.includes(version)) {
      return res.status(400).json(rpcError(null, -32600, `Unsupported MCP-Protocol-Version: ${version.slice(0, 40)}`));
    }

    const body = req.body;
    if (!isObject(body) && !Array.isArray(body)) {
      return res.status(400).json(rpcError(null, -32700, "Send a JSON-RPC message as application/json."));
    }
    const batch = Array.isArray(body);
    const messages = batch ? body : [body];
    if (messages.length === 0 || messages.length > MAX_BATCH) {
      return res.status(400).json(rpcError(null, -32600, `A batch must hold 1-${MAX_BATCH} messages.`));
    }

    const ctx = { prisma, userId: req.userId, isAdmin: req.isAdmin, scopes: req.scopes };
    const responses = [];
    for (const message of messages) {
      if (!isObject(message) || message.jsonrpc !== "2.0") {
        responses.push(rpcError(isObject(message) && isValidId(message.id) ? message.id : null, -32600, "Not a JSON-RPC 2.0 message."));
        continue;
      }
      // A response to something this server asked (it never asks), or a
      // notification (initialized, cancelled, ...): nothing to answer.
      if (!("method" in message) || !("id" in message)) continue;
      if (typeof message.method !== "string" || !isValidId(message.id)) {
        responses.push(rpcError(isValidId(message.id) ? message.id : null, -32600, "A request needs a string method and an id."));
        continue;
      }
      responses.push(await handleRequest(message, ctx));
    }

    if (responses.length === 0) return res.status(202).end();
    res.json(batch ? responses : responses[0]);
  });

  // No server-to-client stream and no sessions to end.
  const notAllowed = (_req, res) => {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "This MCP endpoint takes POST only." });
  };
  app.get("/api/mcp", notAllowed);
  app.delete("/api/mcp", notAllowed);

  // Malformed JSON is the body parser's error, raised before any route; answer
  // it as JSON-RPC rather than the app's generic error body.
  app.use("/api/mcp", (error, _req, res, next) => {
    if (res.headersSent || !(error?.type === "entity.parse.failed" || error?.type === "entity.too.large")) return next(error);
    res.setHeader("Cache-Control", "no-store");
    const tooLarge = error.type === "entity.too.large";
    res.status(tooLarge ? 413 : 400).json(rpcError(null, tooLarge ? -32600 : -32700, tooLarge ? "Request too large." : "Parse error."));
  });
}
