// Server-side item identification.
//
// Receipts print shorthand -- "GV SHRD MOZZ 8Z", "0007874203922" -- and the
// browser has already tried its alias table and its abbreviation dictionary by
// the time a line reaches here. What arrives is the residue: the lines nobody
// could place for free. They go to Gemini in one batch, because forty separate
// requests for one receipt is forty times the latency and forty times the bill.
//
// The Gemini key never leaves the server; this route resolves it exactly the
// way /api/gemini/parse does, through the shared helpers.

import {
  GOOGLE_SEARCH_TOOL,
  callGemini,
  describeUpstreamError,
  extractResponseText,
  parseJsonFromReply,
  resolveApiKeyOrRespond,
  serverGeminiModel
} from "./gemini.mjs";

// One receipt's worth of lines. Well past any real receipt, and low enough that
// a scripted caller cannot turn one request into an unbounded prompt.
const MAX_ITEMS_PER_REQUEST = 120;
// Labels are receipt text, not prose. Anything longer is not a label.
const MAX_LABEL_LENGTH = 200;
const MAX_STORE_NAME_LENGTH = 120;
const MAX_ALTERNATIVES = 3;
// Upstream statuses that mean "grounding is not available to you", as opposed
// to "your request was wrong". Both are worth retrying without the tool.
const GROUNDING_FALLBACK_STATUSES = new Set([400, 429]);

const PROMPT_HEADER = `You identify exactly which product each line of a store receipt refers to. You have Google Search. Use it.

Each item gives you the store name, the exact text printed on the receipt, the item code printed beside it when there is one, and the price paid.

THE ITEM CODE IS THE PRIMARY EVIDENCE. It is the retailer's own SKU/PLU/DPCI for that product, and it identifies the product exactly, which the abbreviated text never can. When an item has a code:

1. Search the web for it, together with the store name - for example: Walmart 007874203922, or "007874203922" site:walmart.com. Retailers publish their own item numbers on the product page, and resellers and receipt-scanner sites index them too.
2. Trust what the search returns about the code over your own reading of the abbreviated text. If the code resolves to "Great Value Finely Shredded Mozzarella Cheese, 8 oz" then that is the item, even if the receipt text looked like something else.
3. Only fall back to decoding the abbreviation when the code returns nothing usable.
4. Never treat the code as a quantity, a price, or a date.

When an item has no code, decode the abbreviation using the store name and the price, and search for the decoded name plus the store when you are unsure.

Confidence rules - these matter more than being decisive:

- 0.9 or above: a search confirmed the code (or the exact product) at this retailer.
- 0.6 to 0.9: confident decoding of the abbreviation, no direct confirmation.
- 0.4 to 0.6: a plausible reading you could not confirm.
- Below 0.4: guessing. Say so. A wrong name stated confidently is worse than an honest "unsure", because nobody will check it.

Other rules:

- Use the price as a sanity check. A "STK" at $46.00 is a steak; at $4.60 it is not.
- Give up to 3 alternatives when genuinely ambiguous. Leave alternatives empty when it is not.
- brand and size are optional. Omit rather than invent.
- reasoning is one short sentence. When a search settled it, say what the code resolved to.
- Return one entry for every id you were given, and none for ids you were not given. Do not merge, split, reorder or invent items.
- Return valid JSON only. No markdown, no backticks, no commentary before or after.

Return JSON in exactly this shape:
{
  "items": [
    {
      "id": "the id you were given, copied exactly",
      "name": "Full Product Name",
      "brand": "Brand or null",
      "size": "8 oz or null",
      "confidence": 0.0,
      "reasoning": "one short sentence",
      "alternatives": [{ "name": "Other Possible Product", "confidence": 0.0 }]
    }
  ]
}

Return ONLY valid JSON. No other text.`;

/**
 * The request body, checked and trimmed, or a string describing why it is not
 * usable. Everything here reaches a prompt, so nothing is taken on trust: the
 * ids are echoed back and matched by the browser, and the labels are text a
 * caller controls.
 */
