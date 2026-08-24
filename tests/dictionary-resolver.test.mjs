import test from "node:test";
import assert from "node:assert/strict";
import { loadReceiptRing, plain } from "./helpers/load-bundle.mjs";

const { ReceiptRing } = loadReceiptRing();

function makeResolver() {
  return new ReceiptRing.Services.DictionaryResolverService(
    new ReceiptRing.Services.LabelNormalizerService()
  );
}

test("expands shorthand into a readable product name", () => {
  const result = makeResolver().expand("GV SHRD MOZZ 8Z");

  assert.equal(result.name, "Great Value Shredded Mozzarella");
  assert.equal(result.brand, "Great Value");
  assert.equal(result.size, "8 oz");
});

test("puts the brand at the front rather than where it was printed", () => {
  const result = makeResolver().expand("GV ORG CHKN BRST");

  assert.equal(result.name, "Great Value Organic Chicken Breast");
});

test("only reads a brand prefix at the start of the label", () => {
  const result = makeResolver().expand("SHRD PC CHZ");

  assert.equal(result.brand, null);
  assert.ok(result.name.includes("Pc"), `expected the token kept as a word, got ${result.name}`);
});

test("reports the tokens it could not account for", () => {
  const result = makeResolver().expand("SHRD QQZ MOZZ");

  assert.deepEqual(plain(result.unknownTokens), ["qqz"]);
});

test("a label of ordinary words needs no expansion and has no unknowns", () => {
  const result = makeResolver().expand("Organic Whole Milk");

  assert.deepEqual(plain(result.unknownTokens), []);
  assert.deepEqual(plain(result.expandedTokens), []);
  assert.equal(result.name, "Organic Whole Milk");
});

test("matches abbreviations whole, never as substrings", () => {
  const result = makeResolver().expand("BORG");

  assert.equal(result.name, "Borg");
  assert.deepEqual(plain(result.expandedTokens), []);
});

test("keeps a token it does not know in the name rather than dropping it", () => {
  const result = makeResolver().expand("MLK XZ9");

  assert.ok(result.name.includes("Milk"));
  assert.ok(result.name.includes("Xz9"), `expected Xz9 kept, got ${result.name}`);
});

test("an empty label expands to an empty name without throwing", () => {
  const result = makeResolver().expand("****");

  assert.equal(result.name, "");
  assert.equal(result.brand, null);
});
