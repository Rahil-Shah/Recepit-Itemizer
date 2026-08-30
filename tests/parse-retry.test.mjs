import test from "node:test";
import assert from "node:assert/strict";
import { loadReceiptRing } from "./helpers/load-bundle.mjs";

const { ReceiptRing } = loadReceiptRing();
const { isRetryableParseFailure, ReceiptParseError } = ReceiptRing.Services;

test("a request that never reached the server is retryable", () => {
  // Offline, DNS, connection dropped mid-flight.
  assert.equal(isRetryableParseFailure(0), true);
});

test("upstream failures are retryable", () => {
  assert.equal(isRetryableParseFailure(502), true, "upstream failed");
  assert.equal(isRetryableParseFailure(504), true, "upstream took too long");
  assert.equal(isRetryableParseFailure(408), true, "request timed out");
  assert.equal(isRetryableParseFailure(429), true, "rate limited");
});

test("a rejected request is not retryable", () => {
  assert.equal(isRetryableParseFailure(400), false, "unsupported image type");
  assert.equal(isRetryableParseFailure(413), false, "image too large");
});

test("an unauthenticated request is not retryable", () => {
  assert.equal(isRetryableParseFailure(401), false);
  assert.equal(isRetryableParseFailure(403), false);
});

test("503 from our own server means no key, which retrying cannot fix", () => {
  // Gemini's busy-503 is remapped to 502 by the proxy, so a 503 arriving at
  // the browser is the server's own "No Gemini key is configured".
  assert.equal(isRetryableParseFailure(503), false);
});

test("a success status is never a retry candidate", () => {
  assert.equal(isRetryableParseFailure(200), false);
});

test("ReceiptParseError carries the status alongside the message", () => {
  const error = new ReceiptParseError("Gemini is busy.", 502);

  assert.equal(error.status, 502);
  assert.equal(error.message, "Gemini is busy.");
  assert.equal(error.name, "ReceiptParseError");

  // `instanceof Error` cannot be used here: the bundle runs in its own vm
  // realm with its own Error constructor, so the check fails on a class that
  // extends Error perfectly well. Walk the chain instead.
  const chain = [];
  for (let proto = Object.getPrototypeOf(error); proto; proto = Object.getPrototypeOf(proto)) {
    chain.push(proto.constructor?.name);
  }
  assert.deepEqual(chain, ["ReceiptParseError", "Error", "Object"]);
  assert.equal(typeof error.stack, "string");
});

const { retryBackoffMs, MAX_PARSE_RETRIES } = ReceiptRing.Services;

test("the wait doubles with each attempt", () => {
  assert.equal(retryBackoffMs(1), 2000);
  assert.equal(retryBackoffMs(2), 4000);
  assert.equal(retryBackoffMs(3), 8000);
  assert.equal(retryBackoffMs(4), 16000);
});

test("the wait is capped so the button never goes dead for minutes", () => {
  assert.equal(retryBackoffMs(5), 30000);
  assert.equal(retryBackoffMs(50), 30000);
});

test("the first attempt is never punished for a zero or negative count", () => {
  assert.equal(retryBackoffMs(0), 2000);
  assert.equal(retryBackoffMs(-3), 2000);
});

test("retries stop well inside the server's own ceiling", () => {
  // The server allows 30 parses per 15 minutes. Even the worst case here --
  // a first attempt plus every retry -- stays far below that, so a stuck
  // client cannot spend a user's whole allowance on one receipt.
  assert.ok(MAX_PARSE_RETRIES + 1 < 30);
});

test("the whole retry run takes under a minute of waiting", () => {
  let total = 0;
  for (let attempt = 1; attempt <= MAX_PARSE_RETRIES; attempt += 1) {
    total += retryBackoffMs(attempt);
  }

  // Long enough to outlast a Gemini blip, short enough that someone watching
  // it does not conclude the app has hung.
  assert.ok(total <= 60000, `expected under a minute of backoff, got ${total}ms`);
});
