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

  // The budget categories the Gemini pass can choose (server/budget-categorize.mjs)
  // that are not item categories, coloured to sit with the built-in palette.
  const BUDGET_COLORS: Record<string, string> = {
    Travel: "#4f8a8b",
    Shopping: "#c47a5a",
    Utilities: "#8a9a5b",
    Subscriptions: "#7d6ba8",
    Education: "#b5935a",
    Fees: "#a85448"
  };

  // Fallback colors for categories that aren't part of the built-in palette.
  const FALLBACK_COLORS = ["#7cc4ff", "#f0a6ca", "#c3b1e1", "#ffd6a5", "#9ee7c0", "#e8998d"];

  // Map assorted Plaid / receipt category strings onto our display buckets.
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

    /**
     * @param receiptAmounts Overrides the amount a given receipt contributes,
     *   keyed by receipt id. Used when the account owner is one of the people a
     *   receipt was split between: their budget should show their share of the
     *   bill, not the whole thing they happened to pay at the till. Receipts
     *   absent from the map fall back to their full total.
     */
    aggregate(
      receipts: readonly SavedReceiptSummary[],
      transactions: readonly BankTransaction[],
      receiptAmounts?: ReadonlyMap<string, number>
    ): MonthlySpend[] {
      const byMonth = new Map<string, Map<string, number>>();

      // A category from the Gemini pass is already one of the ring's own
      // names, so it is used as given. Running it through the aliases would
      // fold "Travel" into Transport and "Shopping" into Personal, undoing
      // the very distinction the pass was asked to draw.
      const add = (
        dateStr: string,
        rawCategory: string | null,
        amount: number,
        budgetCategory?: string | null
      ): void => {
        if (!(amount > 0)) return;
        const month = this.monthKey(dateStr);
        if (!month) return;
        const category = budgetCategory || this.normalize(rawCategory);
        const bucket = byMonth.get(month) ?? new Map<string, number>();
        bucket.set(category, (bucket.get(category) ?? 0) + amount);
        byMonth.set(month, bucket);
      };

      // A receipt attached to a bank transaction is a picture of that same
      // purchase, not a second one. Counting both put a $40 dinner into the
      // ring as $80 the moment its photo was attached, so let the transaction
      // stand for the spend and skip the receipt.
      const attachedReceiptIds = new Set(
        transactions
          .map((txn) => txn.linkedReceiptId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      );

      for (const receipt of receipts) {
        if (attachedReceiptIds.has(receipt.id)) continue;
        const override = receiptAmounts?.get(receipt.id);
        add(receipt.createdAt, receipt.category, override ?? receipt.total ?? 0, receipt.budgetCategory);
      }
      for (const txn of transactions) {
        // Amounts are normalized to negative-for-outflows on ingest (see
        // server/bank.mjs); only spending counts.
        add(txn.date, txn.category, txn.amount < 0 ? -txn.amount : 0, txn.budgetCategory);
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

    /**
     * The receipts and spending transactions that make up one month of the
     * ring, by id -- what the Gemini categorization pass is asked about. A
     * receipt attached to a transaction is left out: the transaction already
     * stands for that purchase.
     */
    idsForMonth(
      month: string,
      receipts: readonly SavedReceiptSummary[],
      transactions: readonly BankTransaction[]
    ): { receiptIds: string[]; transactionIds: string[] } {
      const attached = new Set(transactions.map((txn) => txn.linkedReceiptId).filter(Boolean));
      return {
        receiptIds: receipts
          .filter((receipt) => !attached.has(receipt.id) && this.monthKey(receipt.createdAt) === month)
          .map((receipt) => receipt.id),
        transactionIds: transactions
          .filter((txn) => txn.amount < 0 && this.monthKey(txn.date) === month)
          .map((txn) => txn.id)
      };
    }

    // Public so callers (e.g. filtering a transaction list to one month) bucket
    // dates exactly the way aggregate() does.
    //
    // Two kinds of value arrive here and they need different handling. Bank
    // transactions carry a calendar date ("YYYY-MM-DD") whose month is simply
    // what it says. Receipts carry a timestamp of when they were saved, which
    // has to be read in the user's own zone: taking the UTC month instead put
    // a receipt saved on the evening of the 31st into the following month's
    // ring and trend, while History -- formatting the same value locally --
    // still showed it as the 31st.
    monthKey(dateStr: string): string | null {
      if (typeof dateStr === "string" && /^\d{4}-\d{2}(-\d{2})?$/.test(dateStr)) {
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
      const known = this.colorByName.get(name) ?? BUDGET_COLORS[name];
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
