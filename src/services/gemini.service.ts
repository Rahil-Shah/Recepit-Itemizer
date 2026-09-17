namespace ReceiptRing.Services {
  /**
   * A parse that failed, carrying the HTTP status so the caller can tell a
   * blip from a dead end. A bare Error string could only be shown, not
   * reasoned about.
   *
   * status is 0 when the request never reached the server at all -- offline,
   * DNS, a dropped connection -- which is the most retryable failure there is.
   */
  export class ReceiptParseError extends Error {
    constructor(
      message: string,
      readonly status: number
    ) {
      super(message);
      this.name = "ReceiptParseError";
    }
  }

  /**
   * Whether trying the same photo again could plausibly work.
   *
   * Offering a retry that cannot succeed is worse than offering none: it costs
   * the user a click, costs a paid API call, and teaches them the button does
   * nothing.
   *
   * The interesting case is 503. Gemini answers 503 when it is busy -- exactly
   * the transient failure this is for -- but the server maps every upstream
   * failure to 502, and keeps 503 for its own "no Gemini key is configured".
   * So a 503 arriving here means the app is not set up, which no amount of
   * retrying will fix, while the busy-Gemini case shows up as 502.
   */
  export function isRetryableParseFailure(status: number): boolean {
    // Never reached the server: offline, DNS, connection dropped mid-flight.
    if (status === 0) return true;
    // 408 request timeout, 429 rate limited, 502 upstream failed,
    // 504 upstream took too long. All worth another go.
    return status === 408 || status === 429 || status === 502 || status === 504;
  }

  /**
   * How long to wait before a retry is allowed, given how many have already
   * been made. Doubling, and capped -- a person watching a spinner will not
   * wait past about half a minute, and past that point the honest advice is to
   * come back later rather than to keep a button alive that keeps failing.
   *
   * Exported and pure so the schedule can be checked without a clock.
   */
  export function retryBackoffMs(attempt: number): number {
    const base = 2000;
    const ceiling = 30_000;
    return Math.min(ceiling, base * Math.pow(2, Math.max(0, attempt - 1)));
  }

  // Past this the photo is not the problem and neither is the moment. Stop
  // offering, so the user goes and looks at the receipt instead of the button.
  export const MAX_PARSE_RETRIES = 4;

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

    /**
     * Parse a receipt image via the server proxy. The server owns the prompt
     * and calls Gemini with the resolved key (the user's own, or the shared
     * server key), so no key is ever exposed to the browser.
     *
     * The image arrives already shrunk to upload size (see
     * ReceiptImageService.toParseImage); this only carries it.
     *
     * The server also extracts and validates the model's reply before
     * responding, so the body here is already the receipt object (storeName,
     * items, ...) -- not the raw Gemini candidates/content/parts envelope.
     */
    async parseReceiptImage(image: UploadImage, model: string): Promise<any> {
      const proxyResponse = await fetch("/api/gemini/parse", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, mimeType: image.mimeType, imageBase64: image.base64 })
      });
      if (!proxyResponse.ok) {
        throw new ReceiptParseError(
          await this.describeFailure(proxyResponse),
          proxyResponse.status
        );
      }
      return proxyResponse.json();
    }

    /**
     * A failure worded for a person rather than for a log.
     *
     * The server sends {"error": "..."} for everything it refuses, so use that
     * sentence when it is there. The old code pasted the raw response body
     * next to a status code, which on an HTML error page meant a wall of
     * markup where the explanation should be.
     */
    private async describeFailure(response: Response): Promise<string> {
      const body = await response.text();
      try {
        const parsed = JSON.parse(body) as { error?: string };
        if (parsed?.error) return parsed.error;
      } catch {
        // Not JSON -- fall through to the generic wording rather than showing
        // whatever the proxy or gateway happened to return.
      }
      // A 413 with no JSON came from the platform in front of the server (a
      // hosted function's request cap), not from the app: the photo could not
      // be shrunk in this browser and the original was past the limit.
      if (response.status === 413) {
        return "That photo is too large to upload. Try a smaller or lower-resolution photo.";
      }
      return `Could not read this receipt (error ${response.status}).`;
    }
  }
}
