import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { makeJpegHeader, makePng } from "./helpers/image-fixtures.mjs";
import {
  buildEducationWorkbook,
  createPhotoBudget,
  embeddableExtension,
  exportFileName,
  fitPhoto,
  imageDimensions,
  parseExportFormat,
  parseExportPeriod,
  photoNote,
  prepareExport,
  resolvePhoto,
  EXPORT_FORMATS,
  EXPORT_RATE_LIMIT
} from "../server/education-export.mjs";

async function readWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

function cellValue(cell) {
  const value = cell.value;
  return value && typeof value === "object" && "result" in value ? value.result : value;
}

const monthPeriod = parseExportPeriod({ month: "2026-08" });
const yearPeriod = parseExportPeriod({ year: "2026" });

const groceries = {
  receiptId: "r1",
  storeName: "Trader Joe's",
  date: "2026-08-14",
  itemTotal: 13.5,
  taxTotal: 0.5,
  total: 14,
  hasImage: true,
  imageMimeType: "image/png",
  items: [
    { lineId: "l1", label: "Milk", amount: 4.5, fullAmount: 9, shared: true, sharedWith: ["Sam"] },
    { lineId: "l2", label: "Bread", amount: 9, fullAmount: 9, shared: false, sharedWith: [] }
  ]
};

// --- Period parsing -------------------------------------------------------------

test("parseExportPeriod accepts one month", () => {
  assert.deepEqual(parseExportPeriod({ month: "2026-08" }), {
    kind: "month",
    year: 2026,
    month: 8,
    label: "August 2026",
    baseName: "education-expenses-2026-08"
  });
});

test("parseExportPeriod accepts a whole year", () => {
  assert.deepEqual(parseExportPeriod({ year: "2026" }), {
    kind: "year",
    year: 2026,
    month: null,
    label: "2026 (full year)",
    baseName: "education-expenses-2026"
  });
});

test("parseExportPeriod insists on exactly one well-formed period", () => {
  assert.match(parseExportPeriod({}).error, /month.*or a whole year/);
  assert.match(parseExportPeriod({ month: "2026-08", year: "2026" }).error, /not both/);
  assert.match(parseExportPeriod({ month: "2026-13" }).error, /YYYY-MM/);
  assert.match(parseExportPeriod({ month: "Aug" }).error, /YYYY-MM/);
  assert.match(parseExportPeriod({ year: "26" }).error, /four-digit/);
  assert.match(parseExportPeriod({ year: "1999" }).error, /four-digit/);
  // Express turns ?month=a&month=b into an array; that is not a month.
  assert.match(parseExportPeriod({ month: ["2026-08", "2026-09"] }).error, /YYYY-MM/);
});

test("parseExportFormat defaults to the spreadsheet and knows the PDF", () => {
  assert.equal(parseExportFormat(undefined), "xlsx");
  assert.equal(parseExportFormat(""), "xlsx");
  assert.equal(parseExportFormat("xlsx"), "xlsx");
  assert.equal(parseExportFormat("pdf"), "pdf");
  assert.equal(parseExportFormat("PDF"), null);
  assert.equal(parseExportFormat("csv"), null);
  // Inherited keys are not formats.
  assert.equal(parseExportFormat("toString"), null);
  assert.equal(parseExportFormat(["pdf", "xlsx"]), null);
});

test("exportFileName and EXPORT_FORMATS name and type each file", () => {
  assert.equal(exportFileName(monthPeriod, "xlsx"), "education-expenses-2026-08.xlsx");
  assert.equal(exportFileName(monthPeriod, "pdf"), "education-expenses-2026-08.pdf");
  assert.equal(exportFileName(yearPeriod, "pdf"), "education-expenses-2026.pdf");
  assert.equal(EXPORT_FORMATS.pdf.contentType, "application/pdf");
  assert.match(EXPORT_FORMATS.xlsx.contentType, /spreadsheetml/);
});

test("prepareExport orders rows by date and totals them once for both formats", () => {
  const rows = prepareExport({
    foodReceipts: [
      { ...groceries, receiptId: "late", date: "2026-08-20", total: 10.1 },
      { ...groceries, receiptId: "early", date: "2026-08-02", total: 0.2 }
    ],
    foodTransactions: [{ transactionId: "t", description: "Zelle", amount: -0.1, date: "2026-08-03" }],
    rentEntries: [
      { id: "b", year: 2026, month: 9, amount: 500.05 },
      { id: "a", year: 2026, month: 8, amount: 499.95 }
    ]
  });
  assert.deepEqual(rows.receipts.map((group) => group.receiptId), ["early", "late"]);
  assert.deepEqual(rows.rent.map((entry) => entry.id), ["a", "b"]);
  // Rounded to cents, so floating point never leaves 10.200000000000001.
  assert.equal(rows.foodTotal, 10.2);
  assert.equal(rows.rentTotal, 1000);
  assert.equal(rows.total, 1010.2);
});

