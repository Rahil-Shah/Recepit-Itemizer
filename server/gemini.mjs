// Server-side Gemini proxy.
//
// Gemini API keys are secrets and must NEVER be sent to the browser. The client
// uploads the receipt image here and the server calls Gemini with a key it
// holds. A user may supply their own key (stored encrypted at rest, keyed to
// their account); when they haven't, the shared key from process env is used.
// Either way the key stays server-side.

import { encryptSecret, decryptSecret } from "./crypto.mjs";

const GEMINI_HOST = "https://generativelanguage.googleapis.com";
// Gemini model ids are interpolated into the request URL, so constrain them to
// a safe character set to avoid path traversal / URL injection.
const MODEL_RE = /^[A-Za-z0-9._-]+$/;
// Google API keys are ASCII alphanumerics plus - and _ (typically ~39 chars).
// Constrain user input to that set: the key is placed in the request URL, so a
// strict allowlist blocks URL/query injection and stray control characters,
// and caps length to bound abuse.
const API_KEY_RE = /^[A-Za-z0-9_-]{20,200}$/;
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
// Formats Gemini accepts for inline image data. An open /^image\// test let
// "image/" plus arbitrary trailing text through to Google verbatim.
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
// Roughly 8 MB of base64, comfortably inside the route's 16 MB body cap. The
// body limit alone let a caller park a 16 MB buffer per in-flight request.
const MAX_IMAGE_BASE64_LENGTH = 8 * 1024 * 1024;
// Without a deadline, a hung upstream connection pinned a socket and its
// buffer indefinitely.
const UPSTREAM_TIMEOUT_MS = 90_000;

const PROMPT_TEXT = `You are an expert receipt parser. Extract only what is directly shown on the receipt.

CRITICAL RULE: The price field is ALWAYS the single price shown next to each item on the receipt.

Discount field rules:
- Set discount to 0 UNLESS the receipt explicitly shows BOTH an original/regular price AND a final/reduced price for the same item
- Example: "Item $20 (reg $25)" → price: 20, discount: 5
- Example: "Item $20" with "Discount -$5" nearby → price: 20, discount: 0 (don't guess original price)
- NEVER calculate or infer discount amounts - only extract if both prices are shown

Rules:

1. For each item, extract the ONE price shown next to it on the receipt - this is the amount the customer paid.
2. Extract discount ONLY if the receipt shows an original price and a final price for that item. Then discount = original - final.
3. Never invent or infer a discount amount - if only one price is shown, discount is always 0.
4. Preserve item order exactly as it appears on the receipt.
5. Ignore store addresses, phone numbers, loyalty info, payment methods, card numbers, receipt IDs.
5a. If an item line prints a product code / SKU / PLU beside it, return it verbatim as itemCode (digits only, keep leading zeros). Omit itemCode or use null when the line prints no code. Never invent one, and never use the receipt ID or a card number as an item code.
6. Do not invent items.
7. If text is unclear, make the best reasonable interpretation.
8. Return valid JSON only - no markdown, no explanations, just JSON.
9. All prices must be numeric values (positive).
10. Extract subtotal, tax, and total from the receipt.
11. If confidence is low for an item name, still include the item but add a lowConfidence flag.

Return JSON in exactly this format, with no backticks or markdown:
{
  "storeName": "Store Name or null",
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00,
  "items": [
    {
      "name": "Item Name",
      "itemCode": "0001234567890 or null",
      "price": 0.00,
      "discount": 0.00,
      "lowConfidence": false
    }
  ]
}

Return ONLY valid JSON. No other text.`;

// Codes end up in lookup keys and on screen, so keep them to what a SKU
// actually is. Anything else the model puts in the field -- the string "null",
// a store name, a card number it was told not to read -- is dropped rather
// than passed on as if it were a fact about the item.
const ITEM_CODE_RE = /^\d{4,20}$/;

function normalizeItemCode(value) {
  const code = typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
  return ITEM_CODE_RE.test(code) ? code : null;
}

