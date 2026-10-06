import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadReceiptRing, plain } from "./helpers/load-bundle.mjs";

const { ReceiptRing } = loadReceiptRing({ TextEncoder, Blob, DataView, Uint8Array, Uint32Array, ArrayBuffer });
const { ZipWriter, crc32, DataExportService } = ReceiptRing.Services;

function service() {
  return new DataExportService((id) => `/img/${id}`, (id) => `/rent/${id}`);
}

const receipt = {
  id: "rcpt_abc123",
  storeName: "Trader Joe's",
  category: "Groceries",
  budgetCategory: "Groceries",
  subtotal: 9,
  tax: 1,
  total: 10,
  createdAt: "2026-09-12T15:00:00",
  hasImage: true,
  linkedTransaction: null,
  people: [{ id: "me", name: "Me", isSelf: true }, { id: "p2", name: "Sam" }],
  lines: [
    {
      id: "l1",
      label: "GV SHRD MOZZ",
      amount: 9,
      isFood: true,
      identification: { resolvedName: "Great Value Mozzarella" },
      assignments: [{ personName: "Me" }, { personName: "Sam" }]
    }
  ]
};
const txn = {
  id: "txn_1",
  date: "2026-09-13",
  description: "=HYPERLINK(\"x\")",
  amount: -25.5,
  category: "FOOD",
  budgetCategory: "Dining",
  isFood: false,
  account: "Checking",
  linkedReceiptId: "rcpt_abc123"
};
const rent = { id: "rent_99", year: 2026, month: 9, amount: 1200, propertyName: "Oak/St", date: "2026-09-01", hasPhoto: true };

function input() {
  return {
    receipts: [receipt],
    transactions: [txn],
    rentEntries: [rent],
    selfShares: new Map([["rcpt_abc123", 5.5]]),
    exportedAt: new Date(2026, 9, 6, 12, 0, 0)
  };
}

test("crc32 matches the standard check value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("plans one photo per receipt and rent proof, with readable unique names", () => {
  const requests = service().imageRequests(input());
  assert.deepEqual(
    plain(requests.map((r) => [r.key, r.basePath, r.url])),
    [
      ["receipt:rcpt_abc123", "receipts/2026-09-12 Trader Joe's (abc123)", "/img/rcpt_abc123"],
      ["rent:rent_99", "rent/2026-09-01 Oak St (ent_99)", "/rent/rent_99"]
    ]
  );
});

test("every transaction gets a row naming its photo, oldest first", () => {
  const names = new Map([
    ["receipt:rcpt_abc123", "receipts/a.jpg"],
    ["rent:rent_99", "rent/b.pdf"]
  ]);
  const [header, ...rows] = service().transactionRows(input(), names);
  assert.equal(header[10], "Image file");
  assert.deepEqual(plain(rows.map((r) => r[0])), ["Rent", "Receipt", "Bank transaction"]);
  const [, receiptRow, bankRow] = rows;
  assert.equal(receiptRow[5], "10.00");
  assert.equal(receiptRow[6], "5.50");
  assert.equal(receiptRow[9], "Sam");
  // The bank row points at the photo of the receipt attached to it.
  assert.equal(bankRow[10], "receipts/a.jpg");
  assert.equal(bankRow[5], "25.50");
});

test("a photo that could not be fetched is said so in its row", () => {
  const [, , receiptRow] = service().transactionRows(input(), new Map());
  assert.equal(receiptRow[10], "(photo could not be exported)");
});

test("CSV quotes, escapes, and defuses formulas", () => {
  const csv = service().toCsv([["a,b", 'say "hi"', "=SUM(A1)", "-12.50"]]);
  assert.equal(csv, '﻿"a,b","say ""hi""",\'=SUM(A1),-12.50\r\n');
});

test("builds a ZIP that a standard unzip tool can read", async (t) => {
  const blob = await service().build(input(), async (url) =>
    url.startsWith("/img/")
      ? new Blob([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], { type: "image/jpeg" })
      : null
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const dir = mkdtempSync(path.join(tmpdir(), "rr-zip-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "export.zip");
  writeFileSync(file, bytes);

  let listing;
  try {
    listing = execFileSync("python3", [
      "-c",
      "import sys, zipfile; z = zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print('\\n'.join(z.namelist()))",
      file
    ]).toString();
  } catch (error) {
    if (error.code === "ENOENT") return t.skip("python3 is not available");
    throw error;
  }
  assert.deepEqual(listing.trim().split("\n"), [
    "receipts/2026-09-12 Trader Joe's (abc123).jpg",
    "transactions.csv",
    "items.csv",
    "README.txt"
  ]);
});
