import test from "node:test";
import assert from "node:assert/strict";
import { loadReceiptRing } from "./helpers/load-bundle.mjs";

const { ReceiptRing } = loadReceiptRing();

function makeStore() {
  return new ReceiptRing.Services.ItemAliasStoreService(
    new ReceiptRing.Services.LabelNormalizerService()
  );
}

function line(label, itemCode) {
  return {
    id: "l1",
    label,
    amount: 1,
    confidence: 1,
    ignored: false,
    ...(itemCode ? { itemCode } : {})
  };
}

function identification(overrides = {}) {
  return {
    lineId: "l1",
    rawLabel: "GV SHRD MOZZ 8Z",
    resolvedName: "Great Value Shredded Mozzarella",
    confidence: 1,
    source: "user-confirmed",
    alternatives: [],
    confirmed: true,
    ...overrides
  };
}

test("finds nothing before anything has been remembered", () => {
  assert.equal(makeStore().find(line("GV SHRD MOZZ 8Z"), "Walmart"), null);
});

test("remembers a name and hands it back for the same label", () => {
  const store = makeStore();
  store.remember(identification(), "Walmart");

  const found = store.resolve(line("GV SHRD MOZZ 8Z"), "Walmart");
  assert.equal(found.resolvedName, "Great Value Shredded Mozzarella");
  assert.equal(found.source, "saved-alias");
  assert.equal(found.confidence, 1);
  assert.equal(found.confirmed, true);
});

test("matches the same item printed with different spacing and size notation", () => {
  const store = makeStore();
  store.remember(identification(), "Walmart");

  assert.ok(store.find(line("gv, shrd. mozz 8 OZ"), "Walmart"));
});

test("files under the item code when the receipt printed one", () => {
  const store = makeStore();
  store.remember(identification({ itemCode: "007874203922" }), "Walmart");

  // A different shorthand for the same SKU still resolves.
  const found = store.find(line("SHREDDED MOZZ CHEESE", "7874203922"), "Walmart");
  assert.equal(found.resolvedName, "Great Value Shredded Mozzarella");
});

test("treats a padded and an unpadded code as one entry", () => {
  const store = makeStore();
  store.remember(identification({ itemCode: "0000123456" }), "Walmart");

  assert.ok(store.find(line("WHATEVER", "123456"), "Walmart"));
});

test("prefers the alias learned at this store over one learned elsewhere", () => {
  const store = makeStore();
  store.remember(identification({ resolvedName: "President's Choice Cheese" }), "Loblaws");
  store.remember(identification({ resolvedName: "Personal Computer Cable" }), "");

  const found = store.resolve(line("GV SHRD MOZZ 8Z"), "Loblaws");
  assert.equal(found.resolvedName, "President's Choice Cheese");
});

test("falls back to an alias learned with no store when this store has none", () => {
  const store = makeStore();
  store.remember(identification({ resolvedName: "Generic Cheese" }), "");

  const found = store.resolve(line("GV SHRD MOZZ 8Z"), "Costco");
  assert.equal(found.resolvedName, "Generic Cheese");
});

test("does not let one store's meaning leak into another's", () => {
  const store = makeStore();
  store.remember(identification({ resolvedName: "Loblaws Cheese" }), "Loblaws");

  assert.equal(store.find(line("GV SHRD MOZZ 8Z"), "Costco"), null);
});

test("counts a repeated confirmation of the same name", () => {
  const store = makeStore();
  store.remember(identification(), "Walmart");
  const second = store.remember(identification(), "Walmart");

  assert.equal(second.timesConfirmed, 2);
  assert.match(store.resolve(line("GV SHRD MOZZ 8Z"), "Walmart").reasoning, /2 times/);
});

test("restarts the count when the name is corrected to something else", () => {
  const store = makeStore();
  store.remember(identification(), "Walmart");
  store.remember(identification(), "Walmart");
  const corrected = store.remember(identification({ resolvedName: "Mozzarella Sticks" }), "Walmart");

  assert.equal(corrected.timesConfirmed, 1);
});

test("normalizes the store name so casing and spacing do not split an entry", () => {
  const store = makeStore();
  store.remember(identification(), "  WAL MART ");

  assert.ok(store.find(line("GV SHRD MOZZ 8Z"), "wal mart"));
});

test("forgets an alias on request", () => {
  const store = makeStore();
  const alias = store.remember(identification(), "Walmart");
  store.forget(alias);

  assert.equal(store.find(line("GV SHRD MOZZ 8Z"), "Walmart"), null);
});

test("replaceAll swaps in the aliases it was handed", () => {
  const store = makeStore();
  store.remember(identification(), "Walmart");
  store.replaceAll([
    {
      lookupKey: "gv shrd mozz",
      storeKey: "costco",
      resolvedName: "Kirkland Mozzarella",
      timesConfirmed: 5,
      updatedAt: new Date().toISOString()
    }
  ]);

  assert.equal(store.all().length, 1);
  assert.equal(store.resolve(line("GV SHRD MOZZ 8Z"), "Costco").resolvedName, "Kirkland Mozzarella");
  assert.equal(store.find(line("GV SHRD MOZZ 8Z"), "Walmart"), null);
});

test("a numeric label cannot collide with an item code", () => {
  const store = makeStore();
  store.remember(identification({ rawLabel: "123", itemCode: "1234" }), "Walmart");

  // "1234" as a bare label normalizes to a code token, not to the code key.
  assert.equal(store.find(line("123"), "Walmart"), null);
});
