// Builds the education-expense spreadsheet: the same food and rent figures
// the budgeting view shows, for one month or a whole year, with each receipt
// or rent proof photo embedded next to the row it backs up. Also home to what
// the spreadsheet and the PDF (server/education-export-pdf.mjs) share: which
// period and format was asked for, the order and totals of the rows, and how
// a photo is loaded, budgeted, or explained away.
//
// No Prisma and no Express in here. The route in server.mjs gathers the rows
// and hands over loaders for the photos, so this module can be unit tested
// with plain objects and a couple of tiny images.

import ExcelJS from "exceljs";
import { parseMonthParam, parseYearParam } from "./month.mjs";

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

// How large a photo is drawn in its cell. Receipts are tall and narrow, so the
// height gets more room than the width; the aspect ratio is always kept.
const PHOTO_MAX_WIDTH = 160;
const PHOTO_MAX_HEIGHT = 240;
// Used when a photo's own dimensions cannot be read from its header.
const PHOTO_FALLBACK = { width: 120, height: 180 };
const PHOTO_COLUMN_WIDTH = 24;

// The export route's rate limit. An export reads a whole period of receipts
// and rent, loads their photos, and zips them up: one request is worth
// hundreds of ordinary ones. Exporting a month, then the year, then fixing a
// receipt and exporting again is nowhere near this; a script hammering the
// route is stopped long before it matters.
export const EXPORT_RATE_LIMIT = Object.freeze({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many exports in a row. Give it a few minutes and try again."
});

const CURRENCY_FORMAT = '"$"#,##0.00;[Red]-"$"#,##0.00';

