namespace ReceiptRing.App {
  export class AppController {
    private items: Domain.PurchaseItem[];

    constructor(
      private readonly elements: UI.DomRegistry,
      private readonly parserService: Services.ReceiptParserService,
      private readonly storageService: Services.StorageService,
      private readonly summaryService: Services.SpendingSummaryService,
      private readonly currencyFormatService: Services.CurrencyFormatService,
      private readonly imagePreviewService: Services.ImagePreviewService,
      private readonly itemListView: UI.ItemListView,
      private readonly ringView: UI.CategoryRingView,
      private readonly categorySummaryView: UI.CategorySummaryView,
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
          amount: 0
        }
      ];
      this.render();
    }

    private updateItem(id: string, patch: Partial<Domain.PurchaseItem>): void {
      this.items = this.items.map((item) => (item.id === id ? { ...item, ...patch } : item));
      this.storageService.save(this.items);
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
  }
}
