namespace ReceiptRing.Services {
  export class GeminiService {
    /**
     * Load non-secret Gemini config from the backend. The API key is never
     * returned to the browser; when the server holds a key, receipts are parsed
     * through the server-side proxy instead.
     */
    async loadConfig(): Promise<{ model: string; hasServerKey: boolean }> {
      try {
        const response = await fetch("/api/gemini-config", { credentials: "same-origin" });
        if (response.ok) {
          const config = (await response.json()) as { GEMINI_MODEL?: string; hasServerKey?: boolean };
          return {
            model: config.GEMINI_MODEL || "",
            hasServerKey: Boolean(config.hasServerKey)
          };
        }
      } catch {
        // No backend config available (e.g. not logged in); fall through.
      }
      return { model: "", hasServerKey: false };
    }

    private fileToBase64(file: File): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });
    }

    async parseReceiptImage(file: File, apiKey: string, model: string): Promise<any> {
      const base64Data = await this.fileToBase64(file);

      // No user-supplied key: parse through the server proxy so the shared key
      // stays server-side. The server owns the prompt and returns Gemini's
      // response in the same shape as a direct call.
      if (!apiKey) {
        const proxyResponse = await fetch("/api/gemini/parse", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, mimeType: file.type, imageBase64: base64Data })
        });
        if (!proxyResponse.ok) {
          const errText = await proxyResponse.text();
          throw new Error(`Receipt parsing failed (${proxyResponse.status}): ${errText}`);
        }
        return this.extractParsedJson(await proxyResponse.json());
      }

      // User brought their own key: call Gemini directly from the browser.
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const promptText = `You are an expert receipt parser.

Your job is to analyze a receipt image and extract ONLY the purchasable items, their prices, and receipt totals.

Rules:

1. Extract every purchased item and its corresponding price.
2. Preserve item order exactly as it appears on the receipt.
3. Ignore:
   - Store addresses
   - Phone numbers
   - Loyalty information
   - Cashier information
   - Payment methods
   - Approval codes
   - Card numbers
   - Barcode values
   - Receipt IDs unless needed for totals
4. Do not invent items.
5. If text is unclear, make the best reasonable interpretation.
6. Return valid JSON only.
7. Prices must be numeric values.
8. Extract subtotal, tax, and total whenever available.
9. If an item appears to be a discount or coupon, include it in a separate discounts array.
10. If confidence is low for an item name, still include the item but add a lowConfidence flag.

Return JSON in exactly this format:

{
  "storeName": string | null,
  "subtotal": number | null,
  "tax": number | null,
  "total": number | null,
  "items": [
    {
      "name": string,
      "price": number,
      "lowConfidence": boolean
    }
  ],
  "discounts": [
    {
      "name": string,
      "amount": number
    }
  ]
}

Important:

Only include actual purchasable line items in the items array.

Do not include:
- SUBTOTAL
- TAX
- TOTAL
- CHANGE
- CASH
- VISA
- MASTERCARD
- PAYMENT
- BALANCE

Return only JSON.`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: promptText },
                {
                  inlineData: {
                    mimeType: file.type,
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error (${response.status}): ${errText}`);
      }

      return this.extractParsedJson(await response.json());
    }

    private extractParsedJson(json: any): any {
      const textResult = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResult) {
        throw new Error("No response text returned from Gemini.");
      }
      try {
        const cleanedText = textResult.trim().replace(/^```json/, "").replace(/```$/, "").trim();
        return JSON.parse(cleanedText);
      } catch (e) {
        console.error("Failed to parse Gemini JSON output. Raw text:", textResult);
        throw new Error("Failed to parse the structured receipt JSON from Gemini response.");
      }
    }
  }
}