export function validateIdentifyRequest(body) {
  const items = Array.isArray(body?.items) ? body.items : null;
  if (!items) return { error: "items must be an array." };
  if (items.length === 0) return { error: "items must not be empty." };
  if (items.length > MAX_ITEMS_PER_REQUEST) {
    return { error: `Too many items in one request (max ${MAX_ITEMS_PER_REQUEST}).` };
  }

  const seen = new Set();
  const cleaned = [];
  for (const item of items) {
    const id = typeof item?.id === "string" ? item.id.trim() : "";
    const label = typeof item?.label === "string" ? item.label.trim() : "";
    if (!id || !label) return { error: "Every item needs an id and a label." };
    if (id.length > 64) return { error: "An item id is too long." };
    // Duplicate ids would make the reply ambiguous: two entries could come
    // back for one row and there would be no way to say which won.
    if (seen.has(id)) return { error: "Item ids must be unique." };
    seen.add(id);

    const itemCode = typeof item?.itemCode === "string" ? item.itemCode.trim() : "";
    const amount = Number(item?.amount);

    cleaned.push({
      id,
      label: label.slice(0, MAX_LABEL_LENGTH),
      itemCode: /^\d{1,20}$/.test(itemCode) ? itemCode : null,
      amount: Number.isFinite(amount) ? Number(amount.toFixed(2)) : null
    });
  }

  const storeName = typeof body?.storeName === "string" ? body.storeName.trim() : "";

  return { items: cleaned, storeName: storeName.slice(0, MAX_STORE_NAME_LENGTH) };
}

/** The prompt for one batch. Item text is JSON-encoded, never interpolated raw. */
export function buildIdentifyPrompt(items, storeName) {
  const context = storeName ? `Store: ${storeName}` : "Store: unknown";
  const lines = items.map((item) => ({
    id: item.id,
    // itemCode is listed before receiptText deliberately. Field order is the
    // cheapest hint available about which evidence matters, and the whole
    // point of this pass is that the code beats the abbreviation.
    ...(item.itemCode ? { itemCode: item.itemCode } : {}),
    receiptText: item.label,
    ...(item.amount !== null ? { price: item.amount } : {})
  }));

  const coded = lines.filter((line) => line.itemCode !== undefined).length;
  const codeNote =
    coded > 0
      ? `\n\n${coded} of these ${lines.length} items printed an item code. Search for those codes first.`
      : "\n\nNone of these items printed an item code, so decode the abbreviations.";

  return `${PROMPT_HEADER}\n\n${context}${codeNote}\n\nItems:\n${JSON.stringify(lines, null, 2)}`;
}

// A model's self-reported confidence is a number it chose. Treat it as a hint
// with a range, not as a measurement: clamp it, and reject anything that is not
// a number at all rather than letting NaN travel.
function clampConfidence(value) {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return 0;
  return Math.max(0, Math.min(1, Number(confidence.toFixed(2))));
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") return null;
  // Collapse whitespace so a name cannot carry newlines into the UI.
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.toLowerCase() === "null") return null;
  return text.slice(0, maxLength);
}

/**
 * The ceiling for an answer produced without a search.
 *
 * The prompt reserves 0.9 and above for "a search confirmed this", so a model
 * that could not search has not earned that band -- and it will claim it
 * anyway. Asked to identify SKU 007874203922 with grounding unavailable, this
 * one answered 0.95 and gave "Search for item code 007874203922 at Walmart
 * confirmed this exact product" as its reasoning, describing a search that
 * never happened.
 *
 * The name was in fact correct, so the answer is worth keeping. What is not
 * worth keeping is the top band: 0.85 still reads as confident in the UI while
 * leaving 0.9+ to mean what it says.
 */
const UNGROUNDED_CONFIDENCE_CEILING = 0.85;

function capUngrounded(confidence, grounded) {
  return grounded ? confidence : Math.min(confidence, UNGROUNDED_CONFIDENCE_CEILING);
}

/**
 * The model's reply, reduced to what is safe to hand back.
 *
 * Only ids that were asked about survive, each at most once. Everything else
 * is dropped: an entry for an id nobody asked about is either a hallucination
 * or a mistake, and neither belongs on a receipt.
 */
