namespace ReceiptRing.UI {
  export class CategorySummaryView {
    constructor(
      private readonly categories: readonly Domain.Category[],
      private readonly currencyFormatService: Services.CurrencyFormatService,
      private readonly ringView: CategoryRingView
    ) {}

    render(container: HTMLElement, totals: Domain.CategoryTotals, grandTotal: number): void {
      container.innerHTML = "";

      this.categories.forEach((category) => {
        const amount = totals[category.name] || 0;
        const percent = grandTotal > 0 ? Math.round((amount / grandTotal) * 100) : 0;
        container.append(this.createRow(category, amount, percent));
      });
    }

    private createRow(category: Domain.Category, amount: number, percent: number): HTMLElement {
      const row = document.createElement("div");
      row.className = "category-row";
      row.dataset.category = category.name;
      row.addEventListener("mouseenter", () => this.ringView.setFocus(category.name));
      row.addEventListener("mouseleave", () => this.ringView.setFocus(null));

      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = category.color;
      swatch.style.color = category.color;

      const name = document.createElement("span");
      name.className = "category-name";
      name.textContent = category.name;

      const meta = document.createElement("span");
      meta.className = "category-meta";
      meta.textContent = `${this.currencyFormatService.format(amount)} / ${percent}%`;

      row.append(swatch, name, meta);
      return row;
    }
  }
}
