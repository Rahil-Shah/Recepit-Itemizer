// Builds the education-expense PDF: the figures the spreadsheet carries, laid
// out to be read and printed. A summary opens it, then every food receipt and
// rent payment with its photo beside it. Every page carries the Receipt Ring
// logo and name at the top, and its page number at the bottom.
//
// Like the spreadsheet builder, this takes plain rows and photo loaders, and
// has no Prisma or Express in it, so it can be tested on its own.

import PDFDocument from "pdfkit";
import { BRAND_COLORS as C, BRAND_NAME, FALLBACK_FONTS, drawBrandMark, loadBrandFonts } from "./brand.mjs";
import {
  EDUCATION_NOTE,
  MONTH_NAMES,
  createPhotoBudget,
  fitPhoto,
  omittedPhotosNote,
  photoNote,
  prepareExport,
  resolvePhoto
} from "./education-export.mjs";

// US Letter, in points. 529 plans are a US account, and so is the dollar.
const PAGE = { width: 612, height: 792 };
// The top margin leaves room for the header every page carries, the bottom
// one for its footer.
const MARGIN = { top: 92, bottom: 70, left: 54, right: 54 };
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;
const CONTENT_RIGHT = PAGE.width - MARGIN.right;

// Where a receipt or rent photo sits beside its row. Big enough to see what
// it is; the full image is embedded, so zooming in reads the small print.
const PHOTO_BOX = { width: 124, height: 168 };
const PHOTO_GUTTER = 18;
const AMOUNT_WIDTH = 80;
const BLOCK_PADDING = 12;

const SHORT_MONTHS = MONTH_NAMES.map((name) => name.slice(0, 3));
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatMoney(value) {
  return currency.format(value);
}

/** "2026-08-14" → "Aug 14, 2026", read from the string so no timezone can shift it. */
export function formatDay(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate ?? ""));
  if (!match) return String(isoDate ?? "");
  return `${SHORT_MONTHS[Number(match[2]) - 1]} ${Number(match[3])}, ${match[1]}`;
}

/** The period as the document's title: "August 2026", "January – December 2026". */
export function pdfTitle(period) {
  return period.kind === "month" ? period.label : `January – December ${period.year}`;
}

function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

// --- Text ---------------------------------------------------------------------

function setType(doc, { font = "body", size = 10, color = C.ink } = {}) {
  doc.font(font).fontSize(size).fillColor(color);
}

function measure(doc, text, { font = "body", size = 10, width, lineGap = 0, characterSpacing = 0 } = {}) {
  doc.font(font).fontSize(size);
  return doc.heightOfString(text, { width, lineGap, characterSpacing });
}

/** Wrapped text in a column. Callers have already made room for it. */
function drawText(doc, text, x, y, { width, lineGap = 0, characterSpacing = 0, align = "left", ...type } = {}) {
  setType(doc, type);
  doc.text(text, x, y, { width, lineGap, characterSpacing, align });
}

/** One line of text ending at `right`, for amounts and page numbers. */
function drawRight(doc, text, right, y, type = {}) {
  setType(doc, type);
  doc.text(text, right - doc.widthOfString(text), y, { lineBreak: false });
}

/** The largest size up to `size` at which `text` fits in `width`. */
function fitSize(doc, text, font, size, width) {
  doc.font(font).fontSize(size);
  const natural = doc.widthOfString(text);
  return natural <= width ? size : Math.max(8, Math.floor((size * width) / natural));
}

// --- Page flow ----------------------------------------------------------------

/**
 * Tracks where the next thing goes and starts a new page when it will not fit.
 * Nothing is ever drawn past the bottom margin: PDFKit would otherwise start a
 * page of its own mid-text and knock the layout out of step.
 */
function createFlow(doc) {
  const bottom = PAGE.height - MARGIN.bottom;
  return {
    y: MARGIN.top,
    pageHeight: bottom - MARGIN.top,
    fits(height) {
      return this.y + height <= bottom;
    },
    newPage() {
      doc.addPage();
      this.y = MARGIN.top;
    },
    /** Start a new page unless `height` fits on this one. */
    ensure(height) {
      if (this.fits(height)) return false;
      this.newPage();
      return true;
    }
  };
}

