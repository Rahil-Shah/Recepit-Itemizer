// Sorts one month's spending into budget categories with Gemini.
//
// Receipts are filed under whatever was picked in the Split tab (Groceries by
// default) and bank transactions under Plaid's own category, which is often
// vague ("GENERAL_MERCHANDISE") or simply wrong for the user. The spending
// ring was only ever as good as those labels. This pass hands the month's
// receipts and transactions to the model in one request, gets one category
// back for each from a fixed list, and stores it as `budgetCategory` beside
// the original -- which is kept, so nothing the user or the bank said is lost.
//
// The browser says which receipts and transactions make up the month: it
// already buckets them by the user's own timezone, which the server does not
// know. Every id is still checked against the caller's account here.

import {
  callGemini,
  describeUpstreamError,
  extractResponseText,
  parseJsonFromReply,
  resolveApiKeyOrRespond,
  serverGeminiModel
} from "./gemini.mjs";

/** What the ring can show. Anything else the model says becomes "Other". */
export const BUDGET_CATEGORIES = [
  "Groceries",
  "Dining",
  "Transport",
  "Travel",
  "Shopping",
  "Home",
  "Utilities",
  "Health",
  "Personal",
  "Entertainment",
  "Subscriptions",
  "Education",
  "Fees",
  "Other"
];

// One month of a busy account, with room to spare, and a hard ceiling on how
// big a prompt one request can build.
const MAX_IDS_PER_REQUEST = 400;
const MAX_LINES_PER_RECEIPT = 25;
const ID_PATTERN = /^[\w-]{1,64}$/;

export const CATEGORIZE_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many categorization runs. Give it a few minutes."
};

/** The request body checked, or `{ error }`. */
export function validateCategorizeRequest(body) {
  const month = typeof body?.month === "string" ? body.month.trim() : "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { error: "month must be YYYY-MM." };

  const ids = (value) =>
    Array.isArray(value) ? [...new Set(value.filter((id) => typeof id === "string" && ID_PATTERN.test(id)))] : [];
  const receiptIds = ids(body?.receiptIds);
  const transactionIds = ids(body?.transactionIds);

  if (receiptIds.length + transactionIds.length === 0) {
    return { error: "Nothing to categorize for this month." };
  }
  if (receiptIds.length + transactionIds.length > MAX_IDS_PER_REQUEST) {
    return { error: `Too much to categorize at once (max ${MAX_IDS_PER_REQUEST}).` };
  }
  return { month, receiptIds, transactionIds };
}

const clean = (value, max) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

/**
 * The prompt. Every entry is JSON-encoded, never interpolated raw: store names,
 * item labels and bank descriptions are all text someone else wrote.
 *
 * Ids are shortened to r1, t1... so the model copies a short token back rather
 * than a cuid it might mangle, and so the reply maps back without guesswork.
 */
export function buildCategorizePrompt(entries, month) {
  return `You sort a person's spending for ${month} into budget categories.

Choose exactly one category for each entry from this list, spelled exactly as written:
${BUDGET_CATEGORIES.join(", ")}

Guidance:
- Groceries: supermarkets and food bought to cook at home. A receipt mostly of household goods from a grocery store is Shopping or Home instead - read its items.
- Dining: restaurants, cafes, bars, takeout and food delivery.
- Transport: fuel, rideshare, transit, parking, tolls. Travel: flights, hotels, car rental, trips.
- Shopping: general merchandise, clothing, electronics, online marketplaces.
- Home: furniture, household supplies, hardware, rent. Utilities: power, water, internet, phone.
- Subscriptions: recurring digital services (streaming, software, memberships).
- Fees: bank fees, interest, late fees. Education: tuition, books, courses.
- The current category is only a weak hint; it is often a default or a bank guess.
- Use the items on a receipt and the amount as evidence. Use "Other" only when nothing fits.

Entries:
${JSON.stringify(entries, null, 2)}

Return ONLY valid JSON, no markdown, in exactly this shape, with one item for every id:
{ "items": [ { "id": "r1", "category": "Groceries" } ] }`;
}

/**
 * The model's reply reduced to `{ shortId: category }`, for ids that were
 * asked about and categories that are on the list.
 */
