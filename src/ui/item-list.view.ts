namespace ReceiptRing.UI {
  export interface ItemListHandlers {
    onUpdate(id: string, patch: Partial<Domain.PurchaseItem>): void;
    onDelete(id: string): void;
  }

  export class ItemListView {
    constructor(private readonly categories: readonly Domain.Category[]) {}

    render(container: HTMLElement, items: readonly Domain.PurchaseItem[], handlers: ItemListHandlers): void {
      container.innerHTML = "";

      items.forEach((item) => {
        container.append(this.createRow(item, handlers));
      });
    }

    private createRow(item: Domain.PurchaseItem, handlers: ItemListHandlers): HTMLElement {
      const row = document.createElement("div");
      row.className = "table-row";
      row.setAttribute("role", "row");
      row.dataset.id = item.id;

      const labelInput = this.createLabelInput(item, handlers);
      const categorySelect = this.createCategorySelect(item, handlers);
      const amountInput = this.createAmountInput(item, handlers);
      const deleteButton = this.createDeleteButton(item, handlers);

      row.append(labelInput, categorySelect, amountInput, deleteButton);
      return row;
    }

    private createLabelInput(item: Domain.PurchaseItem, handlers: ItemListHandlers): HTMLInputElement {
      const input = document.createElement("input");
      input.className = "table-input";
      input.value = item.label;
      input.setAttribute("aria-label", "Item name");
      input.addEventListener("change", () => handlers.onUpdate(item.id, { label: input.value }));
      return input;
    }

    private createCategorySelect(item: Domain.PurchaseItem, handlers: ItemListHandlers): HTMLSelectElement {
      const select = document.createElement("select");
      select.className = "table-select";
      select.setAttribute("aria-label", "Category");

      this.categories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category.name;
        option.textContent = category.name;
        option.selected = category.name === item.category;
        select.append(option);
      });

      select.addEventListener("change", () =>
        handlers.onUpdate(item.id, { category: select.value as Domain.CategoryName })
      );
      return select;
    }

    private createAmountInput(item: Domain.PurchaseItem, handlers: ItemListHandlers): HTMLInputElement {
      const input = document.createElement("input");
      input.className = "table-input amount-input";
      input.type = "number";
      input.min = "0";
      input.step = "0.01";
      input.value = String(item.amount);
      input.setAttribute("aria-label", "Amount");
      input.addEventListener("input", () => handlers.onUpdate(item.id, { amount: Number(input.value) }));
      return input;
    }

    private createDeleteButton(item: Domain.PurchaseItem, handlers: ItemListHandlers): HTMLButtonElement {
      const button = document.createElement("button");
      button.className = "icon-button delete-row";
      button.type = "button";
      button.textContent = "x";
      button.setAttribute("aria-label", `Remove ${item.label || "item"}`);
      button.addEventListener("click", () => handlers.onDelete(item.id));
      return button;
    }
  }
}
