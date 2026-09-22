import "dotenv/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertCryptoEnv } from "./server/crypto.mjs";
import { createAuth } from "./server/auth.mjs";
import { createBank } from "./server/bank.mjs";
import { registerGemini } from "./server/gemini.mjs";
import { registerItemIdentity } from "./server/item-identity.mjs";
import { identificationFields, normalizeStoredItemCode } from "./server/identification.mjs";
import { createRateLimiter, createSingleFlight } from "./server/rate-limit.mjs";
import { createRateLimitStore, dbRateLimiter } from "./server/rate-limit-db.mjs";
import {
  parseMonthParam,
  getMonthRange,
  getUtcMonthRange,
  getYearRange,
  getUtcYearRange
} from "./server/month.mjs";
import { buildEducationWorkbook, parseExportPeriod, EXPORT_RATE_LIMIT } from "./server/education-export.mjs";
import { summariseReceiptFood } from "./server/food-share.mjs";
import { assertAccessPolicy, maxReceiptsPerUser } from "./server/access.mjs";
import { databaseUrl, isProduction, isVercel } from "./server/deployment.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// True when started as `node server.mjs`. False when imported: by the Vercel
// function in api/index.mjs, where the platform owns the socket and the
// process, so this module only builds the app and must not listen or exit.
const isMain = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

// A configuration problem is fatal either way. As a process, say what is
// wrong and stop; as a module, throw, so the import fails and the platform's
// function logs carry the reason instead of a generic 500.
function fatal(message) {
  if (isMain) {
    console.error(message);
    process.exit(1);
  }
  throw new Error(message);
}

if (!databaseUrl()) {
  fatal("DATABASE_URL is not set. Copy .env.example to .env and start Postgres (npm run db:up).");
}

// Fail fast if the auth/encryption secrets are missing or malformed, or if a
// public deployment would let anyone sign up (see server/access.mjs).
try {
  assertCryptoEnv();
  assertAccessPolicy({ production: isProduction() });
} catch (error) {
  fatal(error.message);
}

// Prisma 7 connects through a driver adapter; swap DATABASE_URL to scale to managed Postgres.
const adapter = new PrismaPg({ connectionString: databaseUrl() });
const prisma = new PrismaClient({ adapter });
const app = express();
const PORT = Number(process.env.PORT) || 4173;

// Behind a reverse proxy, req.ip (used by rate limiting and the login throttle)
// only reflects the real client when Express is told to trust the proxy. Opt in
// explicitly via env so forwarded headers aren't trusted by default (they are
// spoofable when directly exposed). TRUST_PROXY=true, or a hop count / subnet.
//
// On Vercel there is always exactly one proxy in front of the function, and it
// overwrites X-Forwarded-For with the client address rather than appending to
// whatever the client sent, so trusting that one hop is safe and needs no
// configuration.
const trustProxy = process.env.TRUST_PROXY || (isVercel() ? "1" : "");
if (trustProxy) {
  app.set("trust proxy", trustProxy === "true" ? 1 : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
}

// Don't advertise the framework.
app.disable("x-powered-by");

// Baseline security headers (conservative — no CSP, to avoid breaking the
// Plaid Link script and Google Fonts the frontend loads).
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  // Only meaningful (and only honoured by browsers) over TLS. Vercel sets its
  // own; this covers a self-hosted server behind a TLS-terminating proxy.
  if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000");
  next();
});

// Broad limit across the whole API, plus a much stricter limit on the auth
// endpoints to slow credential stuffing and mass account creation.
//
// These run BEFORE any body parser. Mounted after, they could not help: the
// 16mb parser below would have already buffered and JSON.parsed the entire
// body of an unauthenticated request before the limiter or the 401 was
// reached, so a handful of concurrent posts to the Gemini route could exhaust
// memory without so much as a cookie.
// The in-memory limiter is the free first line: no query, and it turns away a
// flood before it reaches the database. It cannot be the only line, because
// each serverless instance keeps its own copy and a cold start forgets it --
// so the routes worth protecting also count in Postgres, shared by every
// instance (see server/rate-limit-db.mjs).
app.use("/api", createRateLimiter({ windowMs: 15 * 60 * 1000, max: 300 }));
const limitStore = createRateLimitStore(prisma);

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many authentication attempts. Try again later."
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// Shared across instances: what actually bounds credential stuffing and mass
// account creation on a public URL.
app.use(
  "/api/auth/login",
  dbRateLimiter(limitStore, {
    bucket: "login",
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: "Too many sign-in attempts. Try again later."
  })
);
// Registration is rarer than login by nature, and each one costs a row that
// counts against MAX_USERS, so it gets a tighter window of its own.
app.use(
  "/api/auth/register",
  dbRateLimiter(limitStore, {
    bucket: "register",
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: "Too many accounts created from here. Try again later."
  })
);

// Identification calls a paid model on the operator's key, and the browser
// will happily fire one per receipt. The blanket /api limit is far too loose
// for a route that costs money per request, so this one gets its own -- tight
// enough to bound a runaway client or a scripted caller, loose enough that a
// person working through a stack of receipts never meets it.
const identifyLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: "Too many identification requests. Give it a minute."
});
const identifyLimiterShared = dbRateLimiter(limitStore, {
  bucket: "identify",
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: "Too many identification requests. Give it a minute."
});

// Receipt parsing is the most expensive route in the app: it accepts the
// largest body of any endpoint (16mb), holds it in memory while base64 is
// decoded, and spends a paid Gemini call per request. The blanket /api limit
// of 300 is far too generous for that -- 300 requests is nearly 5GB of body
// buffering and 300 paid calls per window, per IP.
//
// It went unnoticed while parsing was something a user did once per photo.
// A "Try again" button turns it into something a user can hold down, so the
// route gets a ceiling of its own, well above any real use of the app and far
// below what a stuck retry loop or a script could otherwise spend.
//
// Mounted before the 16mb body parser below, so a refused request is rejected
// without the server ever buffering the image it was carrying.
const parseLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many receipt scans in a row. Give it a minute and try again."
});
app.use("/api/gemini/parse", parseLimiter);
app.use(
  "/api/gemini/parse",
  dbRateLimiter(limitStore, {
    bucket: "parse",
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: "Too many receipt scans in a row. Give it a minute and try again."
  })
);