// Validate receipt data and reconcile discount handling.
// Prices shown on receipt are what customer actually paid.
// Discounts shown are only applied if the math requires it.
function validateAndReconcileReceipt(data) {
  if (!data.items || !Array.isArray(data.items)) {
    return data;
  }

  data.items = data.items.map((item) => ({ ...item, itemCode: normalizeItemCode(item?.itemCode) }));

  const tax = Number(data.tax) || 0;
  const total = Number(data.total) || 0;
  const expectedSubtotal = total - tax;

  // First, try prices as-is (without applying discounts)
  // This assumes prices shown are what customer paid
  let sumWithoutDiscounts = 0;
  data.items.forEach((item) => {
    const price = Number(item.price) || 0;
    sumWithoutDiscounts += price;
  });

  const withoutDiscountMatch = Math.abs(sumWithoutDiscounts - expectedSubtotal) < 0.01;

  if (withoutDiscountMatch) {
    // Prices as shown match the total - discounts are informational only
    // Remove all discount metadata
    data.items = data.items.map((item) => ({
      ...item,
      discount: 0
    }));
    return data;
  }

  // If prices alone don't match, check if we need to apply the discounts
  let sumWithDiscounts = 0;
  data.items.forEach((item) => {
    const price = Number(item.price) || 0;
    const discount = Number(item.discount) || 0;
    sumWithDiscounts += price - discount;
  });

  const withDiscountMatch = Math.abs(sumWithDiscounts - expectedSubtotal) < 0.01;

  if (withDiscountMatch) {
    // Discounts need to be applied - keep them
    return data;
  }

  // If neither works, return as-is (let client handle)
  return data;
}

// Raised when a user has a stored key that can no longer be decrypted — most
// likely because TOKEN_ENCRYPTION_KEY was rotated.
class UndecryptableKeyError extends Error {}

export function hasServerGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function serverGeminiModel() {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

// Read a user's stored key. Returns the key, or null when they have none.
// Throws UndecryptableKeyError when a key is stored but cannot be read.
async function readUserKey(prisma, userId) {
  if (!prisma || !userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { geminiKeyCiphertext: true, geminiKeyIv: true, geminiKeyAuthTag: true }
  });
  if (!user?.geminiKeyCiphertext || !user.geminiKeyIv || !user.geminiKeyAuthTag) {
    return null;
  }
  try {
    return decryptSecret({
      ciphertext: user.geminiKeyCiphertext,
      iv: user.geminiKeyIv,
      authTag: user.geminiKeyAuthTag
    });
  } catch (error) {
    console.error("Failed to decrypt stored Gemini key:", error);
    throw new UndecryptableKeyError();
  }
}

// Resolve the key to call Gemini with: the user's own key when they've saved
// one, otherwise the shared server key. Returns "" when neither exists.
//
// An undecryptable personal key used to fall through to the shared key while
// the config endpoint kept reporting hasUserKey: true. After an encryption
// key rotation that quietly moved every user onto the operator's key and
// quota, with nothing but a log line to say so. Surface it instead.
export async function resolveApiKey(prisma, userId) {
  const userKey = await readUserKey(prisma, userId);
  return userKey ?? process.env.GEMINI_API_KEY ?? "";
}

// Reports whether a usable personal key exists, so the UI cannot claim a key
// is in use when it can no longer be read.
async function userHasKey(prisma, userId) {
  try {
    return (await readUserKey(prisma, userId)) !== null;
  } catch {
    return false;
  }
}

/**
 * Turns a failure to resolve a key into the response the caller should get,
 * or null when a key was found. Every route that calls Gemini owes the user
 * the same two answers -- "re-enter your key" and "no key is configured" --
 * and having each one reinvent them is how they drift apart.
 */
export async function resolveApiKeyOrRespond(prisma, req, res) {
  let apiKey;
  try {
    apiKey = await resolveApiKey(prisma, req.userId);
  } catch (error) {
    if (error instanceof UndecryptableKeyError) {
      res.status(400).json({
        error: "Your saved Gemini key can no longer be read. Please re-enter it in Settings."
      });
      return null;
    }
    throw error;
  }
  if (!apiKey) {
    res.status(503).json({ error: "No Gemini key is configured." });
    return null;
  }
  return apiKey;
}

/**
 * One call to Gemini's generateContent, with the guards every caller needs:
 * a validated model id (it is interpolated into the URL), a deadline so a hung
 * upstream cannot pin a socket indefinitely, and the key kept out of the
 * returned error text.
 *
 * Resolves to { ok, status, text }. Upstream failures are reported, not thrown
 * -- each route words its own error, and a 429 from Google is not a bug here.
 */
