// OpenAPI 3.1 description of the HTTP API, served at /api/v1/openapi.json.
//
// For a client that is not this repo's own page: a separate web front end or
// a mobile app. Routes are listed in one table and expanded below, and
// tests/api-platform.test.mjs checks the table against the routes the app
// actually registers, so a new route cannot ship undocumented.

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ content: { "application/json": { schema } } });
const idParam = (name, description) => ({ name, in: "path", required: true, schema: { type: "string" }, description });
const queryParam = (name, description, schema = { type: "string" }) => ({ name, in: "query", required: false, schema, description });

/**
 * [method, path, summary, options]. `auth` is "none", "user" (a session) or
 * "admin" (a session on an ADMIN_EMAILS account).
 */
export const ROUTES = [
  ["get", "/health", "Liveness and database reachability", { auth: "none", tag: "Platform" }],
  ["get", "/meta", "What this server is and how to sign in", { auth: "none", tag: "Platform" }],
  ["get", "/openapi.json", "This document", { auth: "none", tag: "Platform" }],

  ["post", "/auth/register", "Create an account and sign in", { auth: "none", tag: "Auth", body: "Credentials", response: "SignedIn", status: 201 }],
  ["post", "/auth/login", "Sign in", { auth: "none", tag: "Auth", body: "Credentials", response: "SignedIn" }],
  ["post", "/auth/logout", "End the current session", { auth: "none", tag: "Auth", status: 204 }],
  ["get", "/auth/me", "The signed-in account", { auth: "user", tag: "Auth", response: "User" }],
  ["delete", "/auth/account", "Delete the account and everything in it", { auth: "user", tag: "Auth", body: "PasswordConfirmation", status: 204 }],

  ["get", "/gemini-config", "Model and whether a Gemini key is available", { auth: "user", tag: "Gemini" }],
  ["put", "/gemini-key", "Save a personal Gemini key (stored encrypted, never returned)", { auth: "user", tag: "Gemini" }],
  ["delete", "/gemini-key", "Remove the personal Gemini key", { auth: "user", tag: "Gemini" }],
  ["post", "/gemini/parse", "Read a receipt photo into items, prices and totals", { auth: "user", tag: "Gemini" }],
  ["post", "/items/identify", "Name abbreviated receipt lines", { auth: "user", tag: "Gemini" }],
  ["post", "/budget/categorize", "Sort a month's receipts and transactions into budget categories", { auth: "user", tag: "Gemini" }],

  ["get", "/item-aliases", "Item names the user confirmed", { auth: "user", tag: "Items" }],
  ["put", "/item-aliases", "Confirm an item name", { auth: "user", tag: "Items" }],
  ["delete", "/item-aliases", "Forget a confirmed item name", { auth: "user", tag: "Items", query: [queryParam("lookupKey", "The alias key"), queryParam("storeKey", "Its store")] }],

  ["get", "/people", "The people the user splits with", { auth: "user", tag: "People" }],
  ["post", "/people", "Add a person", { auth: "user", tag: "People" }],
  ["get", "/people/search", "Find people by name", { auth: "user", tag: "People", query: [queryParam("q", "Name prefix")] }],
  ["delete", "/people/{id}", "Remove a person", { auth: "user", tag: "People", params: [idParam("id", "Person id")] }],

  ["get", "/receipts", "Every saved receipt, with lines, people and splits", { auth: "user", tag: "Receipts", response: { type: "array", items: ref("Receipt") } }],
  ["post", "/receipts", "Save a receipt", { auth: "user", tag: "Receipts", body: "SaveReceipt", response: "Receipt", status: 201 }],
  ["put", "/receipts/{id}", "Replace a saved receipt's contents", { auth: "user", tag: "Receipts", body: "SaveReceipt", response: "Receipt", params: [idParam("id", "Receipt id")] }],
  ["delete", "/receipts/{id}", "Delete a receipt", { auth: "user", tag: "Receipts", params: [idParam("id", "Receipt id")] }],
  ["get", "/receipts/{id}/image", "The receipt photo (binary)", { auth: "user", tag: "Receipts", params: [idParam("id", "Receipt id")], binary: true }],
  ["patch", "/receipts/{receiptId}/lines/{lineId}", "Flag a line as food", { auth: "user", tag: "Receipts", params: [idParam("receiptId", "Receipt id"), idParam("lineId", "Line id")] }],
  ["get", "/receipts/food-summary", "The owner's food spend for a month", { auth: "user", tag: "Receipts", query: [queryParam("month", "YYYY-MM")] }],
  ["patch", "/receipts/{receiptId}/link-transaction", "Attach a receipt to a bank transaction", { auth: "admin", tag: "Bank", params: [idParam("receiptId", "Receipt id")] }],
  ["delete", "/receipts/{receiptId}/link-transaction", "Detach a receipt from its transaction", { auth: "admin", tag: "Bank", params: [idParam("receiptId", "Receipt id")] }],

  ["get", "/rent-entries", "Rent payments, optionally for one month", { auth: "user", tag: "Rent", query: [queryParam("month", "YYYY-MM")] }],
  ["post", "/rent-entries", "Log a rent payment", { auth: "user", tag: "Rent" }],
  ["get", "/rent-entries/summary", "Rent total for a month", { auth: "user", tag: "Rent", query: [queryParam("month", "YYYY-MM")] }],
  ["patch", "/rent-entries/{entryId}", "Edit a rent payment", { auth: "user", tag: "Rent", params: [idParam("entryId", "Rent entry id")] }],
  ["delete", "/rent-entries/{entryId}", "Delete a rent payment", { auth: "user", tag: "Rent", params: [idParam("entryId", "Rent entry id")] }],
  ["get", "/rent-entries/{entryId}/photo", "The proof-of-payment file (binary)", { auth: "user", tag: "Rent", params: [idParam("entryId", "Rent entry id")], binary: true }],

  ["get", "/education-expenses/export", "Education expenses as a PDF or spreadsheet", { auth: "user", tag: "Exports", query: [queryParam("month", "YYYY-MM"), queryParam("year", "YYYY"), queryParam("format", "pdf or xlsx")], binary: true }],
  ["get", "/spending/export", "All spending as CSV", { auth: "admin", tag: "Exports", binary: true }],

  ["get", "/plaid/link-token", "Start Plaid Link", { auth: "admin", tag: "Bank" }],
  ["post", "/plaid/exchange", "Finish linking a bank", { auth: "admin", tag: "Bank" }],
  ["post", "/plaid/sync", "Import new transactions", { auth: "admin", tag: "Bank" }],
  ["get", "/plaid/connections", "Linked banks", { auth: "admin", tag: "Bank" }],
  ["delete", "/plaid/connections/{id}", "Unlink a bank and delete its transactions", { auth: "admin", tag: "Bank", params: [idParam("id", "Connection id")] }],
  ["get", "/transactions", "Imported bank transactions", { auth: "admin", tag: "Bank", response: { type: "array", items: ref("BankTransaction") } }],
  ["patch", "/bank-transactions/{txnId}/food", "Flag a transaction as food", { auth: "admin", tag: "Bank", params: [idParam("txnId", "Transaction id")] }],

  ["get", "/admin/backup", "Backup manifest: every table and its row count", { auth: "admin", tag: "Admin", query: [queryParam("secrets", "true to include credential columns", { type: "boolean" })], response: "BackupManifest" }],
  ["get", "/admin/backup/{table}", "One page of a table's rows", { auth: "admin", tag: "Admin", params: [idParam("table", "Table name from the manifest")], query: [queryParam("cursor", "nextCursor from the previous page"), queryParam("secrets", "true to include credential columns", { type: "boolean" })], response: "BackupPage" }]
];

