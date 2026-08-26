import test from "node:test";
import assert from "node:assert/strict";
import { identificationFields, normalizeStoredItemCode } from "../server/identification.mjs";

test("keeps a well-formed item code", () => {
  assert.equal(normalizeStoredItemCode("007874203922"), "007874203922");
  assert.equal(normalizeStoredItemCode("  12345  "), "12345");
});

test("drops anything that is not an item code", () => {
  assert.equal(normalizeStoredItemCode(""), null);
  assert.equal(normalizeStoredItemCode("ABC123"), null);
  assert.equal(normalizeStoredItemCode("1".repeat(21)), null);
  assert.equal(normalizeStoredItemCode(null), null);
  assert.equal(normalizeStoredItemCode({ toString: () => "123" }), null);
});

test("turns an identification into the columns to write", () => {
  const fields = identificationFields({
    resolvedName: "Great Value Shredded Mozzarella",
    brand: "Great Value",
    size: "8 oz",
    confidence: 0.86,
    source: "ai",
    reasoning: "SHRD MOZZ decodes to shredded mozzarella.",
    alternatives: [{ name: "Sliced Mozzarella", confidence: 0.2 }],
    confirmed: false
  });

  assert.equal(fields.resolvedName, "Great Value Shredded Mozzarella");
  assert.equal(fields.resolvedBrand, "Great Value");
  assert.equal(fields.resolvedSize, "8 oz");
  assert.equal(fields.resolvedConfidence, 0.86);
  assert.equal(fields.resolvedSource, "ai");
  assert.deepEqual(fields.resolvedAlternatives, [{ name: "Sliced Mozzarella", confidence: 0.2 }]);
  assert.ok(fields.resolvedAt instanceof Date);
});

test("writes nothing when there is no identification to write", () => {
  assert.deepEqual(identificationFields(null), {});
  assert.deepEqual(identificationFields(undefined), {});
  assert.deepEqual(identificationFields("a string"), {});
  assert.deepEqual(identificationFields({ resolvedName: "   " }), {});
});

test("rejects a source the UI could not render", () => {
  const fields = identificationFields({
    resolvedName: "Cheese",
    confidence: 0.9,
    source: "somewhere-else"
  });

  assert.equal(fields.resolvedSource, "unresolved");
});

test("clamps a confidence outside the range", () => {
  assert.equal(identificationFields({ resolvedName: "A", confidence: 5 }).resolvedConfidence, 1);
  assert.equal(identificationFields({ resolvedName: "A", confidence: -1 }).resolvedConfidence, 0);
  assert.equal(identificationFields({ resolvedName: "A", confidence: "yes" }).resolvedConfidence, 0);
});

test("rebuilds alternatives rather than storing whatever JSON arrived", () => {
  const fields = identificationFields({
    resolvedName: "Cheese",
    confidence: 0.5,
    source: "ai",
    alternatives: [
      { name: "Brie", confidence: 0.3, injected: "should not survive" },
      { name: "   ", confidence: 0.2 },
      "not an object"
    ]
  });

  assert.deepEqual(fields.resolvedAlternatives, [{ name: "Brie", confidence: 0.3 }]);
});

test("caps how many alternatives are stored", () => {
  const alternatives = Array.from({ length: 20 }, (_, index) => ({
    name: `Option ${index}`,
    confidence: 0.1
  }));
  const fields = identificationFields({ resolvedName: "A", confidence: 0.5, alternatives });

  assert.equal(fields.resolvedAlternatives.length, 5);
});

test("collapses whitespace and truncates overlong text", () => {
  const fields = identificationFields({
    resolvedName: `Shredded\n\n  Mozzarella${"x".repeat(500)}`,
    reasoning: "y".repeat(500),
    confidence: 0.5
  });

  assert.equal(fields.resolvedName.length, 200);
  assert.match(fields.resolvedName, /^Shredded Mozzarella/);
  assert.equal(fields.resolvedReasoning.length, 240);
});

test("survives alternatives that are not an array", () => {
  const fields = identificationFields({ resolvedName: "A", confidence: 0.5, alternatives: "nope" });

  assert.deepEqual(fields.resolvedAlternatives, []);
});
