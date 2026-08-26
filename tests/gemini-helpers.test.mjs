import test from "node:test";
import assert from "node:assert/strict";
import { describeUpstreamError, extractResponseText } from "../server/gemini.mjs";

test("extractResponseText pulls the model's text out of a response body", () => {
  const body = JSON.stringify({
    candidates: [{ content: { parts: [{ text: '{"items":[]}' }] } }]
  });

  assert.equal(extractResponseText(body), '{"items":[]}');
});

test("extractResponseText strips a json fence the model added anyway", () => {
  const body = JSON.stringify({
    candidates: [{ content: { parts: [{ text: '```json\n{"items":[]}\n```' }] } }]
  });

  assert.equal(extractResponseText(body), '{"items":[]}');
});

test("extractResponseText throws when the response carries no text", () => {
  assert.throws(() => extractResponseText(JSON.stringify({ candidates: [] })), /No response text/);
});

test("describeUpstreamError reads Google's JSON error message", () => {
  const described = describeUpstreamError({
    status: 429,
    text: JSON.stringify({ error: { message: "Quota exceeded for this project." } })
  });

  assert.equal(described, "429 - Quota exceeded for this project.");
});

test("describeUpstreamError falls back to the status when the body is not JSON", () => {
  assert.equal(describeUpstreamError({ status: 502, text: "<html>bad gateway</html>" }), "status 502");
});

test("describeUpstreamError truncates a very long upstream message", () => {
  const described = describeUpstreamError({
    status: 400,
    text: JSON.stringify({ error: { message: "x".repeat(500) } })
  });

  assert.ok(described.length < 130, `expected a short message, got ${described.length} chars`);
});