const SCHEMAS = {
  Error: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
  Credentials: {
    type: "object",
    required: ["email", "password"],
    properties: { email: { type: "string", format: "email" }, password: { type: "string", minLength: 8 }, name: { type: "string" } }
  },
  PasswordConfirmation: { type: "object", required: ["password"], properties: { password: { type: "string" } } },
  User: {
    type: "object",
    properties: { id: { type: "string" }, email: { type: "string" }, name: { type: ["string", "null"] }, isAdmin: { type: "boolean" } }
  },
  SignedIn: {
    allOf: [
      ref("User"),
      {
        type: "object",
        description: "token and expiresAt are present only when the request sent X-Auth-Mode: token.",
        properties: { token: { type: "string" }, expiresAt: { type: "string", format: "date-time" } }
      }
    ]
  },
  SaveReceipt: {
    type: "object",
    required: ["category", "lines"],
    properties: {
      storeName: { type: ["string", "null"] },
      category: { type: "string" },
      subtotal: { type: ["number", "null"] },
      tax: { type: ["number", "null"] },
      total: { type: ["number", "null"] },
      people: { type: "array", items: { type: "object", properties: { clientId: { type: "string" } } } },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            label: { type: "string" },
            amount: { type: "number" },
            ignored: { type: "boolean" },
            isFood: { type: "boolean" },
            itemCode: { type: "string" }
          }
        }
      },
      assignments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            lineClientId: { type: "string" },
            personClientId: { type: "string" },
            mode: { type: "string", enum: ["equal", "percentage", "amount"] },
            value: { type: "number" }
          }
        }
      },
      imageDataUrl: { type: ["string", "null"], description: "A base64 JPEG/PNG/WebP data URL" }
    }
  },
  Receipt: {
    type: "object",
    properties: {
      id: { type: "string" },
      storeName: { type: ["string", "null"] },
      category: { type: "string" },
      budgetCategory: { type: ["string", "null"] },
      subtotal: { type: ["number", "null"] },
      tax: { type: ["number", "null"] },
      total: { type: ["number", "null"] },
      createdAt: { type: "string", format: "date-time" },
      hasImage: { type: "boolean" },
      people: { type: "array", items: { type: "object" } },
      lines: { type: "array", items: { type: "object" } }
    }
  },
  BankTransaction: {
    type: "object",
    properties: {
      id: { type: "string" },
      date: { type: "string", format: "date" },
      description: { type: ["string", "null"] },
      amount: { type: "number", description: "Negative for money out" },
      category: { type: ["string", "null"] },
      budgetCategory: { type: ["string", "null"] },
      isFood: { type: "boolean" },
      account: { type: ["string", "null"] },
      linkedReceiptId: { type: ["string", "null"] }
    }
  },
  BackupManifest: {
    type: "object",
    properties: {
      format: { type: "string" },
      generatedAt: { type: "string", format: "date-time" },
      includesSecrets: { type: "boolean" },
      tables: { type: "array", items: { type: "object", properties: { name: { type: "string" }, rows: { type: "integer" } } } }
    }
  },
  BackupPage: {
    type: "object",
    properties: {
      table: { type: "string" },
      rows: { type: "array", items: { type: "object" } },
      nextCursor: { type: ["string", "null"] }
    }
  }
};

