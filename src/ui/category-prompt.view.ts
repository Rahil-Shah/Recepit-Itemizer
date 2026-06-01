namespace ReceiptRing.UI {
  export interface CategoryPromptResult {
    category: Domain.CategoryName;
    remember: boolean;
  }

  export class CategoryPromptView {
    private activeResolve: ((result: CategoryPromptResult | null) => void) | null = null;

    constructor(
      private readonly categories: readonly Domain.Category[],
      private readonly elements: DomRegistry
    ) {
      this.renderOptions();
      this.bindEvents();
    }

    prompt(item: Domain.PurchaseItem): Promise<CategoryPromptResult | null> {
      this.elements.categoryPromptItem.textContent = item.label;
      this.elements.categoryPromptSelect.value = item.category;
      this.elements.categoryPromptRemember.checked = false;
      this.elements.categoryPrompt.classList.remove("hidden");
      this.elements.categoryPromptSelect.focus();

      return new Promise((resolve) => {
        this.activeResolve = resolve;
      });
    }

    private renderOptions(): void {
      this.elements.categoryPromptSelect.innerHTML = "";
      this.categories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category.name;
        option.textContent = category.name;
        this.elements.categoryPromptSelect.append(option);
      });
    }

    private bindEvents(): void {
      this.elements.categoryPromptSave.addEventListener("click", () => this.resolvePrompt());
      this.elements.categoryPromptSkip.addEventListener("click", () => this.closePrompt(null));
      this.elements.categoryPrompt.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          this.closePrompt(null);
        }
      });
    }

    private resolvePrompt(): void {
      this.closePrompt({
        category: this.elements.categoryPromptSelect.value as Domain.CategoryName,
        remember: this.elements.categoryPromptRemember.checked
      });
    }

    private closePrompt(result: CategoryPromptResult | null): void {
      this.elements.categoryPrompt.classList.add("hidden");
      const resolve = this.activeResolve;
      this.activeResolve = null;
      resolve?.(result);
    }
  }
}
