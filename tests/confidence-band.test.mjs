import test from "node:test";
import assert from "node:assert/strict";
import { loadReceiptRing } from "./helpers/load-bundle.mjs";

const { ReceiptRing } = loadReceiptRing();
const { confidenceBand } = ReceiptRing.UI;

test("a confident identification needs no comment", () => {
  assert.equal(confidenceBand(1), "sure");
  assert.equal(confidenceBand(0.9), "sure");
  assert.equal(confidenceBand(0.85), "sure");
});

test("a fair identification is worth a glance", () => {
  assert.equal(confidenceBand(0.84), "likely");
  assert.equal(confidenceBand(0.7), "likely");
  assert.equal(confidenceBand(0.6), "likely");
});

test("a weak identification is a prompt to check by hand", () => {
  assert.equal(confidenceBand(0.59), "unsure");
  assert.equal(confidenceBand(0.2), "unsure");
  assert.equal(confidenceBand(0), "unsure");
});

test("a dictionary expansion at its ceiling still reads as sure", () => {
  // The dictionary caps itself at 0.9, which must not land in a band that
  // asks the user to check every expanded line on a grocery receipt.
  assert.equal(confidenceBand(0.9), "sure");
});
