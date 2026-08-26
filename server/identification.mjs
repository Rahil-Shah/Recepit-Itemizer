// Turning an identification from the browser into columns to store.
//
// Receipts print shorthand, so a saved split is unreadable months later unless
// what each line actually was is stored alongside it. This is the part that
// decides what is safe to write: the browser is not trusted, so confidence is
// clamped, the source is checked against the set the UI can render, and the
// alternatives are rebuilt element by element rather than stored as whatever
// JSON happened to arrive.

// Where a stored identification can have come from. An unrecognised value is
// dropped rather than stored, so the column only ever holds something the
// browser knows how to render.
const IDENTIFICATION_SOURCES = new Set([
  "user-confirmed",
  "saved-alias",
  "dictionary",
  "ai",
  "unresolved"
]);
const MAX_STORED_ALTERNATIVES = 5;

export function normalizeStoredItemCode(value) {
  const code = typeof value === "string" ? value.trim() : "";
  return /^\d{1,20}$/.test(code) ? code : null;
}

function trimmedOrNull(value, maxLength) {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maxLength) : null;
}

/**
 * An identification from the browser, as columns to write.
 *
 * Returns an empty object when there is nothing usable, so it can be spread
 * into the create without a branch and the columns simply stay null. Nothing
 * here is trusted: confidence is clamped, the source is checked against the
 * list the UI can render, and the alternatives are rebuilt element by element
 * rather than stored as whatever JSON arrived.
 */
export function identificationFields(identification) {
  if (!identification || typeof identification !== "object") return {};

  const resolvedName = trimmedOrNull(identification.resolvedName, 200);
  if (!resolvedName) return {};

  const confidence = Number(identification.confidence);
  const alternatives = (Array.isArray(identification.alternatives) ? identification.alternatives : [])
    .map((alternative) => ({
      name: trimmedOrNull(alternative?.name, 200),
      confidence: Math.max(0, Math.min(1, Number(alternative?.confidence) || 0))
    }))
    .filter((alternative) => alternative.name)
    .slice(0, MAX_STORED_ALTERNATIVES);

  return {
    resolvedName,
    resolvedBrand: trimmedOrNull(identification.brand, 80),
    resolvedSize: trimmedOrNull(identification.size, 40),
    resolvedConfidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
    resolvedSource: IDENTIFICATION_SOURCES.has(identification.source)
      ? identification.source
      : "unresolved",
    resolvedReasoning: trimmedOrNull(identification.reasoning, 240),
    resolvedAlternatives: alternatives,
    resolvedAt: new Date()
  };
}
