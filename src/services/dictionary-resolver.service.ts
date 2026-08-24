namespace ReceiptRing.Services {
  // A dictionary hit is a good guess, never a fact. Full marks are reserved
  // for an identification a human has confirmed, so this tier is capped below
  // the point where the UI stops asking the user to check it.
  const MAX_DICTIONARY_CONFIDENCE = 0.9;

  // Below this the answer is worth less than admitting we do not know, so the
  // line goes on to a tier that might.
  const MIN_DICTIONARY_CONFIDENCE = 0.5;

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

    // Every qualifier's expanded spelling, lowercased. Membership here is how
    // a rebuilt name is checked for actually naming something, whether the
    // word arrived as shorthand ("ORG") or printed in full ("Organic").
    private readonly qualifierNames: ReadonlySet<string>;

    // Nouns and modifiers are separate tables in config so the qualifier rule
    // above can exist, but expansion does not care which is which.
    private readonly words: Readonly<Record<string, string>>;

    constructor(
      private readonly labelNormalizerService: LabelNormalizerService,
      private readonly brands: Readonly<Record<string, string>> = Config.BRAND_ABBREVIATIONS,
      words: Readonly<Record<string, string>> = Config.WORD_ABBREVIATIONS,
      qualifiers: Readonly<Record<string, string>> = Config.QUALIFIER_ABBREVIATIONS
    ) {
      this.words = { ...words, ...qualifiers };
      this.qualifierNames = new Set(Object.values(qualifiers).map((name) => name.toLowerCase()));
    }

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

    /**
     * Turns an expansion into an identification, or into nothing.
     *
     * The score is a claim about coverage, not about correctness: this tier
     * knows whether it accounted for every token, and that is all it knows. So
     * the number is built from what it understood over what it saw, and it is
     * capped well short of 1 -- a dictionary hit is a good guess, never a fact,
     * and only a human confirming it earns full marks.
     *
     * Returns null when there is nothing worth showing, which is how a line
     * gets handed on to a tier that might actually know.
     */
    resolve(line: Domain.ReceiptLine): Domain.ItemIdentification | null {
      const expansion = this.expand(line.label);
      const total =
        expansion.expandedTokens.length +
        expansion.plainTokens.length +
        expansion.unknownTokens.length;

      if (total === 0 || !expansion.name) return null;

      const understood = expansion.expandedTokens.length + expansion.plainTokens.length;
      const coverage = understood / total;

      // Nothing was expanded and nothing was a word: this is a line of pure
      // noise, and dressing it up in title case is not an identification.
      if (expansion.expandedTokens.length === 0 && expansion.plainTokens.length === 0) {
        return null;
      }

      // A name made only of modifiers describes an item without being one.
      // "ORG" expands to "Organic", which nobody bought, and reporting it as a
      // product at 0.75 is worse than admitting the line is still unread.
      if (!this.namesSomething(expansion)) return null;

      const confidence = this.scoreExpansion(expansion, coverage);
      if (confidence < MIN_DICTIONARY_CONFIDENCE) return null;

      return {
        lineId: line.id,
        rawLabel: line.label,
        ...(line.itemCode ? { itemCode: line.itemCode } : {}),
        resolvedName: expansion.name,
        ...(expansion.brand ? { brand: expansion.brand } : {}),
        ...(expansion.size ? { size: expansion.size } : {}),
        confidence,
        source: "dictionary",
        reasoning: this.describe(expansion),
        alternatives: [],
        confirmed: false
      };
    }

    /**
     * Whether the rebuilt name contains a noun and not just adjectives. A brand
     * on its own does not count either: "Great Value" is who made it, not what
     * it is.
     */
    private namesSomething(expansion: DictionaryExpansion): boolean {
      const nameParts = expansion.name
        .toLowerCase()
        .replace(expansion.brand ? expansion.brand.toLowerCase() : "", "")
        .split(/\s+/)
        .filter(Boolean);

      return nameParts.some((part) => !this.qualifierNames.has(part));
    }

    private scoreExpansion(expansion: DictionaryExpansion, coverage: number): number {
      // Start from coverage, then discount for the things that make a
      // dictionary answer shakier than its coverage suggests.
      let confidence = MAX_DICTIONARY_CONFIDENCE * coverage;

      // A leftover token can be the entire product ("MLK QQZ" -- what is QQZ?),
      // so an unknown costs a little beyond its share of the coverage. Kept
      // small: coverage has already charged for it once, and charging twice
      // sank labels that were four-fifths read.
      confidence -= expansion.unknownTokens.length * 0.05;

      // A one-token label carries no context to cross-check against. "ORG" on
      // its own expands to "Organic", which is not a thing anyone bought.
      const tokenCount =
        expansion.expandedTokens.length + expansion.plainTokens.length + expansion.unknownTokens.length;
      if (tokenCount === 1) confidence -= 0.15;

      // Recognising the brand is real evidence the label was read correctly:
      // it means the line started the way that store's lines start.
      if (expansion.brand) confidence += 0.05;

      return Math.max(0, Math.min(MAX_DICTIONARY_CONFIDENCE, Number(confidence.toFixed(2))));
    }

    /** One line on what the tier did, shown in the item detail view. */
    private describe(expansion: DictionaryExpansion): string {
      if (expansion.expandedTokens.length === 0) {
        return "Read as printed -- no shorthand to expand.";
      }
      const expanded = expansion.expandedTokens.map((token) => token.toUpperCase()).join(", ");
      const suffix =
        expansion.unknownTokens.length > 0
          ? ` Could not place ${expansion.unknownTokens.map((t) => t.toUpperCase()).join(", ")}.`
          : "";
      return `Expanded ${expanded} from the abbreviation list.${suffix}`;
    }

    private toTitleCase(token: string): string {
      return token.charAt(0).toUpperCase() + token.slice(1);
    }
  }
}
