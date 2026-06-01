namespace ReceiptRing.Services {
  export class ReceiptParserService {
    private readonly ignoredLabel = /^(total|subtotal|tax|cash|change|visa|mastercard|amex|debit|credit|balance|auth|approval|receipt)\b/i;
    private readonly amountPattern = /(-?\$?\d{1,4}(?:,\d{3})*(?:\.\d{2})?)\s*$/;

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

      const amount = Number(match[1].replace(/[$,]/g, ""));
      const label = line
        .slice(0, match.index)
        .replace(/[*#@]/g, "")
        .replace(/\b\d{4,}\b/g, "")
        .trim();

      if (!label || this.ignoredLabel.test(label) || !Number.isFinite(amount) || amount <= 0) {
        return null;
      }

      return {
        id: this.idService.create(),
        label: this.toTitleCase(label),
        amount: Number(amount.toFixed(2)),
        category: this.categorizationService.assignCategory(label)
      };
    }

    private toTitleCase(value: string): string {
      return value
        .toLowerCase()
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }
  }
}