test("resolvePhoto only loads what the file can carry and the budget allows", async () => {
  const budget = createPhotoBudget(100);
  const load = async () => ({ data: Buffer.alloc(60).toString("base64"), mimeType: "image/png" });

  assert.deepEqual(await resolvePhoto({ hasPhoto: false, budget, load }), { kind: "none" });
  assert.deepEqual(await resolvePhoto({ hasPhoto: true, mimeType: "application/pdf", budget, load }), {
    kind: "unsupported",
    label: "PDF"
  });
  assert.equal((await resolvePhoto({ hasPhoto: true, mimeType: "image/png", budget, load })).kind, "photo");
  // 60 more bytes would pass 100: left out, and the budget is now closed.
  assert.equal((await resolvePhoto({ hasPhoto: true, mimeType: "image/png", budget, load })).kind, "omitted");
  let loaded = false;
  const result = await resolvePhoto({
    hasPhoto: true,
    mimeType: "image/png",
    budget,
    load: async () => {
      loaded = true;
      return null;
    }
  });
  assert.equal(result.kind, "omitted");
  assert.equal(loaded, false);
  assert.equal(budget.omitted, 2);
});

test("photoNote says why a photo is missing, in the file's own terms", () => {
  const unsupported = { kind: "unsupported", label: "PDF" };
  assert.equal(
    photoNote(unsupported, { period: monthPeriod, medium: "spreadsheet" }),
    "PDF attached in the app (can't be shown in a spreadsheet)"
  );
  assert.equal(
    photoNote(unsupported, { period: monthPeriod, medium: "pdf" }),
    "PDF attached in the app (can't be embedded in this file)"
  );
  assert.equal(photoNote({ kind: "omitted" }, { period: monthPeriod, medium: "pdf" }), "Photo left out to keep the file small");
  assert.match(photoNote({ kind: "omitted" }, { period: yearPeriod, medium: "pdf" }), /export this month on its own/);
  assert.equal(photoNote({ kind: "failed" }, { period: monthPeriod, medium: "pdf" }), "Photo could not be loaded");
});

// --- Photo helpers --------------------------------------------------------------

test("embeddableExtension only allows what a spreadsheet can draw", () => {
  assert.equal(embeddableExtension("image/jpeg"), "jpeg");
  assert.equal(embeddableExtension("image/png"), "png");
  assert.equal(embeddableExtension("image/webp"), null);
  assert.equal(embeddableExtension("application/pdf"), null);
  assert.equal(embeddableExtension(null), null);
});

test("imageDimensions reads PNG and JPEG headers", () => {
  assert.deepEqual(imageDimensions(makePng(30, 70)), { width: 30, height: 70 });
  assert.deepEqual(imageDimensions(makeJpegHeader(1200, 1600)), { width: 1200, height: 1600 });
  assert.equal(imageDimensions(Buffer.from("not an image at all, just text")), null);
  assert.equal(imageDimensions(Buffer.alloc(4)), null);
});

test("fitPhoto keeps the aspect ratio and never enlarges", () => {
  // A tall receipt is bound by height.
  assert.deepEqual(fitPhoto({ width: 1200, height: 1600 }), { width: 160, height: 213 });
  assert.deepEqual(fitPhoto({ width: 600, height: 2400 }), { width: 60, height: 240 });
  // A small photo stays as it is.
  assert.deepEqual(fitPhoto({ width: 50, height: 80 }), { width: 50, height: 80 });
  // Unknown dimensions still get a sensible box.
  assert.deepEqual(fitPhoto(null), { width: 120, height: 180 });
});

// --- Workbook -------------------------------------------------------------------

