namespace ReceiptRing.Services {
  /** One line handed to the AI tier, stripped to what the model needs. */
  export interface AiIdentifyRequest {
    lineId: string;
    label: string;
    itemCode?: string;
    amount: number;
    // What the local dictionary made of the label, when it made anything.
    // A head start for the model, never an answer it has to keep.
    hint?: string;
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

  /**
   * Which tier the run is on, and how far through it is.
   *
   * `done` and `total` count lines, not tiers: the free tiers finish in one
   * frame and the model takes seconds, so a bar measured in tiers would sit at
   * two-thirds for the entire visible part of the wait.
   */
  export interface IdentifyProgress {
    stage: "aliases" | "dictionary" | "ai" | "complete";
    done: number;
    total: number;
    message: string;
  }

  export interface IdentifyOptions {
    storeName?: string;
    // Re-identify lines that already have an answer. Off by default: the
    // common case is a user pressing the button again after adding a few
    // lines, and paying to re-derive the rest of the receipt is a waste.
    force?: boolean;
    onProgress?(progress: IdentifyProgress): void;
  }

  // Under this, an answer is not worth showing as an answer. The model is
  // asked for its own confidence and will occasionally offer a name it plainly
  // guessed; below the bar it is recorded as unresolved, keeping whatever it
  // said as an alternative rather than as a claim.
  const MIN_REPORTABLE_CONFIDENCE = 0.35;

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

      // Reporting is best-effort. A view that throws while drawing a progress
      // bar must not take the identification down with it -- the answers are
      // worth more than the bar.
      const report = (progress: IdentifyProgress): void => {
        try {
          options.onProgress?.(progress);
        } catch {
          // Nothing to do about a broken listener except keep going.
        }
      };

      const pending = lines.filter((line) => {
        if (line.ignored) return false;
        if (options.force) return true;
        // A name the user confirmed is never worth re-deriving; a guess is.
        return !known.get(line.id)?.confirmed;
      });

      const total = pending.length;
      report({ stage: "aliases", done: 0, total, message: "Checking what you've named before..." });

      const unresolvedByAlias: Domain.ReceiptLine[] = [];
      pending.forEach((line) => {
        const alias = this.aliasStoreService.resolve(line, storeName);
        if (alias) {
          resolved.set(line.id, alias);
          return;
        }
        unresolvedByAlias.push(line);
      });

      report({
        stage: "dictionary",
        done: resolved.size,
        total,
        message: "Expanding receipt shorthand..."
      });

      // With a model to ask, every line the saved names could not place goes
      // to it, in the one batched request a receipt costs anyway.
      //
      // The dictionary used to settle lines on its own first, which left
      // receipts half named: a label it "read as printed" came back as the
      // same words (and so showed nothing new), a partial expansion like
      // "Kirkland Sig Chicken Brst" stood in for the product, and only the
      // leftovers ever reached the model. Its expansion now rides along as a
      // hint, and is kept as the fallback when the model has nothing better.
      const dictionaryFallbacks = new Map<string, Domain.ItemIdentification>();
      unresolvedByAlias.forEach((line) => {
        const expansion = this.dictionaryResolverService.resolve(line);
        if (expansion) dictionaryFallbacks.set(line.id, expansion);
      });

      if (!this.aiIdentifier) {
        unresolvedByAlias.forEach((line) => {
          resolved.set(line.id, dictionaryFallbacks.get(line.id) ?? this.unresolved(line, null));
        });
      } else if (unresolvedByAlias.length > 0) {
        const count = unresolvedByAlias.length;
        report({
          stage: "ai",
          done: resolved.size,
          total,
          message: `Looking up ${count} ${count === 1 ? "item" : "items"}...`
        });

        const answers = await this.askModel(unresolvedByAlias, dictionaryFallbacks, storeName);
        unresolvedByAlias.forEach((line) => {
          resolved.set(line.id, this.pickAnswer(line, answers.get(line.id), dictionaryFallbacks.get(line.id)));
        });
      }

      // Unresolved lines have entries too, so counting the map would report a
      // receipt nobody could read as fully identified.
      const identified = [...resolved.values()].filter(
        (identification) => identification.source !== "unresolved"
      ).length;
      report({
        stage: "complete",
        done: identified,
        total,
        message: this.summarize(identified, total)
      });

      return resolved;
    }

