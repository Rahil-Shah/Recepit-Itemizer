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

    parseOcr(document: Domain.OcrDocument): Domain.PurchaseItem[] {
      return document.lines
        .map((line) => this.parseSpatialLine(line, document.imageWidth))
        .filter((item): item is Domain.PurchaseItem => item !== null);
    }

    parseReceiptLines(document: Domain.OcrDocument): Domain.ReceiptLine[] {
      return document.lines
        .map((line) => this.parseReceiptLine(line, document.imageWidth))
        .filter((line): line is Domain.ReceiptLine => line !== null);
    }

    extractMetadata(document: Domain.OcrDocument): Domain.ReceiptMetadata {
      const lines = document.lines.map((line) => this.getLineText(line));
      const text = lines.join("\n");
      const amountNear = (label: RegExp): number | null => {
        const line = lines.find((candidate) => label.test(candidate));
        const match = line?.match(this.amountPattern);
        return match ? this.parseAmount(match[1]) : null;
      };
      const dateMatch = text.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/);
      const timeMatch = text.match(/\b(\d{1,2}:\d{2}\s?(?:AM|PM)?)\b/i);
      const receiptMatch = text.match(/\b(?:receipt|trans|transaction|order|invoice|ref)[\s#:.-]*([A-Z0-9-]{4,})\b/i);

      return {
        storeName: lines.find((line) => /[A-Za-z]{3,}/.test(line) && !this.ignoredLabel.test(line)) ?? "",
        date: dateMatch?.[1] ?? "",
        time: timeMatch?.[1] ?? "",
        receiptNumber: receiptMatch?.[1] ?? "",
        subtotal: amountNear(/^sub\s*total|subtotal/i),
        tax: amountNear(/^tax\b|sales tax/i),
        total: amountNear(/^total\b|amount due|balance due/i)
      };
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

    private parseSpatialLine(line: Domain.OcrLine, imageWidth: number): Domain.PurchaseItem | null {
      const words = line.words.slice().sort((left, right) => left.x - right.x);
      const priceSpan = this.findPriceSpan(words, imageWidth);
      if (!priceSpan) return null;

      const priceWord = words[priceSpan.startIndex];
      const labelWords = words
        .slice(0, priceSpan.startIndex)
        .filter((word) => word.x < priceWord.x)
        .map((word) => word.text);
      const label = labelWords.join(" ").replace(/[*#@]/g, "").replace(/\b\d{4,}\b/g, "").trim();
      const amount = this.parseAmount(priceSpan.text);

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

    private parseReceiptLine(line: Domain.OcrLine, imageWidth: number): Domain.ReceiptLine | null {
      const words = line.words.slice().sort((left, right) => left.x - right.x);
      const priceSpan = this.findPriceSpan(words, imageWidth);
      if (!priceSpan) return null;

      const priceWord = words[priceSpan.startIndex];
      const label = words
        .slice(0, priceSpan.startIndex)
        .filter((word) => word.x < priceWord.x)
        .map((word) => word.text)
        .join(" ")
        .replace(/[*#@]/g, "")
        .replace(/\b\d{4,}\b/g, "")
        .trim();
      const amount = this.parseAmount(priceSpan.text);

      if (!label || this.ignoredLabel.test(label) || !Number.isFinite(amount) || amount <= 0) {
        return null;
      }

      const minX = Math.min(...line.words.map((word) => word.x));
      const minY = Math.min(...line.words.map((word) => word.y));
      const maxX = Math.max(...line.words.map((word) => word.x + word.width));
      const maxY = Math.max(...line.words.map((word) => word.y + word.height));

      return {
        id: line.id,
        label: this.toTitleCase(label),
        amount: Number(amount.toFixed(2)),
        confidence: line.confidence,
        ignored: false,
        ocrLineId: line.id,
        bounds: {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY
        }
      };
    }

    private findPriceSpan(
      words: readonly Domain.OcrWord[],
      imageWidth: number
    ): { startIndex: number; endIndex: number; text: string } | null {
      let bestSpan: { startIndex: number; endIndex: number; text: string } | null = null;
      let bestScore = 0;

      words.forEach((_word, index) => {
        for (let endIndex = index; endIndex < Math.min(words.length, index + 3); endIndex += 1) {
          const spanWords = words.slice(index, endIndex + 1);
          const text = spanWords.map((word) => word.text).join("");
          if (!this.amountPattern.test(text)) continue;

          const rightMost = Math.max(...spanWords.map((word) => word.x + word.width));
          const confidence =
            spanWords.reduce((sum, word) => sum + word.confidence, 0) / Math.max(1, spanWords.length);
          const rightBias = rightMost / imageWidth;
          const score = confidence + rightBias * 35;
          if (score > bestScore && rightBias > 0.42) {
            bestScore = score;
            bestSpan = { startIndex: index, endIndex, text };
          }
        }
      });

      return bestSpan;
    }

    private getLineText(line: Domain.OcrLine): string {
      return line.words
        .slice()
        .sort((left, right) => left.x - right.x)
        .map((word) => word.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
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
