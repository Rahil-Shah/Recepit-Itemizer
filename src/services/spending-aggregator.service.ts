namespace ReceiptRing.Services {
  export interface CategorySpend {
    category: string;
    amount: number;
    color: string;
  }

  export interface MonthlySpend {
    month: string; // "YYYY-MM"
    total: number;
    categories: CategorySpend[];
  }

  // Fallback colors for categories that aren't part of the built-in palette.
  const FALLBACK_COLORS = ["#7cc4ff", "#f0a6ca", "#c3b1e1", "#ffd6a5", "#9ee7c0", "#e8998d"];

  // Map assorted Teller / receipt category strings onto our display buckets.
  const CATEGORY_ALIASES: Record<string, string> = {
    dining: "Dining",
    restaurants: "Dining",
    bar: "Dining",
    coffee: "Dining",
    groceries: "Groceries",
    grocery: "Groceries",
    supermarket: "Groceries",
    transport: "Transport",
    transportation: "Transport",
    fuel: "Transport",
    gas: "Transport",
    travel: "Transport",
    entertainment: "Entertainment",
    health: "Health",
    healthcare: "Health",
    medical: "Health",
    home: "Home",
    utilities: "Home",
    shopping: "Personal",
    clothing: "Personal",
    personal: "Personal",
    general: "Other"
  };

  export class SpendingAggregatorService {
    private readonly colorByName = new Map<string, string>();

    constructor(categories: readonly Domain.Category[]) {
      for (const category of categories) {
        this.colorByName.set(category.name, category.color);
      }
    }

    aggregate(
      receipts: readonly SavedReceiptSummary[],
      transactions: readonly BankTransaction[]
    ): MonthlySpend[] {
      const byMonth = new Map<string, Map<string, number>>();

      const add = (dateStr: string, rawCategory: string | null, amount: number): void => {
        if (!(amount > 0)) return;
        const month = this.monthKey(dateStr);
        if (!month) return;
        const category = this.normalize(rawCategory);
        const bucket = byMonth.get(month) ?? new Map<string, number>();
        bucket.set(category, (bucket.get(category) ?? 0) + amount);
        byMonth.set(month, bucket);
      };

      for (const receipt of receipts) {
        add(receipt.createdAt, receipt.category, receipt.total ?? 0);
      }
      for (const txn of transactions) {
        // Teller amounts are negative for outflows; only spending counts.
        add(txn.date, txn.category, txn.amount < 0 ? -txn.amount : 0);
      }

      return [...byMonth.entries()]
        .map(([month, bucket]) => ({
          month,
          total: [...bucket.values()].reduce((sum, value) => sum + value, 0),
          categories: [...bucket.entries()]
            .map(([category, amount]) => ({ category, amount, color: this.color(category) }))
            .sort((a, b) => b.amount - a.amount)
        }))
        .sort((a, b) => (a.month < b.month ? 1 : -1));
    }

    private monthKey(dateStr: string): string | null {
      if (typeof dateStr === "string" && /^\d{4}-\d{2}/.test(dateStr)) {
        return dateStr.slice(0, 7);
      }
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) return null;
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }

    private normalize(raw: string | null): string {
      if (!raw) return "Other";
      const key = raw.trim().toLowerCase();
      if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];
      // Title-case an unknown category so it still reads nicely.
      return key.charAt(0).toUpperCase() + key.slice(1);
    }

    private color(name: string): string {
      const known = this.colorByName.get(name);
      if (known) return known;
      // Deterministic fallback based on the category name.
      let hash = 0;
      for (let i = 0; i < name.length; i += 1) {
        hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
      }
      return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
    }
  }
}