function hairline(doc, y, { color = C.timber, width = 0.6, left = MARGIN.left, right = CONTENT_RIGHT } = {}) {
  doc.save();
  doc.moveTo(left, y).lineTo(right, y).lineWidth(width).strokeColor(color).stroke();
  doc.restore();
}

// --- Photos -------------------------------------------------------------------

/**
 * Load a row's photo and decide what goes in the photo column: the picture,
 * scaled to fit with its orientation respected, or a note saying why there
 * is none. Null when the row has no photo at all.
 */
async function preparePhoto(doc, source, context) {
  const result = await resolvePhoto({ ...source, budget: context.budget });
  if (result.kind === "none") return null;

  if (result.kind === "photo") {
    try {
      const image = doc.openImage(result.buffer);
      // EXIF orientations 5-8 are stored on their side; PDFKit turns them
      // upright when drawing, so the box has to be measured the same way.
      const upright =
        image.orientation > 4 ? { width: image.height, height: image.width } : { width: image.width, height: image.height };
      const size = fitPhoto(upright, PHOTO_BOX.width, PHOTO_BOX.height);
      return { image, ...size };
    } catch (error) {
      console.warn("Could not read a photo for the PDF export:", error?.message ?? error);
      return notePhoto(doc, photoNote({ kind: "failed" }, { period: context.period, medium: "pdf" }));
    }
  }
  return notePhoto(doc, photoNote(result, { period: context.period, medium: "pdf" }));
}

function notePhoto(doc, note) {
  const textHeight = measure(doc, note, { size: 7.5, width: PHOTO_BOX.width - 20, lineGap: 1 });
  return { note, width: PHOTO_BOX.width, height: Math.max(52, textHeight + 22) };
}

function drawPhoto(doc, photo, x, y) {
  if (photo.image) {
    doc.save();
    doc.roundedRect(x, y, photo.width, photo.height, 6).clip();
    doc.image(photo.image, x, y, { width: photo.width, height: photo.height });
    doc.restore();
    doc.save();
    doc.roundedRect(x, y, photo.width, photo.height, 6).lineWidth(0.75).strokeColor(C.timber).stroke();
    doc.restore();
    return;
  }

  doc.save();
  doc.roundedRect(x, y, photo.width, photo.height, 8).fillColor(C.surface2).fill();
  doc
    .roundedRect(x, y, photo.width, photo.height, 8)
    .lineWidth(0.75)
    .dash(3, { space: 2.5 })
    .strokeColor(C.timber)
    .stroke();
  doc.undash();
  doc.restore();
  const textHeight = measure(doc, photo.note, { size: 7.5, width: photo.width - 20, lineGap: 1 });
  drawText(doc, photo.note, x + 10, y + (photo.height - textHeight) / 2, {
    size: 7.5,
    color: C.ink3,
    width: photo.width - 20,
    lineGap: 1,
    align: "center"
  });
}

// --- Blocks -------------------------------------------------------------------

/**
 * One receipt, bank transaction or rent payment: lines of text on the left,
 * its photo (if any) on the right.
 *
 * A block that fits on a page is kept whole, moving to a new page rather than
 * splitting. One taller than a page (a very long receipt) starts wherever its
 * opening lines and photo fit, and runs on across pages, repeating its title
 * with "(continued)" so no line is orphaned from the receipt it belongs to.
 */
function drawBlock(doc, flow, { lines, photo, continuation }) {
  const textHeight = lines.reduce((sum, line) => sum + line.height, 0);
  const height = BLOCK_PADDING * 2 + Math.max(textHeight, photo?.height ?? 0);
  if (height <= flow.pageHeight) {
    flow.ensure(height);
  } else {
    const openingText = lines.slice(0, 4).reduce((sum, line) => sum + line.height, 0);
    flow.ensure(BLOCK_PADDING * 2 + Math.max(openingText, photo?.height ?? 0));
  }

  let y = flow.y + BLOCK_PADDING;
  if (photo) drawPhoto(doc, photo, CONTENT_RIGHT - photo.width, y);
  const photoBottom = photo ? y + photo.height : y;
  let onPhotoPage = true;

  for (const line of lines) {
    flow.y = y;
    if (!flow.fits(line.height + BLOCK_PADDING)) {
      flow.newPage();
      onPhotoPage = false;
      y = flow.y + BLOCK_PADDING;
      y += continuation(y);
    }
    line.draw(y);
    y += line.height;
  }

  flow.y = (onPhotoPage ? Math.max(y, photoBottom) : y) + BLOCK_PADDING;
}

