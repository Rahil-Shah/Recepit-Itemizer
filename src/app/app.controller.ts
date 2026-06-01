namespace ReceiptRing.App {
  export class AppController {
    private items: Domain.PurchaseItem[];
    private isPromptingForCategories = false;
    private reviewTimer: number | null = null;

    constructor(
      private readonly elements: UI.DomRegistry,
      private readonly parserService: Services.ReceiptParserService,
      private readonly categorizationService: Services.CategorizationService,
      private readonly categoryRuleStorageService: Services.CategoryRuleStorageService,
      private readonly storageService: Services.StorageService,
      private readonly summaryService: Services.SpendingSummaryService,
      private readonly currencyFormatService: Services.CurrencyFormatService,
      private readonly imagePreviewService: Services.ImagePreviewService,
      private readonly itemListView: UI.ItemListView,
      private readonly ringView: UI.CategoryRingView,
      private readonly categorySummaryView: UI.CategorySummaryView,
      private readonly categoryPromptView: UI.CategoryPromptView,
      private readonly idService: Services.IdService
    ) {
      this.items = this.storageService.load();
    }

    start(): void {
      this.bindEvents();
      this.render();
    }

    private bindEvents(): void {
      this.elements.sampleButton.addEventListener("click", () => this.loadSample());
      this.elements.receiptImage.addEventListener("change", () => this.handleImageInput());
      this.elements.clearImageButton.addEventListener("click", () => this.clearImage());
      this.elements.parseButton.addEventListener("click", () => this.itemizeReceiptText());
      this.elements.clearButton.addEventListener("click", () => this.clearReceipt());
      this.elements.addItemButton.addEventListener("click", () => this.addItem());

      ["dragenter", "dragover"].forEach((eventName) => {
        this.elements.dropzone.addEventListener(eventName, (event) => {
          event.preventDefault();
          this.elements.dropzone.classList.add("is-dragging");
        });
      });

      ["dragleave", "drop"].forEach((eventName) => {
        this.elements.dropzone.addEventListener(eventName, (event) => {
          event.preventDefault();
          this.elements.dropzone.classList.remove("is-dragging");
        });
      });

      this.elements.dropzone.addEventListener("drop", (event) => this.handleImageDrop(event));
    }

    private loadSample(): void {
      this.elements.receiptText.value = Config.SAMPLE_RECEIPT;
      this.items = this.parserService.parse(Config.SAMPLE_RECEIPT);
      this.render();
      void this.reviewAmbiguousItems();
    }

    private handleImageInput(): void {
      const file = this.elements.receiptImage.files?.[0];
      if (file) {
        this.imagePreviewService.show(file, this.elements.receiptPreview, this.elements.receiptPreviewWrap);
      }
    }

    private handleImageDrop(event: DragEvent): void {
      const file = event.dataTransfer?.files?.[0];
      if (file) {
        this.imagePreviewService.show(file, this.elements.receiptPreview, this.elements.receiptPreviewWrap);
      }
    }

    private clearImage(): void {
      this.imagePreviewService.clear(
        this.elements.receiptImage,
        this.elements.receiptPreview,
        this.elements.receiptPreviewWrap
      );
    }

    private itemizeReceiptText(): void {
      this.items = this.parserService.parse(this.elements.receiptText.value);
      this.render();
      void this.reviewAmbiguousItems();
    }

    private clearReceipt(): void {
      this.elements.receiptText.value = "";
      this.items = [];
      this.render();
    }

    private addItem(): void {
      this.items = [
        ...this.items,
        {
          id: this.idService.create(),
          label: "New item",
          category: "Other",
          amount: 0,
          categorizationConfidence: 0,
          categorizationSource: "uncertain",
          needsCategoryReview: false
        }
      ];
      this.render();
    }

    private updateItem(id: string, patch: Partial<Domain.PurchaseItem>): void {
      const shouldRenderItems = patch.label !== undefined;

      this.items = this.items.map((item) => {
        if (item.id !== id) return item;

        const nextItem = { ...item, ...patch };

        if (patch.label !== undefined && nextItem.label.trim().length > 2 && nextItem.label !== "New item") {
          const categorization = this.categorizationService.categorize(nextItem.label);
          nextItem.category = categorization.category;
          nextItem.categorizationConfidence = categorization.confidence;
          nextItem.categorizationSource = categorization.source;
          nextItem.needsCategoryReview = categorization.shouldPrompt;
          this.scheduleCategoryReview();
        }

        if (patch.category !== undefined) {
          nextItem.categorizationConfidence = 1;
          nextItem.categorizationSource = "saved-rule";
          nextItem.needsCategoryReview = false;
        }

        return nextItem;
      });
      this.storageService.save(this.items);
      if (shouldRenderItems) {
        this.renderItems();
      }
      this.renderSummary();
    }

    private deleteItem(id: string): void {
      this.items = this.items.filter((candidate) => candidate.id !== id);
      this.render();
    }

    private render(): void {
      this.storageService.save(this.items);
      this.renderItems();
      this.renderSummary();
    }

    private renderItems(): void {
      this.elements.emptyState.classList.toggle("hidden", this.items.length > 0);
      this.elements.itemCount.textContent = `${this.items.length} ${this.items.length === 1 ? "item" : "items"}`;
      this.itemListView.render(this.elements.itemsList, this.items, {
        onUpdate: (id, patch) => this.updateItem(id, patch),
        onDelete: (id) => this.deleteItem(id)
      });
    }

    private renderSummary(): void {
      const totals = this.summaryService.getTotals(this.items);
      const grandTotal = this.summaryService.getGrandTotal(totals);
      this.elements.receiptTotal.textContent = this.currencyFormatService.format(grandTotal);
      this.elements.ringTotal.textContent = this.currencyFormatService.format(grandTotal);
      this.ringView.render(this.elements.categoryRing, totals, grandTotal);
      this.categorySummaryView.render(this.elements.categoryList, totals, grandTotal);
    }

    private scheduleCategoryReview(): void {
      if (this.reviewTimer !== null) {
        window.clearTimeout(this.reviewTimer);
      }

      this.reviewTimer = window.setTimeout(() => {
        this.reviewTimer = null;
        void this.reviewAmbiguousItems();
      }, 650);
    }

    private async reviewAmbiguousItems(): Promise<void> {
      if (this.isPromptingForCategories) return;

      this.isPromptingForCategories = true;
      try {
        let item = this.items.find((candidate) => candidate.needsCategoryReview);
        while (item) {
          const result = await this.categoryPromptView.prompt(item);

          if (result) {
            this.applyPromptResult(item.id, result);
          } else {
            this.markItemReviewed(item.id);
          }

          this.render();
          item = this.items.find((candidate) => candidate.needsCategoryReview);
        }
      } finally {
        this.isPromptingForCategories = false;
      }
    }

    private applyPromptResult(id: string, result: UI.CategoryPromptResult): void {
      const item = this.items.find((candidate) => candidate.id === id);
      if (!item) return;

      if (result.remember) {
        this.categoryRuleStorageService.saveRule(item.label, result.category);
      }

      this.items = this.items.map((candidate) =>
        candidate.id === id
          ? {
              ...candidate,
              category: result.category,
              categorizationConfidence: 1,
              categorizationSource: result.remember ? "saved-rule" : "keyword-match",
              needsCategoryReview: false
            }
          : candidate
      );
    }

    private markItemReviewed(id: string): void {
      this.items = this.items.map((candidate) =>
        candidate.id === id ? { ...candidate, needsCategoryReview: false } : candidate
      );
    }
  }
}
