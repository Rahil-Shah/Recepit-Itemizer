// The whole-spending CSV for admin accounts: every bank transaction plus every
// saved receipt that is not already one of those transactions, so nothing is
// counted twice. Unlike the education export it is not limited to food and
// rent. Pure functions only (no Prisma, no Express) so it can be unit tested.

export const SPENDING_EXPORT_RATE_LIMIT = Object.freeze({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many exports in a row. Give it a few minutes and try again."
});

export const SPENDING_CSV_HEADER = Object.freeze([
  "Date",
  "Source",
  "Description",
  "Category",
  "Account",
  "Amount",
  "Food",
  "Linked receipt"
]);

// A cell a spreadsheet would run as a formula if it started with one of these.
const FORMULA_START = /^[=+@\t\r]/;

/** One CSV field, quoted when it needs to be, and defused against formula injection. */
export function csvCell(value) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Descriptions come from banks and OCR, not from the user. A leading "-" is
  // left alone only for real numbers, which are passed as numbers.
  if (typeof value === "string" && (FORMULA_START.test(text) || /^-(?!\d+(\.\d+)?$)/.test(text))) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function money(value) {
  return value === null || value === undefined ? "" : Number(value).toFixed(2);
}

/**
 * Rows for the CSV, newest first. `transactions` are bank transactions
 * ({ date: "YYYY-MM-DD", description, amount, category, account, isFood,
 * linkedReceiptId }); `receipts` are saved receipts ({ id, date, storeName,
 * category, total, hasFood }). A receipt linked to a transaction is folded
 * into that transaction's row instead of getting one of its own.
 */
export function buildSpendingRows({ transactions, receipts }) {
  const linked = new Set(transactions.map((txn) => txn.linkedReceiptId).filter(Boolean));
  const rows = [];

  for (const txn of transactions) {
    rows.push({
      date: txn.date,
      cells: [
        txn.date,
        "Bank",
        txn.description,
        txn.category,
        txn.account,
        money(txn.amount),
        txn.isFood ? "Yes" : "No",
        txn.linkedReceiptId ? "Yes" : "No"
      ]
    });
  }
  for (const receipt of receipts) {
    if (linked.has(receipt.id)) continue;
    rows.push({
      date: receipt.date ?? "",
      cells: [receipt.date ?? "", "Receipt", receipt.storeName, receipt.category, "", money(receipt.total), receipt.hasFood ? "Yes" : "No", ""]
    });
  }

  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return rows.map((row) => row.cells);
}

/** The CSV text, with a UTF-8 BOM so Excel reads accents correctly. */
export function buildSpendingCsv(input) {
  const lines = [SPENDING_CSV_HEADER, ...buildSpendingRows(input)].map((cells) => cells.map(csvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function spendingExportFileName(today = new Date()) {
  return `spending-${today.toISOString().slice(0, 10)}.csv`;
}