/** Title line: a bold label on the left, a bold amount on the right. */
function titleLine(doc, text, amount, textWidth) {
  const labelWidth = textWidth - AMOUNT_WIDTH - 10;
  const height = measure(doc, text, { font: "bold", size: 11.5, width: labelWidth });
  return {
    height: height + 2,
    draw(y) {
      drawText(doc, text, MARGIN.left, y, { font: "bold", size: 11.5, color: C.ink, width: labelWidth });
      drawRight(doc, amount, MARGIN.left + textWidth, y, { font: "bold", size: 11.5, color: C.ink });
    }
  };
}

function metaLine(doc, text, textWidth, { gapAfter = 7, color = C.ink3 } = {}) {
  const height = measure(doc, text, { size: 8.5, width: textWidth });
  return {
    height: height + gapAfter,
    draw(y) {
      drawText(doc, text, MARGIN.left, y, { size: 8.5, color, width: textWidth });
    }
  };
}

/** A line item: label, its amount, and an optional note underneath. */
function itemLine(doc, { label, amount, note, muted = false }, textWidth) {
  const labelWidth = textWidth - AMOUNT_WIDTH - 10;
  const labelHeight = measure(doc, label, { size: 9.5, width: labelWidth });
  const noteHeight = note ? measure(doc, note, { size: 8, width: labelWidth }) + 1 : 0;
  const color = muted ? C.ink3 : C.ink2;
  return {
    height: labelHeight + noteHeight + 3.5,
    draw(y) {
      drawText(doc, label, MARGIN.left, y, { size: 9.5, color, width: labelWidth });
      drawRight(doc, amount, MARGIN.left + textWidth, y, { size: 9.5, color });
      if (note) drawText(doc, note, MARGIN.left, y + labelHeight + 1, { size: 8, color: C.ink3, width: labelWidth });
    }
  };
}

function continuationLine(doc, title, textWidth) {
  return (y) => {
    const text = `${title} (continued)`;
    drawText(doc, text, MARGIN.left, y, { font: "bold", size: 10, color: C.ink3, width: textWidth });
    return measure(doc, text, { font: "bold", size: 10, width: textWidth }) + 6;
  };
}

// --- Sections -----------------------------------------------------------------

function sectionHeading(doc, flow, title, total, subtitle) {
  const subtitleHeight = subtitle ? measure(doc, subtitle, { size: 8.5, width: CONTENT_WIDTH }) + 2 : 0;
  // Never leave a heading alone at the foot of a page.
  flow.ensure(34 + subtitleHeight + 90);
  const y = flow.y;
  drawText(doc, title, MARGIN.left, y, { font: "display", size: 17, color: C.ink, width: CONTENT_WIDTH - 140 });
  drawRight(doc, total, CONTENT_RIGHT, y + 3, { font: "bold", size: 12, color: C.mossDeep });
  let next = y + 26;
  if (subtitle) {
    drawText(doc, subtitle, MARGIN.left, next, { size: 8.5, color: C.ink3, width: CONTENT_WIDTH });
    next += subtitleHeight;
  }
  hairline(doc, next + 4, { color: C.moss, width: 1 });
  flow.y = next + 5;
}

function emptyState(doc, flow, text) {
  flow.ensure(40);
  drawText(doc, text, MARGIN.left, flow.y + 14, { size: 9.5, color: C.ink3, width: CONTENT_WIDTH });
  flow.y += 40;
}

function subheading(doc, flow, text) {
  flow.ensure(24 + 60);
  drawText(doc, text.toUpperCase(), MARGIN.left, flow.y + 14, {
    font: "bold",
    size: 7.5,
    color: C.moss,
    width: CONTENT_WIDTH,
    characterSpacing: 1
  });
  flow.y += 26;
  hairline(doc, flow.y);
}