export function normalizeIdentifyResponse(parsed, requestedIds, grounded = true) {
  const wanted = new Set(requestedIds);
  const answered = new Set();
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  const out = [];

  for (const item of items) {
    const id = typeof item?.id === "string" ? item.id.trim() : "";
    if (!wanted.has(id) || answered.has(id)) continue;

    const name = cleanText(item?.name, MAX_LABEL_LENGTH);
    if (!name) continue;
    answered.add(id);

    const alternatives = (Array.isArray(item?.alternatives) ? item.alternatives : [])
      .map((alternative) => ({
        name: cleanText(alternative?.name, MAX_LABEL_LENGTH),
        confidence: clampConfidence(alternative?.confidence)
      }))
      // An alternative identical to the winner is not an alternative.
      .filter((alternative) => alternative.name && alternative.name !== name)
      .slice(0, MAX_ALTERNATIVES);

    out.push({
      id,
      name,
      brand: cleanText(item?.brand, 80),
      size: cleanText(item?.size, 40),
      confidence: capUngrounded(clampConfidence(item?.confidence), grounded),
      reasoning: cleanText(item?.reasoning, 240),
      alternatives
    });
  }

  return out;
}

// Keys and names are user text that is stored and echoed back, so bound them.
const MAX_LOOKUP_KEY_LENGTH = 200;
const MAX_STORE_KEY_LENGTH = 120;

/** One alias from the browser, checked, or null when it is not usable. */
export function validateAlias(body) {
  const lookupKey = typeof body?.lookupKey === "string" ? body.lookupKey.trim() : "";
  const resolvedName = typeof body?.resolvedName === "string" ? body.resolvedName.replace(/\s+/g, " ").trim() : "";
  if (!lookupKey || !resolvedName) return null;
  if (lookupKey.length > MAX_LOOKUP_KEY_LENGTH) return null;

  const storeKey = typeof body?.storeKey === "string" ? body.storeKey.trim().toLowerCase() : "";
  const brand = typeof body?.brand === "string" ? body.brand.trim() : "";
  const size = typeof body?.size === "string" ? body.size.trim() : "";

  return {
    lookupKey,
    storeKey: storeKey.slice(0, MAX_STORE_KEY_LENGTH),
    resolvedName: resolvedName.slice(0, MAX_LABEL_LENGTH),
    brand: brand ? brand.slice(0, 80) : null,
    size: size ? size.slice(0, 40) : null
  };
}

function serializeAlias(alias) {
  return {
    lookupKey: alias.lookupKey,
    storeKey: alias.storeKey,
    resolvedName: alias.resolvedName,
    ...(alias.brand ? { brand: alias.brand } : {}),
    ...(alias.size ? { size: alias.size } : {}),
    timesConfirmed: alias.timesConfirmed,
    updatedAt: alias.updatedAt.toISOString()
  };
}

/**
 * Whether the alias table is actually reachable.
 *
 * `prisma.itemAlias` is undefined when the generated client predates the model
 * -- which is exactly what happens after pulling a schema change without
 * regenerating. That produced a TypeError deep inside the route and a 500 with
 * a stack trace, when the honest answer is that this feature is not wired up
 * yet on this machine.
 */
function aliasStoreReady(prisma) {
  return Boolean(prisma?.itemAlias);
}

