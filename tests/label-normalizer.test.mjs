import test from "node:test";
import assert from "node:assert/strict";
import { loadReceiptRing, plain } from "./helpers/load-bundle.mjs";

const { ReceiptRing } = loadReceiptRing();

function makeNormalizer() {
  return new ReceiptRing.Services.LabelNormalizerService();
}

test("splits a plain label into lowercased tokens", () => {
  const result = makeNormalizer().normalize("GV SHRD MOZZ");

  assert.deepEqual(plain(result.tokens), ["gv", "shrd", "mozz"]);
  assert.equal(result.key, "gv shrd mozz");
});

test("pulls the size off the end of the label", () => {
  const result = makeNormalizer().normalize("GV SHRD MOZZ 8Z");

  assert.equal(result.size, "8 oz");
  assert.deepEqual(plain(result.tokens), ["gv", "shrd", "mozz"]);
});

test("spells the same size the same way however the receipt wrote it", () => {
  const normalizer = makeNormalizer();

  assert.equal(normalizer.normalize("MOZZ 8Z").size, "8 oz");
  assert.equal(normalizer.normalize("MOZZ 8OZ").size, "8 oz");
  assert.equal(normalizer.normalize("MOZZ 8 oz").size, "8 oz");
  assert.equal(normalizer.normalize("MOZZ8Z").size, "8 oz");
});

test("keeps the pack count when a label carries two sizes", () => {
  const result = makeNormalizer().normalize("COKE 12PK 355ML");

  assert.equal(result.size, "12 pk");
  assert.deepEqual(plain(result.tokens), ["coke"]);
});

test("reads a decimal size without trailing zeros", () => {
  assert.equal(makeNormalizer().normalize("PEPSI 1.50L").size, "1.5 L");
});

test("takes a leading multiplier as a quantity, not as part of the name", () => {
  const result = makeNormalizer().normalize("2X CHKN BRST");

  assert.equal(result.quantity, 2);
  assert.deepEqual(plain(result.tokens), ["chkn", "brst"]);
});

test("collects digit runs as codes rather than as words", () => {
  const result = makeNormalizer().normalize("007874203922 SHRD MOZZ");

  assert.deepEqual(plain(result.codes), ["007874203922"]);
  assert.equal(result.key, "shrd mozz");
});

test("keys two printings of the same item identically", () => {
  const normalizer = makeNormalizer();

  assert.equal(
    normalizer.keyFor("GV SHRD MOZZ 8Z"),
    normalizer.keyFor("  gv, shrd. mozz  8 OZ ")
  );
});

test("does not treat a percentage or a hyphen as a separator", () => {
  const result = makeNormalizer().normalize("2% MLK HALF-N-HALF");

  assert.deepEqual(plain(result.tokens), ["2%", "mlk", "half-n-half"]);
});

test("a bare number is not a size", () => {
  const result = makeNormalizer().normalize("PACK 24");

  assert.equal(result.size, null);
  assert.deepEqual(plain(result.tokens), ["pack", "24"]);
});

test("an empty label normalizes to an empty key without throwing", () => {
  const result = makeNormalizer().normalize("   ***   ");

  assert.equal(result.key, "");
  assert.deepEqual(plain(result.tokens), []);
});