async function drawFood(doc, flow, rows, context) {
  const receiptCount = rows.receipts.length;
  const bankCount = rows.transactions.length;
  const subtitle =
    receiptCount + bankCount === 0
      ? null
      : [receiptCount ? plural(receiptCount, "receipt") : null, bankCount ? `${plural(bankCount, "bank transaction")}` : null]
          .filter(Boolean)
          .join(" · ");
  sectionHeading(doc, flow, "Food & groceries", formatMoney(rows.foodTotal), subtitle);

  if (receiptCount + bankCount === 0) {
    emptyState(doc, flow, "No food was marked in this period.");
    return;
  }

  // Keep the amounts in one column down the section: if any receipt has a
  // photo, every receipt leaves room for one.
  const photoColumn = rows.receipts.some((group) => group.hasImage);
  const textWidth = photoColumn ? CONTENT_WIDTH - PHOTO_BOX.width - PHOTO_GUTTER : CONTENT_WIDTH;

  for (const [index, group] of rows.receipts.entries()) {
    const photo = await preparePhoto(
      doc,
      { hasPhoto: Boolean(group.hasImage), mimeType: group.imageMimeType, load: () => context.loadReceiptImage(group.receiptId) },
      context
    );
    const store = group.storeName || "Receipt";
    const lines = [
      titleLine(doc, store, formatMoney(group.total), textWidth),
      metaLine(doc, `${formatDay(group.date)} · ${plural(group.items.length, "food item")}`, textWidth)
    ];
    for (const item of group.items) {
      const names = item.sharedWith.length > 0 ? ` with ${item.sharedWith.join(", ")}` : "";
      lines.push(
        itemLine(
          doc,
          {
            label: item.label,
            amount: formatMoney(item.amount),
            note: item.shared ? `Your share of ${formatMoney(item.fullAmount)}${names}` : null
          },
          textWidth
        )
      );
    }
    if (group.taxTotal !== 0) {
      lines.push(itemLine(doc, { label: "Tax on your food", amount: formatMoney(group.taxTotal), muted: true }, textWidth));
    }

    if (index > 0) hairline(doc, flow.y);
    drawBlock(doc, flow, { lines, photo, continuation: continuationLine(doc, store, textWidth) });
  }

  if (bankCount > 0) {
    subheading(doc, flow, "From your bank");
    for (const [index, txn] of rows.transactions.entries()) {
      const description = txn.description || "Bank transaction";
      const meta =
        txn.amount < 0
          ? `${formatDay(txn.date)} · Reimbursement, offsets food spending`
          : `${formatDay(txn.date)} · Bank transaction`;
      if (index > 0) hairline(doc, flow.y);
      drawBlock(doc, flow, {
        lines: [
          titleLine(doc, description, formatMoney(txn.amount), CONTENT_WIDTH),
          metaLine(doc, meta, CONTENT_WIDTH, { gapAfter: 0, color: txn.amount < 0 ? C.mossDeep : C.ink3 })
        ],
        photo: null,
        continuation: continuationLine(doc, description, CONTENT_WIDTH)
      });
    }
  }
}

async function drawRent(doc, flow, rows, context) {
  const count = rows.rent.length;
  sectionHeading(doc, flow, "Rent payments", formatMoney(rows.rentTotal), count ? plural(count, "payment") : null);
  if (count === 0) {
    emptyState(doc, flow, "No rent payments were logged in this period.");
    return;
  }

  const photoColumn = rows.rent.some((entry) => entry.photoMimeType);
  const textWidth = photoColumn ? CONTENT_WIDTH - PHOTO_BOX.width - PHOTO_GUTTER : CONTENT_WIDTH;

  for (const [index, entry] of rows.rent.entries()) {
    const photo = await preparePhoto(
      doc,
      { hasPhoto: Boolean(entry.photoMimeType), mimeType: entry.photoMimeType, load: () => context.loadRentPhoto(entry.id) },
      context
    );
    const title = `${MONTH_NAMES[entry.month - 1]} ${entry.year} rent`;
    const meta = [`Paid ${formatDay(entry.date)}`, entry.propertyName].filter(Boolean).join(" · ");
    if (index > 0) hairline(doc, flow.y);
    drawBlock(doc, flow, {
      lines: [titleLine(doc, title, formatMoney(entry.amount), textWidth), metaLine(doc, meta, textWidth, { gapAfter: 0 })],
      photo,
      continuation: continuationLine(doc, title, textWidth)
    });
  }
}

