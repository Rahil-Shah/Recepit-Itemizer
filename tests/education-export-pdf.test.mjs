import test from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { buildEducationWorkbook, parseExportPeriod } from "../server/education-export.mjs";
import { buildEducationPdf, formatDay, formatMoney, pdfTitle } from "../server/education-export-pdf.mjs";
import { makeJpegHeader, makePng } from "./helpers/image-fixtures.mjs";

// --- Reading the PDF back ---------------------------------------------------------
//
// With `fonts: null` the builder uses the standard PDF fonts, whose text is
// written as hex-encoded WinAnsi, so a page's words can be read straight out
// of its content stream. (Embedded fonts write glyph ids instead.)

/** Every stream in the file, decompressed, in file order. */
function streams(buffer) {
  const source = buffer.toString("latin1");
  const found = [];
  // "stream" at the start of a stream, not the tail of an "endstream".
  const pattern = /(?<!end)stream\r?\n/g;
  let match;
  while ((match = pattern.exec(source))) {
    const dictionary = source.slice(source.lastIndexOf(" obj", match.index), match.index);
    const length = Number(/\/Length (\d+)/.exec(dictionary)?.[1]);
    const start = match.index + match[0].length;
    let body = buffer.subarray(start, start + length);
    if (/\/FlateDecode/.test(dictionary)) body = inflateSync(body);
    found.push(body);
    pattern.lastIndex = start + length;
  }
  return found;
}

// Text in the standard fonts is WinAnsi (cp1252): its dashes and quotes are
// not where latin1 would put them.
const winAnsi = new TextDecoder("windows-1252");

/** Each page's text, in page order, one string per page. */
function pageTexts(buffer) {
  return pageContents(buffer).map((content) =>
    [...content.matchAll(/\[(.*?)\] TJ/gs)]
      .map(([, run]) => [...run.matchAll(/<([0-9a-fA-F]*)>/g)].map(([, hex]) => winAnsi.decode(Buffer.from(hex, "hex"))).join(""))
      .join("\n")
  );
}

/** Page content streams: the ones that set text. */
function pageContents(buffer) {
  return streams(buffer)
    .map((body) => body.toString("latin1"))
    .filter((content) => / TJ/.test(content));
}

function pageCount(buffer) {
  return (buffer.toString("latin1").match(/\/Type \/Page\b(?!s)/g) ?? []).length;
}

/** A document Info entry (Title, Author...), direct or by reference. */
function infoValue(buffer, key) {
  const source = buffer.toString("latin1");
  const direct = new RegExp(`/${key} \\((.*?)\\)`).exec(source);
  if (direct) return direct[1];
  const reference = new RegExp(`/${key} (\\d+) 0 R`).exec(source);
  if (!reference) return null;
  const object = new RegExp(`\\n${reference[1]} 0 obj\\n\\((.*?)\\)\\nendobj`).exec(source);
  return object ? object[1] : null;
}

function imageCount(buffer) {
  return (buffer.toString("latin1").match(/\/Subtype \/Image/g) ?? []).length;
}

const monthPeriod = parseExportPeriod({ month: "2026-08" });
const yearPeriod = parseExportPeriod({ year: "2026" });

const item = (label, amount, extra = {}) => ({
  lineId: label,
  label,
  amount,
  fullAmount: amount,
  shared: false,
  sharedWith: [],
  ...extra
});

const groceries = {
  receiptId: "r1",
  storeName: "Trader Joe's",
  date: "2026-08-14",
  itemTotal: 13.5,
  taxTotal: 0.5,
  total: 14,
  hasImage: true,
  imageMimeType: "image/png",
  items: [item("Milk", 4.5, { fullAmount: 9, shared: true, sharedWith: ["Sam"] }), item("Bread", 9)]
};

const rentEntry = {
  id: "rent1",
  year: 2026,
  month: 8,
  date: "2026-08-01",
  amount: 950,
  propertyName: "Maple Apts",
  photoMimeType: "image/jpeg"
};

const loaders = {
  loadReceiptImage: async () => ({ data: makePng(40, 80).toString("base64"), mimeType: "image/png" }),
  loadRentPhoto: async () => ({ data: makeJpegHeader(300, 200).toString("base64"), mimeType: "image/jpeg" })
};

// A receipt long enough to run over several pages.
const bulkReceipt = {
  ...groceries,
  receiptId: "bulk",
  storeName: "Costco",
  date: "2026-08-20",
  hasImage: false,
  items: Array.from({ length: 90 }, (_, index) => item(`Bulk item ${index + 1}`, 1))
};

// --- Formatting ---------------------------------------------------------------------

