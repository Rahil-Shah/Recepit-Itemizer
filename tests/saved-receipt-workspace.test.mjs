import test from "node:test";
import assert from "node:assert/strict";
import { loadReceiptRing, plain } from "./helpers/load-bundle.mjs";

const { ReceiptRing } = loadReceiptRing();

const mozzarella = {
  id: "l1",
  label: "GV SHRD MOZZ 8Z",
  amount: 3.24,
  ignored: false,
  isFood: true,
  itemCode: "007874203922",
  identification: {
    resolvedName: "Shredded Mozzarella",
    brand: "Great Value",
    size: "8 oz",
    confidence: 1,
    source: "user-confirmed",
    reasoning: null,
    alternatives: [],
    confirmed: true
  },
  assignments: [
    { personId: "p-me", personName: "Alex", mode: "percentage", value: 60 },
    { personId: "p-sam", personName: "Sam", mode: "percentage", value: 40 }
  ]
};

const towels = {
  id: "l2",
  label: "PAPER TOWELS",
  amount: 9.26,
  ignored: true,
  isFood: false,
  itemCode: null,
  identification: null,
  assignments: []
};

function savedReceipt(overrides = {}) {
  return {
    id: "r1",
    storeName: "Walmart",
    category: "Groceries",
    subtotal: 12.5,
    tax: 1.1,
    total: 13.6,
    createdAt: "2026-09-03T18:00:00.000Z",
    hasImage: false,
    linkedTransaction: null,
    people: [
      { id: "p-me", name: "Alex", isSelf: true },
      { id: "p-sam", name: "Sam", isSelf: false }
    ],
    lines: [mozzarella, towels],
    ...overrides
  };
}

// Hands out ids in order, so an assignment's id can be asserted exactly.
function open(receipt) {
  let next = 0;
  return ReceiptRing.Services.workspaceFromSavedReceipt(receipt, () => `a${++next}`);
}

test("the store, category and tax come back as they were saved", () => {
  const workspace = open(savedReceipt());

  assert.equal(workspace.storeName, "Walmart");
  assert.equal(workspace.category, "Groceries");
  assert.equal(workspace.tax, 1.1);
});

test("a receipt saved with no store name or tax opens blank rather than null", () => {
  const workspace = open(savedReceipt({ storeName: null, tax: null }));

  assert.equal(workspace.storeName, "");
  assert.equal(workspace.tax, 0);
});

test("lines keep their saved ids, flags and item codes", () => {
  const workspace = open(savedReceipt());

  assert.deepEqual(plain(workspace.lines), [
    {
      id: "l1",
      label: "GV SHRD MOZZ 8Z",
      amount: 3.24,
      itemCode: "007874203922",
      confidence: 100,
      ignored: false,
      isFood: true
    },
    { id: "l2", label: "PAPER TOWELS", amount: 9.26, confidence: 100, ignored: true, isFood: false }
  ]);
});

test("each share comes back on the line it was made on, with its mode and value", () => {
  const workspace = open(savedReceipt());

  assert.deepEqual(plain(workspace.assignments), [
    { id: "a1", lineId: "l1", personId: "p-me", mode: "percentage", value: 60 },
    { id: "a2", lineId: "l1", personId: "p-sam", mode: "percentage", value: 40 }
  ]);
});

test("a line split by percentage reopens in percentage mode, and an unsplit line has no mode", () => {
  const workspace = open(savedReceipt());

  assert.deepEqual(plain(Array.from(workspace.lineModes)), [["l1", "percentage"]]);
});

test("a share with a mode the workspace doesn't know falls back to an even split", () => {
  const line = {
    ...mozzarella,
    assignments: [{ personId: "p-me", personName: "Alex", mode: "thirds", value: 0 }]
  };
  const workspace = open(savedReceipt({ lines: [line] }));

  assert.equal(workspace.assignments[0].mode, "equal");
  assert.equal(workspace.lineModes.get("l1"), "equal");
});

test("a share with no person is dropped rather than saved back to nobody", () => {
  const line = {
    ...mozzarella,
    assignments: [
      { personId: "", personName: "", mode: "equal", value: 0 },
      { personId: "p-sam", personName: "Sam", mode: "equal", value: 0 }
    ]
  };
  const workspace = open(savedReceipt({ lines: [line] }));

  assert.deepEqual(plain(workspace.assignments.map((assignment) => assignment.personId)), ["p-sam"]);
});

test("identifications come back in the shape the workspace renders", () => {
  const workspace = open(savedReceipt());

  assert.deepEqual(plain(workspace.identifications.get("l1")), {
    lineId: "l1",
    rawLabel: "GV SHRD MOZZ 8Z",
    itemCode: "007874203922",
    resolvedName: "Shredded Mozzarella",
    brand: "Great Value",
    size: "8 oz",
    confidence: 1,
    source: "user-confirmed",
    alternatives: [],
    confirmed: true
  });
  assert.equal(workspace.identifications.has("l2"), false);
});

test("people keep whether they are the account owner", () => {
  const workspace = open(savedReceipt());

  assert.deepEqual(plain(workspace.people), [
    { id: "p-me", name: "Alex", isSelf: true },
    { id: "p-sam", name: "Sam", isSelf: false }
  ]);
});