    /**
     * The model's answers, keyed by line id.
     *
     * The model is asked about specific lines and answers about whichever it
     * likes, so the reply is indexed and only what was asked for is kept -- a
     * hallucinated line id cannot introduce a row that is not on the receipt.
     * Models also skip lines in a long batch now and then; those are asked
     * about once more on their own, so one dropped row does not leave an item
     * unnamed.
     */
    private async askModel(
      lines: readonly Domain.ReceiptLine[],
      hints: ReadonlyMap<string, Domain.ItemIdentification>,
      storeName: string
    ): Promise<Map<string, Domain.ItemIdentification>> {
      const ai = this.aiIdentifier;
      const byLineId = new Map<string, Domain.ItemIdentification>();
      if (!ai) return byLineId;

      const wanted = new Set(lines.map((line) => line.id));
      const take = (answers: readonly Domain.ItemIdentification[]): void => {
        answers.forEach((answer) => {
          if (wanted.has(answer.lineId) && answer.resolvedName && !byLineId.has(answer.lineId)) {
            byLineId.set(answer.lineId, answer);
          }
        });
      };

      take(await ai.identify(lines.map((line) => this.toRequest(line, hints.get(line.id))), storeName));

      const skipped = lines.filter((line) => !byLineId.has(line.id));
      if (skipped.length > 0) {
        try {
          take(await ai.identify(skipped.map((line) => this.toRequest(line, hints.get(line.id))), storeName));
        } catch {
          // The first pass already landed; the second is a bonus, and failing
          // it must not throw away everything the first one named.
        }
      }
      return byLineId;
    }

    /**
     * The better of what the model said and what the dictionary made of the
     * label. A model answer below the reporting bar loses to a dictionary
     * expansion when there is one; without one it is still shown -- as a
     * flagged guess, with its low confidence on the chip -- because a named
     * row the user is told to check beats a row left in shorthand.
     */
    private pickAnswer(
      line: Domain.ReceiptLine,
      answer: Domain.ItemIdentification | undefined,
      fallback: Domain.ItemIdentification | undefined
    ): Domain.ItemIdentification {
      if (answer && answer.confidence >= MIN_REPORTABLE_CONFIDENCE) return answer;
      if (fallback && (!answer || fallback.confidence >= answer.confidence)) return fallback;
      if (answer) {
        return {
          ...answer,
          reasoning: answer.reasoning ?? "A low-confidence guess -- worth checking by hand."
        };
      }
      return this.unresolved(line, null);
    }

    /**
     * A line nobody could place, recorded as such.
     *
     * Saying "I don't know" is a result, not the absence of one. Dropping the
     * line instead would leave the row looking exactly like a row that was
     * never asked about, and the user would press the button again and pay for
     * the same non-answer. A low-confidence guess is kept as an alternative --
     * it may well be right, and it is the obvious thing to offer when someone
     * opens the row to correct it -- but it is not presented as the name.
     */
    private unresolved(
      line: Domain.ReceiptLine,
      rejected: Domain.ItemIdentification | null
    ): Domain.ItemIdentification {
      const alternatives = rejected
        ? [{ name: rejected.resolvedName, confidence: rejected.confidence }, ...rejected.alternatives]
        : [];

      return {
        lineId: line.id,
        rawLabel: line.label,
        ...(line.itemCode ? { itemCode: line.itemCode } : {}),
        // The receipt's own words. There is nothing better to show, and
        // blanking the row would lose the one thing that is definitely true.
        resolvedName: line.label,
        confidence: 0,
        source: "unresolved",
        reasoning: rejected
          ? "Only a low-confidence guess -- worth checking by hand."
          : "Couldn't work out what this is.",
        alternatives,
        confirmed: false
      };
    }

    private summarize(done: number, total: number): string {
      if (total === 0) return "Nothing to identify.";
      if (done === 0) return "Couldn't identify anything on this receipt.";
      if (done === total) return `Identified all ${total} ${total === 1 ? "item" : "items"}.`;
      return `Identified ${done} of ${total} items.`;
    }

    private toRequest(line: Domain.ReceiptLine, hint?: Domain.ItemIdentification): AiIdentifyRequest {
      return {
        lineId: line.id,
        label: line.label,
        ...(line.itemCode ? { itemCode: line.itemCode } : {}),
        amount: line.amount,
        ...(hint && hint.resolvedName !== line.label ? { hint: hint.resolvedName } : {})
      };
    }
  }
}
