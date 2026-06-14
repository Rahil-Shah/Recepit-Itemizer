namespace ReceiptRing.App {
  export class AppController {
    private items: Domain.PurchaseItem[];
    private receiptLines: Domain.ReceiptLine[] = [];
    private people: Domain.SplitPerson[] = [];
    private assignments: Domain.LineAssignment[] = [];
    private selectedLineIds = new Set<string>();
    private activePersonId: string | null = null;
    private receiptCategory: Domain.ReceiptCategory = "Dining";
    private cameraStream: MediaStream | null = null;
    private isPromptingForCategories = false;
    private reviewTimer: number | null = null;

    constructor(
      private readonly elements: UI.DomRegistry,
      private readonly parserService: Services.ReceiptParserService,
      private readonly categorizationService: Services.CategorizationService,
      private readonly categoryRuleStorageService: Services.CategoryRuleStorageService,
      private readonly storageService: Services.StorageService,
      private readonly currencyFormatService: Services.CurrencyFormatService,
      private readonly imagePreviewService: Services.ImagePreviewService,
      private readonly geminiService: Services.GeminiService,
      private readonly categoryPromptView: UI.CategoryPromptView,
      private readonly splitWorkspaceView: UI.SplitWorkspaceView,
      private readonly splitCalculatorService: Services.SplitCalculatorService,
      private readonly idService: Services.IdService
    ) {
      this.items = this.storageService.load();
    }

    start(): void {
      this.bindEvents();
      this.render();
      void this.initGeminiSettings();
    }

    private bindEvents(): void {
      this.elements.sampleButton.addEventListener("click", () => this.loadSample());
      this.elements.dropzone.addEventListener("click", (event) => {
        if (event.target === this.elements.receiptImage) return;
        event.preventDefault();
        this.elements.receiptImage.click();
      });
      this.elements.receiptImage.addEventListener("change", () => this.handleImageInput());
      this.elements.clearImageButton.addEventListener("click", () => this.clearImage());
      this.elements.parseButton.addEventListener("click", () => this.itemizeReceiptText());
      this.elements.clearButton.addEventListener("click", () => this.clearReceipt());
      this.elements.openCameraButton.addEventListener("click", () => void this.openCamera());
      this.elements.closeCameraButton.addEventListener("click", () => this.closeCamera());
      this.elements.capturePhotoButton.addEventListener("click", () => void this.captureCameraPhoto());
      this.elements.addPersonButton.addEventListener("click", () => this.addPerson());
      this.elements.personNameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") this.addPerson();
      });
      this.elements.assignLinesButton.addEventListener("click", () => this.assignSelectedLines());
      this.elements.taxInput.addEventListener("input", () => this.render());
      this.elements.receiptCategory.addEventListener("change", () => {
        this.receiptCategory = this.elements.receiptCategory.value as Domain.ReceiptCategory;
      });
      this.elements.settingsButton.addEventListener("click", () => this.openSettings());
      this.elements.closeSettingsButton.addEventListener("click", () => this.closeSettings());
      this.elements.saveSettingsButton.addEventListener("click", () => this.saveSettings());

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
        this.processReceiptImage(file);
      }
    }

    private handleImageDrop(event: DragEvent): void {
      const file = event.dataTransfer?.files?.[0];
      if (file) {
        this.processReceiptImage(file);
      }
    }

    private clearImage(): void {
      this.imagePreviewService.clear(
        this.elements.receiptImage,
        this.elements.receiptPreview,
        this.elements.receiptPreviewWrap
      );
      this.receiptLines = [];
      this.assignments = [];
      this.selectedLineIds.clear();
      this.hideOcrStatus();
    }

    private itemizeReceiptText(): void {
      this.items = this.parserService.parse(this.elements.receiptText.value);
      this.receiptLines = this.items.map((item) => ({
        id: item.id,
        label: item.label,
        amount: item.amount,
        confidence: item.categorizationConfidence * 100,
        ignored: false
      }));
      this.render();
    }

    private clearReceipt(): void {
      this.elements.receiptText.value = "";
      this.items = [];
      this.receiptLines = [];
      this.assignments = [];
      this.selectedLineIds.clear();
      this.render();
    }

    private render(): void {
      this.storageService.save(this.items);
      this.renderSplitWorkspace();
      this.renderSummary();
    }

    private renderSplitWorkspace(): void {
      this.elements.emptyState.classList.toggle("hidden", this.receiptLines.length > 0);
      this.elements.itemCount.textContent = `${this.receiptLines.length} ${this.receiptLines.length === 1 ? "line" : "lines"}`;
      const unassignedCount = this.splitCalculatorService.getUnassignedCount(this.receiptLines, this.assignments);
      this.elements.unassignedCount.textContent = `${unassignedCount} unassigned`;
      this.elements.unassignedCount.classList.toggle("is-warning", unassignedCount > 0);

      this.splitWorkspaceView.renderLines(
        this.elements.receiptLinesList,
        this.receiptLines,
        this.assignments,
        this.people,
        this.selectedLineIds,
        {
          onLineToggle: (lineId) => this.toggleLineSelection(lineId),
          onLineIgnore: (lineId) => this.toggleIgnoredLine(lineId),
          onPersonSelect: (personId) => this.selectPerson(personId),
          onPersonDelete: (personId) => this.deletePerson(personId)
        }
      );
      this.splitWorkspaceView.renderPeople(this.elements.peopleList, this.people, this.activePersonId, {
        onLineToggle: (lineId) => this.toggleLineSelection(lineId),
        onLineIgnore: (lineId) => this.toggleIgnoredLine(lineId),
        onPersonSelect: (personId) => this.selectPerson(personId),
        onPersonDelete: (personId) => this.deletePerson(personId)
      });
      this.splitWorkspaceView.renderTotals(
        this.elements.splitTotalsList,
        this.splitCalculatorService.calculate(this.people, this.receiptLines, this.assignments, this.getTaxAmount())
      );
    }

    private renderSummary(): void {
      const grandTotal =
        this.receiptLines.filter((line) => !line.ignored).reduce((sum, line) => sum + line.amount, 0) + this.getTaxAmount();
      this.elements.receiptTotal.textContent = this.currencyFormatService.format(grandTotal);
    }

    private async extractAndItemizeReceipt(file: File): Promise<void> {
      const apiKey = localStorage.getItem("gemini_api_key") || "";
      const model = localStorage.getItem("gemini_model") || "gemini-3.5-flash";

      if (!apiKey) {
        this.setOcrStatus("Please configure your Gemini API Key in Settings first.", 1);
        this.openSettings();
        return;
      }

      this.setOcrStatus("Analyzing receipt with Gemini...", 0.15);
      this.elements.parseButton.setAttribute("disabled", "true");

      try {
        const result = await this.geminiService.parseReceiptImage(file, apiKey, model);

        // Log the JSON output in the terminal/console when putting a photo
        console.log("Gemini parsed receipt output:", result);

        const storeName = result.storeName || "";
        const subtotal = typeof result.subtotal === "number" ? result.subtotal : null;
        const tax = typeof result.tax === "number" ? result.tax : null;
        const total = typeof result.total === "number" ? result.total : null;

        this.elements.taxInput.value = String(tax ?? 0);

        let formattedText = `Store: ${storeName}\n\nItems:\n`;
        const purchaseItems: Domain.PurchaseItem[] = [];

        if (Array.isArray(result.items)) {
          result.items.forEach((item: any) => {
            const label = this.toTitleCase(item.name || "Unknown Item");
            const amount = typeof item.price === "number" ? item.price : Number(item.price) || 0;
            const lowConfidence = !!item.lowConfidence;

            formattedText += `- ${label}: $${amount.toFixed(2)}${lowConfidence ? " (low confidence)" : ""}\n`;

            const categorization = this.categorizationService.categorize(label);

            purchaseItems.push({
              id: this.idService.create(),
              label,
              amount: Number(amount.toFixed(2)),
              category: categorization.category,
              categorizationConfidence: lowConfidence ? 0.3 : categorization.confidence,
              categorizationSource: categorization.source,
              needsCategoryReview: lowConfidence || categorization.shouldPrompt
            });
          });
        }

        if (Array.isArray(result.discounts) && result.discounts.length > 0) {
          formattedText += `\nDiscounts:\n`;
          result.discounts.forEach((discount: any) => {
            const label = this.toTitleCase(discount.name || "Discount") + " (Discount)";
            const amount = typeof discount.amount === "number" ? discount.amount : Number(discount.amount) || 0;
            const negativeAmount = -Math.abs(amount);

            formattedText += `- ${label}: -$${Math.abs(negativeAmount).toFixed(2)}\n`;

            purchaseItems.push({
              id: this.idService.create(),
              label,
              amount: Number(negativeAmount.toFixed(2)),
              category: "Other",
              categorizationConfidence: 1.0,
              categorizationSource: "saved-rule",
              needsCategoryReview: false
            });
          });
        }

        formattedText += `\nSubtotal: $${(subtotal ?? 0).toFixed(2)}\nTax: $${(tax ?? 0).toFixed(2)}\nTotal: $${(total ?? 0).toFixed(2)}`;

        this.elements.receiptText.value = formattedText;
        this.items = purchaseItems;
        this.receiptLines = this.items.map((item) => ({
          id: item.id,
          label: item.label,
          amount: item.amount,
          confidence: item.categorizationConfidence * 100,
          ignored: false
        }));

        this.assignments = [];
        this.selectedLineIds.clear();
        this.render();

        this.setOcrStatus(`Found ${this.receiptLines.length} lines via Gemini`, 1);
        window.setTimeout(() => this.hideOcrStatus(), 1600);
      } catch (error) {
        console.error("Gemini receipt parsing failed:", error);
        const message = error instanceof Error ? error.message : "Could not extract text from this receipt.";
        this.setOcrStatus(message, 1);
      } finally {
        this.elements.parseButton.removeAttribute("disabled");
      }
    }

    private async initGeminiSettings(): Promise<void> {
      const env = await this.geminiService.loadDotEnv();
      if (env.GEMINI_API_KEY) {
        localStorage.setItem("gemini_api_key", env.GEMINI_API_KEY);
      }
      if (env.GEMINI_MODEL) {
        localStorage.setItem("gemini_model", env.GEMINI_MODEL);
      }

      this.elements.geminiApiKey.value = localStorage.getItem("gemini_api_key") || "";
      this.elements.geminiModel.value = localStorage.getItem("gemini_model") || "gemini-3.5-flash";
    }

    private openSettings(): void {
      this.elements.geminiApiKey.value = localStorage.getItem("gemini_api_key") || "";
      this.elements.geminiModel.value = localStorage.getItem("gemini_model") || "gemini-3.5-flash";
      this.elements.settingsModal.classList.remove("hidden");
    }

    private closeSettings(): void {
      this.elements.settingsModal.classList.add("hidden");
    }

    private saveSettings(): void {
      const key = this.elements.geminiApiKey.value.trim();
      const model = this.elements.geminiModel.value;
      localStorage.setItem("gemini_api_key", key);
      localStorage.setItem("gemini_model", model);
      this.closeSettings();
    }

    private toTitleCase(value: string): string {
      return value
        .toLowerCase()
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }

    private setOcrStatus(label: string, progress: number): void {
      this.elements.ocrStatus.classList.remove("hidden");
      this.elements.ocrStatusText.textContent = label;
      this.elements.ocrProgressBar.style.width = `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`;
    }

    private hideOcrStatus(): void {
      this.elements.ocrStatus.classList.add("hidden");
      this.elements.ocrProgressBar.style.width = "0%";
    }

    private async openCamera(): Promise<void> {
      if (!navigator.mediaDevices?.getUserMedia) {
        this.setOcrStatus("Camera is not available here. Opening file upload instead.", 1);
        this.elements.receiptImage.click();
        return;
      }

      try {
        this.cameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 2560 }
          },
          audio: false
        });
        this.elements.cameraVideo.srcObject = this.cameraStream;
        this.elements.cameraModal.classList.remove("hidden");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Camera permission was denied.";
        this.setOcrStatus(`Camera unavailable: ${message}. Opening file upload instead.`, 1);
        this.elements.receiptImage.click();
      }
    }

    private closeCamera(): void {
      this.cameraStream?.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
      this.elements.cameraVideo.srcObject = null;
      this.elements.cameraModal.classList.add("hidden");
    }

    private async captureCameraPhoto(): Promise<void> {
      const video = this.elements.cameraVideo;
      const canvas = this.elements.cameraCanvas;
      const context = canvas.getContext("2d");

      if (!context || video.videoWidth === 0 || video.videoHeight === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) return;

      const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: "image/jpeg" });
      this.closeCamera();
      this.processReceiptImage(file);
    }

    private processReceiptImage(file: File): void {
      this.imagePreviewService.show(file, this.elements.receiptPreview, this.elements.receiptPreviewWrap);
      this.setOcrStatus(`Loaded ${file.name || "receipt image"}`, 0.02);
      void this.extractAndItemizeReceipt(file);
    }

    private addPerson(): void {
      const name = this.elements.personNameInput.value.trim();
      if (!name) return;

      const person = { id: this.idService.create(), name };
      this.people = [...this.people, person];
      this.activePersonId = person.id;
      this.elements.personNameInput.value = "";
      this.render();
    }

    private selectPerson(personId: string): void {
      this.activePersonId = personId;
      this.render();
    }

    private deletePerson(personId: string): void {
      this.people = this.people.filter((person) => person.id !== personId);
      this.assignments = this.assignments.filter((assignment) => assignment.personId !== personId);
      if (this.activePersonId === personId) this.activePersonId = this.people[0]?.id ?? null;
      this.render();
    }

    private toggleLineSelection(lineId: string): void {
      if (this.selectedLineIds.has(lineId)) {
        this.selectedLineIds.delete(lineId);
      } else {
        this.selectedLineIds.add(lineId);
      }
      this.render();
    }

    private toggleIgnoredLine(lineId: string): void {
      this.receiptLines = this.receiptLines.map((line) =>
        line.id === lineId ? { ...line, ignored: !line.ignored } : line
      );
      this.assignments = this.assignments.filter((assignment) => assignment.lineId !== lineId);
      this.selectedLineIds.delete(lineId);
      this.render();
    }

    private assignSelectedLines(): void {
      if (!this.activePersonId || this.selectedLineIds.size === 0) return;

      const mode = this.elements.assignmentMode.value as Domain.AssignmentMode;
      const rawValue = Number(this.elements.assignmentValue.value);
      const value = mode === "equal" ? 0 : Number.isFinite(rawValue) ? rawValue : 0;
      const nextAssignments = this.assignments.filter(
        (assignment) => !this.selectedLineIds.has(assignment.lineId) || assignment.personId !== this.activePersonId
      );

      this.selectedLineIds.forEach((lineId) => {
        nextAssignments.push({
          id: this.idService.create(),
          lineId,
          personId: this.activePersonId as string,
          mode,
          value
        });
      });

      this.assignments = nextAssignments;
      this.selectedLineIds.clear();
      this.render();
    }

    private getTaxAmount(): number {
      const value = Number(this.elements.taxInput.value);
      return Number.isFinite(value) ? value : 0;
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
