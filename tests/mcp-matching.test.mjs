// How compare_receipt pairs items read off a photo with the saved lines
// (matchItems in server/mcp-tools.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { matchItems, labelSimilarity } from "../server/mcp-tools.mjs";

const line = (id, label, amount, extra = {}) => ({ id, label, amount, name: null, itemCode: null, sortOrder: Number(id.slice(1)), ...extra });
const pairsOf = (result) => result.pairs.map((pair) => [pair.itemIndex, pair.line.id, pair.how]);

test("an item code beats a label, and leading zeros do not matter", () => {
  const saved = [line("l0", "MILK", 3, { itemCode: "000123" }), line("l1", "WHOLE MILK", 3.5)];
  const result = matchItems(saved, [{ label: "WHOLE MILK", amount: 3.29, itemCode: "123" }]);
  assert.deepEqual(pairsOf(result), [[0, "l0", "item_code"]]);
  assert.deepEqual(result.unmatchedLines.map((entry) => entry.id), ["l1"]);
});

test("labels match ignoring case and punctuation, or by the identified name", () => {
  const saved = [line("l0", "GV SHRD MOZZ", 4, { name: "Shredded Mozzarella" }), line("l1", "Org. Bananas", 3)];
  const result = matchItems(saved, [
    { label: "shredded mozzarella", amount: 4 },
    { label: "ORG BANANAS", amount: 2.5 }
  ]);
  assert.deepEqual(pairsOf(result), [[0, "l0", "label"], [1, "l1", "label"]]);
});

test("repeated items pair off by price first, then from the top", () => {
  const saved = [line("l0", "BREAD", 3), line("l1", "BREAD", 2), line("l2", "BREAD", 2)];
  const result = matchItems(saved, [
    { label: "BREAD", amount: 2 },
    { label: "BREAD", amount: 2.5 },
    { label: "BREAD", amount: 3 }
  ]);
  assert.deepEqual(pairsOf(result), [[0, "l1", "label"], [1, "l2", "label"], [2, "l0", "label"]]);
});

test("a similar label matches, a weakly similar one only at the same price, and the rest are left over", () => {
  const saved = [line("l0", "DISH SOAP", 6), line("l1", "PAPER", 1.99), line("l2", "BATTERIES AA", 9)];
  const result = matchItems(saved, [
    { label: "DISH SOAP LG", amount: 5.49 },
    { label: "PAPER TOWEL 6PK", amount: 1.99 },
    { label: "CANDY", amount: 9 }
  ]);
  assert.deepEqual(pairsOf(result), [[0, "l0", "similar_label"], [1, "l1", "similar_label"]]);
  assert.deepEqual(result.unmatchedItems, [2]);
  assert.deepEqual(result.unmatchedLines.map((entry) => entry.id), ["l2"]);
});

test("every line and every item is used at most once", () => {
  const saved = [line("l0", "APPLE", 1)];
  const result = matchItems(saved, [
    { label: "APPLE", amount: 1 },
    { label: "APPLE", amount: 1 },
    { label: "APPLES", amount: 1 }
  ]);
  assert.equal(result.pairs.length, 1);
  assert.deepEqual(result.unmatchedItems, [1, 2]);
});

test("discount lines (negative amounts) match like any other", () => {
  const saved = [line("l0", "COUPON MILK", -0.5)];
  const result = matchItems(saved, [{ label: "COUPON MILK", amount: -0.75 }]);
  assert.deepEqual(pairsOf(result), [[0, "l0", "label"]]);
});

test("labelSimilarity is 1 for the same words and 0 for nothing in common", () => {
  assert.equal(labelSimilarity("Dish-Soap", "DISH SOAP"), 1);
  assert.equal(labelSimilarity("", "x"), 0);
  assert.equal(labelSimilarity("ABC", "XYZ"), 0);
  assert.ok(labelSimilarity("DISH SOAP LG", "DISH SOAP") > 0.8);
  assert.equal(labelSimilarity("A", "B"), 0);
});
