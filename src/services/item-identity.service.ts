namespace ReceiptRing.Services {
  /** One line handed to the AI tier, stripped to what the model needs. */
  export interface AiIdentifyRequest {
    lineId: string;
    label: string;
    itemCode?: string;
    amount: number;
  }

  /**
   * The AI tier, as the orchestrator sees it.
   *
   * An interface rather than a concrete service so the chain can be tested
   * without a network, and so the expensive tier stays optional -- a caller
   * with no Gemini key gets the free tiers and nothing breaks.
   */
  export interface AiIdentifier {
    identify(
      requests: readonly AiIdentifyRequest[],
      storeName: string
    ): Promise<readonly Domain.ItemIdentification[]>;
  }

  export interface IdentifyOptions {
    storeName?: string;
    // Re-identify lines that already have an answer. Off by default: the
    // common case is a user pressing the button again after adding a few
    // lines, and paying to re-derive the rest of the receipt is a waste.
    force?: boolean;
  }

  /**
   * Runs the identification tiers in order and keeps the best answer.
   *
   * Cheapest first, and the order is the point. A saved alias is free,
   * instant, and was written by a human, so nothing downstream can improve on
   * it. The dictionary is free and instant but only ever a good guess. The
   * model costs a request and a wait, so it only ever sees what the first two
   * could not account for -- on a grocery receipt that is usually a handful of
   * lines rather than forty.
   *
   * A line that survives all three is reported as unresolved rather than
   * dropped, so the UI can say so.
   */
  export class ItemIdentityService {
    constructor(
      private readonly aliasStoreService: ItemAliasStoreService,
      private readonly dictionaryResolverService: DictionaryResolverService,
      private readonly aiIdentifier: AiIdentifier | null = null
    ) {}

    /**
     * Identifies every line it can, and returns what it worked out keyed by
     * line id. Lines already carrying an answer are left alone unless `force`
     * says otherwise; ignored lines are skipped, since nobody is paying for
     * them and nobody needs to know what they were.
     */
    async identify(
      lines: readonly Domain.ReceiptLine[],
      known: ReadonlyMap<string, Domain.ItemIdentification>,
      options: IdentifyOptions = {}
    ): Promise<Map<string, Domain.ItemIdentification>> {
      const storeName = options.storeName ?? "";
      const resolved = new Map<string, Domain.ItemIdentification>();

      const pending = lines.filter((line) => {
        if (line.ignored) return false;
        if (options.force) return true;
        // A name the user confirmed is never worth re-deriving; a guess is.
        return !known.get(line.id)?.confirmed;
      });

      const unresolvedByAlias: Domain.ReceiptLine[] = [];
      pending.forEach((line) => {
        const alias = this.aliasStoreService.resolve(line, storeName);
        if (alias) {
          resolved.set(line.id, alias);
          return;
        }
        unresolvedByAlias.push(line);
      });

      const unresolvedByDictionary: Domain.ReceiptLine[] = [];
      unresolvedByAlias.forEach((line) => {
        const expansion = this.dictionaryResolverService.resolve(line);
        if (expansion) {
          resolved.set(line.id, expansion);
          return;
        }
        unresolvedByDictionary.push(line);
      });

      if (unresolvedByDictionary.length > 0 && this.aiIdentifier) {
        const answers = await this.aiIdentifier.identify(
          unresolvedByDictionary.map((line) => this.toRequest(line)),
          storeName
        );
        // The model is asked about specific lines and answers about whichever
        // it likes. Index the reply and take only what was asked for, so a
        // hallucinated line id cannot introduce a row that is not on the
        // receipt.
        const byLineId = new Map(answers.map((answer) => [answer.lineId, answer]));
        unresolvedByDictionary.forEach((line) => {
          const answer = byLineId.get(line.id);
          if (answer) resolved.set(line.id, answer);
        });
      }

      return resolved;
    }

    private toRequest(line: Domain.ReceiptLine): AiIdentifyRequest {
      return {
        lineId: line.id,
        label: line.label,
        ...(line.itemCode ? { itemCode: line.itemCode } : {}),
        amount: line.amount
      };
    }
  }
}
