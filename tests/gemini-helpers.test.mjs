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

import { GOOGLE_SEARCH_TOOL, parseJsonFromReply } from "../server/gemini.mjs";

test("the search tool is the shape the REST API documents", () => {
  // `google_search`, not `googleSearch` or the older
  // `google_search_retrieval`, and it only works on v1beta.
  assert.deepEqual(GOOGLE_SEARCH_TOOL, [{ google_search: {} }]);
});

test("extractResponseText joins every text part of a grounded reply", () => {
  const body = JSON.stringify({
    candidates: [
      { content: { parts: [{ text: '{"items":' }, { text: "[]}" }] } }
    ]
  });

  assert.equal(extractResponseText(body), '{"items":[]}');
});

test("extractResponseText skips parts that carry no text", () => {
  const body = JSON.stringify({
    candidates: [
      { content: { parts: [{ functionCall: { name: "search" } }, { text: '{"items":[]}' }] } }
    ]
  });

  assert.equal(extractResponseText(body), '{"items":[]}');
});

test("parses a clean JSON reply", () => {
  assert.deepEqual(parseJsonFromReply('{"items":[]}'), { items: [] });
});

test("digs the object out of a grounded reply that starts with prose", () => {
  const reply = 'I searched for the SKU and found it.\n\n{"items":[{"id":"l1"}]}';

  assert.deepEqual(parseJsonFromReply(reply), { items: [{ id: "l1" }] });
});

test("digs the object out of a reply with trailing citations", () => {
  const reply = '{"items":[]}\n\nSources: example.com';

  assert.deepEqual(parseJsonFromReply(reply), { items: [] });
});

test("throws when there is no object to find", () => {
  assert.throws(() => parseJsonFromReply("I could not identify anything."), /No JSON object/);
});