export function normalizeCategorizeResponse(parsed, wantedIds) {
  const wanted = new Set(wantedIds);
  const byLower = new Map(BUDGET_CATEGORIES.map((name) => [name.toLowerCase(), name]));
  const out = new Map();
  for (const item of Array.isArray(parsed?.items) ? parsed.items : []) {
    const id = typeof item?.id === "string" ? item.id.trim() : "";
    if (!wanted.has(id) || out.has(id)) continue;
    const category = byLower.get(clean(item?.category, 40).toLowerCase());
    out.set(id, category ?? "Other");
  }
  return out;
}

export function registerBudgetCategorize(app, requireAuth, prisma, limiters = []) {
  const guards = [requireAuth, ...[limiters].flat().filter(Boolean)];

  app.post("/api/budget/categorize", ...guards, async (req, res) => {
    const request = validateCategorizeRequest(req.body);
    if (request.error) return res.status(400).json({ error: request.error });

    const apiKey = await resolveApiKeyOrRespond(prisma, req, res);
    if (!apiKey) return;
    const model = String(req.body?.model || serverGeminiModel());

    try {
      const receipts = request.receiptIds.length
        ? await prisma.receipt.findMany({
            where: { id: { in: request.receiptIds }, userId: req.userId },
            select: {
              id: true,
              storeName: true,
              category: true,
              total: true,
              lines: {
                where: { ignored: false },
                orderBy: { sortOrder: "asc" },
                take: MAX_LINES_PER_RECEIPT,
                select: { label: true, resolvedName: true, amount: true }
              }
            }
          })
        : [];
      // Bank transactions are an admin feature; a regular account has none,
      // and any ids it sends are simply not found.
      const transactions =
        req.isAdmin && request.transactionIds.length
          ? await prisma.bankTransaction.findMany({
              where: { id: { in: request.transactionIds }, account: { connection: { userId: req.userId } } },
              select: { id: true, description: true, amount: true, category: true }
            })
          : [];

      const entries = [];
      const realIds = new Map();
      receipts.forEach((receipt, index) => {
        const shortId = `r${index + 1}`;
        realIds.set(shortId, { kind: "receipt", id: receipt.id });
        entries.push({
          id: shortId,
          type: "receipt",
          store: clean(receipt.storeName, 120) || "unknown",
          total: receipt.total === null ? null : Number(receipt.total),
          currentCategory: receipt.category,
          items: receipt.lines.map((line) => clean(line.resolvedName || line.label, 80)).filter(Boolean)
        });
      });
      transactions
        .filter((txn) => Number(txn.amount) < 0)
        .forEach((txn, index) => {
          const shortId = `t${index + 1}`;
          realIds.set(shortId, { kind: "transaction", id: txn.id });
          entries.push({
            id: shortId,
            type: "bank transaction",
            description: clean(txn.description, 160) || "unknown",
            amount: Math.abs(Number(txn.amount)),
            currentCategory: txn.category
          });
        });

      if (entries.length === 0) {
        return res.json({ updated: 0, receipts: {}, transactions: {} });
      }

      const upstream = await callGemini({
        apiKey,
        model,
        parts: [{ text: buildCategorizePrompt(entries, request.month) }]
      });
      if (!upstream.ok) {
        console.error("Gemini categorize error:", upstream.status, upstream.text.slice(0, 300));
        return res.status(upstream.status === 400 ? 400 : 502).json({
          error: `Could not categorize this month: ${describeUpstreamError(upstream)}`
        });
      }

      const answers = normalizeCategorizeResponse(
        parseJsonFromReply(extractResponseText(upstream.text)),
        [...realIds.keys()]
      );

      const result = { receipts: {}, transactions: {} };
      const writes = [];
      for (const [shortId, category] of answers) {
        const target = realIds.get(shortId);
        if (target.kind === "receipt") {
          result.receipts[target.id] = category;
          writes.push(
            prisma.receipt.updateMany({
              where: { id: target.id, userId: req.userId },
              data: { budgetCategory: category }
            })
          );
        } else {
          result.transactions[target.id] = category;
          writes.push(
            prisma.bankTransaction.updateMany({
              where: { id: target.id, account: { connection: { userId: req.userId } } },
              data: { budgetCategory: category }
            })
          );
        }
      }
      await prisma.$transaction(writes);

      res.json({ updated: writes.length, ...result });
    } catch (error) {
      console.error("Budget categorization failed:", error);
      if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        return res.status(504).json({ error: "Categorizing took too long. Try again." });
      }
      res.status(502).json({ error: "Could not read the categorization result." });
    }
  });
}
