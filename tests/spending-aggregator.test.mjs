import test from "node:test";
import assert from "node:assert/strict";
import { loadReceiptRing, plain } from "./helpers/load-bundle.mjs";

const { ReceiptRing } = loadReceiptRing();

function makeAggregator() {
  return new ReceiptRing.Services.SpendingAggregatorService(ReceiptRing.Config.CATEGORIES);
}

test("monthKey slices plain calendar dates without timezone shifts", () => {
  const aggregator = makeAggregator();
  assert.equal(aggregator.monthKey("2026-08-01"), "2026-08");
  assert.equal(aggregator.monthKey("2026-08"), "2026-08");
  assert.equal(aggregator.monthKey("2026-12-31"), "2026-12");
});

test("monthKey reads full timestamps in local time", () => {
  const aggregator = makeAggregator();
  const local = new Date(2026, 7, 15, 12, 0, 0);
  assert.equal(aggregator.monthKey(local.toISOString()), "2026-08");
});

test("monthKey returns null for garbage", () => {
  const aggregator = makeAggregator();
  assert.equal(aggregator.monthKey("not a date"), null);
});

test("aggregate buckets receipts and bank outflows by month", () => {
  const aggregator = makeAggregator();
  const receipts = [
    { createdAt: "2026-08-05", category: "Groceries", total: 40 },
    { createdAt: "2026-08-20", category: "Groceries", total: 10 },
    { createdAt: "2026-07-11", category: "Dining", total: 25 }
  ];
  const transactions = [
    // Outflows are negative; only spending counts.
    { date: "2026-08-02", category: "restaurants", amount: -30 },
    { date: "2026-08-03", category: "restaurants", amount: 99 }
  ];

  const result = aggregator.aggregate(receipts, transactions);

  assert.equal(result.length, 2);
  // Newest month first.
  assert.equal(result[0].month, "2026-08");
  assert.equal(result[1].month, "2026-07");

  const august = result[0];
  assert.equal(august.total, 80);
  const groceries = august.categories.find((c) => c.category === "Groceries");
  const dining = august.categories.find((c) => c.category === "Dining");
  assert.equal(groceries.amount, 50);
  // "restaurants" aliases onto the Dining bucket, inflow (+99) ignored.
  assert.equal(dining.amount, 30);
});

test("aggregate skips zero and negative receipt totals", () => {
  const aggregator = makeAggregator();
  const result = aggregator.aggregate(
    [
      { createdAt: "2026-08-05", category: "Other", total: 0 },
      { createdAt: "2026-08-05", category: "Other", total: null }
    ],
    []
  );
  assert.equal(result.length, 0);
});

test("aggregate sorts categories within a month by amount, descending", () => {
  const aggregator = makeAggregator();
  const [august] = aggregator.aggregate(
    [
      { createdAt: "2026-08-01", category: "Dining", total: 5 },
      { createdAt: "2026-08-02", category: "Groceries", total: 50 }
    ],
    []
  );
  assert.deepEqual(
    plain(august.categories.map((c) => c.category)),
    ["Groceries", "Dining"]
  );
});

test("a receipt attached to a transaction is not counted twice", () => {
  // Regression: attaching a receipt photo to a $40 dinner made the ring read
  // $80, because the receipt and the transaction it documents were both added
  // as spending. The transaction is the one that counts.
  const aggregator = makeAggregator();
  const receipts = [{ id: "rec_1", createdAt: "2026-08-05", category: "Dining", total: 40 }];
  const transactions = [
    { date: "2026-08-05", category: "restaurants", amount: -40, linkedReceiptId: "rec_1" }
  ];

  const [august] = aggregator.aggregate(receipts, transactions);

  assert.equal(august.total, 40);
  assert.equal(august.categories.length, 1);
  assert.equal(august.categories[0].category, "Dining");
});

test("an unattached receipt still counts alongside bank spending", () => {
  const aggregator = makeAggregator();
  const receipts = [{ id: "rec_1", createdAt: "2026-08-05", category: "Dining", total: 40 }];
  const transactions = [
    { date: "2026-08-06", category: "groceries", amount: -25, linkedReceiptId: null }
  ];

  const [august] = aggregator.aggregate(receipts, transactions);
  assert.equal(august.total, 65);
});

test("only the attached receipt is skipped, not every receipt", () => {
  const aggregator = makeAggregator();
  const receipts = [
    { id: "rec_1", createdAt: "2026-08-05", category: "Dining", total: 40 },
    { id: "rec_2", createdAt: "2026-08-07", category: "Dining", total: 15 }
  ];
  const transactions = [
    { date: "2026-08-05", category: "restaurants", amount: -40, linkedReceiptId: "rec_1" }
  ];

  const [august] = aggregator.aggregate(receipts, transactions);
  assert.equal(august.total, 55);
});

test("a budget category from the Gemini pass wins, used exactly as given", () => {
  const aggregator = new ReceiptRing.Services.SpendingAggregatorService(ReceiptRing.Config.CATEGORIES);
  const receipts = [
    { id: "r1", category: "Groceries", budgetCategory: "Shopping", total: 30, createdAt: "2026-03-10", people: [], lines: [] }
  ];
  const transactions = [
    { id: "t1", date: "2026-03-11", amount: -20, category: "TRAVEL", budgetCategory: "Travel", linkedReceiptId: null },
    { id: "t2", date: "2026-03-12", amount: -5, category: "travel", budgetCategory: null, linkedReceiptId: null }
  ];

  const [march] = aggregator.aggregate(receipts, transactions);
  const byName = Object.fromEntries(march.categories.map((c) => [c.category, c.amount]));

  assert.equal(byName.Shopping, 30);
  // Not folded into Transport the way the bank's own "travel" still is.
  assert.equal(byName.Travel, 20);
  assert.equal(byName.Transport, 5);
});

test("idsForMonth lists the month's receipts and spending, minus attached receipts", () => {
  const aggregator = new ReceiptRing.Services.SpendingAggregatorService(ReceiptRing.Config.CATEGORIES);
  const receipts = [
    { id: "r1", createdAt: "2026-03-10", category: "Other", total: 1, people: [], lines: [] },
    { id: "r2", createdAt: "2026-03-11", category: "Other", total: 1, people: [], lines: [] },
    { id: "r3", createdAt: "2026-04-01", category: "Other", total: 1, people: [], lines: [] }
  ];
  const transactions = [
    { id: "t1", date: "2026-03-05", amount: -9, linkedReceiptId: "r2" },
    { id: "t2", date: "2026-03-06", amount: 40, linkedReceiptId: null }
  ];

  const ids = aggregator.idsForMonth("2026-03", receipts, transactions);

  assert.deepEqual(Array.from(ids.receiptIds), ["r1"]);
  assert.deepEqual(Array.from(ids.transactionIds), ["t1"]);
});