function operation([method, path, summary, options]) {
  const responses = {};
  const ok = String(options.status ?? 200);
  if (options.status === 204) {
    responses[ok] = { description: "Done" };
  } else if (options.binary) {
    responses[ok] = { description: "The file", content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } } };
  } else {
    const schema = typeof options.response === "string" ? ref(options.response) : options.response ?? { type: "object" };
    responses[ok] = { description: "OK", ...json(schema) };
  }
  responses["400"] = { description: "The request was not valid", ...json(ref("Error")) };
  if (options.auth !== "none") responses["401"] = { description: "Not signed in", ...json(ref("Error")) };
  if (options.auth === "admin") responses["403"] = { description: "Not an admin account", ...json(ref("Error")) };
  responses["429"] = { description: "Rate limited; see Retry-After", ...json(ref("Error")) };

  return [
    path,
    method,
    {
      summary,
      tags: [options.tag],
      ...(options.auth === "none" ? { security: [] } : {}),
      ...(options.auth === "admin" ? { "x-requires-admin": true } : {}),
      ...(options.params || options.query ? { parameters: [...(options.params ?? []), ...(options.query ?? [])] } : {}),
      ...(options.body ? { requestBody: { required: true, ...json(ref(options.body)) } } : {}),
      responses
    }
  ];
}

const paths = {};
for (const route of ROUTES) {
  const [path, method, op] = operation(route);
  paths[path] = { ...(paths[path] ?? {}), [method]: op };
}

export const OPENAPI_SPEC = {
  openapi: "3.1.0",
  info: {
    title: "Receipt Ring API",
    version: "1.0.0",
    description:
      "Every route is served under /api/v1 (and, for this repo's own page, /api). Browsers on this site sign in with a cookie. Other clients -- a mobile app, or a front end on another origin -- send `X-Auth-Mode: token` to /auth/login or /auth/register, keep the returned token, and send it as `Authorization: Bearer <token>`. Browsers on another origin must be listed in the server's CORS_ORIGINS."
  },
  servers: [{ url: "/api/v1" }],
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  tags: ["Platform", "Auth", "Receipts", "People", "Items", "Rent", "Gemini", "Exports", "Bank", "Admin"].map((name) => ({ name })),
  paths,
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
      cookieAuth: { type: "apiKey", in: "cookie", name: "rr_session" }
    },
    schemas: SCHEMAS
  }
};