test("formatDay reads the date from the string, never through a timezone", () => {
  assert.equal(formatDay("2026-08-01"), "Aug 1, 2026");
  assert.equal(formatDay("2026-12-31T23:59:59.000Z"), "Dec 31, 2026");
  assert.equal(formatDay("not a date"), "not a date");
});

test("formatMoney writes dollars, credits included", () => {
  assert.equal(formatMoney(1234.5), "$1,234.50");
  assert.equal(formatMoney(-4.5), "-$4.50");
  assert.equal(formatMoney(0), "$0.00");
});

test("pdfTitle names the month, or the whole year", () => {
  assert.equal(pdfTitle(monthPeriod), "August 2026");
  assert.equal(pdfTitle(yearPeriod), "January – December 2026");
});

// --- The document -------------------------------------------------------------------

test("the PDF is a PDF, titled for its period, in the brand typefaces", async () => {
  const { buffer, pageCount: pages } = await buildEducationPdf({
    period: monthPeriod,
    foodReceipts: [groceries],
    rentEntries: [rentEntry],
    ...loaders
  });

  assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-");
  assert.equal(pages, pageCount(buffer));
  const source = buffer.toString("latin1");
  assert.equal(infoValue(buffer, "Title"), "Education expenses: August 2026");
  assert.equal(infoValue(buffer, "Author"), "Receipt Ring");
  // Fraunces and Nunito are embedded (subset), and nothing else is.
  assert.match(source, /\/BaseFont \/[A-Z]+\+Nunito-Regular/);
  assert.match(source, /\/BaseFont \/[A-Z]+\+Nunito-Bold/);
  assert.match(source, /\/BaseFont \/[A-Z]+\+Fraunces/);
  assert.doesNotMatch(source, /\/BaseFont \/Helvetica/);
});

test("every page carries the logo and the app's name, and says which page it is", async () => {
  const { buffer, pageCount: pages } = await buildEducationPdf({
    period: monthPeriod,
    foodReceipts: [groceries, bulkReceipt],
    rentEntries: [rentEntry],
    ...loaders,
    fonts: null
  });

  assert.ok(pages >= 3, `expected a multi-page document, got ${pages} page(s)`);
  const texts = pageTexts(buffer);
  const contents = pageContents(buffer);
  assert.equal(texts.length, pages);

  texts.forEach((text, index) => {
    assert.match(text, /Receipt Ring/, `page ${index + 1} names the app`);
    assert.match(text, new RegExp(`Page ${index + 1} of ${pages}`), `page ${index + 1} is numbered`);
    assert.match(text, /Education expenses/);
  });
  contents.forEach((content, index) => {
    // The logo's gold arc (#d4b060) is stroked on every page.
    assert.match(content, /0\.83\d* 0\.69\d* 0\.37\d* SCN/, `page ${index + 1} draws the logo`);
  });
});

test("the summary, sections and line items are all in the text", async () => {
  const { buffer, foodTotal, rentTotal } = await buildEducationPdf({
    period: monthPeriod,
    foodReceipts: [groceries],
    foodTransactions: [
      { transactionId: "t1", description: "Chipotle", amount: 12.25, date: "2026-08-20" },
      { transactionId: "t2", description: "Zelle from Sam", amount: -4.5, date: "2026-08-21" }
    ],
    rentEntries: [rentEntry],
    ...loaders,
    fonts: null,
    generatedAt: new Date("2026-09-01T12:00:00Z")
  });
  assert.equal(foodTotal, 21.75);
  assert.equal(rentTotal, 950);

  const text = pageTexts(buffer).join("\n");
  for (const expected of [
    "August 2026",
    "Generated Sep 1, 2026",
    "$21.75",
    "$950.00",
    "$971.75",
    "Food & groceries",
    "Trader Joe's",
    "Aug 14, 2026",
    "Milk",
    "Your share of $9.00 with Sam",
    "Tax on your food",
    "FROM YOUR BANK",
    "Chipotle",
    "-$4.50",
    "Reimbursement, offsets food spending",
    "Rent payments",
    "August 2026 rent",
    "Paid Aug 1, 2026",
    "Maple Apts",
    "not tax advice"
  ]) {
    assert.ok(text.includes(expected), `missing "${expected}"`);
  }
});

test("receipt and rent photos are embedded, and only rows with one load it", async () => {
  const loaded = [];
  const { buffer } = await buildEducationPdf({
    period: monthPeriod,
    foodReceipts: [groceries, { ...groceries, receiptId: "r2", hasImage: false, imageMimeType: null }],
    rentEntries: [rentEntry],
    loadReceiptImage: async (id) => {
      loaded.push(id);
      return loaders.loadReceiptImage();
    },
    loadRentPhoto: async (id) => {
      loaded.push(id);
      return loaders.loadRentPhoto();
    }
  });
  assert.deepEqual(loaded, ["r1", "rent1"]);
  assert.equal(imageCount(buffer), 2);
});

