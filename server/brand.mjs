// The Receipt Ring brand as a PDF can draw it: the name, the palette from
// public/styles.css, the logo, and the typefaces the app sets its text in.
//
// The logo is public/favicon.svg (the master mark: a moss tile, the spending
// ring in clay with its gold arc, and a receipt slip) redrawn with PDFKit's
// vector calls, so every page gets a crisp mark at any zoom without reading
// an image off disk.

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
  mossTile: "#65785a",
  mossSoft: "#eef0ea",
  clay: "#c18c5d",
  clayInk: "#9a6437",
  gold: "#d4b060"
});

// favicon.svg, in its own 64-unit box.
const MARK_BOX = 64;
const RING_RADIUS = 21.5;
const RING_WIDTH = 7.5;
// The gold arc is stroke-dasharray="48 136" on a circle rotated to start at
// twelve o'clock: 48 units of a 2πr ≈ 135.1 circumference, clockwise.
const GOLD_ARC_SWEEP = (48 / (2 * Math.PI * RING_RADIUS)) * 2 * Math.PI;
const SLIP_PATH = "M24 12.5h16v39.5l-2.7-2.2-2.7 2.2-2.6-2.2-2.7 2.2-2.6-2.2-2.7 2.2z";

/** Draw the logo with its top-left corner at (x, y), `size` points square. */
export function drawBrandMark(doc, x, y, size) {
  const scale = size / MARK_BOX;
  doc.save();
  doc.translate(x, y).scale(scale);

  // Moss tile, lit from the top left like the favicon's gradient.
  const tile = doc.linearGradient(0, 0, MARK_BOX, MARK_BOX);
  tile.stop(0, BRAND_COLORS.mossTile).stop(1, BRAND_COLORS.mossDeep);
  doc.roundedRect(0, 0, MARK_BOX, MARK_BOX, 15).fill(tile);

  // The ring, and the share of it the gold arc fills.
  const center = MARK_BOX / 2;
  doc.lineWidth(RING_WIDTH).lineCap("butt");
  doc.circle(center, center, RING_RADIUS).stroke(BRAND_COLORS.clay);
  const start = -Math.PI / 2;
  const end = start + GOLD_ARC_SWEEP;
  const endX = center + RING_RADIUS * Math.cos(end);
  const endY = center + RING_RADIUS * Math.sin(end);
  doc
    .path(`M${center} ${center - RING_RADIUS} A${RING_RADIUS} ${RING_RADIUS} 0 0 1 ${endX.toFixed(3)} ${endY.toFixed(3)}`)
    .stroke(BRAND_COLORS.gold);

  // The receipt slip and its two printed lines.
  doc.path(SLIP_PATH).fill(BRAND_COLORS.paper);
  doc.lineWidth(3).lineCap("round");
  doc.moveTo(28, 23).lineTo(36, 23).moveTo(28, 31).lineTo(36, 31).stroke(BRAND_COLORS.moss);

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