test("the workbook has the food, items, rent and summary the app shows", async () => {
  const { buffer, foodTotal, rentTotal } = await buildEducationWorkbook({
    period: monthPeriod,
    foodReceipts: [groceries],
    foodTransactions: [
      { transactionId: "t1", description: "Chipotle", amount: 12.25, date: "2026-08-20" },
      { transactionId: "t2", description: "Zelle from Sam", amount: -4.5, date: "2026-08-21" }
    ],
    rentEntries: [
      { id: "rent1", year: 2026, month: 8, date: "2026-08-01", amount: 950, propertyName: "Maple Apts", photoMimeType: null }
    ],
    loadReceiptImage: async () => ({ data: makePng(40, 80).toString("base64"), mimeType: "image/png" }),
    generatedAt: new Date("2026-09-01T12:00:00Z")
  });

  assert.equal(foodTotal, 21.75);
  assert.equal(rentTotal, 950);

  const workbook = await readWorkbook(buffer);
  assert.deepEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    ["Summary", "Food", "Food items", "Rent"]
  );

  const food = workbook.getWorksheet("Food");
  assert.equal(food.getCell("B2").value, "Trader Joe's");
  assert.match(food.getCell("D2").value, /Milk — \$4\.50 \(your share of \$9\.00 with Sam\)/);
  assert.match(food.getCell("D2").value, /Bread — \$9\.00/);
  assert.equal(food.getCell("G2").value, 14);
  assert.equal(food.getCell("C3").value, "Bank");
  assert.match(food.getCell("D4").value, /Reimbursement/);
  // Total row: a live formula, with the figure cached for viewers that do not
  // recalculate.
  assert.equal(food.getCell("B5").value, "Total");
  assert.equal(food.getCell("G5").value.formula, "SUM(G2:G4)");
  assert.equal(food.getCell("G5").value.result, 21.75);

  const items = workbook.getWorksheet("Food items");
  assert.deepEqual(
    items.getSheetValues().slice(2).map((row) => [row[3], row[4]]),
    [
      ["Milk", 4.5],
      ["Bread", 9],
      ["Tax on your food", 0.5]
    ]
  );

  const rent = workbook.getWorksheet("Rent");
  assert.equal(rent.getCell("B2").value, "August 2026");
  assert.equal(rent.getCell("C2").value, "Maple Apts");
  assert.equal(cellValue(rent.getCell("D3")), 950);

  const summary = workbook.getWorksheet("Summary");
  assert.equal(summary.getCell("B2").value, "August 2026");
  assert.equal(summary.getCell("B3").value, "2026-09-01");
  assert.equal(cellValue(summary.getCell("B5")), 21.75);
  assert.equal(cellValue(summary.getCell("B6")), 950);
  assert.equal(cellValue(summary.getCell("B7")), 971.75);
  assert.equal(summary.getCell("B7").value.formula, "B5+B6");
});

test("receipt and rent photos are embedded beside their rows", async () => {
  const loaded = [];
  const { buffer } = await buildEducationWorkbook({
    period: monthPeriod,
    foodReceipts: [groceries, { ...groceries, receiptId: "r2", hasImage: false, imageMimeType: null }],
    rentEntries: [
      { id: "rent1", year: 2026, month: 8, date: "2026-08-01", amount: 950, propertyName: null, photoMimeType: "image/jpeg" }
    ],
    loadReceiptImage: async (id) => {
      loaded.push(id);
      return { data: makePng(40, 80).toString("base64"), mimeType: "image/png" };
    },
    loadRentPhoto: async (id) => {
      loaded.push(id);
      return { data: makeJpegHeader(300, 400).toString("base64"), mimeType: "image/jpeg" };
    }
  });

  // Only rows that have a photo cost a lookup.
  assert.deepEqual(loaded, ["r1", "rent1"]);

  const workbook = await readWorkbook(buffer);
  const foodImages = workbook.getWorksheet("Food").getImages();
  assert.equal(foodImages.length, 1);
  // Anchored in the photo column (H, zero-based 7) on the first data row.
  assert.equal(Math.floor(foodImages[0].range.tl.nativeCol), 7);
  assert.equal(Math.floor(foodImages[0].range.tl.nativeRow), 1);
  assert.ok(workbook.getWorksheet("Food").getRow(2).height >= 60, "the row is tall enough for the photo");

  const rentImages = workbook.getWorksheet("Rent").getImages();
  assert.equal(rentImages.length, 1);
  assert.equal(Math.floor(rentImages[0].range.tl.nativeCol), 4);
  const media = workbook.model.media.map((entry) => entry.extension).sort();
  assert.deepEqual(media, ["jpeg", "png"]);
});

