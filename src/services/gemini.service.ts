namespace ReceiptRing.Services {
  export class GeminiService {
    async loadDotEnv(): Promise<Record<string, string>> {
      // Prefer the backend config endpoint so the raw .env file is never served over HTTP.
      try {
        const apiResponse = await fetch("/api/gemini-config");
        if (apiResponse.ok) {
          const config = (await apiResponse.json()) as Record<string, string>;
          if (config && (config.GEMINI_API_KEY || config.GEMINI_MODEL)) {
            return config;
          }
        }
      } catch {
        // Fall back to reading the .env file directly (e.g. static-only hosting).
      }

      try {
        const response = await fetch(".env");
        if (!response.ok) return {};
        const text = await response.text();
        const config: Record<string, string> = {};
        text.split(/\r?\n/).forEach((line) => {
          const cleanLine = line.trim();
          if (!cleanLine || cleanLine.startsWith("#")) return;
          const index = cleanLine.indexOf("=");
          if (index === -1) return;
          const key = cleanLine.slice(0, index).trim();
          const value = cleanLine.slice(index + 1).trim();
          config[key] = value;
        });
        return config;
      } catch {
        return {};
      }
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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

      const json = await response.json();
      const textResult = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResult) {
        throw new Error("No response text returned from Gemini.");
      }

      try {
        const cleanedText = textResult.trim().replace(/^```json/, "").replace(/```$/, "").trim();
        const parsed = JSON.parse(cleanedText);
        return parsed;
      } catch (e) {
        console.error("Failed to parse Gemini JSON output. Raw text:", textResult);
        throw new Error("Failed to parse the structured receipt JSON from Gemini response.");
      }
    }
  }
}
