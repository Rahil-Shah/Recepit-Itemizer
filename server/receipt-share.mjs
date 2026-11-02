// Public links to a receipt, for showing it to someone without an account.
//
// The owner picks how long a link lasts and whether whoever holds it may edit.
// Holding the link is the only credential, so the token is long and random, and
// only its hash is stored (like a session's). An expired link and one that never
// existed get the same 404.
//
// What a link reveals is listed field by field in the selects below rather than
// filtered out of a whole receipt, so a column added later stays private until
// someone decides otherwise. The photo stays out on purpose: it can show a card's
// last four, a loyalty number or a home address (see GET /api/receipts/:id/image).
//
// Editing covers what the visitor can see: the store name, tax, items and who is
// on each one. Ignored lines, food flags, the category, the photo and any linked
// bank transaction are left alone, and only people already on the receipt can be
// assigned, so a stranger cannot add names to the owner's account.

import { generateSessionToken, hashToken } from "./crypto.mjs";

export const MAX_SHARE_MINUTES = 30 * 24 * 60;

export const SHARE_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many share links. Give it a few minutes."
};

// Counted per address, since an editor has no account to count against.
export const SHARED_EDIT_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: "Too many edits. Give it a few minutes."
};

const TOKEN_PATTERN = /^[\w-]{43}$/;

const shareSelect = { id: true, canEdit: true, expiresAt: true, createdAt: true };

const sharedReceiptSelect = {
  storeName: true,
  category: true,
  subtotal: true,
  tax: true,
  total: true,
  createdAt: true,
  updatedAt: true,
  people: {
    orderBy: { createdAt: "asc" },
    select: { id: true, accountPerson: { select: { name: true } } }
  },
  lines: {
    where: { ignored: false },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      label: true,
      resolvedName: true,
      amount: true,
      assignments: { select: { personId: true, mode: true, value: true } }
    }
  }
};

const toNumber = (value) => (value === null || value === undefined ? null : Number(value));
const toCents = (value) => Math.round(value * 100);

function serializeSharedReceipt(receipt, share) {
  return {
    storeName: receipt.storeName,
    category: receipt.category,
    subtotal: toNumber(receipt.subtotal),
    tax: toNumber(receipt.tax),
    total: toNumber(receipt.total),
    createdAt: receipt.createdAt,
    // Sent back with an edit, to catch two people editing at once.
    updatedAt: receipt.updatedAt,
    canEdit: share.canEdit,
    expiresAt: share.expiresAt,
    people: receipt.people.map((person) => ({ id: person.id, name: person.accountPerson.name })),
    lines: receipt.lines.map((line) => ({
      id: line.id,
      name: line.resolvedName ?? line.label,
      amount: toNumber(line.amount),
      assignments: line.assignments.map((assignment) => ({
        personId: assignment.personId,
        mode: assignment.mode,
        value: toNumber(assignment.value)
      }))
    }))
  };
}

// Thrown inside the edit transaction to roll it back and answer with `status`.
class ShareEditError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function findLiveShare(client, token) {
  if (!TOKEN_PATTERN.test(token)) return null;
  return client.receiptShare.findFirst({
    where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() } },
    select: { receiptId: true, canEdit: true, expiresAt: true }
  });
}

function ownedShareWhere(req) {
  return {
    id: req.params.shareId,
    receipt: { id: req.params.id, userId: req.userId },
    expiresAt: { gt: new Date() }
  };
}

// Returns an error message, or null when the edit is safe to write. `rules` are
// the same limits a saved receipt is held to (see server/app.mjs).
function validateEdit(body, rules) {
  if (typeof body.updatedAt !== "string") return "updatedAt is required.";
  if (body.storeName !== null && !rules.isShortString(body.storeName)) {
    return "The store name must be 1-200 characters.";
  }
  if (body.tax !== null && !rules.isStorableAmount(body.tax)) return "Tax must be a number within range.";
  if (!Array.isArray(body.lines) || body.lines.length === 0) return "At least one item is required.";
  if (body.lines.length > rules.maxLines) return "Too many items.";

  let assignmentCount = 0;
  const seenLines = new Set();
  for (const line of body.lines) {
    if (!line || typeof line !== "object") return "Each item must be an object.";
    if (line.id !== undefined) {
      if (typeof line.id !== "string" || seenLines.has(line.id)) return "Each item must appear once.";
      seenLines.add(line.id);
    }
    if (!rules.isShortString(line.label)) return "Each item needs a name of 1-200 characters.";
    if (!rules.isStorableAmount(line.amount)) return "Each item price must be a number within range.";
    if (!Array.isArray(line.assignments)) return "Each item needs a list of assignments.";

    assignmentCount += line.assignments.length;
    const seenPeople = new Set();
    for (const assignment of line.assignments) {
      if (!assignment || typeof assignment !== "object") return "Each assignment must be an object.";
      if (typeof assignment.personId !== "string" || seenPeople.has(assignment.personId)) {
        return "An item cannot be assigned to the same person twice.";
      }
      seenPeople.add(assignment.personId);
      if (!rules.modes.has(assignment.mode)) return "Unknown assignment mode.";
      if (!rules.isStorableAmount(assignment.value)) return "Each assignment value must be a number within range.";
    }
  }
  if (assignmentCount > rules.maxAssignments) return "Too many assignments.";
  return null;
}

