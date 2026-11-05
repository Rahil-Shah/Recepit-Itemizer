// The tools an AI assistant gets through the MCP endpoint (server/mcp.mjs).
//
// What they are for, in the order an assistant meets them:
//
//   - Answering questions about saved receipts: what was bought where, what
//     it cost, and who owes what (list_receipts, get_receipt, search_items,
//     list_people, person_summary, who_owes_what).
//   - Checking a photo of a receipt against the copy saved here. The assistant
//     reads the photo itself and sends the items it read to compare_receipt,
//     which pairs them with the saved lines and reports the differences
//     without changing anything. update_receipt then writes the corrections
//     the user agreed to.
//   - Saving a receipt that is not here yet (create_receipt).
//
// Every query is scoped to the account the token belongs to, by userId in
// the where clause rather than by checking afterwards, so another account's
// receipt answers "not found" exactly like one that does not exist. Writes
// need the receipts:write scope, and an edit carries the version it was based
// on, so it cannot overwrite a change made in the meantime (in the app, or
// through a share link).
//
// Arguments are checked here, field by field, against the same limits the
// REST routes apply. A bad argument comes back as a tool error the model can
// read and correct, not as a protocol error.

import { ensureSelfPerson } from "./people.mjs";
import { calculateSplit, personBreakdown, describeSplit } from "./split.mjs";
import { maxReceiptsPerUser } from "./access.mjs";
import { normalizeStoredItemCode } from "./identification.mjs";
import { SCOPE_READ, SCOPE_WRITE } from "./api-tokens.mjs";

/** A problem with the call that the assistant can fix, shown to it as-is. */
export class ToolError extends Error {}

// Same ceilings as a receipt saved through the REST API (server/app.mjs).
const MAX_LINES = 500;
const MAX_ASSIGNMENTS = 5000;
const MAX_TEXT = 200;
const MAX_AMOUNT = 1e8;
const MAX_PEOPLE_PER_ACCOUNT = 10;
const MAX_PEOPLE_PER_ITEM = 20;
const MAX_LIST = 50;
const MAX_SEARCH = 100;
// The most receipts a summary across receipts will read. Far above what one
// account holds under the default receipt cap; it only bounds the work.
const MAX_SUMMARY_RECEIPTS = 500;
export const CATEGORIES = ["Groceries", "Dining", "Entertainment", "Travel", "Other"];
const SELF_NAMES = new Set(["me", "myself", "i", "you", "self", "owner"]);
// Interactive transactions default to five seconds, which a 500-line receipt
// on a slow connection could exceed.
const TRANSACTION_OPTIONS = { timeout: 20_000, maxWait: 10_000 };

// --- Arguments ---------------------------------------------------------------

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const toNumber = (value) => (value === null || value === undefined ? null : Number(value));
const toCents = (value) => Math.round(Number(value) * 100);
const fromCents = (cents) => cents / 100;
const day = (date) => date.toISOString().slice(0, 10);

function checkKeys(object, allowed, where) {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) {
      throw new ToolError(`Unknown argument "${key}"${where ? ` in ${where}` : ""}. Allowed: ${allowed.join(", ")}.`);
    }
  }
}

function text(value, name, { required = false, max = MAX_TEXT } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new ToolError(`${name} is required.`);
    return null;
  }
  if (typeof value !== "string") throw new ToolError(`${name} must be a string.`);
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    if (required) throw new ToolError(`${name} must not be empty.`);
    return null;
  }
  if (cleaned.length > max) throw new ToolError(`${name} must be at most ${max} characters.`);
  return cleaned;
}

function amount(value, name, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new ToolError(`${name} is required.`);
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) >= MAX_AMOUNT) {
    throw new ToolError(`${name} must be a number (dollars and cents, e.g. 3.49).`);
  }
  return Math.round(value * 100) / 100;
}

