namespace ReceiptRing.Services {
  export class CategorizationService {
    private readonly promptThreshold = 0.66;

    constructor(
      private readonly categories: readonly Domain.Category[],
      private readonly ruleStorageService: CategoryRuleStorageService
    ) {}

    categorize(label: string): Domain.CategorizationResult {
      const savedCategory = this.ruleStorageService.getCategoryFor(label);
      if (savedCategory) {
        return {
          category: savedCategory,
          confidence: 1,
          source: "saved-rule",
          matchedTerms: [],
          shouldPrompt: false
        };
      }

      const normalizedLabel = this.ruleStorageService.normalizeLabel(label);
      const tokens = this.getTokens(normalizedLabel);
      const scoredCategories = this.categories
        .filter((category) => category.name !== "Other")
        .map((category) => this.scoreCategory(category, normalizedLabel, tokens))
        .sort((left, right) => right.score - left.score);

      const bestMatch = scoredCategories[0];
      const runnerUp = scoredCategories[1];

      if (!bestMatch || bestMatch.score <= 0) {
        return this.createUncertainResult("Other", 0.18);
      }

      const margin = bestMatch.score - (runnerUp?.score ?? 0);
      const confidence = Math.min(0.96, 0.48 + bestMatch.score * 0.095 + margin * 0.055);

      if (confidence < this.promptThreshold) {
        return this.createUncertainResult(bestMatch.category.name, confidence, bestMatch.matchedTerms);
      }

      return {
        category: bestMatch.category.name,
        confidence,
        source: "keyword-match",
        matchedTerms: bestMatch.matchedTerms,
        shouldPrompt: false
      };
    }

    private scoreCategory(
      category: Domain.Category,
      normalizedLabel: string,
      tokens: readonly string[]
    ): { category: Domain.Category; score: number; matchedTerms: readonly string[] } {
      const matchedTerms: string[] = [];
      let score = 0;

      category.keywords.forEach((keyword) => {
        const normalizedKeyword = this.ruleStorageService.normalizeLabel(keyword);
        const keywordTokens = this.getTokens(normalizedKeyword);

        if (normalizedKeyword && normalizedLabel.includes(normalizedKeyword)) {
          score += keywordTokens.length > 1 ? 4.5 : 3;
          matchedTerms.push(keyword);
          return;
        }

        const overlap = keywordTokens.filter((token) => tokens.includes(token)).length;
        if (overlap > 0) {
          score += overlap * 1.25;
          matchedTerms.push(keyword);
        }
      });

      return { category, score, matchedTerms };
    }

    private createUncertainResult(
      category: Domain.CategoryName,
      confidence: number,
      matchedTerms: readonly string[] = []
    ): Domain.CategorizationResult {
      return {
        category,
        confidence,
        source: "uncertain",
        matchedTerms,
        shouldPrompt: true
      };
    }

    private getTokens(value: string): string[] {
      const stopWords = new Set(["and", "the", "with", "for", "fresh", "organic", "item"]);
      return value
        .split(" ")
        .map((token) => token.trim())
        .map((token) => this.stemToken(token))
        .filter((token) => token.length > 1 && !stopWords.has(token));
    }

    private stemToken(token: string): string {
      if (token.endsWith("ies") && token.length > 4) {
        return `${token.slice(0, -3)}y`;
      }

      if (token.endsWith("es") && token.length > 3) {
        return token.slice(0, -2);
      }

      if (token.endsWith("s") && token.length > 3) {
        return token.slice(0, -1);
      }

      return token;
    }
  }
}