// Written line by line rather than replaced whole, so an untouched line keeps
// its food flag and identification, and the hidden ignored lines stay as they
// were. Renaming a line drops what it was identified as, which no longer fits.
async function writeEdit(tx, receiptId, body) {
  const receipt = await tx.receipt.findUnique({
    where: { id: receiptId },
    select: {
      updatedAt: true,
      people: { select: { id: true } },
      lines: { where: { ignored: false }, select: { id: true, label: true, resolvedName: true } }
    }
  });
  if (receipt.updatedAt.toISOString() !== body.updatedAt) {
    throw new ShareEditError(409, "This receipt changed since you opened it. Reload to see the latest.");
  }

  const subtotalCents = body.lines.reduce((sum, line) => sum + toCents(line.amount), 0);
  const subtotal = subtotalCents / 100;
  const total = (subtotalCents + toCents(body.tax ?? 0)) / 100;
  if (Math.abs(total) >= 1e8) throw new ShareEditError(400, "The total is too large.");

  const personIds = new Set(receipt.people.map((person) => person.id));
  for (const line of body.lines) {
    if (line.assignments.some((assignment) => !personIds.has(assignment.personId))) {
      throw new ShareEditError(400, "An item was assigned to someone who is not on this receipt.");
    }
  }

  const existing = new Map(receipt.lines.map((line) => [line.id, line]));
  for (const line of body.lines) {
    if (line.id !== undefined && !existing.has(line.id)) {
      throw new ShareEditError(400, "An item is no longer on this receipt. Reload to see the latest.");
    }
  }

  const kept = new Set(body.lines.map((line) => line.id));
  await tx.receiptLine.deleteMany({
    where: { id: { in: receipt.lines.filter((line) => !kept.has(line.id)).map((line) => line.id) } }
  });
  await tx.lineAssignment.deleteMany({ where: { lineId: { in: [...kept].filter(Boolean) } } });

  const { _max } = await tx.receiptLine.aggregate({ where: { receiptId }, _max: { sortOrder: true } });
  let nextSortOrder = (_max.sortOrder ?? -1) + 1;

  for (const line of body.lines) {
    const current = line.id === undefined ? null : existing.get(line.id);
    let lineId = line.id;
    if (!current) {
      const created = await tx.receiptLine.create({
        data: { receiptId, label: line.label, amount: line.amount, sortOrder: nextSortOrder++ },
        select: { id: true }
      });
      lineId = created.id;
    } else if (line.label !== (current.resolvedName ?? current.label)) {
      await tx.receiptLine.update({
        where: { id: lineId },
        data: {
          label: line.label,
          amount: line.amount,
          itemCode: null,
          resolvedName: null,
          resolvedBrand: null,
          resolvedSize: null,
          resolvedConfidence: null,
          resolvedSource: null,
          resolvedReasoning: null,
          resolvedAlternatives: [],
          resolvedAt: null
        }
      });
    } else {
      await tx.receiptLine.update({ where: { id: lineId }, data: { amount: line.amount } });
    }
    if (line.assignments.length > 0) {
      await tx.lineAssignment.createMany({
        data: line.assignments.map((assignment) => ({
          lineId,
          personId: assignment.personId,
          mode: assignment.mode,
          value: assignment.value
        }))
      });
    }
  }

  return tx.receipt.update({
    where: { id: receiptId },
    data: { storeName: body.storeName, tax: body.tax, subtotal, total },
    select: sharedReceiptSelect
  });
}