test("a receipt longer than a page runs on, with its name repeated", async () => {
  const { buffer, pageCount: pages } = await buildEducationPdf({
    period: monthPeriod,
    foodReceipts: [bulkReceipt],
    fonts: null
  });
  const texts = pageTexts(buffer);
  assert.ok(pages >= 3);
  assert.match(texts[1], /Costco \(continued\)/);
  // Every item made it in, exactly once.
  const all = texts.join("\n");
  for (let index = 1; index <= 90; index += 1) {
    assert.equal(all.split(`Bulk item ${index}\n`).length - 1, 1, `Bulk item ${index}`);
  }
});

test("attachments the PDF cannot carry are named in place of the photo", async () => {
  let loads = 0;
  const { buffer } = await buildEducationPdf({
    period: monthPeriod,
    foodReceipts: [{ ...groceries, imageMimeType: "image/webp" }],
    rentEntries: [{ ...rentEntry, photoMimeType: "application/pdf" }],
    loadReceiptImage: async () => {
      loads += 1;
      return null;
    },
    loadRentPhoto: async () => {
      loads += 1;
      return null;
    },
    fonts: null
  });
  assert.equal(loads, 0);
  assert.equal(imageCount(buffer), 0);
  const text = pageTexts(buffer).join(" ").replace(/\s+/g, " ");
  assert.match(text, /WebP image attached in the app \(can't be embedded in this file\)/);
  assert.match(text, /PDF attached in the app \(can't be embedded in this file\)/);
});

test("past the photo budget, photos are left out and the summary says so", async () => {
  const photo = makePng(40, 80);
  const receipts = ["r1", "r2", "r3"].map((receiptId, index) => ({ ...groceries, receiptId, date: `2026-0${index + 1}-10` }));
  const loaded = [];
  const { buffer, photosOmitted } = await buildEducationPdf({
    period: yearPeriod,
    foodReceipts: receipts,
    loadReceiptImage: async (id) => {
      loaded.push(id);
      return { data: photo.toString("base64"), mimeType: "image/png" };
    },
    maxPhotoBytes: photo.length + 10,
    fonts: null
  });

  assert.deepEqual(loaded, ["r1", "r2"]);
  assert.equal(photosOmitted, 2);
  assert.equal(imageCount(buffer), 1);
  const texts = pageTexts(buffer).map((text) => text.replace(/\s+/g, " "));
  assert.match(texts[0], /2 photos were left out to keep this file small\. Export a single month/);
  assert.match(texts.join(" "), /Photo left out to keep the file small — export this month on its own/);
});

test("a photo that fails to load, or will not decode, does not fail the PDF", async () => {
  const { buffer } = await buildEducationPdf({
    period: monthPeriod,
    foodReceipts: [groceries, { ...groceries, receiptId: "r2" }],
    loadReceiptImage: async (id) => {
      if (id === "r1") throw new Error("connection reset");
      // Claims to be a PNG, is not one.
      return { data: Buffer.from("definitely not a png").toString("base64"), mimeType: "image/png" };
    },
    fonts: null
  });
  const text = pageTexts(buffer).join("\n");
  assert.equal(text.split("Photo could not be loaded").length - 1, 2);
});

test("an empty period still makes a one-page PDF with zero totals", async () => {
  const { buffer, pageCount: pages } = await buildEducationPdf({ period: monthPeriod, fonts: null });
  assert.equal(pages, 1);
  const text = pageTexts(buffer)[0];
  assert.match(text, /No food was marked in this period\./);
  assert.match(text, /No rent payments were logged in this period\./);
  assert.match(text, /\$0\.00/);
});

test("the PDF and the spreadsheet add up to the same totals", async () => {
  const input = {
    period: yearPeriod,
    foodReceipts: [groceries, { ...groceries, receiptId: "r2", total: 7.35 }],
    foodTransactions: [{ transactionId: "t1", description: "Deli", amount: 8.1, date: "2026-03-02" }],
    rentEntries: [rentEntry, { ...rentEntry, id: "rent2", month: 9, amount: 975.5 }]
  };
  const pdf = await buildEducationPdf({ ...input, fonts: null });
  const xlsx = await buildEducationWorkbook(input);
  assert.equal(pdf.foodTotal, xlsx.foodTotal);
  assert.equal(pdf.rentTotal, xlsx.rentTotal);
});
