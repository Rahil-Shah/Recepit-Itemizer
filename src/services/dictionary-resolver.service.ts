namespace ReceiptRing.Services {
  /**
   * What the local dictionary made of a label. `unknownTokens` is the part it
   * could not account for, which is what decides whether the answer is good
   * enough to keep or whether the line should go on to the AI tier.
   */
  export interface DictionaryExpansion {
    name: string;
    brand: string | null;
    size: string | null;
    expandedTokens: string[];
    unknownTokens: string[];
    // Tokens that were already ordinary English and needed no expansion. They
    // count as understood, but they are not evidence the dictionary helped.
    plainTokens: string[];
  }

  /**
   * Expands receipt shorthand using the local tables -- no network, no model.
   *
   * This tier exists because most of a grocery receipt is not actually
   * ambiguous once the vowels are put back: "GV SHRD MOZZ 8Z" is Great Value
   * Shredded Mozzarella, 8 oz, and paying a model to tell you that is a waste
   * of a request. What it cannot do is invent knowledge -- an unrecognised
   * token stays unrecognised and is reported as such, rather than being
   * smoothed over into a confident-sounding wrong answer.
   */
  export class DictionaryResolverService {
    // Words that are already words. A label made entirely of these needs no
    // expansion, and treating them as "unknown" would send every plainly
    // printed item to the AI tier for nothing.
    //
    // The tell is vowels. Receipt shorthand is made by knocking them out --
    // "shrd", "brst", "chkn" -- so a token carrying one is very likely a word
    // that was printed in full, and one without is either shorthand the tables
    // know or shorthand nobody knows. A length test alone accepted "qqz" as
    // English and quietly reported the label as fully understood.
    private readonly plainWordPattern = /^[a-z][a-z'-]{2,}$/;
    private readonly vowelPattern = /[aeiouy]/;

    constructor(
      private readonly labelNormalizerService: LabelNormalizerService,
      private readonly brands: Readonly<Record<string, string>> = Config.BRAND_ABBREVIATIONS,
      private readonly words: Readonly<Record<string, string>> = Config.WORD_ABBREVIATIONS
    ) {}

    expand(label: string): DictionaryExpansion {
      const normalized = this.labelNormalizerService.normalize(label);

      let brand: string | null = null;
      const expandedTokens: string[] = [];
      const unknownTokens: string[] = [];
      const plainTokens: string[] = [];
      const nameParts: string[] = [];

      normalized.tokens.forEach((token, index) => {
        // A brand prefix only counts at the front of the label. "PC" leading a
        // line is President's Choice; "PC" in the middle is far more likely to
        // be part of a product name, and claiming a brand there reads as a
        // confident mistake.
        if (index === 0 && brand === null && this.brands[token] !== undefined) {
          brand = this.brands[token];
          expandedTokens.push(token);
          return;
        }

        const expansion = this.words[token];
        if (expansion !== undefined) {
          expandedTokens.push(token);
          nameParts.push(expansion);
          return;
        }

        if (this.plainWordPattern.test(token) && this.vowelPattern.test(token)) {
          plainTokens.push(token);
          nameParts.push(this.toTitleCase(token));
          return;
        }

        unknownTokens.push(token);
        nameParts.push(this.toTitleCase(token));
      });

      const name = [brand, ...nameParts].filter(Boolean).join(" ").trim();

      return {
        name,
        brand,
        size: normalized.size,
        expandedTokens,
        unknownTokens,
        plainTokens
      };
    }

    private toTitleCase(token: string): string {
      return token.charAt(0).toUpperCase() + token.slice(1);
    }
  }
}
