namespace ReceiptRing.Services {
  export class ReceiptParserService {
    private readonly ignoredLabel = /^(total|subtotal|tax|cash|change|visa|mastercard|amex|debit|credit|balance|auth|approval|receipt)\b/i;
    private readonly amountPattern = /(-?\$?\s*\d{1,4}(?:(?:,\d{3})+)?[,.]\d{2}|-?\$\s*\d{1,5})\s*$/;

    constructor(
      private readonly categorizationService: CategorizationService,
      private readonly idService: IdService
    ) {}

    parse(text: string): Domain.PurchaseItem[] {
      return text
        .split(/\n+/)
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .map((line) => this.parseLine(line))
        .filter((item): item is Domain.PurchaseItem => item !== null);
    }

    private parseLine(line: string): Domain.PurchaseItem | null {
      const match = line.match(this.amountPattern);
      if (!match || match.index === undefined) return null;

      const amount = this.parseAmount(match[1]);
      const label = line
        .slice(0, match.index)
        .replace(/[*#@]/g, "")
        .replace(/\b\d{4,}\b/g, "")
        .trim();

      if (!label || this.ignoredLabel.test(label) || !Number.isFinite(amount) || amount <= 0) {
        return null;
      }

      const categorization = this.categorizationService.categorize(label);

      return {
        id: this.idService.create(),
        label: this.toTitleCase(label),
        amount: Number(amount.toFixed(2)),
        category: categorization.category,
        categorizationConfidence: categorization.confidence,
        categorizationSource: categorization.source,
        needsCategoryReview: categorization.shouldPrompt
      };
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
