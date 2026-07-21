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
const DEFAULT_MODEL = "gemini-2.5-flash";

const PROMPT_TEXT = `You are an expert receipt parser.

Your job is to analyze a receipt image and extract ONLY the purchasable items, their prices, and receipt totals.

Rules:

1. Extract every purchased item and its corresponding price.
2. Preserve item order exactly as it appears on the receipt.
3. Ignore store addresses, phone numbers, loyalty info, cashier info, payment methods, approval codes, card numbers, barcode values, and receipt IDs unless needed for totals.
4. Do not invent items.
5. If text is unclear, make the best reasonable interpretation.
6. Return valid JSON only.
7. Prices must be numeric values.
8. Extract subtotal, tax, and total whenever available.
9. If an item appears to be a discount or coupon, include it in a separate discounts array.
10. If confidence is low for an item name, still include the item but add a lowConfidence flag.

Return JSON in exactly this format:
{ "storeName": string | null, "subtotal": number | null, "tax": number | null, "total": number | null, "items": [ { "name": string, "price": number, "lowConfidence": boolean } ], "discounts": [ { "name": string, "amount": number } ] }

Only include actual purchasable line items in the items array. Return only JSON.`;

export function hasServerGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function serverGeminiModel() {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

export function registerGemini(app, requireAuth, prisma) {
  // Resolve the key to call Gemini with: the user's own key when they've saved
  // one, otherwise the shared server key. Returns "" when neither exists.
  async function resolveApiKey(userId) {
    if (prisma && userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { geminiKeyCiphertext: true, geminiKeyIv: true, geminiKeyAuthTag: true }
      });
      if (user?.geminiKeyCiphertext && user.geminiKeyIv && user.geminiKeyAuthTag) {
        try {
          return decryptSecret({
            ciphertext: user.geminiKeyCiphertext,
            iv: user.geminiKeyIv,
            authTag: user.geminiKeyAuthTag
          });
        } catch (error) {
          // Tampered/undecryptable (e.g. rotated encryption key): fall back to
          // the shared key rather than failing the parse outright.
          console.error("Failed to decrypt stored Gemini key:", error);
        }
      }
    }
    return process.env.GEMINI_API_KEY || "";
  }

  async function userHasKey(userId) {
    if (!prisma || !userId) return false;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { geminiKeyCiphertext: true }
    });
    return Boolean(user?.geminiKeyCiphertext);
  }

  // Non-secret config for the browser: model, whether a shared server key
  // exists, and whether this user has saved a personal key. The key values
  // themselves are deliberately never returned.
  app.get("/api/gemini-config", requireAuth, async (req, res) => {
    res.json({
      GEMINI_MODEL: serverGeminiModel(),
      hasServerKey: hasServerGeminiKey(),
      hasUserKey: await userHasKey(req.userId)
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
    const apiKey = await resolveApiKey(req.userId);
    if (!apiKey) {
      return res.status(503).json({ error: "No Gemini key is configured." });
    }

    const imageBase64 = typeof req.body?.imageBase64 === "string" ? req.body.imageBase64 : "";
    const mimeType = typeof req.body?.mimeType === "string" ? req.body.mimeType : "";
    const model = String(req.body?.model || serverGeminiModel());

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: "imageBase64 and mimeType are required." });
    }
    if (!/^image\//.test(mimeType)) {
      return res.status(400).json({ error: "mimeType must be an image type." });
    }
    if (!MODEL_RE.test(model)) {
      return res.status(400).json({ error: "Invalid model name." });
    }

    try {
      const url = `${GEMINI_HOST}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const upstream = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT_TEXT },
                { inlineData: { mimeType, data: imageBase64 } }
              ]
            }
          ],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const text = await upstream.text();
      if (!upstream.ok) {
        // Do not forward the upstream body verbatim; it can echo the request/key context.
        console.error("Gemini upstream error:", upstream.status, text.slice(0, 300));
        return res.status(502).json({ error: "Receipt parsing failed upstream." });
      }
      // Pass through the (non-secret) model output as-is.
      res.type("application/json").send(text);
    } catch (error) {
      console.error("Gemini proxy failed:", error);
      res.status(502).json({ error: "Could not reach the receipt parser." });
    }
  });
}
