// The Receipt Ring brand as a PDF can draw it: the name, the palette from
// public/styles.css, the logo, and the typefaces the app sets its text in.
//
// The logo is public/favicon.svg (the master mark: the site's moss disc with
// its outline receipt, inside a spending ring whose peach arc runs along a
// deep-moss track) redrawn with PDFKit's vector calls, so every page gets a
// crisp mark at any zoom without reading an image off disk.

import { readFileSync } from "node:fs";

export const BRAND_NAME = "Receipt Ring";

// Named as in the :root tokens of public/styles.css.
export const BRAND_COLORS = Object.freeze({
  paper: "#fdfcf8",
  surface2: "#f7f4ee",
  well: "#f0ebe5",
  sand: "#e6dccd",
  timber: "#ded8cf",
  ink: "#2c2c24",
  ink2: "#4a4a40",
  ink3: "#78786c",
  moss: "#5d7052",
  mossDeep: "#4d5e43",
  mossSoft: "#eef0ea",
  mossMist: "#f3f4f1",
  clay: "#c18c5d",
  clayInk: "#9a6437",
  // The logo's ring arc: clay lifted to read against moss. Not a UI token.
  clayGlow: "#e8b98f"
});

// favicon.svg, in its own 64-unit box.
const MARK_BOX = 64;
const RING_RADIUS = 26;
const RING_WIDTH = 4;
// The arc is pathLength="100" stroke-dasharray="62 38" on a circle rotated to
// start at twelve o'clock: 62% of the circle, clockwise, with round caps.
const RING_ARC_SWEEP = 0.62 * 2 * Math.PI;
// The site's receipt icon (the 24px glyph in public/index.html's sprite),
// scaled by 1.7 and centred on the disc.
const RECEIPT_SCALE = 1.7;
const RECEIPT_OFFSET = MARK_BOX / 2 - 12 * RECEIPT_SCALE;
const RECEIPT_STROKE = 1.8;
const RECEIPT_BODY = "M6 3.5h12a1 1 0 0 1 1 1v15l-2.4-1.6-2.4 1.6-2.2-1.6-2.2 1.6-2.4-1.6L5 20.5v-16a1 1 0 0 1 1-1Z";
const RECEIPT_LINES = "M8.5 8.5h7M8.5 12h7M8.5 15.5h4";

/** Draw the logo with its top-left corner at (x, y), `size` points square. */
export function drawBrandMark(doc, x, y, size) {
  const scale = size / MARK_BOX;
  doc.save();
  doc.translate(x, y).scale(scale);

  // The moss disc, as on the site.
  const center = MARK_BOX / 2;
  doc.circle(center, center, MARK_BOX / 2).fill(BRAND_COLORS.moss);

  // The ring: a deep-moss track, and the share of it the peach arc fills.
  doc.lineWidth(RING_WIDTH).lineCap("butt");
  doc.circle(center, center, RING_RADIUS).stroke(BRAND_COLORS.mossDeep);
  const start = -Math.PI / 2;
  const end = start + RING_ARC_SWEEP;
  const endX = center + RING_RADIUS * Math.cos(end);
  const endY = center + RING_RADIUS * Math.sin(end);
  doc
    .lineCap("round")
    .path(`M${center} ${center - RING_RADIUS} A${RING_RADIUS} ${RING_RADIUS} 0 1 1 ${endX.toFixed(3)} ${endY.toFixed(3)}`)
    .stroke(BRAND_COLORS.clayGlow);

  // The receipt and its three printed lines, outlined in moss-mist.
  doc.save();
  doc.translate(RECEIPT_OFFSET, RECEIPT_OFFSET).scale(RECEIPT_SCALE);
  doc.lineWidth(RECEIPT_STROKE).lineCap("round").lineJoin("round");
  doc.path(RECEIPT_BODY).stroke(BRAND_COLORS.mossMist);
  doc.path(RECEIPT_LINES).stroke(BRAND_COLORS.mossMist);
  doc.restore();

  doc.restore();
}

// Fraunces for the wordmark, headings and figures; Nunito for everything
// else -- the pairing the app itself uses. Static instances of the Google
// Fonts families (SIL Open Font License; see server/fonts/OFL-*.txt).
//
// Each path is a literal `new URL(..., import.meta.url)` so the serverless
// bundler's file tracer can see it (vercel.json also names the directory).
const FONT_URLS = {
  display: new URL("./fonts/Fraunces-SemiBold.ttf", import.meta.url),
  body: new URL("./fonts/Nunito-Regular.ttf", import.meta.url),
  bold: new URL("./fonts/Nunito-Bold.ttf", import.meta.url)
};

// The standard PDF fonts stand in when the files cannot be read, so a
// deployment that left server/fonts behind still produces a readable file
// rather than failing the export.
export const FALLBACK_FONTS = Object.freeze({
  display: "Times-Bold",
  body: "Helvetica",
  bold: "Helvetica-Bold"
});

let cachedFonts;

/**
 * The brand typefaces as Buffers, read once per process, or null when they
 * are not available.
 */
export function loadBrandFonts() {
  if (cachedFonts !== undefined) return cachedFonts;
  try {
    cachedFonts = Object.fromEntries(Object.entries(FONT_URLS).map(([role, url]) => [role, readFileSync(url)]));
  } catch (error) {
    console.warn("Brand fonts unavailable; PDFs will use the standard fonts:", error?.message ?? error);
    cachedFonts = null;
  }
  return cachedFonts;
}
