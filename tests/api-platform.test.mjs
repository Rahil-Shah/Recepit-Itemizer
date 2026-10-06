import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer } from "./helpers/test-server.mjs";
import { ROUTES, OPENAPI_SPEC } from "../server/openapi.mjs";
import { apiVersionAlias, corsOrigins } from "../server/api-platform.mjs";

const server = await startTestServer();
test.after(() => server.close());

test("every route answers under /api/v1 as well as /api", async () => {
  const user = await server.signUp();
  const plain = await user.get("/api/auth/me");
  const versioned = await user.get("/api/v1/auth/me");
  assert.equal(plain.status, 200);
  assert.deepEqual(versioned.body, plain.body);
  assert.equal((await server.client().get("/api/v1/health")).status, 200);
});

test("the alias leaves other paths alone", () => {
  const alias = apiVersionAlias();
  for (const [input, output] of [
    ["/api/v1", "/api"],
    ["/api/v1?x=1", "/api?x=1"],
    ["/api/v1/receipts", "/api/receipts"],
    ["/api/v10/receipts", "/api/v10/receipts"],
    ["/index.html", "/index.html"]
  ]) {
    const req = { url: input };
    alias(req, {}, () => {});
    assert.equal(req.url, output);
  }
});

test("meta says how to sign in and where the spec is", async () => {
  const meta = await server.client().get("/api/v1/meta");
  assert.equal(meta.status, 200);
  assert.equal(meta.body.apiVersion, 1);
  assert.equal(meta.body.basePath, "/api/v1");
  assert.match(meta.body.auth.bearer, /X-Auth-Mode: token/);
});

test("the OpenAPI document is served and covers every registered route", async () => {
  const response = await server.client().get("/api/v1/openapi.json");
  assert.equal(response.status, 200);
  assert.equal(response.body.openapi, "3.1.0");

  const { createApp } = await import("../server/app.mjs");
  const app = createApp({ prisma: server.prisma });
  const registered = new Set();
  for (const layer of app.router.stack) {
    if (!layer.route) continue;
    for (const method of Object.keys(layer.route.methods)) {
      const path = layer.route.path.replace(/^\/api/, "").replace(/:(\w+)/g, "{$1}");
      registered.add(`${method} ${path}`);
    }
  }
  const documented = new Set(ROUTES.map(([method, path]) => `${method} ${path}`));
  assert.deepEqual([...registered].filter((route) => !documented.has(route)), [], "undocumented routes");
  assert.deepEqual([...documented].filter((route) => !registered.has(route)), [], "documented but missing");
  for (const [method, path] of ROUTES) assert.ok(OPENAPI_SPEC.paths[path][method].responses);
});

test("CORS: an allowed origin gets credentials headers and a preflight answer", async () => {
  const preflight = await fetch(`${server.baseUrl}/api/v1/receipts`, {
    method: "OPTIONS",
    headers: { Origin: "https://ui.example.test", "Access-Control-Request-Method": "POST" }
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "https://ui.example.test");
  assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");
  assert.match(preflight.headers.get("access-control-allow-headers"), /Authorization/);

  const simple = await fetch(`${server.baseUrl}/api/health`, { headers: { Origin: "https://ui.example.test" } });
  assert.equal(simple.headers.get("access-control-allow-origin"), "https://ui.example.test");
  assert.match(simple.headers.get("access-control-expose-headers"), /Content-Disposition/);
});

test("CORS: any other origin gets nothing, and its preflight is refused", async () => {
  const preflight = await fetch(`${server.baseUrl}/api/receipts`, {
    method: "OPTIONS",
    headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" }
  });
  assert.equal(preflight.status, 403);
  assert.equal(preflight.headers.get("access-control-allow-origin"), null);
  const simple = await fetch(`${server.baseUrl}/api/health`, { headers: { Origin: "https://evil.example" } });
  assert.equal(simple.headers.get("access-control-allow-origin"), null);
});

test("corsOrigins keeps only well-formed origins", () => {
  assert.deepEqual(
    [...corsOrigins(" https://a.test/ , http://localhost:5173,ftp://x, not a url, https://b.test/path ")],
    ["https://a.test", "http://localhost:5173"]
  );
  assert.equal(corsOrigins("").size, 0);
  // With nothing passed it reads CORS_ORIGINS.
  assert.ok(corsOrigins().has("https://ui.example.test"));
});

test("token clients: sign in with X-Auth-Mode, then use the bearer token", async () => {
  const signedUp = await server.signUp();
  const mobile = server.client();
  const login = await mobile.post(
    "/api/v1/auth/login",
    { email: signedUp.user.email, password: signedUp.password },
    { headers: { "X-Auth-Mode": "token" } }
  );
  assert.equal(login.status, 200);
  assert.equal(typeof login.body.token, "string");
  assert.ok(Date.parse(login.body.expiresAt) > Date.now());
  // No cookie for a token client.
  assert.equal(mobile.cookie, null);
  assert.equal(login.headers.get("set-cookie"), null);

  const app = server.client({ token: login.body.token });
  const me = await app.get("/api/v1/auth/me");
  assert.equal(me.status, 200);
  assert.equal(me.body.email, signedUp.user.email);

  assert.equal((await app.post("/api/v1/auth/logout")).status, 204);
  assert.equal((await app.get("/api/v1/auth/me")).status, 401);
});

test("register can hand back a token too", async () => {
  const mobile = server.client();
  const response = await mobile.post(
    "/api/v1/auth/register",
    { email: "phone@test.dev", password: "long enough password" },
    { headers: { "X-Auth-Mode": "token" } }
  );
  assert.equal(response.status, 201);
  assert.ok(response.body.token);
  assert.equal((await server.client({ token: response.body.token }).get("/api/receipts")).status, 200);
});

test("a malformed or unknown bearer token is refused", async () => {
  assert.equal((await server.client({ token: "short" }).get("/api/auth/me")).status, 401);
  assert.equal((await server.client({ token: "x".repeat(43) }).get("/api/auth/me")).status, 401);
});
