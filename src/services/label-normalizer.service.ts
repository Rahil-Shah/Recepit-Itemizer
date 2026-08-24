namespace ReceiptRing.Services {
  /** A receipt label pulled apart into the pieces worth reasoning about. */
  export interface NormalizedLabel {
    // Lowercased, punctuation-flattened, codes and sizes removed. This is what
    // alias lookups key on, so two printings of the same item collapse onto
    // one entry.
    key: string;
    // The words left after the size and quantity noise is taken out, in the
    // order the receipt printed them.
    tokens: string[];
    // "8Z", "4L", "12PK" and friends, normalized to a readable form.
    size: string | null;
    // A leading multiplier -- "2 @ 3.99", "3X" -- which says how many were
    // bought and nothing about what the item is.
    quantity: number | null;
    // Digit runs that survived into the label despite the parser's best
    // efforts. Reported so a caller can treat them as a code.
    codes: string[];
  }

  /**
   * Pulls a printed receipt label apart.
   *
   * Receipt shorthand is not arbitrary: it is a word with the vowels knocked
   * out, sometimes a brand prefix, and almost always a size glued to the end.
   * Separating those three things is most of the work of reading it, and it is
   * work that needs no network and no model, so it happens here where it can
   * be tested directly.
   *
   * This deliberately does not try to *understand* anything -- no dictionary,
   * no guessing. It splits; something else interprets.
   */
  export class LabelNormalizerService {
    // Size suffixes as receipts write them: 8Z, 8OZ, 1.5L, 500ML, 12PK, 2CT,
    // 3LB. The unit is required, so a bare number stays a number.
    private readonly sizePattern =
      /^(\d+(?:\.\d+)?)\s*(z|oz|ozs|g|kg|mg|l|ml|lt|ltr|lb|lbs|ct|pk|pc|pcs|pack|qt|gal|ea)$/i;

    // "2X", "3 @", "X4" -- a count of how many, not a description of what.
    private readonly quantityPattern = /^(?:x\s*(\d+)|(\d+)\s*x|(\d+)\s*@)$/i;

    private readonly codePattern = /^\d{4,}$/;

    // Canonical spelling for each unit, so "8Z", "8 OZ" and "8oz" all end up
    // as one string and can be compared.
    private readonly unitNames: Readonly<Record<string, string>> = {
      z: "oz",
      oz: "oz",
      ozs: "oz",
      g: "g",
      kg: "kg",
      mg: "mg",
      l: "L",
      lt: "L",
      ltr: "L",
      ml: "mL",
      lb: "lb",
      lbs: "lb",
      ct: "ct",
      pk: "pk",
      pc: "pc",
      pcs: "pc",
      pack: "pk",
      qt: "qt",
      gal: "gal",
      ea: "ea"
    };

    normalize(label: string): NormalizedLabel {
      const rawTokens = this.splitTokens(label);

      const tokens: string[] = [];
      const codes: string[] = [];
      let size: string | null = null;
      let quantity: number | null = null;

      rawTokens.forEach((token) => {
        const sizeMatch = token.match(this.sizePattern);
        // First size wins. A label carrying two ("12PK 355ML") is describing a
        // pack of somethings, and the pack count is the more useful of the two
        // to a reader scanning a receipt.
        if (sizeMatch && size === null) {
          size = `${this.trimNumber(sizeMatch[1])} ${this.unitNames[sizeMatch[2].toLowerCase()]}`;
          return;
        }
        if (sizeMatch) return;

        const quantityMatch = token.match(this.quantityPattern);
        if (quantityMatch) {
          const value = Number(quantityMatch[1] ?? quantityMatch[2] ?? quantityMatch[3]);
          if (Number.isFinite(value) && value > 0 && quantity === null) quantity = value;
          return;
        }

        if (this.codePattern.test(token)) {
          codes.push(token);
          return;
        }

        tokens.push(token.toLowerCase());
      });

      return { key: tokens.join(" "), tokens, size, quantity, codes };
    }

    /**
     * The alias lookup key for a label. Two receipts printing the same item
     * with different spacing, punctuation or size notation must produce the
     * same key, or a correction made on one will not be found from the other.
     */
    keyFor(label: string): string {
      return this.normalize(label).key;
    }

    /**
     * Splits on whitespace, and on the punctuation receipts use as a separator
     * rather than as part of a word. Hyphens and slashes inside a token are
     * kept -- "half-n-half" and "2%" are words here, not delimiters -- but a
     * size stuck to a word ("MOZZ8Z") is prised apart first.
     */
    private splitTokens(label: string): string[] {
      const tokens = label
        .replace(/[()[\]{},;:!?"']/g, " ")
        .replace(/\.(?=\s|$)/g, " ")
        .replace(/([A-Za-z])(\d+(?:\.\d+)?(?:z|oz|g|kg|ml|l|lb|ct|pk)\b)/gi, "$1 $2")
        .split(/\s+/)
        .map((token) => token.replace(/^[-*#@/]+|[-*#@/]+$/g, ""))
        .filter(Boolean);

      return this.joinSpacedSizes(tokens);
    }

    /**
     * Glues a bare number back onto the unit that follows it, so a receipt
     * that prints "8 OZ" is read the same as one that prints "8Z". Without
     * this the number and the unit are two tokens, neither of which is a size
     * on its own, and both end up in the name as noise.
     */
    private joinSpacedSizes(tokens: readonly string[]): string[] {
      const joined: string[] = [];
      for (let index = 0; index < tokens.length; index += 1) {
        const current = tokens[index];
        const next = tokens[index + 1];
        if (
          next !== undefined &&
          /^\d+(?:\.\d+)?$/.test(current) &&
          Object.prototype.hasOwnProperty.call(this.unitNames, next.toLowerCase())
        ) {
          joined.push(`${current}${next}`);
          index += 1;
          continue;
        }
        joined.push(current);
      }
      return joined;
    }

    // "1.50" reads as a size of 1.5, and "8.0" as 8.
    private trimNumber(value: string): string {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? String(parsed) : value;
    }
  }
}