// --- Summary ------------------------------------------------------------------

function drawSummary(doc, flow, rows, { period, generatedLabel }) {
  let y = flow.y;
  drawText(doc, "EDUCATION EXPENSES", MARGIN.left, y, {
    font: "bold",
    size: 8,
    color: C.moss,
    width: CONTENT_WIDTH,
    characterSpacing: 1.4
  });
  y += 16;
  const title = pdfTitle(period);
  const titleSize = fitSize(doc, title, "display", 30, CONTENT_WIDTH);
  drawText(doc, title, MARGIN.left, y, { font: "display", size: titleSize, color: C.ink, width: CONTENT_WIDTH });
  y += measure(doc, title, { font: "display", size: titleSize, width: CONTENT_WIDTH }) + 4;
  drawText(doc, `Food and rent you marked in ${BRAND_NAME}. Generated ${generatedLabel}.`, MARGIN.left, y, {
    size: 9.5,
    color: C.ink3,
    width: CONTENT_WIDTH
  });
  y += 32;

  // The three stat cards from the budgeting view.
  const gap = 12;
  const cardWidth = (CONTENT_WIDTH - gap * 2) / 3;
  const cardHeight = 80;
  const receiptCount = rows.receipts.length;
  const bankCount = rows.transactions.length;
  const cards = [
    {
      label: "FOOD",
      value: rows.foodTotal,
      detail:
        [receiptCount ? plural(receiptCount, "receipt") : null, bankCount ? `${bankCount} from your bank` : null]
          .filter(Boolean)
          .join(" · ") || "Nothing marked"
    },
    { label: "RENT", value: rows.rentTotal, detail: rows.rent.length ? plural(rows.rent.length, "payment") : "Nothing logged" },
    { label: "TOTAL", value: rows.total, detail: "Food and rent together", highlight: true }
  ];

  cards.forEach((card, index) => {
    const x = MARGIN.left + index * (cardWidth + gap);
    doc.save();
    doc.roundedRect(x, y, cardWidth, cardHeight, 16).fillColor(card.highlight ? C.mossSoft : C.well).fill();
    if (card.highlight) {
      doc.roundedRect(x, y, cardWidth, cardHeight, 16).lineWidth(0.9).strokeColor(C.moss).stroke();
    }
    doc.restore();

    const inner = cardWidth - 32;
    drawText(doc, card.label, x + 16, y + 14, {
      font: "bold",
      size: 7.5,
      color: card.highlight ? C.mossDeep : C.ink3,
      width: inner,
      characterSpacing: 1
    });
    const value = formatMoney(card.value);
    const valueSize = fitSize(doc, value, "display", 22, inner);
    drawText(doc, value, x + 16, y + 29, {
      font: "display",
      size: valueSize,
      color: card.highlight ? C.mossDeep : C.ink,
      width: inner
    });
    drawText(doc, card.detail, x + 16, y + cardHeight - 22, { size: 8, color: C.ink3, width: inner });
  });
  y += cardHeight + 16;

  drawText(doc, EDUCATION_NOTE, MARGIN.left, y, { size: 8.5, color: C.ink3, width: CONTENT_WIDTH, lineGap: 1.5 });
  y += measure(doc, EDUCATION_NOTE, { size: 8.5, width: CONTENT_WIDTH, lineGap: 1.5 });

  // How many photos were left out is only known once the sections are drawn,
  // so the line under the note is kept free and filled in at the end.
  const photosNoteY = y + 4;
  flow.y = y + 34;
  return { photosNoteY };
}

// --- Header and footer --------------------------------------------------------