export async function callGemini({ apiKey, model, parts }) {
  if (!MODEL_RE.test(model)) {
    return { ok: false, status: 400, text: "Invalid model name." };
  }

  const url = `${GEMINI_HOST}/v1/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const startTime = Date.now();

  const upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }] }),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
  });

  console.log(`Gemini response received in ${Date.now() - startTime}ms`);
  return { ok: upstream.ok, status: upstream.status, text: await upstream.text() };
}

/**
 * A short, safe description of an upstream failure. Google's error bodies are
 * JSON when they are JSON and HTML when they are not, so parse defensively and
 * truncate -- this string goes to the browser.
 */
export function describeUpstreamError(upstream) {
  try {
    const body = JSON.parse(upstream.text);
    const message = body?.error?.message || body?.message || "Unknown error";
    return `${upstream.status} - ${String(message).slice(0, 100)}`;
  } catch {
    return `status ${upstream.status}`;
  }
}

/** Pulls the model's text out of a generateContent response body. */
export function extractResponseText(rawBody) {
  const json = JSON.parse(rawBody);
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || !text) {
    throw new Error("No response text returned from Gemini.");
  }
  return text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
}

export function registerGemini(app, requireAuth, prisma) {

  // Non-secret config for the browser: model, whether a shared server key
  // exists, and whether this user has saved a personal key. The key values
  // themselves are deliberately never returned.
  app.get("/api/gemini-config", requireAuth, async (req, res) => {
    res.json({
      GEMINI_MODEL: serverGeminiModel(),
      hasServerKey: hasServerGeminiKey(),
      hasUserKey: await userHasKey(prisma, req.userId)
    });
  });

  // Save (or replace) this user's personal Gemini key. The plaintext key is
  // validated, encrypted, and stored; it is never echoed back.
  app.put("/api/gemini-key", requireAuth, async (req, res) => {
    if (!prisma) {
      return res.status(503).json({ error: "Key storage is unavailable." });
    }
    const apiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
    if (!API_KEY_RE.test(apiKey)) {
      return res.status(400).json({ error: "That doesn't look like a valid Gemini API key." });
    }
    try {
      const encrypted = encryptSecret(apiKey);
      await prisma.user.update({
        where: { id: req.userId },
        data: {
          geminiKeyCiphertext: encrypted.ciphertext,
          geminiKeyIv: encrypted.iv,
          geminiKeyAuthTag: encrypted.authTag
        }
      });
      res.json({ hasUserKey: true });
    } catch (error) {
      console.error("Failed to store Gemini key:", error);
      res.status(500).json({ error: "Could not save the key." });
    }
  });

  // Remove this user's personal key, reverting to the shared server key.
  app.delete("/api/gemini-key", requireAuth, async (req, res) => {
    if (!prisma) {
      return res.status(503).json({ error: "Key storage is unavailable." });
    }
    try {
      await prisma.user.update({
        where: { id: req.userId },
        data: { geminiKeyCiphertext: null, geminiKeyIv: null, geminiKeyAuthTag: null }
      });
      res.json({ hasUserKey: false, hasServerKey: hasServerGeminiKey() });
    } catch (error) {
      console.error("Failed to clear Gemini key:", error);
      res.status(500).json({ error: "Could not clear the key." });
    }
  });

  // Proxy a single receipt image to Gemini using the resolved server-held key.
  app.post("/api/gemini/parse", requireAuth, async (req, res) => {
    const apiKey = await resolveApiKeyOrRespond(prisma, req, res);
    if (!apiKey) return;

    const imageBase64 = typeof req.body?.imageBase64 === "string" ? req.body.imageBase64 : "";
    const mimeType = typeof req.body?.mimeType === "string" ? req.body.mimeType : "";
    const model = String(req.body?.model || serverGeminiModel());

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: "imageBase64 and mimeType are required." });
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({ error: "Unsupported image type." });
    }
    if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      return res.status(413).json({ error: "That image is too large. Try a smaller photo." });
    }
    if (!MODEL_RE.test(model)) {
      return res.status(400).json({ error: "Invalid model name." });
    }

    try {
      console.log("Sending request to Gemini...");
      const upstream = await callGemini({
        apiKey,
        model,
        parts: [{ text: PROMPT_TEXT }, { inlineData: { mimeType, data: imageBase64 } }]
      });

      if (!upstream.ok) {
        console.error("Gemini upstream error:", upstream.status, upstream.text.slice(0, 300));
        return res.status(upstream.status === 400 ? 400 : 502).json({
          error: `Receipt parsing failed: ${describeUpstreamError(upstream)}`
        });
      }

      console.log("Parsing and validating receipt data...");
      const parsed = JSON.parse(extractResponseText(upstream.text));
      const validated = validateAndReconcileReceipt(parsed);
      console.log("Receipt validation complete");
      res.type("application/json").json(validated);
    } catch (error) {
      console.error("Gemini proxy failed:", error);
      if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        return res.status(504).json({ error: "The receipt parser took too long. Try again." });
      }
      res.status(502).json({ error: `Could not reach the receipt parser: ${error?.message}` });
    }
  });
}
