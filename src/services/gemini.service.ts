namespace ReceiptRing.Services {
  export interface GeminiConfig {
    model: string;
    hasServerKey: boolean;
    hasUserKey: boolean;
  }

  export class GeminiService {
    /**
     * Load non-secret Gemini config from the backend. No API key is ever
     * returned to the browser — only the model and whether a shared server key
     * and/or a personal per-user key exist. Receipts are always parsed through
     * the server-side proxy so keys stay server-side.
     */
    async loadConfig(): Promise<GeminiConfig> {
      try {
        const response = await fetch("/api/gemini-config", { credentials: "same-origin" });
        if (response.ok) {
          const config = (await response.json()) as {
            GEMINI_MODEL?: string;
            hasServerKey?: boolean;
            hasUserKey?: boolean;
          };
          return {
            model: config.GEMINI_MODEL || "",
            hasServerKey: Boolean(config.hasServerKey),
            hasUserKey: Boolean(config.hasUserKey)
          };
        }
      } catch {
        // No backend config available (e.g. not logged in); fall through.
      }
      return { model: "", hasServerKey: false, hasUserKey: false };
    }

    /**
     * Save a personal Gemini API key. The key is sent once to the server, which
     * validates and encrypts it at rest; it is never persisted in the browser.
     */
    async saveApiKey(apiKey: string): Promise<void> {
      const response = await fetch("/api/gemini-key", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey })
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Could not save the key.");
      }
    }

    /** Remove the personal key, reverting to the shared server key. */
    async clearApiKey(): Promise<void> {
      const response = await fetch("/api/gemini-key", {
        method: "DELETE",
        credentials: "same-origin"
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Could not clear the key.");
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

    /**
     * Parse a receipt image via the server proxy. The server owns the prompt
     * and calls Gemini with the resolved key (the user's own, or the shared
     * server key), so no key is ever exposed to the browser.
     */
    async parseReceiptImage(file: File, model: string): Promise<any> {
      const base64Data = await this.fileToBase64(file);

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