export function registerItemIdentity(app, requireAuth, prisma, identifyLimiter) {
  const aliasUnavailable = (res) =>
    res.status(503).json({
      error: "Saved item names are unavailable. Run `npm run db:migrate` to set them up."
    });

  // Every alias this user has. The browser does its own lookups against the
  // whole set rather than asking per line: a receipt is forty questions, the
  // table is small, and forty round trips to answer them would be slower than
  // the model call this is meant to avoid.
  app.get("/api/item-aliases", requireAuth, async (req, res) => {
    if (!aliasStoreReady(prisma)) return aliasUnavailable(res);
    try {
      const aliases = await prisma.itemAlias.findMany({
        where: { userId: req.userId },
        orderBy: { updatedAt: "desc" }
      });
      res.json({ aliases: aliases.map(serializeAlias) });
    } catch (error) {
      console.error("Failed to load item aliases:", error);
      res.status(500).json({ error: "Could not load your saved item names." });
    }
  });

  // Confirm a name. Confirming the same name again counts up; correcting it to
  // a different one starts the count over, so a fresh answer cannot inherit
  // the authority of the one it replaced.
  app.put("/api/item-aliases", requireAuth, async (req, res) => {
    if (!aliasStoreReady(prisma)) return aliasUnavailable(res);

    const alias = validateAlias(req.body);
    if (!alias) {
      return res.status(400).json({ error: "An alias needs a lookup key and a name." });
    }

    try {
      const key = {
        userId_storeKey_lookupKey: {
          userId: req.userId,
          storeKey: alias.storeKey,
          lookupKey: alias.lookupKey
        }
      };
      const existing = await prisma.itemAlias.findUnique({ where: key });
      const timesConfirmed =
        existing && existing.resolvedName === alias.resolvedName ? existing.timesConfirmed + 1 : 1;

      const saved = await prisma.itemAlias.upsert({
        where: key,
        create: { userId: req.userId, ...alias, timesConfirmed },
        update: { ...alias, timesConfirmed }
      });
      res.json(serializeAlias(saved));
    } catch (error) {
      console.error("Failed to save item alias:", error);
      res.status(500).json({ error: "Could not save that name." });
    }
  });

  // Forget one. The key travels in the query string rather than the path: a
  // lookup key is arbitrary user text and would need escaping to survive a
  // path segment intact.
  app.delete("/api/item-aliases", requireAuth, async (req, res) => {
    if (!aliasStoreReady(prisma)) return aliasUnavailable(res);

    const lookupKey = typeof req.query?.lookupKey === "string" ? req.query.lookupKey : "";
    if (!lookupKey) return res.status(400).json({ error: "lookupKey is required." });
    const storeKey = typeof req.query?.storeKey === "string" ? req.query.storeKey.toLowerCase() : "";

    try {
      // deleteMany rather than delete: it scopes to this user in the same
      // statement and answers 0 instead of throwing when there is no such row.
      const { count } = await prisma.itemAlias.deleteMany({
        where: { userId: req.userId, storeKey, lookupKey }
      });
      res.json({ deleted: count });
    } catch (error) {
      console.error("Failed to delete item alias:", error);
      res.status(500).json({ error: "Could not forget that name." });
    }
  });

  const guards = identifyLimiter ? [requireAuth, identifyLimiter] : [requireAuth];

  // Identify a batch of receipt lines. The browser sends only what its own free
  // tiers could not place, so a well-worn account sends very little.
  app.post("/api/items/identify", ...guards, async (req, res) => {
    const request = validateIdentifyRequest(req.body);
    if (request.error) {
      return res.status(400).json({ error: request.error });
    }

    const apiKey = await resolveApiKeyOrRespond(prisma, req, res);
    if (!apiKey) return;

    const model = String(req.body?.model || serverGeminiModel());

    const parts = [{ text: buildIdentifyPrompt(request.items, request.storeName) }];

    try {
      // Grounded first: a store SKU means nothing to a model's own memory, but
      // it is often a single search away -- retailers put their own item
      // numbers on the product page.
      let grounded = true;
      let upstream = await callGemini({ apiKey, model, parts, tools: GOOGLE_SEARCH_TOOL });

      // Falling back beats failing. An ungrounded answer is worth more than
      // none, and without this the whole feature goes dark for anyone whose
      // key cannot ground right now.
      //
      // Two ways that happens, and neither is announced as a capability flag
      // we could check up front:
      //   400 - the model or project does not have search enabled at all.
      //   429 - search grounding carries its own quota, separate from
      //         generateContent's. It is entirely normal to have quota for the
      //         plain call and none for the grounded one, which showed up here
      //         as an ungrounded request returning 200 while a grounded one to
      //         the same model, seconds apart, returned 429.
      if (!upstream.ok && GROUNDING_FALLBACK_STATUSES.has(upstream.status)) {
        console.warn(
          `Grounded identify unavailable (${upstream.status}), retrying without search:`,
          upstream.text.slice(0, 200)
        );
        upstream = await callGemini({ apiKey, model, parts });
        grounded = false;
      }

      if (!upstream.ok) {
        console.error("Gemini identify error:", upstream.status, upstream.text.slice(0, 300));
        return res.status(upstream.status === 400 ? 400 : 502).json({
          error: `Could not identify these items: ${describeUpstreamError(upstream)}`
        });
      }

      const parsed = parseJsonFromReply(extractResponseText(upstream.text));
      const items = normalizeIdentifyResponse(
        parsed,
        request.items.map((item) => item.id),
        grounded
      );

      // Told to the browser so a caller can say why an answer is weaker than
      // usual: without a search the model is working from the abbreviation
      // alone, which is exactly the case this pass exists to improve on.
      res.json({ items, grounded });
    } catch (error) {
      console.error("Item identification failed:", error);
      if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        return res.status(504).json({ error: "Identifying these items took too long. Try again." });
      }
      // A model that returns prose instead of JSON is a bad gateway, not a
      // server error: nothing here is broken and retrying may well work.
      res.status(502).json({ error: "Could not read the identification result." });
    }
  });
}
