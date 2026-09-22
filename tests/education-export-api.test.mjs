import test from "node:test";
import assert from "node:assert/strict";
import { loadReceiptRing } from "./helpers/load-bundle.mjs";

const { ReceiptRing } = loadReceiptRing();
const { educationExportUrl, exportFileName } = ReceiptRing.Services;

test("educationExportUrl builds the month and year URLs", () => {
  assert.equal(
    educationExportUrl({ kind: "month", month: "2026-08" }),
    "/api/education-expenses/export?month=2026-08"
  );
  assert.equal(educationExportUrl({ kind: "year", year: 2026 }), "/api/education-expenses/export?year=2026");
});

test("educationExportUrl refuses a period the server would reject", () => {
  // An empty <input type="month"> reads as "".
  assert.equal(educationExportUrl({ kind: "month", month: "" }), null);
  assert.equal(educationExportUrl({ kind: "month", month: "2026-13" }), null);
  assert.equal(educationExportUrl({ kind: "month", month: "2026-8" }), null);
  assert.equal(educationExportUrl({ kind: "year", year: Number.NaN }), null);
  assert.equal(educationExportUrl({ kind: "year", year: 1999 }), null);
  assert.equal(educationExportUrl({ kind: "year", year: 2026.5 }), null);
});

test("exportFileName takes the server's name, or falls back", () => {
  assert.equal(
    exportFileName('attachment; filename="education-expenses-2026.xlsx"', "fallback.xlsx"),
    "education-expenses-2026.xlsx"
  );
  assert.equal(exportFileName("attachment; filename=plain.xlsx", "fallback.xlsx"), "plain.xlsx");
  assert.equal(exportFileName(null, "fallback.xlsx"), "fallback.xlsx");
  assert.equal(exportFileName("attachment", "fallback.xlsx"), "fallback.xlsx");
});