function integer(value, name, { min, max, fallback }) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ToolError(`${name} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

function bool(value, name, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new ToolError(`${name} must be true or false.`);
  return value;
}

function list(value, name, { required = false, max }) {
  if (value === undefined || value === null) {
    if (required) throw new ToolError(`${name} is required.`);
    return [];
  }
  if (!Array.isArray(value)) throw new ToolError(`${name} must be a list.`);
  if (required && value.length === 0) throw new ToolError(`${name} must not be empty.`);
  if (value.length > max) throw new ToolError(`${name} can hold at most ${max} entries.`);
  return value;
}

function id(value, name) {
  if (typeof value !== "string" || !/^[\w-]{1,64}$/.test(value)) throw new ToolError(`${name} must be an id from Receipt Ring.`);
  return value;
}

/** "2026-03-01" as the start (or, with endOfDay, the end) of that UTC day. */
function dateArg(value, name, { endOfDay = false } = {}) {
  if (value === undefined || value === null) return null;
  const match = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  if (!date || day(date) !== value) throw new ToolError(`${name} must be a date written YYYY-MM-DD.`);
  return endOfDay ? new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1) : date;
}

function dateRange(args) {
  const from = dateArg(args.from, "from");
  const to = dateArg(args.to, "to", { endOfDay: true });
  if (from && to && from > to) throw new ToolError("from must be on or before to.");
  if (!from && !to) return undefined;
  return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
}

// --- Reading receipts --------------------------------------------------------

const receiptSelect = {
  id: true,
  storeName: true,
  category: true,
  subtotal: true,
  tax: true,
  total: true,
  createdAt: true,
  updatedAt: true,
  imageMimeType: true,
  people: {
    orderBy: { createdAt: "asc" },
    select: { accountPersonId: true, accountPerson: { select: { name: true, isSelf: true } } }
  },
  lines: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      label: true,
      amount: true,
      ignored: true,
      isFood: true,
      itemCode: true,
      resolvedName: true,
      sortOrder: true,
      assignments: { select: { mode: true, value: true, person: { select: { accountPersonId: true } } } }
    }
  }
};

/** A stored receipt as plain numbers and ids, ready for the split. */
function normalizeReceipt(receipt) {
  return {
    id: receipt.id,
    storeName: receipt.storeName,
    category: receipt.category,
    subtotal: toNumber(receipt.subtotal),
    tax: toNumber(receipt.tax),
    total: toNumber(receipt.total),
    createdAt: receipt.createdAt,
    version: receipt.updatedAt.toISOString(),
    hasPhoto: Boolean(receipt.imageMimeType),
    people: receipt.people.map((person) => ({
      id: person.accountPersonId,
      name: person.accountPerson.name,
      isSelf: person.accountPerson.isSelf
    })),
    lines: receipt.lines.map((line) => ({
      id: line.id,
      label: line.label,
      name: line.resolvedName,
      amount: Number(line.amount),
      ignored: line.ignored,
      isFood: line.isFood,
      itemCode: line.itemCode,
      sortOrder: line.sortOrder,
      assignments: line.assignments.map((assignment) => ({
        personId: assignment.person.accountPersonId,
        mode: assignment.mode,
        value: Number(assignment.value)
      }))
    }))
  };
}

async function loadReceipt(ctx, receiptId, client = ctx.prisma) {
  const receipt = await client.receipt.findFirst({ where: { id: receiptId, userId: ctx.userId }, select: receiptSelect });
  if (!receipt) throw new ToolError(`No receipt with id ${receiptId}. Use list_receipts to find it.`);
  return normalizeReceipt(receipt);
}

const splitOf = (receipt) => calculateSplit(receipt.people, receipt.lines, receipt.tax ?? 0);

function sumOfItems(lines) {
  return fromCents(lines.filter((line) => !line.ignored).reduce((sum, line) => sum + toCents(line.amount), 0));
}

function describeAssignment(assignment, count) {
  return describeSplit({ mode: assignment.mode, value: assignment.value, splitCount: count });
}

/** Everything about one receipt an assistant needs, including who owes what. */
function receiptDetail(receipt) {
  const split = splitOf(receipt);
  const names = new Map(receipt.people.map((person) => [person.id, person.name]));
  const itemsSum = sumOfItems(receipt.lines);
  const expectedTotal = fromCents(toCents(itemsSum) + toCents(receipt.tax ?? 0));
  return {
    receipt_id: receipt.id,
    version: receipt.version,
    store: receipt.storeName,
    category: receipt.category,
    date: day(receipt.createdAt),
    subtotal: receipt.subtotal,
    tax: receipt.tax,
    total: receipt.total,
    has_photo: receipt.hasPhoto,
    // A receipt nobody was put on is the owner's alone.
    ...(receipt.people.length === 0 ? { not_split: true } : {}),
    people: receipt.people.map((person) => ({ person_id: person.id, name: person.name, is_you: person.isSelf })),
    items: receipt.lines.map((line) => {
      const shares = split.lineShares.get(line.id);
      return {
        line_id: line.id,
        label: line.label,
        ...(line.name ? { name: line.name } : {}),
        price: line.amount,
        ...(line.itemCode ? { item_code: line.itemCode } : {}),
        is_food: line.isFood,
        ignored: line.ignored,
        split: line.ignored
          ? []
          : line.assignments.map((assignment) => ({
              person: names.get(assignment.personId) ?? "Unknown",
              share: shares?.get(assignment.personId) ?? 0,
              how: describeAssignment(assignment, line.assignments.length)
            }))
      };
    }),
    who_owes_what: split.totals.map((total) => ({
      person: total.personName,
      is_you: receipt.people.find((person) => person.id === total.personId)?.isSelf ?? false,
      items: total.itemTotal,
      tax: total.allocatedTax,
      total: total.finalTotal
    })),
    checks: {
      sum_of_items: itemsSum,
      subtotal_matches_items: receipt.subtotal === null ? null : toCents(receipt.subtotal) === toCents(itemsSum),
      total_matches_items_plus_tax: receipt.total === null ? null : toCents(receipt.total) === toCents(expectedTotal),
      items_with_nobody_on_them: split.unassignedLines,
      amount_not_assigned_to_anyone: fromCents(toCents(split.receiptTotal) - toCents(split.assignedTotal))
    }
  };
}

function receiptSummary(receipt) {
  return {
    receipt_id: receipt.id,
    store: receipt.storeName,
    category: receipt.category,
    date: day(receipt.createdAt),
    subtotal: receipt.subtotal,
    tax: receipt.tax,
    total: receipt.total,
    item_count: receipt.lines.filter((line) => !line.ignored).length,
    people: receipt.people.map((person) => (person.isSelf ? `${person.name} (you)` : person.name))
  };
}

/** The account's people; "me" and its variants mean the owner. */
async function findPerson(ctx, value, name) {
  const wanted = text(value, name, { required: true });
  if (SELF_NAMES.has(wanted.toLowerCase())) return ensureSelfPerson(ctx.prisma, ctx.userId);
  const people = await ctx.prisma.accountPerson.findMany({ where: { userId: ctx.userId }, orderBy: { name: "asc" } });
  const found =
    people.find((person) => person.id === wanted) ??
    people.find((person) => person.name.toLowerCase() === wanted.toLowerCase());
  if (!found) {
    throw new ToolError(
      `No person called "${wanted}". People on this account: ${people.map((person) => person.name).join(", ") || "none yet"}.`
    );
  }
  return found;
}

function receiptFilters(ctx, args) {
  const where = { userId: ctx.userId };
  const store = text(args.store, "store", { max: 100 });
  if (store) where.storeName = { contains: store, mode: "insensitive" };
  const range = dateRange(args);
  if (range) where.createdAt = range;
  return where;
}

// --- Matching a scanned receipt to a saved one --------------------------------

const normalizeLabel = (value) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const normalizeCode = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? digits.replace(/^0+(?=\d)/, "") : "";
};

function bigrams(value) {
  const compact = value.replace(/ /g, "");
  const grams = new Map();
  for (let index = 0; index < compact.length - 1; index += 1) {
    const gram = compact.slice(index, index + 2);
    grams.set(gram, (grams.get(gram) ?? 0) + 1);
  }
  return grams;
}

/** Dice similarity of two labels' letter pairs, 0..1. */
export function labelSimilarity(left, right) {
  const a = normalizeLabel(left);
  const b = normalizeLabel(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const gramsA = bigrams(a);
  const gramsB = bigrams(b);
  let sizeA = 0;
  let sizeB = 0;
  let shared = 0;
  for (const count of gramsA.values()) sizeA += count;
  for (const [gram, count] of gramsB) {
    sizeB += count;
    shared += Math.min(count, gramsA.get(gram) ?? 0);
  }
  return sizeA + sizeB === 0 ? 0 : (2 * shared) / (sizeA + sizeB);
}

/**
 * Pair items read off a receipt with the lines saved for it. Each line and
 * each item is used at most once. Tried in order of how sure the pairing is:
 *
 *   1. the same item code (the SKU/PLU the receipt printed);
 *   2. the same label, or the same name the line was identified as;
 *   3. a similar label -- similar enough on its own, or a little similar at
 *      the same price.
 *
 * Among equally good candidates the one at the same price wins, then the one
 * nearest the top of the receipt, so a repeated item pairs off in order.
 *
 * `saved` is [{ id, label, name, itemCode, amount, sortOrder }];
 * `scanned` is [{ label, amount, itemCode }]. Returns the pairs and the
 * indexes left over on each side.
 */
export function matchItems(saved, scanned) {
  const usedLines = new Set();
  const usedItems = new Set();
  const pairs = [];
  const take = (itemIndex, line, how, similarity) => {
    usedItems.add(itemIndex);
    usedLines.add(line.id);
    pairs.push({ itemIndex, line, how, similarity });
  };
  const samePrice = (line, item) => toCents(line.amount) === toCents(item.amount);

  // An exact pass runs twice: first only pairs at the same price, across every
  // item, then whatever is left in order. Otherwise a repeated item whose price
  // changed could take the line another copy matches exactly.
  const exactPass = (sameKey, how) => {
    for (const priceMustMatch of [true, false]) {
      scanned.forEach((item, itemIndex) => {
        if (usedItems.has(itemIndex)) return;
        const candidate = saved
          .filter((line) => !usedLines.has(line.id) && sameKey(line, item) && (!priceMustMatch || samePrice(line, item)))
          .sort((a, b) => a.sortOrder - b.sortOrder)[0];
        if (candidate) take(itemIndex, candidate, how, 1);
      });
    }
  };

  exactPass((line, item) => {
    const code = normalizeCode(item.itemCode);
    return Boolean(code) && normalizeCode(line.itemCode) === code;
  }, "item_code");
  exactPass((line, item) => {
    const label = normalizeLabel(item.label);
    return Boolean(label) && (normalizeLabel(line.label) === label || normalizeLabel(line.name) === label);
  }, "label");

  const fuzzy = [];
  scanned.forEach((item, itemIndex) => {
    if (usedItems.has(itemIndex)) return;
    for (const line of saved) {
      if (usedLines.has(line.id)) continue;
      const similarity = Math.max(labelSimilarity(item.label, line.label), labelSimilarity(item.label, line.name));
      const same = samePrice(line, item);
      if (similarity >= 0.5 || (same && similarity >= 0.3)) {
        fuzzy.push({ itemIndex, line, similarity, score: similarity + (same ? 0.15 : 0) });
      }
    }
  });
  fuzzy
    .sort((a, b) => b.score - a.score || a.line.sortOrder - b.line.sortOrder || a.itemIndex - b.itemIndex)
    .forEach((candidate) => {
      if (usedItems.has(candidate.itemIndex) || usedLines.has(candidate.line.id)) return;
      take(candidate.itemIndex, candidate.line, "similar_label", Math.round(candidate.similarity * 100) / 100);
    });

  pairs.sort((a, b) => a.itemIndex - b.itemIndex);
  return {
    pairs,
    unmatchedItems: scanned.map((_, index) => index).filter((index) => !usedItems.has(index)),
    unmatchedLines: saved.filter((line) => !usedLines.has(line.id))
  };
}

function scannedItems(value) {
  return list(value, "items", { required: true, max: MAX_LINES }).map((item, index) => {
    const where = `items[${index}]`;
    if (!isPlainObject(item)) throw new ToolError(`${where} must be an object with label and amount.`);
    checkKeys(item, ["label", "amount", "item_code"], where);
    const itemCode = text(item.item_code, `${where}.item_code`, { max: 40 });
    return {
      label: text(item.label, `${where}.label`, { required: true }),
      amount: amount(item.amount, `${where}.amount`, { required: true }),
      itemCode
    };
  });
}

// --- Writing -----------------------------------------------------------------

function requireWrite(ctx) {
  if (!ctx.scopes.has(SCOPE_WRITE)) {
    throw new ToolError("This connection can only read receipts. Create a token that allows changes in Receipt Ring's Settings.");
  }
}

/**
 * Resolve names to the account's people, adding any that do not exist yet
 * (up to the same ten-person limit as the People list in the app). Returns a
 * Map of lowercased name to accountPerson, and the names that were added.
 */
async function resolvePeople(tx, ctx, names) {
  const wanted = [...new Map(names.map((name) => [name.toLowerCase(), name])).values()];
  const resolved = new Map();
  const created = [];
  if (wanted.length === 0) return { resolved, created };

  const self = wanted.some((name) => SELF_NAMES.has(name.toLowerCase())) ? await ensureSelfPerson(tx, ctx.userId) : null;
  const existing = await tx.accountPerson.findMany({ where: { userId: ctx.userId } });
  let count = existing.length;
  for (const name of wanted) {
    const key = name.toLowerCase();
    if (SELF_NAMES.has(key)) {
      resolved.set(key, self);
      continue;
    }
    const match = existing.find((person) => person.name.toLowerCase() === key);
    if (match) {
      resolved.set(key, match);
      continue;
    }
    if (count >= MAX_PEOPLE_PER_ACCOUNT) {
      throw new ToolError(
        `"${name}" is not one of your people, and the account already has the most it can (${MAX_PEOPLE_PER_ACCOUNT}). ` +
          `Use one of: ${existing.map((person) => person.name).join(", ")}.`
      );
    }
    const person = await tx.accountPerson.create({ data: { userId: ctx.userId, name } });
    existing.push(person);
    count += 1;
    created.push(name);
    resolved.set(key, person);
  }
  return { resolved, created };
}

function newItems(value, name, { required }) {
  let assignments = 0;
  const items = list(value, name, { required, max: MAX_LINES }).map((item, index) => {
    const where = `${name}[${index}]`;
    if (!isPlainObject(item)) throw new ToolError(`${where} must be an object with label and amount.`);
    checkKeys(item, ["label", "amount", "item_code", "is_food", "ignored", "people"], where);
    const people = list(item.people, `${where}.people`, { max: MAX_PEOPLE_PER_ITEM }).map((person, personIndex) =>
      text(person, `${where}.people[${personIndex}]`, { required: true })
    );
    if (new Set(people.map((person) => person.toLowerCase())).size !== people.length) {
      throw new ToolError(`${where}.people names someone twice.`);
    }
    assignments += people.length;
    return {
      label: text(item.label, `${where}.label`, { required: true }),
      amount: amount(item.amount, `${where}.amount`, { required: true }),
      itemCode: normalizeStoredItemCode(text(item.item_code, `${where}.item_code`, { max: 40 }) ?? undefined),
      isFood: bool(item.is_food, `${where}.is_food`),
      ignored: bool(item.ignored, `${where}.ignored`),
      people
    };
  });
  if (assignments > MAX_ASSIGNMENTS) throw new ToolError("Too many people across the items.");
  return items;
}

/**
 * Add lines to a receipt, each split evenly between the people named on it.
 * Each person gets a row on the receipt the first time they appear on it.
 */
async function insertLines(tx, ctx, receiptId, items, firstSortOrder) {
  if (items.length === 0) return { created: [] };
  const { resolved, created } = await resolvePeople(tx, ctx, items.flatMap((item) => item.people));

  await tx.receiptLine.createMany({
    data: items.map((item, index) => ({
      receiptId,
      label: item.label,
      amount: item.amount,
      itemCode: item.itemCode,
      isFood: item.isFood,
      ignored: item.ignored,
      sortOrder: firstSortOrder + index
    }))
  });
  const inserted = await tx.receiptLine.findMany({
    where: { receiptId, sortOrder: { gte: firstSortOrder } },
    select: { id: true, sortOrder: true }
  });
  const lineIdAt = new Map(inserted.map((line) => [line.sortOrder, line.id]));

  const personRows = new Map(
    (await tx.person.findMany({ where: { receiptId }, select: { id: true, accountPersonId: true } })).map((person) => [
      person.accountPersonId,
      person.id
    ])
  );
  const assignmentData = [];
  for (const [index, item] of items.entries()) {
    for (const name of item.people) {
      const accountPerson = resolved.get(name.toLowerCase());
      if (!personRows.has(accountPerson.id)) {
        const row = await tx.person.create({ data: { receiptId, accountPersonId: accountPerson.id }, select: { id: true } });
        personRows.set(accountPerson.id, row.id);
      }
      assignmentData.push({
        lineId: lineIdAt.get(firstSortOrder + index),
        personId: personRows.get(accountPerson.id),
        mode: "equal",
        value: 0
      });
    }
  }
  if (assignmentData.length > 0) await tx.lineAssignment.createMany({ data: assignmentData });
  return { created };
}

/** Subtotal and total the way the app saves them: the kept lines, plus tax. */
async function recomputeTotals(tx, receiptId, tax, extra = {}) {
  const lines = await tx.receiptLine.findMany({ where: { receiptId, ignored: false }, select: { amount: true } });
  const subtotalCents = lines.reduce((sum, line) => sum + toCents(line.amount), 0);
  const totalCents = subtotalCents + toCents(tax ?? 0);
  if (Math.abs(totalCents) >= MAX_AMOUNT * 100) throw new ToolError("The total would be too large.");
  await tx.receipt.update({
    where: { id: receiptId },
    data: { subtotal: fromCents(subtotalCents), tax: tax ?? null, total: fromCents(totalCents), ...extra },
    select: { id: true }
  });
}

// --- The tools ---------------------------------------------------------------

const dateProps = {
  from: { type: "string", description: "Earliest date, YYYY-MM-DD (the day the receipt was saved, UTC)." },
  to: { type: "string", description: "Latest date, YYYY-MM-DD, inclusive." }
};

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export const TOOLS = [
  {
    name: "list_receipts",
    title: "List receipts",
    description:
      "List the user's saved receipts, newest first, with store, date, totals and who is on each. Use it to find the receipt a photo or question is about: filter by store name, date range, total, or a person on the receipt.",
    scope: SCOPE_READ,
    annotations: READ_ONLY,
    inputSchema: {
      type: "object",
      properties: {
        store: { type: "string", description: "Part of the store name, any case." },
        ...dateProps,
        min_total: { type: "number" },
        max_total: { type: "number" },
        person: { type: "string", description: "Only receipts this person (name, or \"me\") is on." },
        limit: { type: "integer", minimum: 1, maximum: MAX_LIST, default: 20 },
        offset: { type: "integer", minimum: 0, default: 0 }
      },
      additionalProperties: false
    },
    async run(args, ctx) {
      checkKeys(args, ["store", "from", "to", "min_total", "max_total", "person", "limit", "offset"]);
      const where = receiptFilters(ctx, args);
      const min = amount(args.min_total, "min_total");
      const max = amount(args.max_total, "max_total");
      if (min !== null || max !== null) where.total = { ...(min !== null ? { gte: min } : {}), ...(max !== null ? { lte: max } : {}) };
      if (args.person !== undefined) {
        const person = await findPerson(ctx, args.person, "person");
        where.people = { some: { accountPersonId: person.id } };
      }
      const limit = integer(args.limit, "limit", { min: 1, max: MAX_LIST, fallback: 20 });
      const offset = integer(args.offset, "offset", { min: 0, max: 100_000, fallback: 0 });
      const [count, receipts] = await Promise.all([
        ctx.prisma.receipt.count({ where }),
        ctx.prisma.receipt.findMany({ where, orderBy: { createdAt: "desc" }, skip: offset, take: limit, select: receiptSelect })
      ]);
      return {
        total_matching: count,
        returned: receipts.length,
        ...(offset + receipts.length < count ? { next_offset: offset + receipts.length } : {}),
        receipts: receipts.map((receipt) => receiptSummary(normalizeReceipt(receipt)))
      };
    }
  },
  {
    name: "get_receipt",
    title: "Get a receipt",
    description:
      "One saved receipt in full: every item with its price, who is on it and each person's share, what each person owes in total (items plus their share of tax), and checks on whether the items add up to the saved subtotal and total. The account owner is assumed to have paid; everyone else's total is what they owe the owner. Returns a version to pass to update_receipt.",
    scope: SCOPE_READ,
    annotations: READ_ONLY,
    inputSchema: {
      type: "object",
      properties: { receipt_id: { type: "string" } },
      required: ["receipt_id"],
      additionalProperties: false
    },
    async run(args, ctx) {
      checkKeys(args, ["receipt_id"]);
      return receiptDetail(await loadReceipt(ctx, id(args.receipt_id, "receipt_id")));
    }
  },
  {
    name: "search_items",
    title: "Search items",
    description:
      "Find items across all saved receipts by name, as printed or as identified (e.g. \"milk\", \"MOZZ\"), or by item code. Shows the store, date, price and who it was split with. Good for \"when did I last buy X\" or \"how much did X cost\".",
    scope: SCOPE_READ,
    annotations: READ_ONLY,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words from the item's name, or its item code." },
        store: { type: "string" },
        ...dateProps,
        limit: { type: "integer", minimum: 1, maximum: MAX_SEARCH, default: 25 }
      },
      required: ["query"],
      additionalProperties: false
    },
    async run(args, ctx) {
      checkKeys(args, ["query", "store", "from", "to", "limit"]);
      const query = text(args.query, "query", { required: true, max: 100 });
      const limit = integer(args.limit, "limit", { min: 1, max: MAX_SEARCH, fallback: 25 });
      const code = /^\d{1,20}$/.test(query) ? query : null;
      const lines = await ctx.prisma.receiptLine.findMany({
        where: {
          receipt: receiptFilters(ctx, args),
          OR: [
            { label: { contains: query, mode: "insensitive" } },
            { resolvedName: { contains: query, mode: "insensitive" } },
            ...(code ? [{ itemCode: code }] : [])
          ]
        },
        orderBy: [{ receipt: { createdAt: "desc" } }, { sortOrder: "asc" }],
        take: limit,
        select: {
          id: true,
          label: true,
          resolvedName: true,
          amount: true,
          ignored: true,
          isFood: true,
          receipt: { select: { id: true, storeName: true, createdAt: true } },
          assignments: { select: { person: { select: { accountPerson: { select: { name: true } } } } } }
        }
      });
      return {
        returned: lines.length,
        items: lines.map((line) => ({
          receipt_id: line.receipt.id,
          store: line.receipt.storeName,
          date: day(line.receipt.createdAt),
          line_id: line.id,
          label: line.label,
          ...(line.resolvedName ? { name: line.resolvedName } : {}),
          price: Number(line.amount),
          is_food: line.isFood,
          ignored: line.ignored,
          people: line.assignments.map((assignment) => assignment.person.accountPerson.name)
        }))
      };
    }
  },
  {
    name: "list_people",
    title: "List people",
    description: "The people the user splits receipts with. is_you marks the account owner.",
    scope: SCOPE_READ,
    annotations: READ_ONLY,
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async run(args, ctx) {
      checkKeys(args, []);
      await ensureSelfPerson(ctx.prisma, ctx.userId);
      const people = await ctx.prisma.accountPerson.findMany({
        where: { userId: ctx.userId },
        orderBy: [{ isSelf: "desc" }, { name: "asc" }]
      });
      return { people: people.map((person) => ({ person_id: person.id, name: person.name, is_you: person.isSelf })) };
    }
  },
  {
    name: "person_summary",
    title: "What one person had",
    description:
      "Everything one person was on across saved receipts (or one receipt): each item, how it was split, their share, their share of tax and their total per receipt, and a grand total. Answers \"what did Sam have\" and \"how much does Sam owe me\". Use \"me\" for the account owner.",
    scope: SCOPE_READ,
    annotations: READ_ONLY,
    inputSchema: {
      type: "object",
      properties: {
        person: { type: "string", description: "A name from list_people, a person_id, or \"me\"." },
        receipt_id: { type: "string", description: "Only this receipt." },
        store: { type: "string" },
        ...dateProps
      },
      required: ["person"],
      additionalProperties: false
    },
    async run(args, ctx) {
      checkKeys(args, ["person", "receipt_id", "store", "from", "to"]);
      const person = await findPerson(ctx, args.person, "person");
      const where = { ...receiptFilters(ctx, args), people: { some: { accountPersonId: person.id } } };
      if (args.receipt_id !== undefined) where.id = id(args.receipt_id, "receipt_id");
      const receipts = (
        await ctx.prisma.receipt.findMany({ where, orderBy: { createdAt: "desc" }, take: MAX_SUMMARY_RECEIPTS, select: receiptSelect })
      ).map(normalizeReceipt);

      let itemsCents = 0;
      let taxCents = 0;
      const perReceipt = receipts.map((receipt) => {
        const breakdown = personBreakdown(receipt.people, receipt.lines, receipt.tax ?? 0, person.id);
        itemsCents += toCents(breakdown.itemTotal);
        taxCents += toCents(breakdown.allocatedTax);
        const names = new Map(receipt.lines.map((line) => [line.id, line.name]));
        return {
          receipt_id: receipt.id,
          store: receipt.storeName,
          date: day(receipt.createdAt),
          items: breakdown.items.map((item) => ({
            label: item.label,
            ...(names.get(item.lineId) ? { name: names.get(item.lineId) } : {}),
            price: item.lineAmount,
            share: item.share,
            how: describeSplit(item)
          })),
          items_total: breakdown.itemTotal,
          tax: breakdown.allocatedTax,
          total: breakdown.finalTotal
        };
      });
      return {
        person: person.name,
        is_you: person.isSelf,
        receipts: perReceipt.length,
        ...(receipts.length === MAX_SUMMARY_RECEIPTS ? { note: `Only the newest ${MAX_SUMMARY_RECEIPTS} receipts were read; narrow the dates.` } : {}),
        items_total: fromCents(itemsCents),
        tax_total: fromCents(taxCents),
        grand_total: fromCents(itemsCents + taxCents),
        by_receipt: perReceipt
      };
    }
  },
  {
    name: "who_owes_what",
    title: "Who owes what",
    description:
      "Totals per person across saved receipts (optionally by store or dates): what each person's share came to, items plus tax. The account owner is assumed to have paid every receipt, so everyone else's total is what they owe the owner. Also reports receipts nobody was split with and amounts left on nobody.",
    scope: SCOPE_READ,
    annotations: READ_ONLY,
    inputSchema: {
      type: "object",
      properties: { store: { type: "string" }, ...dateProps },
      additionalProperties: false
    },
    async run(args, ctx) {
      checkKeys(args, ["store", "from", "to"]);
      const receipts = (
        await ctx.prisma.receipt.findMany({
          where: receiptFilters(ctx, args),
          orderBy: { createdAt: "desc" },
          take: MAX_SUMMARY_RECEIPTS,
          select: receiptSelect
        })
      ).map(normalizeReceipt);

      const people = new Map();
      let unsplitCents = 0;
      let unsplitCount = 0;
      let leftOverCents = 0;
      for (const receipt of receipts) {
        if (receipt.people.length === 0) {
          unsplitCount += 1;
          unsplitCents += toCents(receipt.total ?? 0);
          continue;
        }
        const split = splitOf(receipt);
        leftOverCents += toCents(split.receiptTotal) - toCents(split.assignedTotal);
        for (const total of split.totals) {
          const isSelf = receipt.people.find((person) => person.id === total.personId)?.isSelf ?? false;
          const entry = people.get(total.personId) ?? { person: total.personName, is_you: isSelf, receipts: 0, items: 0, tax: 0, total: 0 };
          entry.receipts += 1;
          entry.items += toCents(total.itemTotal);
          entry.tax += toCents(total.allocatedTax);
          entry.total += toCents(total.finalTotal);
          people.set(total.personId, entry);
        }
      }
      return {
        receipts_read: receipts.length,
        ...(receipts.length === MAX_SUMMARY_RECEIPTS ? { note: `Only the newest ${MAX_SUMMARY_RECEIPTS} receipts were read; narrow the dates.` } : {}),
        people: [...people.values()]
          .sort((a, b) => Number(b.is_you) - Number(a.is_you) || b.total - a.total)
          .map((entry) => ({ ...entry, items: fromCents(entry.items), tax: fromCents(entry.tax), total: fromCents(entry.total) })),
        receipts_not_split: { count: unsplitCount, total: fromCents(unsplitCents) },
        amount_on_nobody: fromCents(leftOverCents)
      };
    }
  },
  {
    name: "compare_receipt",
    title: "Compare a scanned receipt",
    description:
      "Check items read from a receipt photo against the copy saved in Receipt Ring, without changing anything. Read every line item from the photo (label as printed, price, and the item code if one is printed), find the saved receipt with list_receipts, then call this. It pairs each scanned item with a saved line and reports price differences, items missing from either side, and how the subtotal, tax and total compare. Its suggested_update can be passed to update_receipt once the user confirms. Discounts are items with negative prices.",
    scope: SCOPE_READ,
    annotations: READ_ONLY,
    inputSchema: {
      type: "object",
      properties: {
        receipt_id: { type: "string" },
        items: {
          type: "array",
          maxItems: MAX_LINES,
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "The item as printed on the receipt." },
              amount: { type: "number", description: "The price charged for the line, e.g. 3.49. Negative for a discount." },
              item_code: { type: "string", description: "The SKU/PLU printed beside the item, if any." }
            },
            required: ["label", "amount"],
            additionalProperties: false
          }
        },
        subtotal: { type: "number" },
        tax: { type: "number" },
        total: { type: "number" }
      },
      required: ["receipt_id", "items"],
      additionalProperties: false
    },
    async run(args, ctx) {
      checkKeys(args, ["receipt_id", "items", "subtotal", "tax", "total"]);
      const receipt = await loadReceipt(ctx, id(args.receipt_id, "receipt_id"));
      const items = scannedItems(args.items);
      const scanned = {
        subtotal: amount(args.subtotal, "subtotal"),
        tax: amount(args.tax, "tax"),
        total: amount(args.total, "total")
      };

      const { pairs, unmatchedItems, unmatchedLines } = matchItems(receipt.lines, items);
      const matched = pairs.map(({ itemIndex, line, how, similarity }) => {
        const item = items[itemIndex];
        const difference = fromCents(toCents(item.amount) - toCents(line.amount));
        return {
          line_id: line.id,
          saved_label: line.label,
          ...(line.name ? { saved_name: line.name } : {}),
          scanned_label: item.label,
          saved_price: line.amount,
          scanned_price: item.amount,
          difference,
          matched_by: how,
          ...(how === "similar_label" ? { similarity } : {}),
          ...(line.ignored ? { ignored_in_app: true } : {})
        };
      });
      const priceDifferences = matched.filter((entry) => entry.difference !== 0 && !entry.ignored_in_app);
      const missingFromSaved = unmatchedItems.map((index) => ({
        scanned_label: items[index].label,
        scanned_price: items[index].amount,
        ...(items[index].itemCode ? { item_code: items[index].itemCode } : {})
      }));
      const notOnScan = unmatchedLines
        .filter((line) => !line.ignored)
        .map((line) => ({ line_id: line.id, saved_label: line.label, ...(line.name ? { saved_name: line.name } : {}), saved_price: line.amount }));

      const savedItems = sumOfItems(receipt.lines);
      const scannedSum = fromCents(items.reduce((sum, item) => sum + toCents(item.amount), 0));
      const compare = (saved, read) =>
        read === null ? { saved, scanned: null } : { saved, scanned: read, difference: fromCents(toCents(read) - toCents(saved ?? 0)) };
      const taxDiffers = scanned.tax !== null && toCents(scanned.tax) !== toCents(receipt.tax ?? 0);

      const suggestion = {
        receipt_id: receipt.id,
        expected_version: receipt.version,
        ...(priceDifferences.length > 0
          ? { line_prices: priceDifferences.map((entry) => ({ line_id: entry.line_id, amount: entry.scanned_price })) }
          : {}),
        ...(taxDiffers ? { tax: scanned.tax } : {}),
        ...(missingFromSaved.length > 0
          ? {
              add_lines: missingFromSaved.map((item) => ({
                label: item.scanned_label,
                amount: item.scanned_price,
                ...(item.item_code ? { item_code: item.item_code } : {})
              }))
            }
          : {})
      };
      const hasChanges = Object.keys(suggestion).length > 2;

      const findings = [];
      if (priceDifferences.length > 0) findings.push(`${priceDifferences.length} price difference(s)`);
      if (taxDiffers) findings.push("a different tax");
      if (missingFromSaved.length > 0) findings.push(`${missingFromSaved.length} scanned item(s) not on the saved receipt`);
      if (notOnScan.length > 0) findings.push(`${notOnScan.length} saved item(s) not found on the scan`);

      return {
        receipt_id: receipt.id,
        store: receipt.storeName,
        date: day(receipt.createdAt),
        summary: findings.length > 0 ? `Found ${findings.join(", ")}.` : "The scanned items match the saved receipt.",
        price_differences: priceDifferences,
        missing_from_saved: missingFromSaved,
        not_on_scan: notOnScan,
        totals: {
          sum_of_items: { saved: savedItems, scanned: scannedSum, difference: fromCents(toCents(scannedSum) - toCents(savedItems)) },
          subtotal: compare(receipt.subtotal, scanned.subtotal),
          tax: compare(receipt.tax, scanned.tax),
          total: compare(receipt.total, scanned.total)
        },
        matched,
        ...(hasChanges ? { suggested_update: suggestion } : {}),
        notes: [
          "Nothing has been changed. Show the user the differences and call update_receipt only with the changes they agree to.",
          ...(notOnScan.length > 0
            ? ["Saved items not found on the scan may just be worded differently; check them before suggesting ignore_line_ids."]
            : []),
          ...(missingFromSaved.length > 0
            ? ["Added items are on nobody until people are given: add a people list to each add_lines entry to split it."]
            : [])
        ]
      };
    }
  },
  {
    name: "update_receipt",
    title: "Correct a saved receipt",
    description:
      "Correct a saved receipt: change item prices, the tax or store name, add items that were missed (optionally split evenly between named people), or ignore/restore items so they do not count. The subtotal and total are recalculated from the items, as the app does, and each person's split follows the new prices. Pass expected_version from get_receipt or compare_receipt; if the receipt changed since, nothing is written and you should read it again. Only call this with changes the user has agreed to.",
    scope: SCOPE_WRITE,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        receipt_id: { type: "string" },
        expected_version: { type: "string", description: "The version from get_receipt or compare_receipt." },
        line_prices: {
          type: "array",
          maxItems: MAX_LINES,
          items: {
            type: "object",
            properties: { line_id: { type: "string" }, amount: { type: "number" } },
            required: ["line_id", "amount"],
            additionalProperties: false
          }
        },
        tax: { type: "number" },
        store_name: { type: "string" },
        add_lines: {
          type: "array",
          maxItems: MAX_LINES,
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              amount: { type: "number" },
              item_code: { type: "string" },
              is_food: { type: "boolean" },
              people: { type: "array", items: { type: "string" }, description: "Names (or \"me\") to split it evenly between." }
            },
            required: ["label", "amount"],
            additionalProperties: false
          }
        },
        ignore_line_ids: { type: "array", items: { type: "string" }, description: "Items to stop counting (reversible)." },
        restore_line_ids: { type: "array", items: { type: "string" }, description: "Ignored items to count again." }
      },
      required: ["receipt_id", "expected_version"],
      additionalProperties: false
    },
    async run(args, ctx) {
      requireWrite(ctx);
      checkKeys(args, ["receipt_id", "expected_version", "line_prices", "tax", "store_name", "add_lines", "ignore_line_ids", "restore_line_ids"]);
      const receiptId = id(args.receipt_id, "receipt_id");
      const version = typeof args.expected_version === "string" ? new Date(args.expected_version) : null;
      if (!version || Number.isNaN(version.getTime()) || version.toISOString() !== args.expected_version) {
        throw new ToolError("expected_version must be the version string from get_receipt or compare_receipt.");
      }

      const prices = list(args.line_prices, "line_prices", { max: MAX_LINES }).map((entry, index) => {
        const where = `line_prices[${index}]`;
        if (!isPlainObject(entry)) throw new ToolError(`${where} must be an object with line_id and amount.`);
        checkKeys(entry, ["line_id", "amount"], where);
        return { lineId: id(entry.line_id, `${where}.line_id`), amount: amount(entry.amount, `${where}.amount`, { required: true }) };
      });
      const ignore = list(args.ignore_line_ids, "ignore_line_ids", { max: MAX_LINES }).map((value, index) => id(value, `ignore_line_ids[${index}]`));
      const restore = list(args.restore_line_ids, "restore_line_ids", { max: MAX_LINES }).map((value, index) => id(value, `restore_line_ids[${index}]`));
      const additions = newItems(args.add_lines, "add_lines", { required: false });
      const tax = amount(args.tax, "tax");
      const storeName = text(args.store_name, "store_name");

      const touched = [...prices.map((entry) => entry.lineId), ...ignore, ...restore];
      if (new Set(prices.map((entry) => entry.lineId)).size !== prices.length) throw new ToolError("line_prices names a line twice.");
      if (new Set([...ignore, ...restore]).size !== ignore.length + restore.length) {
        throw new ToolError("A line cannot be both ignored and restored, or named twice.");
      }
      if (touched.length === 0 && additions.length === 0 && tax === null && storeName === null) {
        throw new ToolError("Nothing to change: give line_prices, tax, store_name, add_lines, ignore_line_ids or restore_line_ids.");
      }

      const outcome = await ctx.prisma.$transaction(async (tx) => {
        // Claim the receipt at the version the caller read. A concurrent edit
        // has moved updatedAt on, so this matches nothing and the update stops
        // here; one that commits while this runs waits on the row lock and is
        // then checked against the new value.
        const claimed = await tx.receipt.updateMany({
          where: { id: receiptId, userId: ctx.userId, updatedAt: version },
          data: { updatedAt: new Date() }
        });
        if (claimed.count === 0) {
          const exists = await tx.receipt.count({ where: { id: receiptId, userId: ctx.userId } });
          if (!exists) throw new ToolError(`No receipt with id ${receiptId}. Use list_receipts to find it.`);
          throw new ToolError("This receipt changed since you read it. Call get_receipt again and redo the comparison against the latest version.");
        }

        const before = await loadReceipt(ctx, receiptId, tx);
        const lines = new Map(before.lines.map((line) => [line.id, line]));
        for (const lineId of touched) {
          if (!lines.has(lineId)) throw new ToolError(`Line ${lineId} is not on this receipt.`);
        }
        if (before.lines.length + additions.length > MAX_LINES) throw new ToolError(`A receipt can hold at most ${MAX_LINES} items.`);

        const changes = [];
        const warnings = [];
        const byAmount = new Map();
        for (const entry of prices) {
          const line = lines.get(entry.lineId);
          if (toCents(line.amount) === toCents(entry.amount)) continue;
          byAmount.set(entry.amount, [...(byAmount.get(entry.amount) ?? []), entry.lineId]);
          changes.push({ line_id: line.id, label: line.label, old_price: line.amount, new_price: entry.amount });
          const custom = line.assignments.filter((assignment) => assignment.mode === "amount");
          if (custom.length > 0) {
            const customCents = custom.reduce((sum, assignment) => sum + toCents(assignment.value), 0);
            if (custom.length === line.assignments.length && customCents !== toCents(entry.amount)) {
              warnings.push(
                `"${line.label}" is split by custom amounts adding up to ${fromCents(customCents)}, not the new price ${entry.amount}. Adjust the split in the app.`
              );
            }
          }
        }
        for (const [newAmount, ids] of byAmount) {
          await tx.receiptLine.updateMany({ where: { id: { in: ids }, receiptId }, data: { amount: newAmount } });
        }
        const toIgnore = ignore.filter((lineId) => !lines.get(lineId).ignored);
        const toRestore = restore.filter((lineId) => lines.get(lineId).ignored);
        if (toIgnore.length > 0) await tx.receiptLine.updateMany({ where: { id: { in: toIgnore }, receiptId }, data: { ignored: true } });
        if (toRestore.length > 0) await tx.receiptLine.updateMany({ where: { id: { in: toRestore }, receiptId }, data: { ignored: false } });

        const firstSortOrder = before.lines.reduce((max, line) => Math.max(max, line.sortOrder), -1) + 1;
        const { created } = await insertLines(tx, ctx, receiptId, additions, firstSortOrder);

        const nextTax = tax ?? before.tax;
        await recomputeTotals(tx, receiptId, nextTax, storeName !== null ? { storeName } : {});
        const after = await loadReceipt(ctx, receiptId, tx);
        return { before, after, changes, warnings, created, ignored: toIgnore, restored: toRestore };
      }, TRANSACTION_OPTIONS);

      const { before, after } = outcome;
      return {
        updated: true,
        price_changes: outcome.changes,
        ...(tax !== null && toCents(tax) !== toCents(before.tax ?? 0) ? { tax_change: { old: before.tax, new: tax } } : {}),
        ...(storeName !== null && storeName !== before.storeName ? { store_change: { old: before.storeName, new: storeName } } : {}),
        added_items: additions.length,
        ignored_items: outcome.ignored.length,
        restored_items: outcome.restored.length,
        ...(outcome.created.length > 0 ? { people_added_to_account: outcome.created } : {}),
        totals: {
          subtotal: { old: before.subtotal, new: after.subtotal },
          tax: { old: before.tax, new: after.tax },
          total: { old: before.total, new: after.total }
        },
        ...(outcome.warnings.length > 0 ? { warnings: outcome.warnings } : {}),
        receipt: receiptDetail(after)
      };
    }
  },
  {
    name: "create_receipt",
    title: "Save a new receipt",
    description:
      "Save a receipt that is not in Receipt Ring yet, from items read off a photo. Check with list_receipts first that it is not already saved. Each item can be split evenly between named people (names from list_people, or \"me\"; a new name is added to the account's people). The photo itself is not stored. The subtotal and total are worked out from the items and tax.",
    scope: SCOPE_WRITE,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        store_name: { type: "string" },
        category: { type: "string", enum: CATEGORIES, default: "Groceries" },
        tax: { type: "number" },
        items: {
          type: "array",
          minItems: 1,
          maxItems: MAX_LINES,
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              amount: { type: "number" },
              item_code: { type: "string" },
              is_food: { type: "boolean" },
              ignored: { type: "boolean", description: "Kept on the receipt but not counted (e.g. a note line)." },
              people: { type: "array", items: { type: "string" } }
            },
            required: ["label", "amount"],
            additionalProperties: false
          }
        }
      },
      required: ["items"],
      additionalProperties: false
    },
    async run(args, ctx) {
      requireWrite(ctx);
      checkKeys(args, ["store_name", "category", "tax", "items"]);
      const storeName = text(args.store_name, "store_name");
      const category = args.category === undefined ? "Groceries" : args.category;
      if (!CATEGORIES.includes(category)) throw new ToolError(`category must be one of ${CATEGORIES.join(", ")}.`);
      const tax = amount(args.tax, "tax") ?? 0;
      const items = newItems(args.items, "items", { required: true });

      if (!ctx.isAdmin) {
        const limit = maxReceiptsPerUser();
        const saved = await ctx.prisma.receipt.count({ where: { userId: ctx.userId } });
        if (saved >= limit) {
          throw new ToolError(`The account has reached its limit of ${limit} saved receipts. Delete one in the app to save another.`);
        }
      }

      const { receiptId, created } = await ctx.prisma.$transaction(async (tx) => {
        const receipt = await tx.receipt.create({
          data: { userId: ctx.userId, storeName, category, tax },
          select: { id: true }
        });
        const { created } = await insertLines(tx, ctx, receipt.id, items, 0);
        await recomputeTotals(tx, receipt.id, tax);
        return { receiptId: receipt.id, created };
      }, TRANSACTION_OPTIONS);

      return {
        created: true,
        ...(created.length > 0 ? { people_added_to_account: created } : {}),
        receipt: receiptDetail(await loadReceipt(ctx, receiptId))
      };
    }
  }
];

const TOOLS_BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));

/** The tools this connection may call, as tools/list describes them. */
export function listTools(scopes) {
  return TOOLS.filter((tool) => scopes.has(tool.scope)).map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: { title: tool.title, ...tool.annotations }
  }));
}

export function findTool(name) {
  return typeof name === "string" ? TOOLS_BY_NAME.get(name) ?? null : null;
}

/**
 * Run a tool. Returns { data } or { error }, where an error is a message the
 * assistant may see; anything unexpected is logged and reported vaguely.
 */
export async function runTool(tool, args, ctx) {
  if (args !== undefined && !isPlainObject(args)) return { error: "arguments must be an object." };
  if (!ctx.scopes.has(tool.scope)) {
    return { error: "This connection can only read receipts. Create a token that allows changes in Receipt Ring's Settings." };
  }
  try {
    return { data: await tool.run(args ?? {}, ctx) };
  } catch (error) {
    if (error instanceof ToolError) return { error: error.message };
    console.error(`MCP tool ${tool.name} failed:`, error);
    return { error: "Receipt Ring could not finish that. Try again in a moment." };
  }
}