/** What each export format is sent as. */
export const EXPORT_FORMATS = Object.freeze({
  xlsx: Object.freeze({
    extension: "xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }),
  pdf: Object.freeze({ extension: "pdf", contentType: "application/pdf" })
});

/**
 * The format asked for with `?format=`, or null when it is not one of ours.
 * Left out, it is a spreadsheet: that is what the export was first, and what
 * an older page still asks for.
 */
export function parseExportFormat(value) {
  if (value === undefined || value === "") return "xlsx";
  return typeof value === "string" && Object.hasOwn(EXPORT_FORMATS, value) ? value : null;
}

/** "education-expenses-2026-08.pdf" and the like. */
export function exportFileName(period, format) {
  return `${period.baseName}.${EXPORT_FORMATS[format].extension}`;
}

/**
 * Which period an export covers, from the query string: `?month=YYYY-MM` or
 * `?year=YYYY`, exactly one of them. Returns `{ error }` when the request is
 * malformed, so the route can answer 400 with the message as-is.
 */
export function parseExportPeriod(query = {}) {
  const hasMonth = query.month !== undefined && query.month !== "";
  const hasYear = query.year !== undefined && query.year !== "";

  if (hasMonth && hasYear) {
    return { error: "Choose either a month or a year, not both." };
  }
  if (hasMonth) {
    const parsed = typeof query.month === "string" ? parseMonthParam(query.month) : null;
    if (!parsed) return { error: "month must be in YYYY-MM format." };
    const key = `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
    return {
      kind: "month",
      year: parsed.year,
      month: parsed.month,
      label: `${MONTH_NAMES[parsed.month - 1]} ${parsed.year}`,
      baseName: `education-expenses-${key}`
    };
  }
  if (hasYear) {
    const year = typeof query.year === "string" ? parseYearParam(query.year) : null;
    if (year === null) return { error: "year must be a four-digit year." };
    return {
      kind: "year",
      year,
      month: null,
      label: `${year} (full year)`,
      baseName: `education-expenses-${year}`
    };
  }
  return { error: "Choose a month (month=YYYY-MM) or a whole year (year=YYYY) to export." };
}

/**
 * Only JPEG and PNG can be embedded in an .xlsx picture. WebP and PDF proofs
 * are real attachments too, but Excel cannot draw them, so the cell says so
 * instead of silently leaving a gap.
 */
export function embeddableExtension(mimeType) {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpeg";
  if (mimeType === "image/png") return "png";
  return null;
}

/**
 * Pixel dimensions from a PNG or JPEG header, or null when they cannot be
 * found. Reading the header is enough: nothing here decodes the image.
 */
export function imageDimensions(buffer) {
  if (!buffer || buffer.length < 24) return null;

  // PNG: 8-byte signature, then the IHDR chunk holding width and height.
  if (buffer.readUInt32BE(0) === 0x89504e47 && buffer.toString("ascii", 12, 16) === "IHDR") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  // JPEG: walk the segments until a start-of-frame marker, which carries the
  // dimensions. Every other segment is skipped by its declared length.
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) return null;
      const marker = buffer[offset + 1];
      // Fill bytes between segments.
      if (marker === 0xff) {
        offset += 1;
        continue;
      }
      const isStartOfFrame =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isStartOfFrame) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) return null;
      offset += 2 + length;
    }
  }
  return null;
}

/** Scale a photo to fit its cell, keeping its aspect ratio. */
export function fitPhoto(dimensions, maxWidth = PHOTO_MAX_WIDTH, maxHeight = PHOTO_MAX_HEIGHT) {
  const source = dimensions && dimensions.width > 0 && dimensions.height > 0 ? dimensions : PHOTO_FALLBACK;
  const scale = Math.min(1, maxWidth / source.width, maxHeight / source.height);
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale))
  };
}

// "Milk — $4.50 (your share of $9.00 with Sam)", one item per line, for the
// Items cell of a receipt row.
function describeItems(group) {
  const money = (value) => `$${Number(value).toFixed(2)}`;
  return group.items
    .map((item) => {
      if (!item.shared) return `${item.label} — ${money(item.amount)}`;
      const names = item.sharedWith.length > 0 ? ` with ${item.sharedWith.join(", ")}` : "";
      return `${item.label} — ${money(item.amount)} (your share of ${money(item.fullAmount)}${names})`;
    })
    .join("\n");
}

function styleHeader(row) {
  row.font = { bold: true };
  row.alignment = { vertical: "middle" };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8ECEF" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF9AA5B1" } } };
  });
}

function sumFormula(column, firstRow, lastRow, result) {
  // An empty sheet still gets a total row; SUM over a reversed range would
  // read the header, so an empty section totals to a literal zero instead.
  if (lastRow < firstRow) return 0;
  return { formula: `SUM(${column}${firstRow}:${column}${lastRow})`, result };
}

export function roundCents(value) {
  return Math.round(value * 100) / 100;
}

/** The note both formats carry: these are records, not advice. */
export const EDUCATION_NOTE =
  "These totals are a record of what you marked, not tax advice. Check them against your own " +
  "receipts and the rules for your plan before using them in a filing.";

/**
 * The rows of an export in the order they are printed, with their totals.
 *
 * Chronological reads better on paper than the newest-first of the app, and
 * both formats must add up to the same figures, so the sorting and summing
 * live here once.
 */
export function prepareExport({ foodReceipts = [], foodTransactions = [], rentEntries = [] }) {
  const receipts = [...foodReceipts].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const transactions = [...foodTransactions].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const rent = [...rentEntries].sort((a, b) => a.year - b.year || a.month - b.month);

  const foodTotal = roundCents(
    receipts.reduce((sum, group) => sum + group.total, 0) + transactions.reduce((sum, txn) => sum + txn.amount, 0)
  );
  const rentTotal = roundCents(rent.reduce((sum, entry) => sum + entry.amount, 0));
  return { receipts, transactions, rent, foodTotal, rentTotal, total: roundCents(foodTotal + rentTotal) };
}

/**
 * Tracks how many photo bytes the workbook has taken on. A year of receipts
 * can hold hundreds of photos; past the budget the rest are left out and
 * named in their cells, so one export cannot balloon the response (or the
 * memory holding it) without limit.
 */
export function createPhotoBudget(maxBytes) {
  let used = 0;
  let omitted = 0;
  let full = false;
  return {
    tryTake(bytes) {
      if (full || used + bytes > maxBytes) {
        // Once one photo has not fit, the rest are left out without being
        // loaded: the export stops querying for photos it would only discard.
        full = true;
        omitted += 1;
        return false;
      }
      used += bytes;
      return true;
    },
    /** Count a photo left out without loading it. */
    skip() {
      omitted += 1;
    },
    get full() {
      return full;
    },
    get used() {
      return used;
    },
    get omitted() {
      return omitted;
    }
  };
}

/**
 * Fetch a row's photo, if it has one the file can carry and the budget has
 * room for it. `load` is called only then, so rows without a photo cost no
 * query and photos are held one at a time.
 *
 * Resolves to one of:
 * - `{ kind: "none" }`: the row has no photo.
 * - `{ kind: "photo", buffer, extension }`: embed it.
 * - `{ kind: "unsupported", label }`: a PDF or WebP attachment; nothing to draw.
 * - `{ kind: "omitted" }`: over the budget, left out.
 * - `{ kind: "failed" }`: it should be there and could not be loaded.
 */
export async function resolvePhoto({ hasPhoto, mimeType, load, budget }) {
  if (!hasPhoto) return { kind: "none" };

  const extension = embeddableExtension(mimeType);
  if (!extension) {
    const label =
      mimeType === "application/pdf"
        ? "PDF"
        : mimeType === "image/webp"
          ? "WebP image"
          : `${(mimeType?.split("/")[1] ?? "unknown").toUpperCase()} file`;
    return { kind: "unsupported", label };
  }

  if (budget.full) {
    budget.skip();
    return { kind: "omitted" };
  }

  let photo;
  try {
    photo = await load();
  } catch (error) {
    console.warn("Could not load a photo for the export:", error?.message ?? error);
    photo = null;
  }
  if (!photo?.data) return { kind: "failed" };

  const buffer = Buffer.from(photo.data, "base64");
  if (!budget.tryTake(buffer.length)) return { kind: "omitted" };
  return { kind: "photo", buffer, extension };
}

// Why an attachment is missing, in the words of the file it is missing from.
const UNSUPPORTED_REASON = {
  spreadsheet: "can't be shown in a spreadsheet",
  pdf: "can't be embedded in this file"
};

/**
 * What stands in for a photo that is not in the file. `medium` is the file
 * it is missing from: "spreadsheet" or "pdf".
 */
export function photoNote(result, { period, medium }) {
  switch (result.kind) {
    case "unsupported":
      return `${result.label} attached in the app (${UNSUPPORTED_REASON[medium]})`;
    case "omitted":
      return period.kind === "year"
        ? "Photo left out to keep the file small — export this month on its own to include it"
        : "Photo left out to keep the file small";
    case "failed":
      return "Photo could not be loaded";
    default:
      return "";
  }
}

/** The Summary line explaining how many photos a file left out, if any. */
export function omittedPhotosNote(count, period) {
  if (count === 0) return null;
  return (
    `${count} photo${count === 1 ? " was" : "s were"} left out to keep this file small.` +
    (period.kind === "year" ? " Export a single month to include every photo." : "")
  );
}

/**
 * Put a row's photo (or a note explaining its absence) in `cell`, and size
 * the row so the picture fits.
 */
async function placePhoto(workbook, sheet, cell, row, { hasPhoto, mimeType, load, budget, period }) {
  const result = await resolvePhoto({ hasPhoto, mimeType, load, budget });
  if (result.kind !== "photo") {
    cell.value = photoNote(result, { period, medium: "spreadsheet" });
    return { embedded: false };
  }

  const { buffer, extension } = result;
  const size = fitPhoto(imageDimensions(buffer));
  const imageId = workbook.addImage({ buffer, extension });
  // tl is zero-based; a small inset keeps the picture off the gridlines.
  sheet.addImage(imageId, {
    tl: { col: cell.fullAddress.col - 1 + 0.05, row: row.number - 1 + 0.05 },
    ext: size,
    editAs: "oneCell"
  });
  // Row heights are in points (0.75 of a pixel) plus a little padding.
  row.height = Math.max(row.height ?? 15, Math.ceil(size.height * 0.75) + 8);
  return { embedded: true };
}

/**
 * Build the workbook and return it as an .xlsx Buffer.
 *
 * - `foodReceipts`: summariseReceiptFood() results, each with `hasImage` and
 *   `imageMimeType` added.
 * - `foodTransactions`: food-flagged bank transactions, as the food summary
 *   route returns them.
 * - `rentEntries`: `{ id, date, year, month, amount, propertyName, photoMimeType }`.
 * - `loadReceiptImage(id)` / `loadRentPhoto(id)`: resolve to
 *   `{ data: base64, mimeType }` or null.
 * - `maxPhotoBytes`: the photo budget described at createPhotoBudget().
 */
export async function buildEducationWorkbook({
  period,
  foodReceipts = [],
  foodTransactions = [],
  rentEntries = [],
  loadReceiptImage = async () => null,
  loadRentPhoto = async () => null,
  maxPhotoBytes = 25 * 1024 * 1024,
  generatedAt = new Date()
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Receipt Ring";
  workbook.created = generatedAt;
  // Totals are live formulas with their figures cached, but a zero result is
  // not cached, so have the spreadsheet app work them out when it opens.
  workbook.calcProperties.fullCalcOnLoad = true;

  const budget = createPhotoBudget(maxPhotoBytes);
  const summary = workbook.addWorksheet("Summary");
  const food = workbook.addWorksheet("Food");
  const foodItems = workbook.addWorksheet("Food items");
  const rent = workbook.addWorksheet("Rent");

  // --- Food: one row per receipt, then one per bank transaction ------------
  food.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Store / description", key: "store", width: 28 },
    { header: "Source", key: "source", width: 10 },
    { header: "Items", key: "items", width: 48 },
    { header: "Food subtotal", key: "subtotal", width: 14, style: { numFmt: CURRENCY_FORMAT } },
    { header: "Tax", key: "tax", width: 10, style: { numFmt: CURRENCY_FORMAT } },
    { header: "Your total", key: "total", width: 14, style: { numFmt: CURRENCY_FORMAT } },
    { header: "Receipt photo", key: "photo", width: PHOTO_COLUMN_WIDTH }
  ];
  styleHeader(food.getRow(1));
  food.views = [{ state: "frozen", ySplit: 1 }];

  const {
    receipts: receiptsInOrder,
    transactions: transactionsInOrder,
    rent: rentInOrder,
    foodTotal,
    rentTotal,
    total
  } = prepareExport({ foodReceipts, foodTransactions, rentEntries });

  for (const group of receiptsInOrder) {
    const row = food.addRow({
      date: group.date,
      store: group.storeName ?? "Receipt",
      source: "Receipt",
      items: describeItems(group),
      subtotal: group.itemTotal,
      tax: group.taxTotal,
      total: group.total
    });
    row.alignment = { vertical: "top", wrapText: true };
    await placePhoto(workbook, food, row.getCell("photo"), row, {
      hasPhoto: Boolean(group.hasImage),
      mimeType: group.imageMimeType,
      load: () => loadReceiptImage(group.receiptId),
      budget,
      period
    });
  }
  for (const txn of transactionsInOrder) {
    const row = food.addRow({
      date: txn.date,
      store: txn.description || "Bank transaction",
      source: "Bank",
      items: txn.amount < 0 ? "Reimbursement (offsets food spending)" : "",
      subtotal: txn.amount,
      tax: 0,
      total: txn.amount
    });
    row.alignment = { vertical: "top", wrapText: true };
  }
  const foodLastDataRow = food.rowCount;
  const foodTotalRow = food.addRow({
    store: "Total",
    total: sumFormula("G", 2, foodLastDataRow, foodTotal)
  });
  foodTotalRow.font = { bold: true };

  // --- Food items: the same food, one line item per row, for filtering -----
  foodItems.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Store", key: "store", width: 28 },
    { header: "Item", key: "item", width: 36 },
    { header: "Your share", key: "amount", width: 12, style: { numFmt: CURRENCY_FORMAT } },
    { header: "Full price", key: "fullAmount", width: 12, style: { numFmt: CURRENCY_FORMAT } },
    { header: "Shared with", key: "sharedWith", width: 28 }
  ];
  styleHeader(foodItems.getRow(1));
  foodItems.views = [{ state: "frozen", ySplit: 1 }];
  for (const group of receiptsInOrder) {
    for (const item of group.items) {
      foodItems.addRow({
        date: group.date,
        store: group.storeName ?? "Receipt",
        item: item.label,
        amount: item.amount,
        fullAmount: item.fullAmount,
        sharedWith: item.sharedWith.join(", ")
      });
    }
    if (group.taxTotal !== 0) {
      foodItems.addRow({
        date: group.date,
        store: group.storeName ?? "Receipt",
        item: "Tax on your food",
        amount: group.taxTotal
      });
    }
  }

  // --- Rent -----------------------------------------------------------------
  rent.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Month", key: "month", width: 16 },
    { header: "Property / landlord", key: "property", width: 28 },
    { header: "Amount", key: "amount", width: 14, style: { numFmt: CURRENCY_FORMAT } },
    { header: "Proof of payment", key: "photo", width: PHOTO_COLUMN_WIDTH }
  ];
  styleHeader(rent.getRow(1));
  rent.views = [{ state: "frozen", ySplit: 1 }];

  for (const entry of rentInOrder) {
    const row = rent.addRow({
      date: entry.date,
      month: `${MONTH_NAMES[entry.month - 1]} ${entry.year}`,
      property: entry.propertyName ?? "",
      amount: entry.amount
    });
    row.alignment = { vertical: "top", wrapText: true };
    await placePhoto(workbook, rent, row.getCell("photo"), row, {
      hasPhoto: Boolean(entry.photoMimeType),
      mimeType: entry.photoMimeType,
      load: () => loadRentPhoto(entry.id),
      budget,
      period
    });
  }
  const rentLastDataRow = rent.rowCount;
  const rentTotalRow = rent.addRow({ property: "Total", amount: sumFormula("D", 2, rentLastDataRow, rentTotal) });
  rentTotalRow.font = { bold: true };

  // --- Summary --------------------------------------------------------------
  summary.columns = [
    { key: "label", width: 22 },
    { key: "value", width: 60 }
  ];
  const title = summary.addRow({ label: "Education expenses" });
  title.font = { bold: true, size: 14 };
  summary.addRow({ label: "Period", value: period.label });
  summary.addRow({ label: "Generated", value: generatedAt.toISOString().slice(0, 10) });
  summary.addRow({});

  const money = (row) => {
    row.getCell("value").numFmt = CURRENCY_FORMAT;
    row.getCell("value").alignment = { horizontal: "left" };
    return row;
  };
  const foodSummaryRow = money(
    summary.addRow({ label: "Food", value: { formula: `Food!G${foodTotalRow.number}`, result: foodTotal } })
  );
  const rentSummaryRow = money(
    summary.addRow({ label: "Rent", value: { formula: `Rent!D${rentTotalRow.number}`, result: rentTotal } })
  );
  const combinedRow = money(
    summary.addRow({
      label: "Total",
      value: {
        formula: `B${foodSummaryRow.number}+B${rentSummaryRow.number}`,
        result: total
      }
    })
  );
  combinedRow.font = { bold: true };
  summary.addRow({});
  summary.addRow({ label: "Note", value: EDUCATION_NOTE }).alignment = { wrapText: true, vertical: "top" };
  const omitted = omittedPhotosNote(budget.omitted, period);
  if (omitted) {
    summary.addRow({ label: "Photos", value: omitted }).alignment = { wrapText: true, vertical: "top" };
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    buffer,
    foodTotal,
    rentTotal,
    photoBytes: budget.used,
    photosOmitted: budget.omitted
  };
}
