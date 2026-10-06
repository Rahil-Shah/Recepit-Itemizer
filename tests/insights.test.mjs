import test from "node:test";
import assert from "node:assert/strict";
import { loadReceiptRing, plain } from "./helpers/load-bundle.mjs";

const { ReceiptRing } = loadReceiptRing();
const { InsightsService, SpendingAggregatorService } = ReceiptRing.Services;

function service() {
  return new InsightsService(new SpendingAggregatorService(ReceiptRing.Config.CATEGORIES));
}

const receipt = (id, store, total, createdAt, extra = {}) => ({
  id, storeName: store, category: "Groceries", total, createdAt, hasImage: false, people: [], lines: [], ...extra
});

test("history overview totals, this month, and ranks stores case-insensitively", () => {
  const receipts = [
    receipt("a", "Costco", 100, "2026-10-02"),
    receipt("b", "costco", 50, "2026-09-02", { hasImage: true }),
    receipt("c", "Target", 30, "2026-10-03", { budgetCategory: "Shopping" })
  ];
  const overview = service().historyOverview(receipts, new Date(2026, 9, 15));

  assert.equal(overview.receiptCount, 3);
  assert.equal(overview.totalSpent, 180);
  assert.equal(overview.averageReceipt, 60);
  assert.equal(overview.thisMonthSpent, 130);
  assert.equal(overview.thisMonthCount, 2);
  assert.equal(overview.withPhotos, 1);
  assert.deepEqual(plain(overview.topStores[0]), { name: "Costco", amount: 150, count: 2 });
  assert.deepEqual(plain(overview.categories.map((c) => c.name)), ["Groceries", "Shopping"]);
});

test("month glance compares with the month before and averages over days so far", () => {
  const aggregator = new SpendingAggregatorService(ReceiptRing.Config.CATEGORIES);
  const receipts = [receipt("a", "Costco", 100, "2026-10-02"), receipt("b", "Costco", 50, "2026-09-10")];
  const transactions = [{ id: "t", date: "2026-10-04", amount: -20, description: "Uber", category: "travel", linkedReceiptId: null }];
  const spend = aggregator.aggregate(receipts, transactions);

  const glance = service().monthGlance("2026-10", spend, receipts, transactions, new Date(2026, 9, 10));

  assert.equal(glance.total, 120);
  assert.equal(glance.previousTotal, 50);
  assert.equal(glance.changeRatio, 1.4);
  assert.equal(glance.dailyAverage, 12);
  assert.equal(glance.receiptCount, 1);
  assert.equal(glance.transactionCount, 1);
  assert.equal(glance.largestPurchase.name, "Costco");
  assert.equal(glance.biggestCategory.name, "Groceries");
});
