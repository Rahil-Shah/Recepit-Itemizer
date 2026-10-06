namespace ReceiptRing.Services {
  export interface NamedAmount {
    name: string;
    amount: number;
    count: number;
  }

  /** The History tab's side panel: what the saved receipts add up to. */
  export interface HistoryOverview {
    receiptCount: number;
    totalSpent: number;
    averageReceipt: number;
    thisMonthSpent: number;
    thisMonthCount: number;
    withPhotos: number;
    topStores: NamedAmount[];
    categories: NamedAmount[];
  }

  /** The budgeting tab's "month at a glance" panel. */
  export interface MonthGlance {
    month: string;
    total: number;
    // The month before, for the change line; null when it has no spending.
    previousTotal: number | null;
    changeRatio: number | null;
    receiptCount: number;
    transactionCount: number;
    dailyAverage: number;
    biggestCategory: NamedAmount | null;
    topMerchant: NamedAmount | null;
    largestPurchase: { name: string; amount: number } | null;
  }

  /**
   * Summaries for the panels beside the main content. Pure: everything comes
   * in as arguments, including "now", so the numbers are testable.
   */
  export class InsightsService {
    constructor(private readonly aggregator: SpendingAggregatorService) {}

    historyOverview(receipts: readonly SavedReceiptSummary[], now: Date = new Date()): HistoryOverview {
      const thisMonth = this.aggregator.monthKey(now.toISOString());
      const total = (receipt: SavedReceiptSummary): number => Number(receipt.total ?? 0) || 0;
      const totalSpent = receipts.reduce((sum, receipt) => sum + total(receipt), 0);
      const inMonth = receipts.filter((receipt) => this.aggregator.monthKey(receipt.createdAt) === thisMonth);

      return {
        receiptCount: receipts.length,
        totalSpent,
        averageReceipt: receipts.length > 0 ? totalSpent / receipts.length : 0,
        thisMonthSpent: inMonth.reduce((sum, receipt) => sum + total(receipt), 0),
        thisMonthCount: inMonth.length,
        withPhotos: receipts.filter((receipt) => receipt.hasImage).length,
        topStores: this.rank(receipts.map((receipt) => [this.storeKey(receipt.storeName), total(receipt)]), 5),
        categories: this.rank(
          receipts.map((receipt) => [receipt.budgetCategory || receipt.category || "Other", total(receipt)]),
          6
        )
      };
    }

    monthGlance(
      month: string,
      monthlySpend: readonly MonthlySpend[],
      receipts: readonly SavedReceiptSummary[],
      transactions: readonly BankTransaction[],
      now: Date = new Date()
    ): MonthGlance {
      const entry = monthlySpend.find((spend) => spend.month === month) ?? null;
      const total = entry?.total ?? 0;
      const previous = monthlySpend.find((spend) => spend.month === this.previousMonth(month)) ?? null;
      const ids = this.aggregator.idsForMonth(month, receipts, transactions);
      const monthReceipts = receipts.filter((receipt) => ids.receiptIds.includes(receipt.id));
      const monthTransactions = transactions.filter((txn) => ids.transactionIds.includes(txn.id));

      const purchases: [string, number][] = [
        ...monthReceipts.map((receipt): [string, number] => [
          this.storeKey(receipt.storeName),
          Number(receipt.total ?? 0) || 0
        ]),
        ...monthTransactions.map((txn): [string, number] => [this.storeKey(txn.description), -txn.amount])
      ];
      const largest = purchases.reduce<[string, number] | null>(
        (best, purchase) => (best === null || purchase[1] > best[1] ? purchase : best),
        null
      );
      const top = entry?.categories[0];

      return {
        month,
        total,
        previousTotal: previous ? previous.total : null,
        changeRatio: previous && previous.total > 0 ? (total - previous.total) / previous.total : null,
        receiptCount: monthReceipts.length,
        transactionCount: monthTransactions.length,
        dailyAverage: total / this.daysElapsed(month, now),
        biggestCategory: top ? { name: top.category, amount: top.amount, count: 0 } : null,
        topMerchant: this.rank(purchases, 1)[0] ?? null,
        largestPurchase: largest ? { name: largest[0], amount: largest[1] } : null
      };
    }

    // Groups by name, case-insensitively, keeping the first spelling seen.
    private rank(entries: readonly [string, number][], limit: number): NamedAmount[] {
      const groups = new Map<string, NamedAmount>();
      for (const [name, amount] of entries) {
        const key = name.toLowerCase();
        const group = groups.get(key) ?? { name, amount: 0, count: 0 };
        group.amount += amount;
        group.count += 1;
        groups.set(key, group);
      }
      return [...groups.values()]
        .filter((group) => group.amount > 0)
        .sort((left, right) => right.amount - left.amount)
        .slice(0, limit);
    }

    private storeKey(name: string | null | undefined): string {
      const trimmed = (name ?? "").replace(/\s+/g, " ").trim();
      return trimmed || "Unknown";
    }

    private previousMonth(month: string): string {
      const [year, monthNumber] = month.split("-").map(Number);
      const date = new Date(year, monthNumber - 2, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }

    // A month still under way is averaged over the days so far, not all of it.
    private daysElapsed(month: string, now: Date): number {
      const [year, monthNumber] = month.split("-").map(Number);
      const daysInMonth = new Date(year, monthNumber, 0).getDate();
      const current = now.getFullYear() === year && now.getMonth() + 1 === monthNumber;
      return Math.max(1, current ? now.getDate() : daysInMonth);
    }
  }
}