export function registerReceiptShare(app, requireAuth, prisma, { createLimiters, editLimiters, rules }) {
  async function ownsReceipt(req) {
    const receipt = await prisma.receipt.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true }
    });
    return Boolean(receipt);
  }

  app.post("/api/receipts/:id/shares", requireAuth, ...createLimiters, async (req, res) => {
    const { expiresInMinutes, canEdit = false } = req.body ?? {};
    if (!Number.isInteger(expiresInMinutes) || expiresInMinutes < 1 || expiresInMinutes > MAX_SHARE_MINUTES) {
      return res.status(400).json({ error: "A link can last from 1 minute to 30 days." });
    }
    if (typeof canEdit !== "boolean") return res.status(400).json({ error: "canEdit must be true or false." });

    try {
      if (!(await ownsReceipt(req))) return res.status(404).json({ error: "Receipt not found." });

      const now = Date.now();
      // Links that ran out are no use to anyone; this keeps the table small.
      await prisma.receiptShare.deleteMany({ where: { expiresAt: { lte: new Date(now) } } });

      const token = generateSessionToken();
      const share = await prisma.receiptShare.create({
        data: {
          receiptId: req.params.id,
          tokenHash: hashToken(token),
          canEdit,
          expiresAt: new Date(now + expiresInMinutes * 60 * 1000)
        },
        select: shareSelect
      });
      // The one time the link can be told: only its hash is kept.
      res.status(201).json({ ...share, path: `/r/${token}` });
    } catch (error) {
      console.error("Failed to create share link:", error);
      res.status(500).json({ error: "Failed to create the link." });
    }
  });

  app.get("/api/receipts/:id/shares", requireAuth, async (req, res) => {
    try {
      if (!(await ownsReceipt(req))) return res.status(404).json({ error: "Receipt not found." });
      const shares = await prisma.receiptShare.findMany({
        where: { receiptId: req.params.id, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        select: shareSelect
      });
      res.json(shares);
    } catch (error) {
      console.error("Failed to list share links:", error);
      res.status(500).json({ error: "Failed to load the links." });
    }
  });

  app.patch("/api/receipts/:id/shares/:shareId", requireAuth, async (req, res) => {
    const { canEdit } = req.body ?? {};
    if (typeof canEdit !== "boolean") return res.status(400).json({ error: "canEdit must be true or false." });
    try {
      const { count } = await prisma.receiptShare.updateMany({ where: ownedShareWhere(req), data: { canEdit } });
      if (count === 0) return res.status(404).json({ error: "Link not found." });
      const share = await prisma.receiptShare.findUnique({ where: { id: req.params.shareId }, select: shareSelect });
      res.json(share);
    } catch (error) {
      console.error("Failed to update share link:", error);
      res.status(500).json({ error: "Failed to update the link." });
    }
  });

  app.delete("/api/receipts/:id/shares/:shareId", requireAuth, async (req, res) => {
    try {
      const { count } = await prisma.receiptShare.deleteMany({ where: ownedShareWhere(req) });
      if (count === 0) return res.status(404).json({ error: "Link not found." });
      res.status(204).end();
    } catch (error) {
      console.error("Failed to remove share link:", error);
      res.status(500).json({ error: "Failed to remove the link." });
    }
  });

  // --- Public: no session, only the link ---------------------------------------

  const GONE = { error: "This link has expired or does not exist." };

  app.get("/api/shared-receipts/:token", async (req, res) => {
    // Never kept by a browser or proxy, so an expired link cannot be replayed.
    res.setHeader("Cache-Control", "no-store");
    try {
      const share = await findLiveShare(prisma, req.params.token);
      if (!share) return res.status(404).json(GONE);
      const receipt = await prisma.receipt.findUnique({ where: { id: share.receiptId }, select: sharedReceiptSelect });
      res.json(serializeSharedReceipt(receipt, share));
    } catch (error) {
      console.error("Failed to load shared receipt:", error);
      res.status(500).json({ error: "Failed to load this receipt." });
    }
  });

  app.put("/api/shared-receipts/:token", ...editLimiters, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const body = req.body ?? {};
    const invalid = validateEdit(body, rules);
    if (invalid) return res.status(400).json({ error: invalid });

    try {
      const result = await prisma.$transaction(async (tx) => {
        const share = await findLiveShare(tx, req.params.token);
        if (!share) throw new ShareEditError(404, GONE.error);
        if (!share.canEdit) throw new ShareEditError(403, "This link is view only.");
        return serializeSharedReceipt(await writeEdit(tx, share.receiptId, body), share);
      });
      res.json(result);
    } catch (error) {
      if (error instanceof ShareEditError) return res.status(error.status).json({ error: error.message });
      console.error("Failed to save shared receipt:", error);
      res.status(500).json({ error: "Failed to save this receipt." });
    }
  });
}
