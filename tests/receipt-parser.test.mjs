import test from "node:test";
import assert from "node:assert/strict";
import { loadReceiptRing } from "./helpers/load-bundle.mjs";

function makeParser() {
  const { ReceiptRing } = loadReceiptRing();
  const ruleStorage = new ReceiptRing.Services.CategoryRuleStorageService("test-rules");
  const categorization = new ReceiptRing.Services.CategorizationService(
    ReceiptRing.Config.CATEGORIES,
    ruleStorage
  );
  const idService = new ReceiptRing.Services.IdService();
  return new ReceiptRing.Services.ReceiptParserService(categorization, idService);
}

test("parses labeled amounts into items", () => {
  const parser = makeParser();
  const items = parser.parse("Banana 1.25\nCoffee $3.50");
  assert.equal(items.length, 2);
  assert.equal(items[0].label, "Banana");
  assert.equal(items[0].amount, 1.25);
  assert.equal(items[1].label, "Coffee");
  assert.equal(items[1].amount, 3.5);
});

test("skips totals, tax, and payment lines", () => {
  const parser = makeParser();
  const items = parser.parse("Milk 4.00\nSubtotal 4.00\nTax 0.34\nTotal 4.34\nVISA 4.34");
  assert.equal(items.length, 1);
  assert.equal(items[0].label, "Milk");
});

test("does not truncate long amounts (the $10,999 TV regression)", () => {
  const parser = makeParser();
  const items = parser.parse("Tv 10999.00");
  assert.equal(items.length, 1);
  assert.equal(items[0].amount, 10999);
  assert.equal(items[0].label, "Tv");
});

test("handles thousands separators and negative amounts", () => {
  const parser = makeParser();
  const items = parser.parse("Sofa 1,299.99\nDiscount -5.00");
  assert.equal(items[0].amount, 1299.99);
  assert.equal(items[1].amount, -5);
});

test("drops lines without an amount or with a zero amount", () => {
  const parser = makeParser();
  const items = parser.parse("Store 123 Main St\nFreebie 0.00\nBread 2.50");
  assert.equal(items.length, 1);
  assert.equal(items[0].label, "Bread");
});

test("title-cases labels and strips receipt noise", () => {
  const parser = makeParser();
  const [item] = parser.parse("ORGANIC AVOCADO* 2.50");
  assert.equal(item.label, "Organic Avocado");
});

test("keeps the item code the label used to have stripped out of it", () => {
  const parser = makeParser();
  const items = parser.parse("007874203922 GV SHRD MOZZ 8Z 3.24");

  assert.equal(items.length, 1);
  assert.equal(items[0].itemCode, "007874203922");
  assert.equal(items[0].label, "Gv Shrd Mozz 8z");
});

test("leaves out the item code when the line does not print one", () => {
  const parser = makeParser();
  const items = parser.parse("Banana 1.25");

  assert.equal(items[0].itemCode, undefined);
});

test("takes the longest digit run as the code, not a quantity or weight", () => {
  const parser = makeParser();
  const items = parser.parse("1200 004900000634 CHKN BRST 12.80");

  assert.equal(items[0].itemCode, "004900000634");
});

test("does not mistake the amount for an item code", () => {
  const parser = makeParser();
  const items = parser.parse("Tv 10999.00");

  assert.equal(items[0].itemCode, undefined);
  assert.equal(items[0].amount, 10999);
});

test("still ignores a payment line that carries a long number", () => {
  const parser = makeParser();
  const items = parser.parse("VISA 4111111111111111 43.20");

  assert.equal(items.length, 0);
});

test("attaches a code printed on its own line to the item below it", () => {
  const parser = makeParser();
  const items = parser.parse("007874203922\nGV SHRD MOZZ 8Z 3.24");

  assert.equal(items.length, 1);
  assert.equal(items[0].itemCode, "007874203922");
  assert.equal(items[0].label, "Gv Shrd Mozz 8z");
});

test("an inline code beats one from the line above", () => {
  const parser = makeParser();
  const items = parser.parse("111111\n004900000634 CHKN BRST 12.80");

  assert.equal(items[0].itemCode, "004900000634");
});

test("a standalone code does not leak past a line it cannot describe", () => {
  const parser = makeParser();
  const items = parser.parse("007874203922\nSubtotal 10.00\nBanana 1.25");

  // The code belonged to whatever the Subtotal row displaced, not the banana.
  assert.equal(items.length, 1);
  assert.equal(items[0].label, "Banana");
  assert.equal(items[0].itemCode, undefined);
});

test("a standalone code applies to one item only", () => {
  const parser = makeParser();
  const items = parser.parse("007874203922\nCheese 3.24\nBanana 1.25");

  assert.equal(items[0].itemCode, "007874203922");
  assert.equal(items[1].itemCode, undefined);
});

test("a bare code with no item after it is simply dropped", () => {
  const parser = makeParser();
  const items = parser.parse("Banana 1.25\n007874203922");

  assert.equal(items.length, 1);
  assert.equal(items[0].itemCode, undefined);
});

test("a standalone code line never becomes an item of its own", () => {
  const parser = makeParser();
  const items = parser.parse("007874203922\n004900000634\nCheese 3.24");

  assert.equal(items.length, 1);
  // The nearest code above wins.
  assert.equal(items[0].itemCode, "004900000634");
});
