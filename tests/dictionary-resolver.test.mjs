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

function receiptLine(label, extra = {}) {
  return { id: "l1", label, amount: 1, confidence: 1, ignored: false, ...extra };
}

test("resolves a fully understood label with high confidence", () => {
  const result = makeResolver().resolve(receiptLine("GV SHRD MOZZ 8Z"));

  assert.equal(result.resolvedName, "Great Value Shredded Mozzarella");
  assert.equal(result.source, "dictionary");
  assert.equal(result.confirmed, false);
  assert.ok(result.confidence >= 0.8, `expected a confident answer, got ${result.confidence}`);
});

test("never reaches full confidence, however clean the expansion", () => {
  const result = makeResolver().resolve(receiptLine("GV ORG SHRD MOZZ CHZ"));

  assert.ok(result.confidence <= 0.9, `dictionary answers are capped, got ${result.confidence}`);
});

test("an unknown token drags the confidence down", () => {
  const resolver = makeResolver();

  const clean = resolver.resolve(receiptLine("GV SHRD MOZZ CHZ"));
  const murky = resolver.resolve(receiptLine("GV SHRD MOZZ QQZ"));

  assert.ok(
    murky.confidence < clean.confidence,
    `${murky.confidence} should be below ${clean.confidence}`
  );
});

test("declines a label it recognised nothing in", () => {
  assert.equal(makeResolver().resolve(receiptLine("QQZ XZ9 ZZT")), null);
});

test("declines an empty label", () => {
  assert.equal(makeResolver().resolve(receiptLine("***")), null);
});

test("a lone qualifier is not an identification", () => {
  const result = makeResolver().resolve(receiptLine("ORG"));

  assert.equal(result, null);
});

test("carries the item code onto the identification", () => {
  const result = makeResolver().resolve(receiptLine("GV SHRD MOZZ", { itemCode: "007874203922" }));

  assert.equal(result.itemCode, "007874203922");
});

test("keeps the raw label alongside the expansion", () => {
  const result = makeResolver().resolve(receiptLine("GV SHRD MOZZ 8Z"));

  assert.equal(result.rawLabel, "GV SHRD MOZZ 8Z");
  assert.equal(result.size, "8 oz");
});

test("explains which abbreviations it expanded", () => {
  const result = makeResolver().resolve(receiptLine("SHRD MOZZ"));

  assert.match(result.reasoning, /SHRD/);
  assert.match(result.reasoning, /MOZZ/);
});

test("a label of nothing but modifiers is not an identification", () => {
  const resolver = makeResolver();

  assert.equal(resolver.resolve(receiptLine("ORG")), null);
  assert.equal(resolver.resolve(receiptLine("ORG FRZN")), null);
  assert.equal(resolver.resolve(receiptLine("SHRD LRG")), null);
});

test("a brand with no product is not an identification either", () => {
  assert.equal(makeResolver().resolve(receiptLine("GV ORG")), null);
});

test("a modifier plus a product is an identification", () => {
  const result = makeResolver().resolve(receiptLine("ORG MLK"));

  assert.equal(result.resolvedName, "Organic Milk");
});
