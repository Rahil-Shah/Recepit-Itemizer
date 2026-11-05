import test from "node:test";
import assert from "node:assert/strict";
import { configuredOrigin, publicOrigin, mcpUrl } from "../server/public-url.mjs";
import { isAllowedRedirectUri } from "../server/oauth.mjs";

test("PUBLIC_URL wins, reduced to its origin; junk is ignored", () => {
  assert.equal(configuredOrigin("https://receipts.example.com/app/"), "https://receipts.example.com");
  assert.equal(configuredOrigin("ftp://example.com"), null);
  assert.equal(configuredOrigin("not a url"), null);
  assert.equal(configuredOrigin(""), null);
  process.env.PUBLIC_URL = "https://receipts.example.com";
  try {
    assert.equal(publicOrigin({ protocol: "http", host: "elsewhere.test" }), "https://receipts.example.com");
  } finally {
    delete process.env.PUBLIC_URL;
  }
});

test("without PUBLIC_URL the request's protocol and host are used, and a strange host is not echoed", () => {
  assert.equal(publicOrigin({ protocol: "https", host: "app.example.com" }), "https://app.example.com");
  assert.equal(publicOrigin({ protocol: "http", host: "127.0.0.1:4173" }), "http://127.0.0.1:4173");
  assert.equal(publicOrigin({ protocol: "http", host: "[::1]:4173" }), "http://[::1]:4173");
  assert.equal(publicOrigin({ protocol: "gopher", host: "a.test" }), "http://a.test");
  assert.equal(publicOrigin({ protocol: "https", host: 'evil.test"><script>' }), "https://localhost");
  assert.equal(publicOrigin({ protocol: "https", host: "a.test/path" }), "https://localhost");
  assert.equal(publicOrigin({ protocol: "https", headers: { host: "b.test" } }), "https://b.test");
  assert.equal(mcpUrl({ protocol: "https", host: "app.example.com" }), "https://app.example.com/api/mcp");
});

test("redirect URIs: https anywhere, http only on loopback", () => {
  assert.ok(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback"));
  assert.ok(isAllowedRedirectUri("http://localhost:3000/callback"));
  assert.ok(isAllowedRedirectUri("http://127.0.0.1/callback"));
  assert.ok(isAllowedRedirectUri("http://[::1]:8080/cb"));
  assert.ok(!isAllowedRedirectUri("http://localhost.evil.test/cb"));
  assert.ok(!isAllowedRedirectUri("http://example.com/cb"));
  assert.ok(!isAllowedRedirectUri("data:text/html,hi"));
  assert.ok(!isAllowedRedirectUri(42));
  assert.ok(!isAllowedRedirectUri("https://a.test/#x"));
});