// The education-expense export is the heaviest read in the app (see
// EXPORT_RATE_LIMIT in server/education-export.mjs for the numbers).
// The in-memory limiter runs before auth, per address, so a flood never gets
// as far as a session lookup. The shared one is counted per account (below,
// on the route itself), so it holds across instances and addresses alike.
app.use("/api/education-expenses/export", createRateLimiter(EXPORT_RATE_LIMIT));
const exportLimiterShared = dbRateLimiter(limitStore, {
  bucket: "export",
  ...EXPORT_RATE_LIMIT,
  keyOf: (req) => req.userId
});
// One export at a time per account on this instance. A second click while the
// first is still building would only do the same work twice.
const exportSingleFlight = createSingleFlight({
  keyOf: (req) => req.userId,
  message: "An export is already being prepared. Wait for it to finish."
});

const auth = createAuth(prisma, limitStore);
const { requireAuth, requireAdmin } = auth;

// Cookies are parsed here rather than inside auth.register() because
// requireAuth reads them, and it now gates a middleware that runs before the
// route table.
app.use(cookieParser());

// Receipt photos arrive as base64 JSON on the Gemini proxy route, so it needs
// a larger body cap than the rest of the API (body-parser skips re-parsing, so
// mounting the bigger limit first scopes it to this path only). requireAuth
// gates the big parser, so only a logged-in user can make the server hold
// 16mb of request body.
app.use("/api/gemini/parse", requireAuth, express.json({ limit: "16mb" }));
// Saving a receipt can carry its photo (downscaled base64, see MAX_IMAGE_CHARS),
// so this route needs more headroom than the rest of the API too.
app.use("/api/receipts", requireAuth, express.json({ limit: "12mb" }));
app.use(express.json({ limit: "2mb" }));

// Routes last, so every request reaching one has been limited and parsed.

// For uptime monitors and the platform's own checks: is the process up, and
// can it reach its database. Says nothing else, to nobody in particular.
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(503).json({ ok: false });
  }
});

auth.register(app);

// Bank routes are admin-only (see server/access.mjs): the Plaid keys are the
// operator's, and a regular account has no bank side at all.
const bank = createBank(prisma);
bank.register(app, requireAuth, requireAdmin);

// Gemini config + image-parsing proxy. Keys (shared or per-user) stay
// server-side and are never returned to the browser (see server/gemini.mjs).
registerGemini(app, requireAuth, prisma);

// Expands abbreviated receipt lines into real product names. Only the lines
// the browser could not resolve for free get this far (see
// src/services/item-identity.service.ts for the tiers in front of it).
registerItemIdentity(app, requireAuth, prisma, [identifyLimiter, identifyLimiterShared]);

// --- API -------------------------------------------------------------------

const toNumber = (value) => (value === null || value === undefined ? null : Number(value));
function serializeReceipt(receipt) {
  return {
    id: receipt.id,
    storeName: receipt.storeName,
    category: receipt.category,
    subtotal: toNumber(receipt.subtotal),
    tax: toNumber(receipt.tax),
    total: toNumber(receipt.total),
    createdAt: receipt.createdAt,
    // The photo itself is fetched separately (GET /api/receipts/:id/image) so
    // the history list stays small; this only says whether there is one.
    hasImage: Boolean(receipt.imageMimeType),
    // The bank transaction this receipt is attached to, if any. History needs
    // it to show that a receipt is already accounted for and to offer the
    // link/unlink action without first loading the whole transaction list.
    linkedTransaction: receipt.linkedTransaction
      ? {
          id: receipt.linkedTransaction.id,
          description: receipt.linkedTransaction.description,
          date: receipt.linkedTransaction.date.toISOString().slice(0, 10),
          amount: toNumber(receipt.linkedTransaction.amount)
        }
      : null,
    people: receipt.people.map((person) => ({
      id: person.accountPersonId,
      name: person.accountPerson.name,
      isSelf: person.accountPerson.isSelf ?? false
    })),
    lines: receipt.lines.map((line) => ({
      id: line.id,
      label: line.label,
      amount: toNumber(line.amount),
      ignored: line.ignored ?? false,
      isFood: line.isFood ?? false,
      itemCode: line.itemCode ?? null,
      // Null rather than a hollow object when nobody has identified the line,
      // so a caller can test the field itself instead of inspecting it.
      identification: line.resolvedName
        ? {
            resolvedName: line.resolvedName,
            brand: line.resolvedBrand,
            size: line.resolvedSize,
            confidence: toNumber(line.resolvedConfidence) ?? 0,
            source: line.resolvedSource ?? "unresolved",
            reasoning: line.resolvedReasoning,
            alternatives: Array.isArray(line.resolvedAlternatives) ? line.resolvedAlternatives : [],
            // Lines saved before identifications existed have a name and no
            // source; treating them as unconfirmed is the safe read.
            confirmed: line.resolvedSource === "user-confirmed"
          }
        : null,
      assignments: line.assignments.map((assignment) => ({
        // The account-level id, matching the ids in `people` above, so a caller
        // can re-run the split without matching people by display name.
        personId: assignment.person?.accountPersonId ?? "",
        personName: assignment.person?.accountPerson?.name ?? "",
        mode: assignment.mode,
        value: toNumber(assignment.value)
      }))
    }))
  };
}

const receiptInclude = {
  people: {
    include: { accountPerson: true }
  },
  linkedTransaction: true,
  lines: {
    orderBy: { sortOrder: "asc" },
    include: { assignments: { include: { person: { include: { accountPerson: true } } } } }
  }
};

// Never load the base64 photo alongside a receipt: it is orders of magnitude
// larger than everything else on the row, and no caller of these endpoints
// needs it (the dedicated image route selects it on its own).
const omitImageData = { imageData: true };

// Upper bounds so a single request can't spawn an unbounded number of rows.
const MAX_LINES = 500;
const MAX_PEOPLE = 100;
const MAX_ASSIGNMENTS = 5000;
const MAX_TEXT_LENGTH = 200;
// DECIMAL(10,2) tops out at 99,999,999.99; stay well inside it.
const MAX_AMOUNT = 1e8;
// Must match Domain.AssignmentMode in src/domain/models.ts.
const ASSIGNMENT_MODES = new Set(["equal", "percentage", "amount"]);
// Receipt photos are stored as base64. The browser downscales before sending
// (see ReceiptImageService), so anything beyond ~8mb of base64 (~6mb of image)
// is well past a legible receipt photo and gets rejected rather than stored.
const MAX_IMAGE_CHARS = 8 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const IMAGE_DATA_URL_RE = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/;

// Splits a data: URL into the pieces the columns hold, or returns null when it
// isn't an image data URL this server is willing to store.
function parseImageDataUrl(value) {
  const match = IMAGE_DATA_URL_RE.exec(value);
  if (!match) return null;
  const [, mimeType, data] = match;
  if (!IMAGE_MIME_TYPES.has(mimeType) || data.length === 0) return null;
  return { mimeType, data };
}

// Thrown from inside the save transaction to roll it back and answer 400.
class BadRequestError extends Error {}