test("PDF and WebP attachments are named, not silently dropped", async () => {
  let loads = 0;
  const { buffer } = await buildEducationWorkbook({
    period: monthPeriod,
    foodReceipts: [{ ...groceries, imageMimeType: "image/webp" }],
    rentEntries: [
      { id: "rent1", year: 2026, month: 8, date: "2026-08-01", amount: 950, photoMimeType: "application/pdf" }
    ],
    loadReceiptImage: async () => {
      loads += 1;
      return null;
    },
    loadRentPhoto: async () => {
      loads += 1;
      return null;
    }
  });

  assert.equal(loads, 0, "a photo the spreadsheet cannot draw is never loaded");
  const workbook = await readWorkbook(buffer);
  assert.match(workbook.getWorksheet("Food").getCell("H2").value, /WebP image attached in the app/);
  assert.match(workbook.getWorksheet("Rent").getCell("E2").value, /PDF attached in the app/);
  assert.equal(workbook.getWorksheet("Food").getImages().length, 0);
});

test("past the photo budget the rest are left out without being loaded", async () => {
  const photo = makePng(40, 80);
  const receipts = ["r1", "r2", "r3", "r4"].map((receiptId, index) => ({
    ...groceries,
    receiptId,
    date: `2026-0${index + 1}-10`
  }));
  const loaded = [];

  const { buffer, photosOmitted } = await buildEducationWorkbook({
    period: yearPeriod,
    foodReceipts: receipts,
    loadReceiptImage: async (id) => {
      loaded.push(id);
      return { data: photo.toString("base64"), mimeType: "image/png" };
    },
    // Room for two photos and change.
    maxPhotoBytes: photo.length * 2 + 10
  });

  // The third photo is loaded and found not to fit; the fourth never is.
  assert.deepEqual(loaded, ["r1", "r2", "r3"]);
  assert.equal(photosOmitted, 2);

  const workbook = await readWorkbook(buffer);
  const food = workbook.getWorksheet("Food");
  assert.equal(food.getImages().length, 2);
  assert.match(food.getCell("H4").value, /export this month on its own/);
  assert.match(food.getCell("H5").value, /export this month on its own/);
  const summaryText = workbook
    .getWorksheet("Summary")
    .getSheetValues()
    .flat()
    .filter((value) => typeof value === "string")
    .join(" ");
  assert.match(summaryText, /2 photos were left out/);
  assert.match(summaryText, /2026 \(full year\)/);
});

test("a photo that fails to load does not fail the export", async () => {
  const { buffer } = await buildEducationWorkbook({
    period: monthPeriod,
    foodReceipts: [groceries],
    loadReceiptImage: async () => {
      throw new Error("connection reset");
    }
  });
  const workbook = await readWorkbook(buffer);
  assert.equal(workbook.getWorksheet("Food").getCell("H2").value, "Photo could not be loaded");
});

test("an empty period still produces a readable workbook with zero totals", async () => {
  const { buffer, foodTotal, rentTotal } = await buildEducationWorkbook({ period: monthPeriod });
  assert.equal(foodTotal, 0);
  assert.equal(rentTotal, 0);

  const workbook = await readWorkbook(buffer);
  assert.equal(workbook.getWorksheet("Food").getCell("G2").value, 0);
  assert.equal(workbook.getWorksheet("Rent").getCell("D2").value, 0);
  // ExcelJS does not cache a zero formula result; the workbook sets
  // fullCalcOnLoad so the spreadsheet app works it out on open.
  assert.equal(workbook.getWorksheet("Summary").getCell("B7").value.formula, "B5+B6");
});

test("rows are in date order regardless of the order they arrive in", async () => {
  const { buffer } = await buildEducationWorkbook({
    period: yearPeriod,
    foodReceipts: [
      { ...groceries, receiptId: "late", storeName: "Late", date: "2026-11-02", hasImage: false },
      { ...groceries, receiptId: "early", storeName: "Early", date: "2026-02-15", hasImage: false }
    ],
    rentEntries: [
      { id: "b", year: 2026, month: 10, date: "2026-10-01", amount: 1 },
      { id: "a", year: 2026, month: 3, date: "2026-03-01", amount: 1 }
    ]
  });
  const workbook = await readWorkbook(buffer);
  assert.equal(workbook.getWorksheet("Food").getCell("B2").value, "Early");
  assert.equal(workbook.getWorksheet("Rent").getCell("B2").value, "March 2026");
});

test("the export's rate limit is far tighter than the blanket API limit", () => {
  assert.equal(EXPORT_RATE_LIMIT.windowMs, 15 * 60 * 1000);
  assert.ok(EXPORT_RATE_LIMIT.max <= 10);
  assert.match(EXPORT_RATE_LIMIT.message, /Too many exports/);
});
