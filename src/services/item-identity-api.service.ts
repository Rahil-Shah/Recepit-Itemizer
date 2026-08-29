namespace ReceiptRing.Services {
  interface IdentifyResponseItem {
    id: string;
    name: string;
    brand: string | null;
    size: string | null;
    confidence: number;
    reasoning: string | null;
    alternatives: { name: string; confidence: number }[];
  }

  /**
   * The AI tier, over HTTP.
   *
   * Implements AiIdentifier so ItemIdentityService can hold it without knowing
   * a network exists. The Gemini key lives on the server, so this posts the
   * lines and takes back names -- the browser never sees a key, exactly as
   * with receipt parsing.
   */
  export class ItemIdentityApiService implements AiIdentifier {
    // One request per receipt is the design, but a caller with a very long
    // receipt should not get a 400 for it. Split instead, well under the
    // server's own cap.
    private readonly maxBatchSize = 60;

    async identify(
      requests: readonly AiIdentifyRequest[],
      storeName: string
    ): Promise<readonly Domain.ItemIdentification[]> {
      if (requests.length === 0) return [];

      const batches: AiIdentifyRequest[][] = [];
      for (let index = 0; index < requests.length; index += this.maxBatchSize) {
        batches.push(requests.slice(index, index + this.maxBatchSize));
      }

      const results = await Promise.all(batches.map((batch) => this.identifyBatch(batch, storeName)));
      return results.flat();
    }

    private async identifyBatch(
      requests: readonly AiIdentifyRequest[],
      storeName: string
    ): Promise<Domain.ItemIdentification[]> {
      const response = await fetch("/api/items/identify", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName,
          model: this.selectedModel(),
          items: requests.map((request) => ({
            id: request.lineId,
            label: request.label,
            ...(request.itemCode ? { itemCode: request.itemCode } : {}),
            amount: request.amount
          }))
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Could not identify these items (${response.status}).`);
      }

      const payload = (await response.json()) as { items?: IdentifyResponseItem[] };
      const byLineId = new Map(requests.map((request) => [request.lineId, request]));

      return (payload.items ?? [])
        .map((item) => this.toIdentification(item, byLineId.get(item.id)))
        .filter((identification): identification is Domain.ItemIdentification => identification !== null);
    }

    /**
     * One server answer as an identification, or null when it is about a line
     * this batch never asked about.
     *
     * The server already filters those out; checking again here costs nothing
     * and means rawLabel is always the label actually printed on the receipt
     * rather than whatever came back over the wire.
     */
    private toIdentification(
      item: IdentifyResponseItem,
      request: AiIdentifyRequest | undefined
    ): Domain.ItemIdentification | null {
      if (!request || !item?.name) return null;

      return {
        lineId: request.lineId,
        rawLabel: request.label,
        ...(request.itemCode ? { itemCode: request.itemCode } : {}),
        resolvedName: item.name,
        ...(item.brand ? { brand: item.brand } : {}),
        ...(item.size ? { size: item.size } : {}),
        confidence: this.clamp(item.confidence),
        source: "ai",
        ...(item.reasoning ? { reasoning: item.reasoning } : {}),
        alternatives: (item.alternatives ?? [])
          .filter((alternative) => Boolean(alternative?.name))
          .map((alternative) => ({
            name: alternative.name,
            confidence: this.clamp(alternative.confidence)
          })),
        confirmed: false
      };
    }

    /**
     * The model the user picked in Settings -- the same one the receipt was
     * parsed with.
     *
     * Identification used to send no model at all and let the server fall back
     * to its own GEMINI_MODEL, so choosing a model in Settings changed how the
     * photo was read but not how the items were named. Two different models on
     * one receipt, and only one of them the user had asked for.
     */
    private selectedModel(): string {
      return localStorage.getItem("gemini_model") || "gemini-3.5-flash-lite";
    }

    // The server clamps too. Doing it again here keeps the guarantee local to
    // the type: nothing builds an ItemIdentification with a confidence outside
    // 0..1, whatever the response body said.
    private clamp(value: number): number {
      const confidence = Number(value);
      if (!Number.isFinite(confidence)) return 0;
      return Math.max(0, Math.min(1, confidence));
    }
  }
}