// Only accept values the Decimal columns can actually hold. Infinity (which
// JSON.parse happily produces from 1e999) used to reach Postgres as a numeric
// infinity and come back out of serializeReceipt as null, silently corrupting
// the stored total; anything over the column's range threw a 500 instead.
function isStorableAmount(value) {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) < MAX_AMOUNT;
}

function isShortString(value) {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_TEXT_LENGTH;
}

// Returns an error message, or null when the payload is safe to persist.
// Everything here previously went straight into Prisma, where a wrong type or
// a missing field surfaced as a 500 rather than a 400.
function validateReceiptPayload(body) {
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return "At least one receipt line is required.";
  }
  if (body.people !== undefined && !Array.isArray(body.people)) {
    return "people must be an array.";
  }
  if (body.assignments !== undefined && !Array.isArray(body.assignments)) {
    return "assignments must be an array.";
  }
  if (body.storeName !== null && body.storeName !== undefined && !isShortString(body.storeName)) {
    return "storeName must be a short string.";
  }
  if (body.category !== undefined && body.category !== null && !isShortString(body.category)) {
    return "category must be a short string.";
  }
  for (const field of ["subtotal", "tax", "total"]) {
    const value = body[field];
    if (value !== null && value !== undefined && !isStorableAmount(value)) {
      return `${field} must be a number within range.`;
    }
  }
  for (const line of body.lines) {
    if (!line || typeof line !== "object") return "Each line must be an object.";
    if (!isShortString(line.label)) return "Each line needs a label of 1-200 characters.";
    if (line.amount !== undefined && !isStorableAmount(line.amount)) {
      return "Each line amount must be a number within range.";
    }
  }
  for (const person of body.people ?? []) {
    if (!person || typeof person !== "object") return "Each person must be an object.";
  }
  if (body.imageDataUrl !== null && body.imageDataUrl !== undefined) {
    if (typeof body.imageDataUrl !== "string" || !parseImageDataUrl(body.imageDataUrl)) {
      return "imageDataUrl must be a base64 JPEG, PNG, or WebP data URL.";
    }
    if (body.imageDataUrl.length > MAX_IMAGE_CHARS) {
      return "The receipt image is too large.";
    }
  }
  const seenPairs = new Set();
  for (const assignment of body.assignments ?? []) {
    if (!assignment || typeof assignment !== "object") return "Each assignment must be an object.";
    if (assignment.mode !== undefined && !ASSIGNMENT_MODES.has(assignment.mode)) {
      return "Unknown assignment mode.";
    }
    if (assignment.value !== undefined && !isStorableAmount(assignment.value)) {
      return "Each assignment value must be a number within range.";
    }
    // One share per person per line — matches the unique constraint, so a
    // repeated pair answers 400 rather than tripping a database error.
    const pair = `${assignment.lineClientId}\u0000${assignment.personClientId}`;
    if (seenPairs.has(pair)) return "A line cannot be assigned to the same person twice.";
    seenPairs.add(pair);
  }
  return null;
}

function isReceiptTooLarge(body) {
  return (
    body.lines.length > MAX_LINES ||
    (body.people ?? []).length > MAX_PEOPLE ||
    (body.assignments ?? []).length > MAX_ASSIGNMENTS
  );
}

// Writes a receipt's people, lines and assignments. Shared by create and
// update, so an edited receipt is checked and stored exactly like a new one.
// Throws BadRequestError to roll the surrounding transaction back.
async function writeReceiptContents(tx, receiptId, userId, body) {
  // Map clientId to accountPersonId; person.clientId now refers to accountPersonId
  const personByClient = new Map();
  const seenAccountPersonIds = new Set();
  for (const person of body.people ?? []) {
    // Prevent duplicate people in a single receipt
    if (seenAccountPersonIds.has(person.clientId)) {
      throw new BadRequestError("A person cannot appear twice in the same receipt.");
    }
    seenAccountPersonIds.add(person.clientId);

    // Verify the accountPerson exists and belongs to this user
    const accountPerson = await tx.accountPerson.findUnique({
      where: { id: person.clientId }
    });
    if (!accountPerson || accountPerson.userId !== userId) {
      throw new BadRequestError("Invalid person reference.");
    }
    // Create a Person record that references the AccountPerson
    const created = await tx.person.create({
      data: { receiptId, accountPersonId: person.clientId }
    });
    personByClient.set(person.clientId, created.id);
  }

  const lineByClient = new Map();
  let sortOrder = 0;
  for (const line of body.lines) {
    const created = await tx.receiptLine.create({
      data: {
        receiptId,
        label: line.label,
        amount: line.amount ?? 0,
        ignored: Boolean(line.ignored),
        isFood: Boolean(line.isFood),
        itemCode: normalizeStoredItemCode(line.itemCode),
        sortOrder: sortOrder++,
        ...identificationFields(line.identification)
      }
    });
    lineByClient.set(line.clientId, created.id);
  }

  const assignmentData = (body.assignments ?? []).map((assignment) => ({
    lineId: lineByClient.get(assignment.lineClientId),
    personId: personByClient.get(assignment.personClientId),
    mode: assignment.mode ?? "equal",
    value: assignment.value ?? 0
  }));
  // An assignment pointing at a line or person that isn't in this payload
  // used to be dropped here, so the caller got a 201 for a receipt that had
  // quietly lost some of its splits. Fail the whole save instead; the
  // transaction rolls back and the client can say something went wrong.
  if (assignmentData.some((assignment) => !assignment.lineId || !assignment.personId)) {
    throw new BadRequestError("An assignment referenced an unknown line or person.");
  }

  if (assignmentData.length > 0) {
    await tx.lineAssignment.createMany({ data: assignmentData });
  }
}

