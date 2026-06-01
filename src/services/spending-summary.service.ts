namespace ReceiptRing.Services {
  export class SpendingSummaryService {
    constructor(private readonly categories: readonly Domain.Category[]) {}

    getTotals(items: readonly Domain.PurchaseItem[]): Domain.CategoryTotals {
      const totals = this.categories.reduce((summary, category) => {
        summary[category.name] = 0;
        return summary;
      }, {} as Domain.CategoryTotals);

      items.forEach((item) => {
        totals[item.category] += Number(item.amount || 0);
      });

      return totals;
    }

    getGrandTotal(totals: Domain.CategoryTotals): number {
      return Object.values(totals).reduce((sum, value) => sum + value, 0);
    }
  }
}
