import test from "node:test";
import assert from "node:assert/strict";
import { buildSpendingCsv, csvCell, spendingExportFileName } from "../server/spending-export.mjs";

test("csvCell quotes, escapes and defuses formulas", () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell("=SUM(A1)"), "'=SUM(A1)");
  assert.equal(csvCell(-12.5), "-12.5");
  assert.equal(csvCell(null), "");
});

test("buildSpendingCsv lists bank rows and unlinked receipts, folding linked ones", () => {
  const csv = buildSpendingCsv({
    transactions: [
      { date: "2026-08-02", description: "Target", amount: 40, category: "Shopping", account: "Checking", isFood: false, linkedReceiptId: "r1" }
    ],
    receipts: [
      { id: "r1", date: "2026-08-02", storeName: "Target", category: "Other", total: 40, hasFood: false },
      { id: "r2", date: "2026-08-05", storeName: "Corner Deli", category: "Dining", total: 9.5, hasFood: true }
    ]
  });
  const lines = csv.replace("﻿", "").trim().split("\r\n");
  assert.equal(lines.length, 3);
  assert.equal(lines[1], "2026-08-05,Receipt,Corner Deli,Dining,,9.50,Yes,");
  assert.equal(lines[2], "2026-08-02,Bank,Target,Shopping,Checking,40.00,No,Yes");
});

test("spendingExportFileName is dated", () => {
  assert.equal(spendingExportFileName(new Date("2026-09-29T12:00:00Z")), "spending-2026-09-29.csv");
});