/**
 * Draw the header and footer onto every page, once the page count is known.
 * Both sit in the margins, so the bottom margin is lifted while they are
 * drawn: text below it would otherwise make PDFKit open yet another page.
 */
function stampPages(doc, { title, generatedLabel }) {
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    // Header: the mark and the name on the left, what this is on the right.
    const top = 32;
    const markSize = 26;
    drawBrandMark(doc, MARGIN.left, top, markSize);
    setType(doc, { font: "display", size: 15, color: C.ink });
    doc.text(BRAND_NAME, MARGIN.left + markSize + 9, top + (markSize - doc.currentLineHeight()) / 2, {
      lineBreak: false
    });
    drawRight(doc, "Education expenses", CONTENT_RIGHT, top + 1, { font: "bold", size: 8.5, color: C.ink2 });
    drawRight(doc, title, CONTENT_RIGHT, top + 13, { size: 8.5, color: C.ink3 });
    hairline(doc, top + markSize + 12, { width: 0.75 });

    // Footer.
    const footerY = PAGE.height - 42;
    hairline(doc, footerY - 8, { width: 0.5 });
    drawText(doc, `Generated ${generatedLabel} with ${BRAND_NAME} · A record, not tax advice`, MARGIN.left, footerY, {
      size: 7.5,
      color: C.ink3,
      width: CONTENT_WIDTH - 80
    });
    drawRight(doc, `Page ${index + 1} of ${range.count}`, CONTENT_RIGHT, footerY, { font: "bold", size: 7.5, color: C.ink3 });

    doc.page.margins.bottom = bottomMargin;
  }
}

function collect(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

/**
 * Build the PDF and return it as a Buffer. Takes the same rows, loaders and
 * photo budget as buildEducationWorkbook(); `fonts` defaults to the brand
 * typefaces, and null uses the standard PDF fonts instead.
 */
export async function buildEducationPdf({
  period,
  foodReceipts = [],
  foodTransactions = [],
  rentEntries = [],
  loadReceiptImage = async () => null,
  loadRentPhoto = async () => null,
  maxPhotoBytes = 25 * 1024 * 1024,
  generatedAt = new Date(),
  fonts = loadBrandFonts()
}) {
  const rows = prepareExport({ foodReceipts, foodTransactions, rentEntries });
  const budget = createPhotoBudget(maxPhotoBytes);
  const title = pdfTitle(period);
  const generatedLabel = formatDay(generatedAt.toISOString());
  const faces = fonts ?? FALLBACK_FONTS;

  const doc = new PDFDocument({
    size: "LETTER",
    margins: MARGIN,
    bufferPages: true,
    // The default font is opened with the document; handing it the body
    // face means the built-in Helvetica is never loaded when it is not used.
    font: faces.body,
    info: {
      Title: `Education expenses: ${title}`,
      Author: BRAND_NAME,
      Creator: BRAND_NAME,
      Subject: "Food and rent recorded as education expenses",
      CreationDate: generatedAt
    }
  });
  doc.registerFont("display", faces.display);
  doc.registerFont("body", faces.body);
  doc.registerFont("bold", faces.bold);
  const output = collect(doc);

  const flow = createFlow(doc);
  const context = { budget, period, loadReceiptImage, loadRentPhoto };
  const { photosNoteY } = drawSummary(doc, flow, rows, { period, generatedLabel });
  await drawFood(doc, flow, rows, context);
  flow.y += 18;
  await drawRent(doc, flow, rows, context);

  const omitted = omittedPhotosNote(budget.omitted, period);
  if (omitted) {
    doc.switchToPage(doc.bufferedPageRange().start);
    drawText(doc, omitted, MARGIN.left, photosNoteY, { font: "bold", size: 8.5, color: C.clayInk, width: CONTENT_WIDTH });
  }

  const pageCount = doc.bufferedPageRange().count;
  stampPages(doc, { title, generatedLabel });
  doc.end();

  return {
    buffer: await output,
    foodTotal: rows.foodTotal,
    rentTotal: rows.rentTotal,
    pageCount,
    photoBytes: budget.used,
    photosOmitted: budget.omitted
  };
}