app.post("/api/receipts", requireAuth, async (req, res) => {
  const body = req.body ?? {};
  const invalid = validateReceiptPayload(body);
  if (invalid) {
    return res.status(400).json({ error: invalid });
  }
  if (isReceiptTooLarge(body)) {
    return res.status(413).json({ error: "Receipt is too large." });
  }

  const image = body.imageDataUrl ? parseImageDataUrl(body.imageDataUrl) : null;

  try {
    // A non-admin account keeps a bounded number of receipts (see
    // server/access.mjs). Receipts carry photos, so this is what actually
    // bounds the database on an instance anyone can join. Only creation is
    // capped: editing a saved receipt (PUT below) adds nothing, so a user at
    // the limit can still fix what they have.
    if (!req.isAdmin) {
      const limit = maxReceiptsPerUser();
      const saved = await prisma.receipt.count({ where: { userId: req.userId } });
      if (saved >= limit) {
        return res.status(403).json({
          error: `You have reached the limit of ${limit} saved receipts. Delete one to save another.`
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.create({
        data: {
          userId: req.userId,
          storeName: body.storeName ?? null,
          category: body.category ?? "Other",
          subtotal: body.subtotal ?? null,
          tax: body.tax ?? null,
          total: body.total ?? null,
          imageData: image?.data ?? null,
          imageMimeType: image?.mimeType ?? null
        }
      });

      await writeReceiptContents(tx, receipt.id, req.userId, body);

      return tx.receipt.findUnique({
        where: { id: receipt.id },
        omit: omitImageData,
        include: receiptInclude
      });
    });

    res.status(201).json(serializeReceipt(result));
  } catch (error) {
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Failed to save receipt:", error);
    res.status(500).json({ error: "Failed to save receipt." });
  }
});

// Rewrites a saved receipt with what the Split tab now holds, when it has been
// reopened from History to fix a mistake.
//
// Updated in place rather than deleted and saved again: the receipt keeps its
// id, so a bank transaction linked to it stays linked, and its createdAt, so it
// stays in the budget month it was first saved in. Its people and lines are
// replaced whole, and their assignments go with them (onDelete: Cascade).
//
// The photo is only touched when a new one is sent. The browser never holds
// the stored image, so a null imageDataUrl means "unchanged", not "remove it".
app.put("/api/receipts/:id", requireAuth, async (req, res) => {
  const body = req.body ?? {};
  const invalid = validateReceiptPayload(body);
  if (invalid) {
    return res.status(400).json({ error: invalid });
  }
  if (isReceiptTooLarge(body)) {
    return res.status(413).json({ error: "Receipt is too large." });
  }

  const image = body.imageDataUrl ? parseImageDataUrl(body.imageDataUrl) : null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Scoped to the caller, so one user can't overwrite another's receipt.
      const existing = await tx.receipt.findFirst({
        where: { id: req.params.id, userId: req.userId },
        select: { id: true }
      });
      if (!existing) return null;

      await tx.receipt.update({
        where: { id: existing.id },
        data: {
          storeName: body.storeName ?? null,
          category: body.category ?? "Other",
          subtotal: body.subtotal ?? null,
          tax: body.tax ?? null,
          total: body.total ?? null,
          ...(image ? { imageData: image.data, imageMimeType: image.mimeType } : {})
        },
        // Otherwise the update hands back the base64 photo it just left alone.
        select: { id: true }
      });
      await tx.person.deleteMany({ where: { receiptId: existing.id } });
      await tx.receiptLine.deleteMany({ where: { receiptId: existing.id } });
      await writeReceiptContents(tx, existing.id, req.userId, body);

      return tx.receipt.findUnique({
        where: { id: existing.id },
        omit: omitImageData,
        include: receiptInclude
      });
    });

    if (!result) {
      return res.status(404).json({ error: "Receipt not found." });
    }
    res.json(serializeReceipt(result));
  } catch (error) {
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Failed to update receipt:", error);
    res.status(500).json({ error: "Failed to update receipt." });
  }
});

// The saved receipt photo, decoded back to binary. Scoped to the caller, and
// deliberately not served from a static directory: the image can show a card's
// last four, a loyalty number, or a home address, so it stays behind the
// session cookie and out of shared caches.
app.get("/api/receipts/:id/image", requireAuth, async (req, res) => {
  try {
    const receipt = await prisma.receipt.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { imageData: true, imageMimeType: true }
    });
    if (!receipt?.imageData || !receipt.imageMimeType) {
      return res.status(404).json({ error: "No image for this receipt." });
    }
    res.setHeader("Content-Type", receipt.imageMimeType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Content-Disposition", "inline");
    res.send(Buffer.from(receipt.imageData, "base64"));
  } catch (error) {
    console.error("Failed to load receipt image:", error);
    res.status(500).json({ error: "Failed to load receipt image." });
  }
});

app.delete("/api/receipts/:id", requireAuth, async (req, res) => {
  try {
    // Scope the delete to the caller so one user can't remove another's
    // receipt. Cascades to lines, people, and assignments (see schema).
    const result = await prisma.receipt.deleteMany({
      where: { id: req.params.id, userId: req.userId }
    });
    if (result.count === 0) {
      return res.status(404).json({ error: "Receipt not found." });
    }
    res.status(204).end();
  } catch (error) {
    console.error("Failed to delete receipt:", error);
    res.status(500).json({ error: "Failed to delete receipt." });
  }
});

app.get("/api/receipts", requireAuth, async (req, res) => {
  try {
    const receipts = await prisma.receipt.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      omit: omitImageData,
      include: receiptInclude
    });
    res.json(receipts.map(serializeReceipt));
  } catch (error) {
    console.error("Failed to list receipts:", error);
    res.status(500).json({ error: "Failed to load receipts." });
  }
});

// The account owner's own participant row. A receipt split three ways should
// only put a third of the bill in the owner's budget, which needs them to be
// one of the people it is split between. Created on first use rather than at
// signup so existing accounts pick one up too.
async function ensureSelfPerson(userId) {
  const existing = await prisma.accountPerson.findFirst({
    where: { userId, isSelf: true }
  });
  if (existing) return existing;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true }
  });
  // Fall back through name, the local part of the email, then a plain label:
  // the column is only unique per user, so a collision with a person the user
  // already added by the same name is the one case that needs a distinct name.
  const preferred = (user?.name ?? "").trim() || (user?.email ?? "").split("@")[0].trim() || "Me";
  const candidates = [preferred, `${preferred} (me)`, "Me", "Myself"];

  for (const name of candidates) {
    const taken = await prisma.accountPerson.findUnique({
      where: { userId_name: { userId, name } }
    });
    if (taken) {
      // An ordinary person already holds this name; promote it rather than
      // leaving the user with two rows that mean the same person.
      if (name === preferred) {
        return prisma.accountPerson.update({ where: { id: taken.id }, data: { isSelf: true } });
      }
      continue;
    }
    return prisma.accountPerson.create({ data: { userId, name, isSelf: true } });
  }

  // Every candidate was taken by someone else; fall back to a unique suffix.
  return prisma.accountPerson.create({
    data: { userId, name: `Me ${Date.now().toString(36)}`, isSelf: true }
  });
}

const serializeAccountPerson = (person) => ({
  id: person.id,
  name: person.name,
  isSelf: person.isSelf ?? false
});

