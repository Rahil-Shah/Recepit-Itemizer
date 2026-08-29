namespace ReceiptRing.Services {
  export class ReceiptParserService {
    private readonly ignoredLabel = /^(total|subtotal|tax|cash|change|visa|mastercard|amex|debit|credit|balance|auth|approval|receipt)\b/i;
    // The amount must start at a word boundary. Capping the integer part at a
    // few digits without anchoring the left side let the regex simply start
    // matching partway into a longer number: "Tv 10999.00" matched "999.00"
    // and the stray "1" was absorbed into the label, booking a $10,999 TV as
    // $999. Anchor to start-of-line or whitespace and accept any length.
    private readonly amountPattern = /(?:^|\s)(-?\$?\s*\d+(?:,\d{3})*[,.]\d{2}|-?\$\s*\d+)\s*$/;
    // A run of four or more digits sitting on its own in the label is the
    // item's SKU/PLU. It used to be deleted outright, which threw away the one
    // token that names the product unambiguously -- "GV SHRD MOZZ 8Z" is a
    // guess, "007874203922" is not. Capture the longest such run instead.
    private readonly itemCodePattern = /\b\d{4,}\b/g;
    // A line that is nothing but a code. Receipts from Target, Costco and
    // Walmart routinely print the SKU on its own line above the item it
    // belongs to, and a line with no amount on it is dropped before anything
    // looks at it -- so those codes were being thrown away entirely.
    private readonly standaloneCodePattern = /^(\d{4,})$/;

    constructor(
      private readonly categorizationService: CategorizationService,
      private readonly idService: IdService
    ) {}

    parse(text: string): Domain.PurchaseItem[] {
      const items: Domain.PurchaseItem[] = [];
      // A code seen on its own line, waiting for the item it describes.
      let pendingCode: string | undefined;

      text
        .split(/\n+/)
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .forEach((line) => {
          const standalone = line.match(this.standaloneCodePattern);
          if (standalone) {
            pendingCode = standalone[1];
            return;
          }

          const item = this.parseLine(line, pendingCode);
          // Cleared whatever happened next, including on a line that parsed to
          // nothing. A code carried past a Subtotal row would attach itself to
          // an item further down the receipt that it has nothing to do with.
          pendingCode = undefined;
          if (item) items.push(item);
        });

      return items;
    }

    private parseLine(line: string, pendingCode?: string): Domain.PurchaseItem | null {
      const match = line.match(this.amountPattern);
      if (!match || match.index === undefined) return null;

      const amount = this.parseAmount(match[1]);
      const withoutMarks = line.slice(0, match.index).replace(/[*#@]/g, "");
      // A code printed on the item's own line describes it more directly than
      // one on the line above, so an inline code wins.
      const itemCode = this.extractItemCode(withoutMarks) ?? pendingCode;
      const label = withoutMarks.replace(this.itemCodePattern, "").trim();

      if (!label || this.ignoredLabel.test(label) || !Number.isFinite(amount) || amount === 0) {
        return null;
      }

      const categorization = this.categorizationService.categorize(label);

      return {
        id: this.idService.create(),
        label: this.toTitleCase(label),
        amount: Number(amount.toFixed(2)),
        ...(itemCode ? { itemCode } : {}),
        category: categorization.category,
        categorizationConfidence: categorization.confidence,
        categorizationSource: categorization.source,
        needsCategoryReview: categorization.shouldPrompt
      };
    }

    /**
     * The item's code, when the line carries one. A line can hold more than one
     * long digit run (a quantity, a weight in grams, a loyalty number); the
     * longest is overwhelmingly the SKU, and ties go to the first, which is
     * where receipts print the code.
     */
    private extractItemCode(labelPart: string): string | undefined {
      const codes = labelPart.match(this.itemCodePattern);
      if (!codes) return undefined;

      return codes.reduce((longest, code) => (code.length > longest.length ? code : longest));
    }

    private toTitleCase(value: string): string {
      return value
        .toLowerCase()
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }

    private parseAmount(value: string): number {
      const compactValue = value.replace(/[$\s]/g, "");
      const normalizedValue =
        compactValue.includes(".") || !compactValue.includes(",")
          ? compactValue.replace(/,/g, "")
          : compactValue.replace(",", ".");

      return Number(normalizedValue);
    }
  }
}
