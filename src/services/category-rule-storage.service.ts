namespace ReceiptRing.Services {
  export class CategoryRuleStorageService {
    constructor(private readonly storageKey: string) {}

    getCategoryFor(label: string): Domain.CategoryName | null {
      const normalizedLabel = this.normalizeLabel(label);
      return this.loadRules()[normalizedLabel]?.category ?? null;
    }

    saveRule(label: string, category: Domain.CategoryName): void {
      const normalizedLabel = this.normalizeLabel(label);
      if (!normalizedLabel) return;

      const rules = this.loadRules();
      rules[normalizedLabel] = {
        normalizedLabel,
        category,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(rules));
    }

    normalizeLabel(label: string): string {
      return label
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\b(\d+(\.\d+)?|oz|lb|lbs|ct|pk|pkg|ea|each|small|medium|large)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    private loadRules(): Record<string, Domain.StoredCategoryRule> {
      try {
        const rawRules = localStorage.getItem(this.storageKey);
        return rawRules ? (JSON.parse(rawRules) as Record<string, Domain.StoredCategoryRule>) : {};
      } catch {
        return {};
      }
    }
  }
}