// GET /api/people - list all account people for the user
app.get("/api/people", requireAuth, async (req, res) => {
  try {
    await ensureSelfPerson(req.userId);
    const people = await prisma.accountPerson.findMany({
      where: { userId: req.userId },
      orderBy: [{ isSelf: "desc" }, { name: "asc" }]
    });
    res.json(people.map(serializeAccountPerson));
  } catch (error) {
    console.error("Failed to list people:", error);
    res.status(500).json({ error: "Failed to load people." });
  }
});

// POST /api/people - add a new person for the user (max 10)
app.post("/api/people", requireAuth, async (req, res) => {
  const body = req.body ?? {};
  const name = (body.name ?? "").trim();

  if (!name || name.length === 0 || name.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: "Name must be 1-200 characters." });
  }

  try {
    // Check current count
    const count = await prisma.accountPerson.count({
      where: { userId: req.userId }
    });
    if (count >= 10) {
      return res.status(400).json({ error: "You can only add up to 10 people." });
    }

    // Create or update (upsert) based on unique constraint
    const person = await prisma.accountPerson.upsert({
      where: { userId_name: { userId: req.userId, name } },
      update: {},
      create: { userId: req.userId, name }
    });

    res.status(201).json(serializeAccountPerson(person));
  } catch (error) {
    console.error("Failed to add person:", error);
    res.status(500).json({ error: "Failed to add person." });
  }
});

// DELETE /api/people/:id - delete a person
app.delete("/api/people/:id", requireAuth, async (req, res) => {
  try {
    // Verify the person belongs to the user before deleting
    const person = await prisma.accountPerson.findUnique({
      where: { id: req.params.id }
    });

    if (!person) {
      return res.status(404).json({ error: "Person not found." });
    }

    if (person.userId !== req.userId) {
      return res.status(403).json({ error: "Unauthorized." });
    }

    // Removing yourself would leave past splits with a share belonging to
    // nobody, and there would be no way to get the row back.
    if (person.isSelf) {
      return res.status(400).json({ error: "You can't remove yourself from the people list." });
    }

    // Delete the person (cascades to Person records and their assignments)
    await prisma.accountPerson.delete({
      where: { id: req.params.id }
    });

    res.status(204).end();
  } catch (error) {
    console.error("Failed to delete person:", error);
    res.status(500).json({ error: "Failed to delete person." });
  }
});

// GET /api/people/search?q=... - search for people
app.get("/api/people/search", requireAuth, async (req, res) => {
  const query = (req.query.q ?? "").trim();

  if (!query || query.length === 0) {
    return res.json([]);
  }

  try {
    const people = await prisma.accountPerson.findMany({
      where: {
        userId: req.userId,
        name: {
          contains: query,
          mode: "insensitive"
        }
      },
      orderBy: { name: "asc" },
      take: 10
    });

    res.json(people.map((person) => ({ id: person.id, name: person.name })));
  } catch (error) {
    console.error("Failed to search people:", error);
    res.status(500).json({ error: "Failed to search people." });
  }
});

// --- 529 Education Expenses Tracking (Food/Rent) ----------------------------
// Month helpers live in server/month.mjs so unit tests can import them
// without booting the server.

// Helper: serialize ReceiptLine with isFood
function serializeReceiptLineWithFood(line) {
  return {
    id: line.id,
    label: line.label,
    amount: toNumber(line.amount),
    isFood: line.isFood,
    ignored: line.ignored,
    sortOrder: line.sortOrder,
    assignments: line.assignments.map((assignment) => ({
      personName: assignment.person?.accountPerson?.name ?? "",
      mode: assignment.mode,
      value: toNumber(assignment.value)
    }))
  };
}

