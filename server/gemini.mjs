// Server-side Gemini proxy.
//
// The Gemini API key is a server secret. It must NEVER be sent to the browser.
// Instead of shipping the key to the client, the client uploads the receipt
// image here and the server calls Gemini with the key held in process env.
// Users who bring their own key still call Gemini directly from the browser.

const GEMINI_HOST = "https://generativelanguage.googleapis.com";
// Gemini model ids are interpolated into the request URL, so constrain them to
// a safe character set to avoid path traversal / URL injection.
const MODEL_RE = /^[A-Za-z0-9._-]+$/;
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

export function registerGemini(app, requireAuth) {
  // Non-secret config for the browser (model + whether a server key exists).
  // The API key itself is deliberately absent.
  app.get("/api/gemini-config", requireAuth, (_req, res) => {
    res.json({ GEMINI_MODEL: serverGeminiModel(), hasServerKey: hasServerGeminiKey() });
  });

  // Proxy a single receipt image to Gemini using the server-held key.
  app.post("/api/gemini/parse", requireAuth, async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "Server-side Gemini key is not configured." });
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
