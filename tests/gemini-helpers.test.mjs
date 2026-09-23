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

import { callGemini, isPlausibleGeminiKey } from "../server/gemini.mjs";

// Made-up keys in each format's shape -- not real credentials.
const STANDARD_KEY = "AIzaSy" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r";
const AUTH_KEY = "AQ.Ab8RN6" + "Kx9-_Zq2Wv7Lm4Tp1Yc8Hs5Fd3Gb6Nj0Re9Ua2Ok7Ix4El1Pw";

test("accepts a standard AIza key", () => {
  assert.equal(isPlausibleGeminiKey(STANDARD_KEY), true);
});

test("accepts an AQ. auth key, the only kind AI Studio now issues", () => {
  // The dot after "AQ" is what the old pattern rejected.
  assert.equal(isPlausibleGeminiKey(AUTH_KEY), true);
});

test("rejects values that are not keys", () => {
  assert.equal(isPlausibleGeminiKey(""), false);
  assert.equal(isPlausibleGeminiKey("too-short"), false);
  assert.equal(isPlausibleGeminiKey(`${STANDARD_KEY} extra`), false);
  assert.equal(isPlausibleGeminiKey(`${STANDARD_KEY}\r\nX-Injected: 1`), false);
  assert.equal(isPlausibleGeminiKey(`${STANDARD_KEY}&alt=sse`), false);
  assert.equal(isPlausibleGeminiKey("A".repeat(513)), false);
  assert.equal(isPlausibleGeminiKey(undefined), false);
});

test("callGemini sends the key in the x-goog-api-key header, not the URL", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url, init });
    return new Response("{}", { status: 200 });
  });
  t.mock.method(console, "log", () => {});

  await callGemini({ apiKey: AUTH_KEY, model: "gemini-3.5-flash-lite", parts: [{ text: "hi" }] });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash-lite:generateContent");
  assert.equal(calls[0].init.headers["x-goog-api-key"], AUTH_KEY);
  assert.ok(!String(calls[0].url).includes(AUTH_KEY));
});