// Helper: serialize RentEntry
function serializeRentEntry(entry) {
  return {
    id: entry.id,
    year: entry.year,
    month: entry.month,
    amount: toNumber(entry.amount),
    propertyName: entry.propertyName,
    date: entry.date.toISOString().slice(0, 10),
    hasPhoto: Boolean(entry.photoMimeType),
    bankTransactionId: entry.bankTransactionId ?? null,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

// PATCH /api/receipts/:receiptId/lines/:lineId - Update receipt line's isFood flag
app.patch("/api/receipts/:receiptId/lines/:lineId", requireAuth, async (req, res) => {
  const body = req.body ?? {};

  if (typeof body.isFood !== "boolean") {
    return res.status(400).json({ error: "isFood must be a boolean." });
  }

  try {
    // Verify receipt belongs to user
    const receipt = await prisma.receipt.findFirst({
      where: { id: req.params.receiptId, userId: req.userId },
      select: { id: true }
    });

    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found." });
    }

    // Verify line belongs to this receipt
    const line = await prisma.receiptLine.findFirst({
      where: { id: req.params.lineId, receiptId: req.params.receiptId },
      include: { assignments: { include: { person: { include: { accountPerson: true } } } } }
    });

    if (!line) {
      return res.status(404).json({ error: "Receipt line not found." });
    }

    // Update the line
    const updated = await prisma.receiptLine.update({
      where: { id: req.params.lineId },
      data: { isFood: body.isFood },
      include: { assignments: { include: { person: { include: { accountPerson: true } } } } }
    });

    res.json(serializeReceiptLineWithFood(updated));
  } catch (error) {
    console.error("Failed to update receipt line:", error);
    res.status(500).json({ error: "Failed to update receipt line." });
  }
});

// GET /api/receipts/food-summary?month=YYYY-MM - Get food spending totals
//
// Reports what the account owner spent on food, not what the food cost. A line
// split with friends counts only for the owner's share, and a line assigned
// wholly to someone else does not count at all -- they are paying for it.
// Results are grouped per receipt so the budgeting view can show one compact
// row per shop and keep the individual items behind a disclosure.
app.get("/api/receipts/food-summary", requireAuth, async (req, res) => {
  try {
    let window = null;
    if (req.query.month) {
      const parsed = parseMonthParam(req.query.month);
      if (!parsed) {
        return res.status(400).json({ error: "month must be in YYYY-MM format." });
      }
      window = {
        local: getMonthRange(parsed.year, parsed.month),
        utc: getUtcMonthRange(parsed.year, parsed.month)
      };
    }

    const { foodTotal, foodReceipts, foodTransactions } = await loadFoodSummary(req, window);
    res.json({
      foodTotal,
      // The photo's type is only for the spreadsheet export; the list only
      // needs to know whether there is one.
      foodReceipts: foodReceipts.map(({ imageMimeType: _mimeType, ...group }) => group),
      foodTransactions
    });
  } catch (error) {
    console.error("Failed to get food summary:", error);
    res.status(500).json({ error: "Failed to get food summary." });
  }
});

// The owner's food spending, per receipt and per food-flagged bank
// transaction, shared by the food summary and the spreadsheet export so the
// two can never disagree. `window` is null for all time, or `{ local, utc }`
// half-open ranges: receipts are timestamps recorded by this server (local),
// while bank transaction dates are calendar dates stored as UTC midnight (see
// server/bank.mjs), so their window must be UTC — a local-time window would
// clip the first or last day of the period.
async function loadFoodSummary(req, window) {
  const receiptWhere = { userId: req.userId, lines: { some: { isFood: true, ignored: false } } };
  const txnWhere = { isFood: true, account: { connection: { userId: req.userId } } };
  if (window) {
    receiptWhere.createdAt = { gte: window.local.start, lt: window.local.end };
    txnWhere.date = { gte: window.utc.start, lt: window.utc.end };
  }

  const [selfPerson, receipts, foodTxns] = await Promise.all([
    prisma.accountPerson.findFirst({ where: { userId: req.userId, isSelf: true } }),
    prisma.receipt.findMany({
      where: receiptWhere,
      select: {
        id: true,
        storeName: true,
        createdAt: true,
        tax: true,
        imageMimeType: true,
        lines: {
          select: {
            id: true,
            label: true,
            amount: true,
            ignored: true,
            isFood: true,
            assignments: {
              select: {
                mode: true,
                value: true,
                person: { select: { accountPersonId: true, accountPerson: { select: { name: true } } } }
              }
            }
          },
          orderBy: { sortOrder: "asc" }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    // The bank side is admin-only, so a regular account's total is its
    // receipts alone; an account demoted from admin keeps its rows but stops
    // counting them.
    req.isAdmin ? prisma.bankTransaction.findMany({ where: txnWhere, orderBy: { date: "desc" } }) : []
  ]);

  const selfAccountPersonId = selfPerson?.id ?? null;
  const foodReceipts = receipts
    .map((receipt) => ({
      ...summariseReceiptFood(
        {
          id: receipt.id,
          storeName: receipt.storeName,
          date: receipt.createdAt.toISOString().slice(0, 10),
          tax: toNumber(receipt.tax),
          lines: receipt.lines.map((line) => ({
            id: line.id,
            label: line.label,
            amount: toNumber(line.amount),
            ignored: line.ignored,
            isFood: line.isFood,
            assignments: line.assignments.map((assignment) => ({
              accountPersonId: assignment.person.accountPersonId,
              name: assignment.person.accountPerson.name,
              mode: assignment.mode,
              value: toNumber(assignment.value)
            }))
          }))
        },
        selfAccountPersonId
      ),
      hasImage: Boolean(receipt.imageMimeType),
      imageMimeType: receipt.imageMimeType ?? null
    }))
    // A receipt whose food was all assigned to other people leaves nothing
    // behind, so it should not sit in the list as an empty $0.00 row.
    .filter((group) => group.items.length > 0);

  // Outflows are stored negative and inflows positive (see server/bank.mjs),
  // so negating gives a food-spend figure: money spent on food becomes a
  // positive amount, while an inflow flagged as food -- a friend Zelling back
  // their share of a meal -- becomes negative and offsets that spend. Taking
  // the absolute value here would have counted reimbursements as extra
  // spending instead of crediting them back.
  const foodTransactions = foodTxns.map((txn) => ({
    transactionId: txn.id,
    description: txn.description,
    amount: -Number(txn.amount),
    date: txn.date.toISOString().slice(0, 10)
  }));

  const foodTotal =
    foodReceipts.reduce((sum, group) => sum + group.total, 0) +
    foodTransactions.reduce((sum, txn) => sum + txn.amount, 0);

  return { foodTotal, foodReceipts, foodTransactions };
}

// PATCH /api/receipts/:receiptId/link-transaction - Link receipt to bank transaction
app.patch("/api/receipts/:receiptId/link-transaction", requireAuth, requireAdmin, async (req, res) => {
  const body = req.body ?? {};
  const bankTransactionId = String(body.bankTransactionId ?? "").trim();

  if (!bankTransactionId) {
    return res.status(400).json({ error: "bankTransactionId is required." });
  }

  try {
    // Verify receipt belongs to user
    const receipt = await prisma.receipt.findFirst({
      where: { id: req.params.receiptId, userId: req.userId },
      select: { id: true }
    });

    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found." });
    }

    // Verify transaction belongs to user and check 1:1 constraint
    const transaction = await prisma.bankTransaction.findFirst({
      where: { id: bankTransactionId },
      include: { account: { include: { connection: { select: { userId: true } } } } }
    });

    if (!transaction) {
      return res.status(404).json({ error: "Bank transaction not found." });
    }

    if (transaction.account?.connection?.userId !== req.userId) {
      return res.status(403).json({ error: "Unauthorized." });
    }

    // Check if transaction is already linked to a different receipt
    if (transaction.linkedReceiptId && transaction.linkedReceiptId !== req.params.receiptId) {
      return res.status(400).json({ error: "This transaction is already linked to another receipt." });
    }

    // Update the transaction with the linked receipt
    const updated = await prisma.bankTransaction.update({
      where: { id: bankTransactionId },
      data: { linkedReceiptId: req.params.receiptId },
      include: { account: { select: { name: true, lastFour: true } } }
    });

    res.json({
      id: updated.id,
      date: updated.date.toISOString().slice(0, 10),
      description: updated.description,
      amount: toNumber(updated.amount),
      category: updated.category,
      account: updated.account?.name ?? null,
      linkedReceiptId: updated.linkedReceiptId
    });
  } catch (error) {
    console.error("Failed to link transaction:", error);
    res.status(500).json({ error: "Failed to link transaction." });
  }
});

// DELETE /api/receipts/:receiptId/link-transaction - Unlink receipt from transaction
app.delete("/api/receipts/:receiptId/link-transaction", requireAuth, requireAdmin, async (req, res) => {
  try {
    // Verify receipt belongs to user
    const receipt = await prisma.receipt.findFirst({
      where: { id: req.params.receiptId, userId: req.userId },
      select: { id: true }
    });

    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found." });
    }

    // Find the transaction linked to this receipt
    const transaction = await prisma.bankTransaction.findFirst({
      where: { linkedReceiptId: req.params.receiptId },
      include: { account: { include: { connection: { select: { userId: true } } } } }
    });

    if (!transaction) {
      return res.status(404).json({ error: "No linked transaction found." });
    }

    // Verify transaction belongs to user
    if (transaction.account?.connection?.userId !== req.userId) {
      return res.status(403).json({ error: "Unauthorized." });
    }

    // Clear the link
    await prisma.bankTransaction.update({
      where: { id: transaction.id },
      data: { linkedReceiptId: null }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Failed to unlink transaction:", error);
    res.status(500).json({ error: "Failed to unlink transaction." });
  }
});

// POST /api/rent-entries - Create rent entry
app.post("/api/rent-entries", requireAuth, async (req, res) => {
  const body = req.body ?? {};
  const { month, year, amount, propertyName, date, photoDataUrl, bankTransactionId } = body;

  // Validate required fields
  if (typeof month !== "number" || month < 1 || month > 12) {
    return res.status(400).json({ error: "month must be a number between 1 and 12." });
  }
  if (typeof year !== "number" || year < 2000 || year > 2100) {
    return res.status(400).json({ error: "year must be a valid year." });
  }
  if (!isStorableAmount(amount)) {
    return res.status(400).json({ error: "amount must be a number within range." });
  }
  if (date !== undefined && date !== null && typeof date !== "string") {
    return res.status(400).json({ error: "date must be a valid ISO string." });
  }
  if (propertyName !== undefined && propertyName !== null && !isShortString(propertyName)) {
    return res.status(400).json({ error: "propertyName must be a short string." });
  }
  if (bankTransactionId !== undefined && bankTransactionId !== null && !isShortString(bankTransactionId)) {
    return res.status(400).json({ error: "bankTransactionId must be a short string." });
  }
  // A rent entry backed by a bank transaction is a bank feature, so admin-only;
  // a rent entry typed in by hand is for everyone.
  if (bankTransactionId && !req.isAdmin) {
    return res.status(403).json({ error: "Only admin accounts can log rent from a bank transaction." });
  }

  const photo = photoDataUrl ? parseImageDataUrl(photoDataUrl) : null;
  if (photoDataUrl && !photo) {
    return res.status(400).json({ error: "photoDataUrl must be a base64 JPEG, PNG, WebP, or PDF data URL." });
  }
  if (photoDataUrl && photoDataUrl.length > MAX_IMAGE_CHARS) {
    return res.status(400).json({ error: "The photo is too large." });
  }

  try {
    // A transaction may only back a rent entry if it is the caller's own, so a
    // guessed id cannot attach someone else's spending to this account.
    if (bankTransactionId) {
      const owned = await prisma.bankTransaction.findFirst({
        where: { id: bankTransactionId, account: { connection: { userId: req.userId } } },
        select: { id: true }
      });
      if (!owned) {
        return res.status(404).json({ error: "Bank transaction not found." });
      }
      const alreadyLogged = await prisma.rentEntry.findUnique({
        where: { bankTransactionId },
        select: { id: true }
      });
      if (alreadyLogged) {
        return res.status(400).json({ error: "This transaction is already logged as rent." });
      }
    }

    // Check unique constraint: (userId, year, month)
    const existing = await prisma.rentEntry.findUnique({
      where: { userId_year_month: { userId: req.userId, year, month } }
    });

    if (existing) {
      return res.status(400).json({ error: "A rent entry already exists for this month." });
    }

    const entryDate = date ? new Date(date) : new Date(year, month - 1, 1);

    const created = await prisma.rentEntry.create({
      data: {
        userId: req.userId,
        year,
        month,
        amount,
        propertyName: propertyName ?? null,
        date: entryDate,
        photoData: photo?.data ?? null,
        photoMimeType: photo?.mimeType ?? null,
        bankTransactionId: bankTransactionId || null
      }
    });

    res.status(201).json(serializeRentEntry(created));
  } catch (error) {
    console.error("Failed to create rent entry:", error);
    res.status(500).json({ error: "Failed to create rent entry." });
  }
});

// GET /api/rent-entries?month=YYYY-MM - List rent entries
app.get("/api/rent-entries", requireAuth, async (req, res) => {
  try {
    let whereClause = { userId: req.userId };

    // Optional month filter
    if (req.query.month) {
      const parsed = parseMonthParam(req.query.month);
      if (!parsed) {
        return res.status(400).json({ error: "month must be in YYYY-MM format." });
      }
      whereClause.year = parsed.year;
      whereClause.month = parsed.month;
    }

    const entries = await prisma.rentEntry.findMany({
      where: whereClause,
      orderBy: [{ year: "desc" }, { month: "desc" }],
      omit: { photoData: true }
    });

    res.json(entries.map(serializeRentEntry));
  } catch (error) {
    console.error("Failed to list rent entries:", error);
    res.status(500).json({ error: "Failed to load rent entries." });
  }
});

// PATCH /api/rent-entries/:entryId - Update rent entry
app.patch("/api/rent-entries/:entryId", requireAuth, async (req, res) => {
  const body = req.body ?? {};

  try {
    // Verify entry belongs to user
    const entry = await prisma.rentEntry.findFirst({
      where: { id: req.params.entryId, userId: req.userId }
    });

    if (!entry) {
      return res.status(404).json({ error: "Rent entry not found." });
    }

    // Validate fields that are provided
    const updateData = {};

    if (body.amount !== undefined) {
      if (!isStorableAmount(body.amount)) {
        return res.status(400).json({ error: "amount must be a number within range." });
      }
      updateData.amount = body.amount;
    }

    if (body.propertyName !== undefined) {
      if (body.propertyName !== null && !isShortString(body.propertyName)) {
        return res.status(400).json({ error: "propertyName must be a short string." });
      }
      updateData.propertyName = body.propertyName;
    }

    if (body.date !== undefined && body.date !== null) {
      // The month/year columns must follow the date, or an entry moved to a
      // different month would keep counting under its old one.
      const match = typeof body.date === "string" && /^(\d{4})-(\d{2})-(\d{2})/.exec(body.date);
      if (!match) {
        return res.status(400).json({ error: "date must be a valid ISO string." });
      }
      updateData.date = new Date(body.date);
      updateData.year = parseInt(match[1], 10);
      updateData.month = parseInt(match[2], 10);
      if (updateData.month < 1 || updateData.month > 12) {
        return res.status(400).json({ error: "date must contain a valid month." });
      }
    }

    if (body.photoDataUrl !== undefined && body.photoDataUrl !== null) {
      const photo = parseImageDataUrl(body.photoDataUrl);
      if (!photo) {
        return res.status(400).json({ error: "photoDataUrl must be a base64 JPEG, PNG, WebP, or PDF data URL." });
      }
      if (body.photoDataUrl.length > MAX_IMAGE_CHARS) {
        return res.status(400).json({ error: "The photo is too large." });
      }
      updateData.photoData = photo.data;
      updateData.photoMimeType = photo.mimeType;
    }

    // Handle removing photo
    if (body.photoDataUrl === null) {
      updateData.photoData = null;
      updateData.photoMimeType = null;
    }

    if (Object.keys(updateData).length === 0) {
      // Nothing to update
      return res.json(serializeRentEntry(entry));
    }

    const updated = await prisma.rentEntry.update({
      where: { id: req.params.entryId },
      data: updateData
    });

    res.json(serializeRentEntry(updated));
  } catch (error) {
    // P2002 = unique (userId, year, month) — the entry was moved into a month
    // that already has one.
    if (error?.code === "P2002") {
      return res.status(400).json({ error: "A rent entry already exists for this month." });
    }
    console.error("Failed to update rent entry:", error);
    res.status(500).json({ error: "Failed to update rent entry." });
  }
});

// DELETE /api/rent-entries/:entryId - Delete rent entry
app.delete("/api/rent-entries/:entryId", requireAuth, async (req, res) => {
  try {
    const result = await prisma.rentEntry.deleteMany({
      where: { id: req.params.entryId, userId: req.userId }
    });

    if (result.count === 0) {
      return res.status(404).json({ error: "Rent entry not found." });
    }

    res.status(204).end();
  } catch (error) {
    console.error("Failed to delete rent entry:", error);
    res.status(500).json({ error: "Failed to delete rent entry." });
  }
});

// GET /api/rent-entries/summary?month=YYYY-MM - Get rent spending summary
app.get("/api/rent-entries/summary", requireAuth, async (req, res) => {
  try {
    let whereClause = { userId: req.userId };

    // Optional month filter
    if (req.query.month) {
      const parsed = parseMonthParam(req.query.month);
      if (!parsed) {
        return res.status(400).json({ error: "month must be in YYYY-MM format." });
      }
      whereClause.year = parsed.year;
      whereClause.month = parsed.month;
    }

    const entries = await prisma.rentEntry.findMany({
      where: whereClause,
      orderBy: [{ year: "desc" }, { month: "desc" }],
      omit: { photoData: true }
    });

    const rentTotal = entries.reduce((sum, entry) => sum + Number(entry.amount), 0);

    res.json({
      rentTotal,
      entries: entries.map(serializeRentEntry)
    });
  } catch (error) {
    console.error("Failed to get rent summary:", error);
    res.status(500).json({ error: "Failed to get rent summary." });
  }
});

// GET /api/education-expenses/export?month=YYYY-MM | ?year=YYYY
//
// The food and rent behind the education-expense totals, as an .xlsx with each
// receipt and rent proof photo embedded beside its row. Exactly one of month
// or year picks the period.

// Photos are the bulk of the file. Vercel refuses a function response over
// 4.5 MB, so there the budget leaves room for the sheets themselves; a
// self-hosted server has no such cap and can carry a year of photos.
const EXPORT_PHOTO_BUDGET = isVercel() ? 3.5 * 1024 * 1024 : 40 * 1024 * 1024;

app.get("/api/education-expenses/export", requireAuth, exportLimiterShared, exportSingleFlight, async (req, res) => {
  const period = parseExportPeriod(req.query);
  if (period.error) {
    return res.status(400).json({ error: period.error });
  }

  try {
    const window =
      period.kind === "month"
        ? { local: getMonthRange(period.year, period.month), utc: getUtcMonthRange(period.year, period.month) }
        : { local: getYearRange(period.year), utc: getUtcYearRange(period.year) };
    const rentWhere = { userId: req.userId, year: period.year };
    if (period.kind === "month") rentWhere.month = period.month;

    const [food, rentEntries] = await Promise.all([
      loadFoodSummary(req, window),
      prisma.rentEntry.findMany({ where: rentWhere, omit: { photoData: true } })
    ]);

    // Photos are fetched one at a time as the workbook reaches them, scoped
    // to this account, rather than loading every photo in the period up front.
    const { buffer } = await buildEducationWorkbook({
      period,
      foodReceipts: food.foodReceipts,
      foodTransactions: food.foodTransactions,
      rentEntries: rentEntries.map((entry) => ({
        id: entry.id,
        year: entry.year,
        month: entry.month,
        date: entry.date.toISOString().slice(0, 10),
        amount: toNumber(entry.amount),
        propertyName: entry.propertyName,
        photoMimeType: entry.photoMimeType
      })),
      loadReceiptImage: async (id) => {
        const receipt = await prisma.receipt.findFirst({
          where: { id, userId: req.userId },
          select: { imageData: true, imageMimeType: true }
        });
        return receipt?.imageData ? { data: receipt.imageData, mimeType: receipt.imageMimeType } : null;
      },
      loadRentPhoto: async (id) => {
        const entry = await prisma.rentEntry.findFirst({
          where: { id, userId: req.userId },
          select: { photoData: true, photoMimeType: true }
        });
        return entry?.photoData ? { data: entry.photoData, mimeType: entry.photoMimeType } : null;
      },
      maxPhotoBytes: EXPORT_PHOTO_BUDGET
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${period.fileName}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  } catch (error) {
    console.error("Failed to export education expenses:", error);
    res.status(500).json({ error: "Failed to export education expenses." });
  }
});

// --- Static frontend -------------------------------------------------------

// A request under /api that no route claimed is answered here, as JSON, and
// never falls through to the static handler's HTML 404.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found." });
});

// Only public/ is ever served: the page, its stylesheets and the compiled
// bundle. Source, server code, config and dependencies all live outside it,
// so there is nothing to block -- which is the whole reason for the
// directory. On Vercel the CDN serves it and this handler is never reached
// (see vercel.json); dotfiles: "ignore" keeps any stray dotfile a 404 here.
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir, { dotfiles: "ignore", index: "index.html" }));

// Anything else is a page that does not exist. Vercel serves public/404.html
// for these on its own; this is the same answer when the server is hosting the
// files itself, so a self-hosted deployment does not fall through to Express's
// bare text 404.
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  res.status(404).sendFile(path.join(publicDir, "404.html"), (error) => {
    if (error) res.status(404).type("txt").send("Not found");
  });
});

// Terminal error handler. Without one, Express's default handler renders the
// stack trace into the response whenever NODE_ENV isn't "production" — so
// malformed JSON, an oversized body, or any unhandled rejection in a route
// handed the caller absolute file paths and internal error text. Log the
// detail, return a flat message.
app.use((error, _req, res, _next) => {
  console.error("Unhandled request error:", error);
  if (res.headersSent) return;
  const status = Number(error?.status || error?.statusCode) || 500;
  // Body-parser's own 4xx (bad JSON, payload too large) are the caller's
  // fault and safe to name; everything else stays opaque.
  const message = status >= 400 && status < 500 ? "Invalid request." : "Internal server error.";
  res.status(status).json({ error: message });
});

// Exported for the Vercel function (api/index.mjs). Run directly, it listens.
export default app;

if (isMain) {
  app.listen(PORT, () => {
    console.log(`Receipt Ring running at http://localhost:${PORT}`);
  });
}
