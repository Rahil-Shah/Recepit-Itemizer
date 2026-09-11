namespace ReceiptRing.App {
  type TabName = "receipts" | "history" | "budgeting";

  // A small receipt glyph for the "this transaction has a receipt" tag. A bare
  // word was easy to miss when scanning the list; the mark reads at a glance.
  const RECEIPT_TAG_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <path d="M6 3.5h12a1 1 0 0 1 1 1v15l-2.4-1.6-2.4 1.6-2.2-1.6-2.2 1.6-2.4-1.6L5 20.5v-16a1 1 0 0 1 1-1Z"
        fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="M8.6 8.2h6.8M8.6 11.6h6.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    </svg>`;

  export class AppController {
    private items: Domain.PurchaseItem[];
    private receiptLines: Domain.ReceiptLine[] = [];
    private people: Domain.SplitPerson[] = [];
    private assignments: Domain.LineAssignment[] = [];
    private lineModes = new Map<string, Domain.AssignmentMode>();
    private foodFlags = new Map<string, boolean>();
    // What each line was worked out to be, keyed by line id. Kept beside the
    // lines rather than inside them: a ReceiptLine is what the receipt says,
    // and this is what we worked out afterwards.
    private identifications = new Map<string, Domain.ItemIdentification>();
    // Guards against a second press while a run is in flight. The free tiers
    // finish instantly, but the model does not, and a double-click would buy
    // the same answers twice.
    private isIdentifying = false;
    // Guards against a second parse starting on top of a running one. Two
    // in-flight parses race to write the same receipt, so the slower reply
    // could overwrite the faster one and leave the workspace showing a result
    // the user did not ask for -- while charging for both.
    private isParsing = false;
    // The photo a parse failed on, so a retry has something to send.
    //
    // Held here rather than read back off the file input, because the input is
    // emptied the moment the file is in hand -- picking the same file twice
    // fires no change event, so by the time a parse fails there is nothing
    // left there to go back to.
    private failedParseFile: File | null = null;
    // How many times the current photo has been retried, and when the button
    // becomes live again. The server has a ceiling of its own, but reaching it
    // costs a full 16mb upload per attempt before being turned away -- backing
    // off here means those attempts are never made.
    private parseRetryCount = 0;
    private retryAvailableAt = 0;
    private retryCountdownTimer: number | null = null;
    private receiptCategory: Domain.ReceiptCategory = "Groceries";
    private cameraStream: MediaStream | null = null;
    private isPromptingForCategories = false;
    private reviewTimer: number | null = null;
    private bankTransactions: Services.BankTransaction[] = [];
    private bankConnections: Services.BankConnection[] = [];
    private monthlySpend: Services.MonthlySpend[] = [];
    private selectedMonth: string | null = null;
    private serverHasGeminiKey = false;
    private userHasGeminiKey = false;
    // Downscaling the photo runs alongside the Gemini parse, so the pending
    // promise is what's held here: a save that lands first waits for it instead
    // of storing the receipt without its image.
    private receiptImage: Promise<string | null> | null = null;
    // The saved receipt the workspace was opened from, while it is being
    // edited. Saving then updates that receipt instead of filing a new one.
    private editingReceipt: Services.SavedReceiptSummary | null = null;
    private rentEntries: Domain.RentEntry[] = [];
    // Months ("YYYY-MM") that have at least one rent entry. Folded into the
    // month dropdown so rent-only months are reachable even when no receipt
    // or bank activity exists for them.
    private rentMonths = new Set<string>();
    private editingRentEntryId: string | null = null;
    // The caller's saved receipts, kept so a transaction row can name the
    // receipt attached to it and so the ring can be recomputed after a link
    // changes without refetching everything.
    private receipts: Services.SavedReceiptSummary[] = [];
    // Bank transaction id -> the rent entry logged from it, so a row that has
    // already been counted as rent says so and offers to undo it.
    private rentEntryByTransaction = new Map<string, string>();
    private linkingTransactionId: string | null = null;
    // The receipt awaiting a transaction, when linking from the History tab.
    private linkingReceiptId: string | null = null;
    private attachingTransactionId: string | null = null;

    constructor(
      private readonly elements: UI.DomRegistry,
      private readonly parserService: Services.ReceiptParserService,
      private readonly categorizationService: Services.CategorizationService,
      private readonly categoryRuleStorageService: Services.CategoryRuleStorageService,
      private readonly storageService: Services.StorageService,
      private readonly currencyFormatService: Services.CurrencyFormatService,
      private readonly imagePreviewService: Services.ImagePreviewService,
      private readonly receiptImageService: Services.ReceiptImageService,
      private readonly geminiService: Services.GeminiService,
      private readonly categoryPromptView: UI.CategoryPromptView,
      private readonly splitWorkspaceView: UI.SplitWorkspaceView,
      private readonly splitCalculatorService: Services.SplitCalculatorService,
      private readonly lineSelectionService: Services.LineSelectionService,
      private readonly idService: Services.IdService,
      private readonly receiptApiService: Services.ReceiptApiService,
      private readonly bankApiService: Services.BankApiService,
      private readonly spendingAggregatorService: Services.SpendingAggregatorService,
      private readonly budgetRingView: UI.BudgetRingView,
      private readonly monthlyTrendView: UI.MonthlyTrendView,
      private readonly peopleApiService: Services.PeopleApiService,
      private readonly rentEntryApiService: Services.RentEntryApiService,
      private readonly rentEntriesView: UI.RentEntriesView,
      private readonly notificationService: Services.NotificationService,
      private readonly itemIdentityService: Services.ItemIdentityService,
      private readonly itemAliasStoreService: Services.ItemAliasStoreService
    ) {
      this.items = this.storageService.load();
    }

    start(): void {
      this.bindEvents();
      this.render();
      void this.initGeminiSettings();
      void this.loadPeople();
      // Corrections made on past receipts, so the first identification of this
      // session can already be free for anything the user has taught it.
      void this.itemAliasStoreService.load();
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
      this.elements.retryParseButton.addEventListener("click", () => void this.retryParse());
      this.elements.parseButton.addEventListener("click", () => this.itemizeReceiptText());
      this.elements.clearButton.addEventListener("click", () => this.clearReceipt());
      this.elements.selectAllLines.addEventListener("change", () => this.toggleSelectAll());
      this.elements.batchClearButton.addEventListener("click", () => this.clearLineSelection());
      this.elements.identifyItemsButton.addEventListener("click", () => void this.identifyItems());

      // Escape is the way out of a selection, as it is out of the dialogs.
      // Listening on the document rather than the table because clicking a
      // batch button leaves focus on the bar, and the table is where the user
      // is looking. Guarded so it cannot steal Escape from a text field or
      // from a modal that is open over the top of it.
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || this.lineSelectionService.count === 0) return;
        if (document.querySelector(".modal-backdrop:not(.hidden)")) return;

        const active = document.activeElement;
        if (active instanceof HTMLInputElement && active.type !== "checkbox") return;
        if (active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return;

        this.clearLineSelection();
      });
      this.elements.openCameraButton.addEventListener("click", () => void this.openCamera());
      this.elements.closeCameraButton.addEventListener("click", () => this.closeCamera());
      this.elements.capturePhotoButton.addEventListener("click", () => void this.captureCameraPhoto());
      this.elements.addPersonButton.addEventListener("click", () => this.addPerson());
      this.elements.personNameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") this.addPerson();
      });
      this.elements.taxInput.addEventListener("input", () => this.renderTotals());
      this.elements.receiptCategory.addEventListener("change", () => {
        this.receiptCategory = this.elements.receiptCategory.value as Domain.ReceiptCategory;
      });
      this.elements.settingsButton.addEventListener("click", () => this.openSettings());
      this.elements.closeSettingsButton.addEventListener("click", () => this.closeSettings());
      this.elements.saveSettingsButton.addEventListener("click", () => void this.saveSettings());
      this.elements.removeKeyButton.addEventListener("click", () => void this.removeGeminiKey());
      this.elements.pasteJsonButton.addEventListener("click", () => this.openPasteJsonModal());
      this.elements.closePasteJsonButton.addEventListener("click", () => this.closePasteJsonModal());
      this.elements.importPasteJsonButton.addEventListener("click", () => this.importPastedJson());
      this.elements.saveReceiptButton.addEventListener("click", () => void this.saveReceipt());
      this.elements.refreshHistoryButton.addEventListener("click", () => void this.loadHistory());
      this.elements.connectBankButton.addEventListener("click", () => void this.connectBank());
      this.elements.refreshTransactionsButton.addEventListener("click", () => void this.refreshTransactions());
      this.elements.budgetMonth.addEventListener("change", () => {
        this.selectMonth(this.elements.budgetMonth.value || null);
      });

      this.elements.addRentEntryButton.addEventListener("click", () => this.openRentEntryForm());
      this.elements.rentEntryCancelButton.addEventListener("click", () => this.closeRentEntryModal());
      this.elements.rentEntrySaveButton.addEventListener("click", () => void this.saveRentEntry());
      this.elements.rentEntriesList.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (target.textContent === "Edit") {
          const entryId = target.dataset.entryId;
          const entry = this.rentEntries.find((e) => e.id === entryId);
          if (entry) this.openRentEntryForm(entry);
        } else if (target.textContent === "Delete") {
          const entryId = target.dataset.entryId;
          const entry = this.rentEntries.find((e) => e.id === entryId);
          if (entry) void this.deleteRentEntry(entry);
        }
      });

      this.elements.transactionReceiptFile.addEventListener("change", () => {
        const file = this.elements.transactionReceiptFile.files?.[0];
        if (file) void this.attachReceiptFile(file);
      });

      // A <details> menu only closes when its own summary is clicked, so a menu
      // left open would sit over the next row the user reaches for.
      document.addEventListener("click", (event) => {
        const target = event.target;
        if (target instanceof Node && this.elements.transactionsList.contains(target)) return;
        this.closeTransactionMenus();
      });

      this.elements.receiptLinkCancelButton.addEventListener("click", () => this.closeReceiptLinkModal());
      this.elements.transactionLinkCancelButton.addEventListener("click", () =>
        this.closeTransactionLinkModal()
      );
      this.elements.receiptLinkList.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        const button = target.closest(".receipt-link-item");
        if (button instanceof HTMLElement && button.dataset.receiptId) {
          void this.selectReceiptForLink(button.dataset.receiptId);
        }
      });

      this.elements.tabButtons.forEach((button) => {
        button.addEventListener("click", () => this.switchTab(button.dataset.tab as TabName));
      });

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
      this.bindEducationSectionToggles();
    }

    // The collapse chevrons in the budgeting view were markup only -- nothing
    // ever listened to them, so aria-expanded stayed "true" for the life of the
    // page and clicking one did nothing.
    private bindEducationSectionToggles(): void {
      document.querySelectorAll<HTMLButtonElement>(".section-toggle").forEach((toggle) => {
        toggle.addEventListener("click", () => {
          const section = toggle.closest<HTMLElement>(".education-section");
          if (!section) return;
          const collapsed = section.classList.toggle("is-collapsed");
          toggle.setAttribute("aria-expanded", String(!collapsed));
        });
      });
    }

    private switchTab(tab: TabName): void {
      this.elements.tabButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.tab === tab);
      });
      this.elements.receiptsView.classList.toggle("hidden", tab !== "receipts");
      this.elements.historyView.classList.toggle("hidden", tab !== "history");
      this.elements.budgetingView.classList.toggle("hidden", tab !== "budgeting");

      if (tab === "history") {
        void this.loadHistory();
      }
      if (tab === "budgeting") {
        void this.loadBudgeting();
      }
    }

    private loadSample(): void {
      this.elements.receiptText.value = Config.SAMPLE_RECEIPT;
      this.setItemsFromParse(this.parserService.parse(Config.SAMPLE_RECEIPT));
      this.render();
      void this.reviewAmbiguousItems();
    }

    private handleImageInput(): void {
      const file = this.elements.receiptImage.files?.[0];
      // Clear the input once the file is in hand. Otherwise picking the *same*
      // file again fires no change event, so retrying after a failed parse did
      // nothing at all and the app looked dead.
      this.elements.receiptImage.value = "";
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
      this.lineModes.clear();
      this.identifications.clear();
      this.lineSelectionService.clear();
      this.receiptImage = null;
      // Removing the photo has to drop the retry with it. Otherwise "Try
      // again" would re-upload an image the user had deliberately taken away,
      // which is the app overruling them about their own receipt.
      this.failedParseFile = null;
      this.resetRetryBackoff();
      this.hideOcrStatus();
      // The lines are gone, so there is nothing left to save back to the
      // receipt that was open.
      this.stopEditing();
    }

    private setItemsFromParse(items: Domain.PurchaseItem[]): void {
      // A freshly parsed receipt is a different receipt. Saving it over the one
      // being edited would replace that receipt with something else entirely.
      this.stopEditing();
      this.items = items;
      this.receiptLines = this.items.map((item) => ({
        id: item.id,
        label: item.label,
        amount: item.amount,
        ...(item.itemCode ? { itemCode: item.itemCode } : {}),
        confidence: item.categorizationConfidence * 100,
        ignored: false
      }));
      this.assignments = [];
      this.lineModes.clear();
      this.foodFlags.clear();
      this.identifications.clear();
      // A new receipt means new line ids; anything still ticked belongs to the
      // receipt that was just replaced.
      this.lineSelectionService.clear();
    }

    private itemizeReceiptText(): void {
      this.setItemsFromParse(this.parserService.parse(this.elements.receiptText.value));
      this.render();
    }

    private clearReceipt(): void {
      this.elements.receiptText.value = "";
      this.elements.storeNameInput.value = "";
      this.items = [];
      // Also drops the photo and its preview: clearing the receipt must not
      // leave the previous image attached to whatever is entered next.
      this.clearImage();
      this.setSaveStatus("");
      this.render();
    }

    private render(): void {
      this.storageService.save(this.items);
      this.renderWorkspace();
      this.renderTotals();
    }

    private renderWorkspace(): void {
      // The selection is only ever as wide as the rows on screen, so a batch
      // action can never reach a line that is no longer part of the receipt.
      this.lineSelectionService.prune(this.receiptLines);

      this.elements.emptyState.classList.toggle("hidden", this.receiptLines.length > 0);
      this.elements.itemCount.textContent = `${this.receiptLines.length} ${this.receiptLines.length === 1 ? "line" : "lines"}`;

      const handlers: UI.SplitWorkspaceHandlers = {
        onLineSelectToggle: (lineId, extend) => this.toggleLineSelection(lineId, extend),
        onLineIgnore: (lineId) => this.toggleIgnoredLine(lineId),
        onPersonDelete: (personId) => this.deletePerson(personId),
        onAssignToggle: (lineId, personId) => this.toggleAssignment(lineId, personId),
        onLineModeChange: (lineId, mode) => this.setLineMode(lineId, mode),
        onAssignValueChange: (lineId, personId, value) => this.setAssignmentValue(lineId, personId, value),
        onLineFood: (lineId, isFood) => this.toggleLineFood(lineId, isFood),
        onBatchAssign: (personId) => this.toggleSelectedLinesFor(personId),
        onBatchFood: (isFood) => this.setSelectedLinesFood(isFood),
        onBatchIgnore: (ignored) => this.setSelectedLinesIgnored(ignored),
        onIdentificationConfirm: (lineId, name) => this.confirmIdentification(lineId, name),
        onIdentificationClear: (lineId) => this.clearIdentification(lineId),
        onBatchIdentify: () => void this.identifyItems(this.getSelectedLines())
      };

      this.splitWorkspaceView.renderLines(
        this.elements.receiptLinesList,
        this.receiptLines,
        this.assignments,
        this.people,
        this.lineModes,
        new Set(this.lineSelectionService.ids()),
        this.identifications,
        handlers
      );
      this.splitWorkspaceView.renderPeople(this.elements.peopleList, this.people, handlers);
      this.renderSelectAll();
      this.renderBatchBar(handlers);
    }

    /**
     * The bar exists only while there is a selection to act on: an empty
     * toolbar sitting over the table would be a permanent row of controls that
     * do nothing.
     */
    private renderBatchBar(handlers: UI.SplitWorkspaceHandlers): void {
      const count = this.lineSelectionService.count;
      this.elements.batchBar.classList.toggle("hidden", count === 0);
      if (count === 0) return;

      this.elements.batchCount.textContent = `${count} ${count === 1 ? "line" : "lines"} selected`;
      this.splitWorkspaceView.renderBatchActions(
        this.elements.batchActions,
        this.people,
        this.getBatchAssignStates(),
        this.getBatchLineState(),
        handlers
      );
    }

    /**
     * How much of the selection each person already holds, so their button can
     * say whether clicking it will assign or unassign.
     */
    private getBatchAssignStates(): Map<string, UI.BatchAssignState> {
      const targets = this.getSelectedLines();
      const states = new Map<string, UI.BatchAssignState>();

      this.people.forEach((person) => {
        const held = targets.filter((line) =>
          this.assignments.some(
            (assignment) => assignment.lineId === line.id && assignment.personId === person.id
          )
        ).length;

        states.set(
          person.id,
          held === 0 ? "none" : targets.length > 0 && held === targets.length ? "all" : "some"
        );
      });

      return states;
    }

    /**
     * One button, both directions. A name already on every selected line comes
     * off; anything less than that fills in the gaps. Assigning from a partial
     * state rather than unassigning is the same call the header checkbox makes:
     * a half-done job usually wants finishing.
     */
    private toggleSelectedLinesFor(personId: string): void {
      if (this.getBatchAssignStates().get(personId) === "all") {
        this.unassignSelectedLinesFrom(personId);
      } else {
        this.assignSelectedLinesTo(personId);
      }
    }

    private unassignSelectedLinesFrom(personId: string): void {
      const targetIds = new Set(this.getSelectedLines().map((line) => line.id));
      this.assignments = this.assignments.filter(
        (assignment) => !(assignment.personId === personId && targetIds.has(assignment.lineId))
      );
      this.render();
    }

    /**
     * Puts one person on every selected line in a single pass.
     *
     * Ignored lines are left out: ignoring a line drops its assignments by
     * design, so writing new ones onto it would either be undone at once or
     * quietly resurrect a line the user has struck off.
     */
    private assignSelectedLinesTo(personId: string): void {
      const targets = this.getSelectedLines();
      const additions: Domain.LineAssignment[] = [];

      targets.forEach((line) => {
        const already = this.assignments.some(
          (assignment) => assignment.lineId === line.id && assignment.personId === personId
        );
        if (already) return;

        additions.push({
          id: this.idService.create(),
          lineId: line.id,
          personId,
          mode: this.lineModes.get(line.id) ?? "equal",
          value: 0
        });
      });

      if (additions.length === 0) return;
      this.assignments = [...this.assignments, ...additions];
      this.render();
    }

    /**
     * What the flag buttons offer. "All food" reads over the lines that are
     * actually in the split, so a struck-off line cannot hold the label at
     * "Food" when everything visible already is.
     */
    private getBatchLineState(): UI.BatchLineState {
      const active = this.getSelectedLines();
      const all = this.getSelectedLines(true);

      return {
        hasActive: active.length > 0,
        allFood: active.length > 0 && active.every((line) => line.isFood === true),
        allIgnored: all.length > 0 && all.every((line) => line.ignored)
      };
    }

    /** Food is a claim about a line in the split, so it skips ignored lines. */
    private setSelectedLinesFood(isFood: boolean): void {
      const targetIds = new Set(this.getSelectedLines().map((line) => line.id));
      if (targetIds.size === 0) return;

      targetIds.forEach((lineId) => this.foodFlags.set(lineId, isFood));
      this.receiptLines = this.receiptLines.map((line) =>
        targetIds.has(line.id) ? { ...line, isFood } : line
      );
      this.render();
    }

    /**
     * Ignoring is the one batch action that has to see struck-off lines too --
     * otherwise nothing could restore them together.
     */
    private setSelectedLinesIgnored(ignored: boolean): void {
      const targetIds = new Set(this.getSelectedLines(true).map((line) => line.id));
      if (targetIds.size === 0) return;

      this.receiptLines = this.receiptLines.map((line) =>
        targetIds.has(line.id) ? { ...line, ignored } : line
      );
      // Same rule as ignoring a single line: a line off the receipt is on
      // nobody's tab.
      if (ignored) {
        this.assignments = this.assignments.filter((assignment) => !targetIds.has(assignment.lineId));
      }
      this.render();
    }

    /**
     * An identification as the server stores it, or null.
     *
     * Unresolved lines are deliberately not saved. "Nobody could read this" is
     * a fact about a lookup that already ran, not about the receipt, and
     * storing it would make the row look permanently answered while telling a
     * later reader nothing they cannot see for themselves.
     */
    private toStoredIdentification(
      identification: Domain.ItemIdentification | undefined
    ): Services.StoredIdentification | null {
      if (!identification || identification.source === "unresolved") return null;

      return {
        resolvedName: identification.resolvedName,
        brand: identification.brand ?? null,
        size: identification.size ?? null,
        confidence: identification.confidence,
        source: identification.source,
        reasoning: identification.reasoning ?? null,
        alternatives: identification.alternatives,
        confirmed: identification.confirmed
      };
    }

    /**
     * Works out what every line on the receipt actually is.
     *
     * Guarded against a second press while one is already running: the free
     * tiers finish instantly but the model does not, and a double-click would
     * buy the same answers twice.
     */
    private async identifyItems(lines?: readonly Domain.ReceiptLine[]): Promise<void> {
      if (this.isIdentifying) return;

      // A selection narrows what is looked at, and nothing else. Forcing here
      // was tempting -- the user did point at these lines -- but it would
      // re-derive names they had already confirmed and overwrite a known
      // answer with a guess. Confirmed lines stay skipped; everything else in
      // the selection is re-asked, which is the default anyway.
      const target = lines ?? this.receiptLines;
      if (target.length === 0) {
        this.notificationService.info("Itemize a receipt first, then identify its items.");
        return;
      }

      this.isIdentifying = true;
      this.elements.identifyItemsButton.setAttribute("disabled", "true");

      try {
        const resolved = await this.itemIdentityService.identify(
          target,
          this.identifications,
          {
            storeName: this.elements.storeNameInput.value.trim(),
            onProgress: (progress) => this.setIdentifyStatus(progress)
          }
        );

        resolved.forEach((identification, lineId) => {
          this.identifications.set(lineId, identification);
        });
        this.render();

        const unresolved = [...resolved.values()].filter(
          (identification) => identification.source === "unresolved"
        ).length;
        if (unresolved > 0) {
          this.notificationService.info(
            `${unresolved} ${unresolved === 1 ? "item" : "items"} couldn't be identified. Click one to name it yourself.`
          );
        }
        window.setTimeout(() => this.hideIdentifyStatus(), 2400);
      } catch (error) {
        console.error("Item identification failed:", error);
        const message =
          error instanceof Error ? error.message : "Could not identify these items.";
        this.setIdentifyMessage(message, 1);
        this.notificationService.error(message);
      } finally {
        this.isIdentifying = false;
        this.elements.identifyItemsButton.removeAttribute("disabled");
      }
    }

    /**
     * Takes the user's word for what a line is.
     *
     * The name is remembered as an alias, so the same item on the next receipt
     * from this store resolves for free and at full confidence. That is the
     * whole economic argument for the feature: corrections compound, and a
     * correction that only fixed the row in front of you would not.
     */
    private confirmIdentification(lineId: string, name: string): void {
      const line = this.receiptLines.find((candidate) => candidate.id === lineId);
      if (!line) return;

      const previous = this.identifications.get(lineId);
      const confirmed: Domain.ItemIdentification = {
        lineId,
        rawLabel: line.label,
        ...(line.itemCode ? { itemCode: line.itemCode } : {}),
        resolvedName: name,
        // Brand and size came from a guess that has just been overruled, so
        // they are only kept when the name itself was left alone -- correcting
        // "Sliced Mozzarella" to "Brie" must not leave Great Value attached.
        ...(previous && previous.resolvedName === name
          ? {
              ...(previous.brand ? { brand: previous.brand } : {}),
              ...(previous.size ? { size: previous.size } : {})
            }
          : {}),
        confidence: 1,
        source: "user-confirmed",
        alternatives: [],
        confirmed: true
      };

      this.identifications.set(lineId, confirmed);
      this.itemAliasStoreService.remember(confirmed, this.elements.storeNameInput.value.trim());
      this.closeItemDetail(lineId);
      this.render();
    }

    /**
     * Forgets a confirmed name, here and for future receipts.
     *
     * The row falls back to the receipt's own text rather than to the guess
     * that preceded it: the user has just said that answer was wrong, and
     * quietly restoring it would be the app arguing back.
     */
    private clearIdentification(lineId: string): void {
      const identification = this.identifications.get(lineId);
      if (!identification) return;

      const alias = this.itemAliasStoreService.find(
        { id: lineId, label: identification.rawLabel, amount: 0, confidence: 0, ignored: false,
          ...(identification.itemCode ? { itemCode: identification.itemCode } : {}) },
        this.elements.storeNameInput.value.trim()
      );
      if (alias) this.itemAliasStoreService.forget(alias);

      this.identifications.delete(lineId);
      this.closeItemDetail(lineId);
      this.render();
    }

    /**
     * Shuts the popup for a line before the re-render that follows.
     *
     * renderLines restores whichever popups were open, which is right while
     * someone is working inside one and wrong the moment they have finished:
     * confirming a name and watching the panel stay put reads as the click not
     * having landed.
     */
    private closeItemDetail(lineId: string): void {
      const selector = `details.item-detail-dropdown[data-line-id="${CSS.escape(lineId)}"]`;
      const details = this.elements.receiptLinesList.querySelector<HTMLDetailsElement>(selector);
      if (details) details.open = false;
    }

    private setIdentifyStatus(progress: Services.IdentifyProgress): void {
      // The free tiers land before the first paint, so the bar would jump from
      // nothing to nearly full and sit there. Give the stages a floor so the
      // movement the user sees tracks the wait they are actually having.
      const stageFloor: Record<Services.IdentifyProgress["stage"], number> = {
        aliases: 0.08,
        dictionary: 0.2,
        ai: 0.45,
        complete: 1
      };
      this.setIdentifyMessage(progress.message, stageFloor[progress.stage]);
    }

    private setIdentifyMessage(message: string, ratio: number): void {
      this.elements.identifyStatus.classList.remove("hidden");
      this.elements.identifyStatusText.textContent = message;
      this.elements.identifyProgressBar.style.width = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
    }

    private hideIdentifyStatus(): void {
      this.elements.identifyStatus.classList.add("hidden");
      this.elements.identifyProgressBar.style.width = "0%";
    }

    private getSelectedLines(includeIgnored = false): Domain.ReceiptLine[] {
      return this.receiptLines.filter(
        (line) => this.lineSelectionService.has(line.id) && (includeIgnored || !line.ignored)
      );
    }

    private clearLineSelection(): void {
      this.lineSelectionService.clear();
      this.renderWorkspace();
    }

    /**
     * The header tick reports on the rows below it: on when every line is
     * selected, indeterminate when only some are. Without the middle state it
     * claimed "nothing is selected" while a dozen rows sat ticked underneath.
     */
    private renderSelectAll(): void {
      const isAll = this.lineSelectionService.isAllSelected(this.receiptLines);
      this.elements.selectAllLines.checked = isAll;
      this.elements.selectAllLines.indeterminate =
        !isAll && this.lineSelectionService.isAnySelected(this.receiptLines);
      this.elements.selectAllLines.disabled = this.receiptLines.length === 0;
    }

    private renderTotals(): void {
      const unassignedCount = this.splitCalculatorService.getUnassignedCount(this.receiptLines, this.assignments);
      this.elements.unassignedCount.textContent = `${unassignedCount} unassigned`;
      this.elements.unassignedCount.classList.toggle("is-warning", unassignedCount > 0);

      this.splitWorkspaceView.renderTotals(
        this.elements.splitTotalsList,
        this.splitCalculatorService.calculate(this.people, this.receiptLines, this.assignments, this.getTaxAmount())
      );

      const itemSum = this.getSubtotal();
      const grandTotal = itemSum + this.getTaxAmount();
      this.elements.receiptTotal.textContent = this.currencyFormatService.format(grandTotal);
    }

    private async extractAndItemizeReceipt(file: File): Promise<void> {
      const model = localStorage.getItem("gemini_model") || "gemini-3.5-flash-lite";

      // Parsing always runs through the server proxy, which uses the user's own
      // saved key or the shared server key. Only block when neither exists.
      if (!this.userHasGeminiKey && !this.serverHasGeminiKey) {
        this.setOcrStatus("Please add your Gemini API key in Settings first.", 1);
        this.openSettings();
        return;
      }

      if (this.isParsing) return;
      this.isParsing = true;
      this.setOcrStatus("Analyzing receipt with Gemini...", 0.15);
      this.elements.parseButton.setAttribute("disabled", "true");

      try {
        const result = await this.geminiService.parseReceiptImage(file, model);

        // Log the JSON output in the terminal/console when putting a photo
        console.log("Gemini parsed receipt output:", result);

        this.applyParsedReceiptJson(result);

        this.failedParseFile = null;
        this.resetRetryBackoff();
        this.setOcrStatus(`Found ${this.receiptLines.length} lines via Gemini`, 1);
        window.setTimeout(() => this.hideOcrStatus(), 1600);
      } catch (error) {
        console.error("Gemini receipt parsing failed:", error);
        const message = error instanceof Error ? error.message : "Could not extract text from this receipt.";
        // Only hold the photo when another attempt could plausibly work. A
        // rejected image type or a missing key will fail identically forever,
        // and a button that cannot succeed is worse than no button: it costs a
        // click and a paid call to teach the user it does nothing.
        // Stop offering once the same photo has failed this many times. It is
        // not a blip any more, and a button that keeps failing is worse than
        // one that admits the receipt needs a different photo.
        const exhausted = this.parseRetryCount >= Services.MAX_PARSE_RETRIES;
        this.failedParseFile = this.canRetryParse(error) && !exhausted ? file : null;

        if (this.failedParseFile) {
          this.beginRetryBackoff();
        }
        this.setOcrStatus(
          exhausted ? `${message} Try a clearer photo, or come back in a few minutes.` : this.withRetryHint(message, this.failedParseFile !== null),
          1
        );
      } finally {
        this.isParsing = false;
        this.elements.parseButton.removeAttribute("disabled");
        this.renderRetryButton();
      }
    }

    /**
     * Apply a parsed receipt JSON object (in the shape Gemini returns) to the
     * workspace. Shared by the image-upload flow and the manual paste-JSON
     * flow, so both end up building identical receipt lines from identical
     * input.
     */
    private applyParsedReceiptJson(result: any): void {
      const storeName = result.storeName || "";
      const subtotal = typeof result.subtotal === "number" ? result.subtotal : null;
      const tax = typeof result.tax === "number" ? result.tax : null;
      const total = typeof result.total === "number" ? result.total : null;

      this.elements.storeNameInput.value = storeName;
      this.elements.taxInput.value = String(tax ?? 0);

      let formattedText = `Store: ${storeName}\n\nItems:\n`;
      const purchaseItems: Domain.PurchaseItem[] = [];

      if (Array.isArray(result.items)) {
        result.items.forEach((item: any) => {
          const label = this.toTitleCase(item.name || "Unknown Item");
          const itemCode = typeof item.itemCode === "string" ? item.itemCode.trim() : "";
          const price = typeof item.price === "number" ? item.price : Number(item.price) || 0;
          const discount = typeof item.discount === "number" ? item.discount : Number(item.discount) || 0;
          const finalAmount = Math.max(0, price - discount);
          const lowConfidence = !!item.lowConfidence;

          let itemLabel = label;
          if (discount > 0.01) {
            itemLabel += ` (was $${price.toFixed(2)}, ${discount > 0 ? "-" : ""}$${Math.abs(discount).toFixed(2)} discount)`;
            formattedText += `- ${itemLabel}: $${finalAmount.toFixed(2)}${lowConfidence ? " (low confidence)" : ""}\n`;
          } else {
            formattedText += `- ${label}: $${finalAmount.toFixed(2)}${lowConfidence ? " (low confidence)" : ""}\n`;
          }

          const categorization = this.categorizationService.categorize(label);

          purchaseItems.push({
            id: this.idService.create(),
            label: itemLabel,
            amount: Number(finalAmount.toFixed(2)),
            ...(itemCode ? { itemCode } : {}),
            category: categorization.category,
            categorizationConfidence: lowConfidence ? 0.3 : categorization.confidence,
            categorizationSource: categorization.source,
            needsCategoryReview: lowConfidence || categorization.shouldPrompt
          });
        });
      }

      formattedText += `\nSubtotal: $${(subtotal ?? 0).toFixed(2)}\nTax: $${(tax ?? 0).toFixed(2)}\nTotal: $${(total ?? 0).toFixed(2)}`;

      this.elements.receiptText.value = formattedText;
      this.setItemsFromParse(purchaseItems);
      this.setSaveStatus("");
      this.render();
    }

    private openPasteJsonModal(): void {
      this.elements.pasteJsonText.value = "";
      this.setPasteJsonStatus("");
      this.elements.pasteJsonModal.classList.remove("hidden");
    }

    private closePasteJsonModal(): void {
      this.elements.pasteJsonModal.classList.add("hidden");
    }

    private setPasteJsonStatus(message: string, isError = false): void {
      this.elements.pasteJsonStatus.textContent = message;
      this.elements.pasteJsonStatus.classList.toggle("is-error", isError);
      this.elements.pasteJsonStatus.classList.toggle("is-active", Boolean(message) && !isError);
    }

    // Gemini's web/app UI sometimes wraps its JSON in a ```json fence even
    // when told not to, so strip one off before parsing, same as the API path.
    private importPastedJson(): void {
      const raw = this.elements.pasteJsonText.value.trim();
      if (!raw) {
        this.setPasteJsonStatus("Paste the JSON Gemini gave you first.", true);
        return;
      }

      let parsed: any;
      try {
        const cleaned = raw.replace(/^```json\n?/, "").replace(/^```\n?/, "").replace(/\n?```$/, "").trim();
        parsed = JSON.parse(cleaned);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid JSON.";
        this.setPasteJsonStatus(`Could not parse that as JSON: ${message}`, true);
        return;
      }

      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.items)) {
        this.setPasteJsonStatus('That JSON needs an "items" array to import.', true);
        return;
      }

      this.applyParsedReceiptJson(parsed);
      this.closePasteJsonModal();
      this.setOcrStatus(`Found ${this.receiptLines.length} lines from pasted JSON`, 1);
      window.setTimeout(() => this.hideOcrStatus(), 1600);
    }

    private async initGeminiSettings(): Promise<void> {
      const config = await this.geminiService.loadConfig();
      this.serverHasGeminiKey = config.hasServerKey;
      this.userHasGeminiKey = config.hasUserKey;
      if (config.model) {
        localStorage.setItem("gemini_model", config.model);
      }

      this.elements.geminiModel.value = localStorage.getItem("gemini_model") || "gemini-3.5-flash-lite";
    }

    private openSettings(): void {
      // The key is write-only from the browser's side: never prefill the field.
      this.elements.geminiApiKey.value = "";
      this.elements.geminiModel.value = localStorage.getItem("gemini_model") || "gemini-3.5-flash-lite";
      this.renderGeminiKeyStatus();
      this.elements.settingsModal.classList.remove("hidden");
    }

    private closeSettings(): void {
      this.elements.settingsModal.classList.add("hidden");
    }

    private renderGeminiKeyStatus(message?: string, isError = false): void {
      const status = this.elements.geminiKeyStatus;
      if (message) {
        status.textContent = message;
        status.classList.toggle("is-active", !isError);
        this.elements.removeKeyButton.classList.toggle("hidden", !this.userHasGeminiKey);
        return;
      }
      if (this.userHasGeminiKey) {
        status.textContent = "Using your saved personal key.";
        status.classList.add("is-active");
      } else if (this.serverHasGeminiKey) {
        status.textContent = "Using the shared server key. Add a key to use your own.";
        status.classList.remove("is-active");
      } else {
        status.textContent = "No key configured yet. Add one to parse receipts.";
        status.classList.remove("is-active");
      }
      this.elements.removeKeyButton.classList.toggle("hidden", !this.userHasGeminiKey);
    }

    private async saveSettings(): Promise<void> {
      const key = this.elements.geminiApiKey.value.trim();
      localStorage.setItem("gemini_model", this.elements.geminiModel.value);

      // Only touch the stored key when the user actually typed one; a blank
      // field means "keep whatever is already there" (the personal or shared key).
      if (!key) {
        this.closeSettings();
        return;
      }

      this.elements.saveSettingsButton.setAttribute("disabled", "true");
      try {
        await this.geminiService.saveApiKey(key);
        this.userHasGeminiKey = true;
        this.elements.geminiApiKey.value = "";
        this.closeSettings();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not save the key.";
        this.renderGeminiKeyStatus(message, true);
      } finally {
        this.elements.saveSettingsButton.removeAttribute("disabled");
      }
    }

    private async removeGeminiKey(): Promise<void> {
      this.elements.removeKeyButton.setAttribute("disabled", "true");
      try {
        await this.geminiService.clearApiKey();
        this.userHasGeminiKey = false;
        this.elements.geminiApiKey.value = "";
        this.renderGeminiKeyStatus();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not clear the key.";
        this.renderGeminiKeyStatus(message, true);
      } finally {
        this.elements.removeKeyButton.removeAttribute("disabled");
      }
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
      // textContent, never innerHTML. This string can carry an error message
      // that originated at Gemini and was passed through the server, so it is
      // upstream text on a page -- it gets rendered, never parsed.
      this.elements.ocrStatusText.textContent = label;
      this.elements.ocrProgressBar.style.width = `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`;
      this.renderRetryButton();
    }

    private hideOcrStatus(): void {
      this.elements.ocrStatus.classList.add("hidden");
      this.elements.ocrProgressBar.style.width = "0%";
      this.renderRetryButton();
    }

    /**
     * The retry offer, shown only while there is a photo to retry and no parse
     * already running.
     *
     * Driven off state rather than toggled at each call site: every path that
     * ends a parse would otherwise have to remember to hide it, and the one
     * that forgot would leave a button that silently re-sends a stale photo.
     */
    private renderRetryButton(): void {
      const offered = this.failedParseFile !== null && !this.isParsing;
      this.elements.retryParseButton.classList.toggle("hidden", !offered);
      if (!offered) {
        this.elements.retryParseButton.disabled = true;
        return;
      }

      const waitMs = this.retryAvailableAt - Date.now();
      const waiting = waitMs > 0;
      this.elements.retryParseButton.disabled = waiting;
      // Counting down beats a button that is simply dead: the user can see the
      // app is pacing itself rather than ignoring them.
      const label = waiting ? `Try again in ${Math.ceil(waitMs / 1000)}s` : "Try again";
      // Only touch the DOM when the second actually changes. The countdown
      // ticks four times a second and would otherwise rewrite the label on
      // every tick, which assistive tech can pick up as a change worth
      // reporting even from outside a live region.
      if (this.elements.retryParseButton.textContent !== label) {
        this.elements.retryParseButton.textContent = label;
      }
    }

    /**
     * Whether this failure is one another attempt could get past.
     *
     * A failure that never produced a status -- the parser threw while reading
     * the reply, or the request never left the browser -- is treated as
     * retryable. Those are the ones most likely to be a blip, and the cost of
     * being wrong is one wasted click rather than a receipt the user cannot
     * load at all.
     */
    private canRetryParse(error: unknown): boolean {
      if (error instanceof Services.ReceiptParseError) {
        return Services.isRetryableParseFailure(error.status);
      }
      return true;
    }

    // The button says what to do; the message should say it is worth doing.
    private withRetryHint(message: string, canRetry: boolean): string {
      return canRetry ? `${message} This often clears up on a second try.` : message;
    }

    /** Sends the photo the last parse failed on back through the parser. */
    private async retryParse(): Promise<void> {
      const file = this.failedParseFile;
      if (!file || this.isParsing || Date.now() < this.retryAvailableAt) return;

      this.parseRetryCount += 1;
      await this.extractAndItemizeReceipt(file);
    }

    /**
     * Puts the retry back to its opening state.
     *
     * Called whenever the photo changes or a parse succeeds, because the
     * backoff describes one photo's run of failures. Carrying a count across
     * photos would greet a fresh receipt with a thirty-second wait it did
     * nothing to earn.
     */
    private resetRetryBackoff(): void {
      this.parseRetryCount = 0;
      this.retryAvailableAt = 0;
      if (this.retryCountdownTimer !== null) {
        window.clearInterval(this.retryCountdownTimer);
        this.retryCountdownTimer = null;
      }
    }

    /**
     * Starts the wait before the next attempt, and ticks the button's label
     * down so the delay is visible rather than the button just being dead.
     */
    private beginRetryBackoff(): void {
      this.retryAvailableAt = Date.now() + Services.retryBackoffMs(this.parseRetryCount + 1);
      if (this.retryCountdownTimer !== null) window.clearInterval(this.retryCountdownTimer);
      this.retryCountdownTimer = window.setInterval(() => {
        this.renderRetryButton();
        if (Date.now() >= this.retryAvailableAt && this.retryCountdownTimer !== null) {
          window.clearInterval(this.retryCountdownTimer);
          this.retryCountdownTimer = null;
        }
      }, 250);
      this.renderRetryButton();
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
      // A new photo is a new receipt. Stopped now rather than when its parse
      // lands, so a save pressed in between can't put this photo on the
      // receipt that was being edited.
      this.stopEditing();
      // Whatever failed before is not what the user is looking at now.
      this.failedParseFile = null;
      this.resetRetryBackoff();
      this.imagePreviewService.show(file, this.elements.receiptPreview, this.elements.receiptPreviewWrap);
      this.setOcrStatus(`Loaded ${file.name || "receipt image"}`, 0.02);
      // Start shrinking the photo now so it is ready by the time the parse
      // finishes and the receipt can be saved with it.
      this.receiptImage = this.receiptImageService.toStorableDataUrl(file);
      void this.extractAndItemizeReceipt(file);
    }

    private async loadPeople(): Promise<void> {
      try {
        const people = await this.peopleApiService.list();
        this.people = people;
        this.render();
      } catch (error) {
        console.error("Failed to load people:", error);
      }
    }

    private addPerson(): void {
      const name = this.elements.personNameInput.value.trim();
      if (!name) return;

      // Prevent adding duplicate people
      if (this.people.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        this.notificationService.error("This person is already in the list.");
        return;
      }

      this.elements.addPersonButton.setAttribute("disabled", "true");
      void (async () => {
        try {
          const person = await this.peopleApiService.add(name);
          this.people = [...this.people, person];
          this.elements.personNameInput.value = "";
          this.render();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not add person.";
          this.notificationService.error(message);
        } finally {
          this.elements.addPersonButton.removeAttribute("disabled");
        }
      })();
    }

    private deletePerson(personId: string): void {
      void (async () => {
        try {
          await this.peopleApiService.delete(personId);
          this.people = this.people.filter((person) => person.id !== personId);
          this.assignments = this.assignments.filter((assignment) => assignment.personId !== personId);
          this.render();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not delete person.";
          this.notificationService.error(message);
        }
      })();
    }

    private toggleSelectAll(): void {
      // Half a selection reads as "some", and the useful next step from there
      // is taking the rest, not throwing away what is already ticked. Only a
      // full selection clears.
      if (this.lineSelectionService.isAllSelected(this.receiptLines)) {
        this.lineSelectionService.clear();
      } else {
        this.lineSelectionService.selectAll(this.receiptLines);
      }
      this.renderWorkspace();
    }

    private toggleLineSelection(lineId: string, extendFromAnchor: boolean): void {
      if (extendFromAnchor) {
        this.lineSelectionService.selectRange(this.receiptLines, lineId);
      } else {
        this.lineSelectionService.toggle(lineId);
      }
      this.renderWorkspace();
    }

    private toggleIgnoredLine(lineId: string): void {
      this.receiptLines = this.receiptLines.map((line) =>
        line.id === lineId ? { ...line, ignored: !line.ignored } : line
      );
      this.assignments = this.assignments.filter((assignment) => assignment.lineId !== lineId);
      this.render();
    }

    private toggleAssignment(lineId: string, personId: string): void {
      const existing = this.assignments.find(
        (assignment) => assignment.lineId === lineId && assignment.personId === personId
      );

      if (existing) {
        this.assignments = this.assignments.filter((assignment) => assignment !== existing);
      } else {
        this.assignments = [
          ...this.assignments,
          {
            id: this.idService.create(),
            lineId,
            personId,
            mode: this.lineModes.get(lineId) ?? "equal",
            value: 0
          }
        ];
      }
      this.render();
    }

    private setLineMode(lineId: string, mode: Domain.AssignmentMode): void {
      this.lineModes.set(lineId, mode);
      this.assignments = this.assignments.map((assignment) =>
        assignment.lineId === lineId
          ? { ...assignment, mode, value: mode === "equal" ? 0 : assignment.value }
          : assignment
      );
      this.render();
    }

    private setAssignmentValue(lineId: string, personId: string, value: number): void {
      this.assignments = this.assignments.map((assignment) =>
        assignment.lineId === lineId && assignment.personId === personId
          ? { ...assignment, value: Number.isFinite(value) ? value : 0 }
          : assignment
      );
      // Recompute totals only so the focused value input keeps focus while typing.
      this.renderTotals();
    }

    private toggleLineFood(lineId: string, isFood: boolean): void {
      this.foodFlags.set(lineId, isFood);
      this.receiptLines = this.receiptLines.map((line) =>
        line.id === lineId ? { ...line, isFood } : line
      );
      this.render();
    }

    private async updateLineFood(receiptId: string, lineId: string, isFood: boolean): Promise<void> {
      try {
        await this.receiptApiService.updateLineFood(receiptId, lineId, isFood);
        await this.loadHistory();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not update line.";
        this.notificationService.error(`Failed to update food flag. ${message}`);
      }
    }

    private getSubtotal(): number {
      return this.receiptLines.filter((line) => !line.ignored).reduce((sum, line) => sum + line.amount, 0);
    }

    private getTaxAmount(): number {
      const value = Number(this.elements.taxInput.value);
      return Number.isFinite(value) ? value : 0;
    }

    private setSaveStatus(message: string, isError = false): void {
      this.elements.saveStatus.textContent = message;
      this.elements.saveStatus.classList.toggle("is-error", isError);
    }

    private async saveReceipt(): Promise<void> {
      if (this.receiptLines.length === 0) {
        this.setSaveStatus("Add receipt lines before saving.", true);
        return;
      }

      this.elements.saveReceiptButton.setAttribute("disabled", "true");
      this.setSaveStatus("Saving...");

      // Wait for the downscale started when the photo was picked; a failed one
      // resolves to null and the receipt is saved without an image.
      const imageDataUrl = this.receiptImage ? await this.receiptImage : null;

      const editing = this.editingReceipt;
      const payload = this.buildReceiptPayload(imageDataUrl);

      try {
        if (editing) {
          const saved = await this.receiptApiService.update(editing.id, payload);
          this.setSaveStatus("Changes saved.");
          // Picks up the new store name for the banner.
          if (this.editingReceipt?.id === saved.id) {
            this.editingReceipt = saved;
            this.renderEditingState();
          }
        } else {
          await this.receiptApiService.save(payload);
          this.setSaveStatus(imageDataUrl ? "Saved to history with the receipt photo." : "Saved to history.");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not save receipt.";
        this.setSaveStatus(message, true);
      } finally {
        this.elements.saveReceiptButton.removeAttribute("disabled");
      }
    }

    /** Everything a save writes, read off the workspace as it stands. */
    private buildReceiptPayload(imageDataUrl: string | null): Services.SaveReceiptPayload {
      const subtotal = this.getSubtotal();
      const tax = this.getTaxAmount();
      return {
        storeName: this.elements.storeNameInput.value.trim() || null,
        category: this.receiptCategory,
        subtotal,
        tax,
        total: subtotal + tax,
        // Only the people who actually ended up with a share. Attaching the
        // whole address book to every receipt made "People:" meaningless in
        // history, and now that the owner's own entry is in that list it would
        // also mark every receipt as split-with-me and drop the budget for it
        // to a share of zero.
        people: this.people
          .filter((person) =>
            this.assignments.some((assignment) => assignment.personId === person.id)
          )
          .map((person) => ({ clientId: person.id })),
        lines: this.receiptLines.map((line) => ({
          clientId: line.id,
          label: line.label,
          amount: line.amount,
          ignored: line.ignored,
          isFood: this.foodFlags.get(line.id) ?? false,
          ...(line.itemCode ? { itemCode: line.itemCode } : {}),
          identification: this.toStoredIdentification(this.identifications.get(line.id))
        })),
        assignments: this.assignments.map((assignment) => ({
          lineClientId: assignment.lineId,
          personClientId: assignment.personId,
          mode: assignment.mode,
          value: assignment.value
        })),
        imageDataUrl
      };
    }

    private stopEditing(): void {
      this.editingReceipt = null;
      this.renderEditingState();
    }

    private renderEditingState(): void {
      const receipt = this.editingReceipt;
      this.elements.editBanner.classList.toggle("hidden", receipt === null);
      this.elements.saveReceiptButton.textContent = receipt ? "Save changes" : "Save to history";
      if (!receipt) return;

      this.elements.editBannerTitle.textContent = receipt.storeName || "Untitled receipt";
      this.elements.editBannerMeta.textContent = `Saved ${new Date(receipt.createdAt).toLocaleDateString()}`;
    }

    private async loadHistory(): Promise<void> {
      try {
        const receipts = await this.receiptApiService.list();
        // Kept so the budgeting view's "Receipt · <store>" tags can name a
        // receipt without refetching.
        this.receipts = receipts;
        this.elements.historyEmpty.classList.toggle("hidden", receipts.length > 0);
        this.splitWorkspaceView.renderHistory(
          this.elements.historyList,
          receipts,
          (receipt) => void this.deleteReceipt(receipt),
          (receiptId, lineId, isFood) => void this.updateLineFood(receiptId, lineId, isFood),
          (receipt) => this.openTransactionLinkModal(receipt.id),
          (receipt) => void this.unlinkReceiptFromHistory(receipt)
        );
      } catch (error) {
        this.elements.historyEmpty.classList.remove("hidden");
        // Error messages can echo server/network response text; render as
        // text nodes, never HTML.
        const title = document.createElement("strong");
        title.textContent = "Couldn't load history";
        const detail = document.createElement("span");
        detail.textContent = error instanceof Error ? error.message : "Is the server running?";
        this.elements.historyEmpty.replaceChildren(title, detail);
        this.splitWorkspaceView.renderHistory(this.elements.historyList, []);
      }
    }

    private async deleteReceipt(receipt: Services.SavedReceiptSummary): Promise<void> {
      const label = receipt.storeName || "this receipt";
      if (!window.confirm(`Delete ${label}? This can't be undone.`)) {
        return;
      }
      try {
        await this.receiptApiService.remove(receipt.id);
        // The copy open in Split would otherwise save back to a receipt that
        // no longer exists.
        if (this.editingReceipt?.id === receipt.id) this.clearReceipt();
        await this.loadHistory();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Please try again.";
        this.notificationService.error(`Couldn't delete receipt. ${message}`);
      }
    }

    private setBankStatus(message: string): void {
      this.elements.bankStatus.textContent = message;
    }

    private async connectBank(): Promise<void> {
      try {
        this.setBankStatus("Opening Plaid…");
        if (typeof Plaid === "undefined") {
          this.setBankStatus("Plaid Link failed to load. Check your connection.");
          return;
        }
        const { linkToken } = await this.bankApiService.createLinkToken();
        if (!linkToken) {
          this.setBankStatus("Set PLAID_CLIENT_ID and PLAID_SECRET in .env to connect a bank.");
          return;
        }
        const handler = Plaid.create({
          token: linkToken,
          onSuccess: (publicToken, metadata) => void this.handleLinkSuccess(publicToken, metadata),
          onExit: (error) => this.setBankStatus(error ? "Bank connection failed." : "")
        });
        handler.open();
      } catch (error) {
        this.setBankStatus(error instanceof Error ? error.message : "Could not start Plaid.");
      }
    }

    private async handleLinkSuccess(publicToken: string, metadata: PlaidLinkMetadata): Promise<void> {
      try {
        this.setBankStatus("Linking account…");
        const result = await this.bankApiService.exchange(publicToken, metadata);
        const bank = result.institutionName ?? "bank";
        // A re-link replaces the previous connection server-side rather than
        // stacking a second copy of the same history on top of it — say so, so
        // the missing "duplicate" isn't mistaken for lost data.
        this.setBankStatus(
          result.replaced ? `Reconnected ${bank}, replacing the earlier link. Syncing…` : `Connected ${bank}. Syncing…`
        );
        const sync = await this.bankApiService.sync();
        if (sync.pending && sync.imported === 0) {
          // Plaid is still preparing the initial history — not an error.
          this.setBankStatus("Connected. Your bank is still preparing transactions — reopen Budgeting in a minute.");
        } else {
          this.setBankStatus(this.describeSync(sync));
        }
        await this.loadBudgeting({ sync: false });
      } catch (error) {
        this.setBankStatus(error instanceof Error ? error.message : "Bank linking failed.");
      }
    }

    // One sentence covering what came in plus anything that went wrong, so a
    // bank that needs re-authenticating says so instead of looking like an
    // empty refresh.
    private describeSync(result: Services.SyncResult): string {
      const imported = `Imported ${result.imported} transaction${result.imported === 1 ? "" : "s"}.`;
      const errors = result.errors ?? [];
      if (errors.length === 0) return imported;

      const details = errors
        .map((error) => `${error.institutionName ?? "A bank"}: ${error.message}`)
        .join(" ");
      const hint = errors.some((error) => error.reconnectRequired)
        ? " Use Connect bank to reconnect it — that replaces the old link instead of duplicating it."
        : "";
      return `${imported} ${details}${hint}`;
    }

    // Explicit re-sync using the stored access token — no re-linking or bank
    // 2FA needed. Distinct from the silent sync in loadBudgeting so the user
    // gets clear feedback on how many transactions came in.
    private async refreshTransactions(): Promise<void> {
      this.elements.refreshTransactionsButton.setAttribute("disabled", "true");
      try {
        this.setBankStatus("Refreshing…");
        const sync = await this.bankApiService.sync();
        if (sync.pending && sync.imported === 0 && (sync.errors ?? []).length === 0) {
          this.setBankStatus("Your bank is still preparing transactions — try again in a minute.");
        } else {
          this.setBankStatus(this.describeSync(sync));
        }
        await this.loadBudgeting({ sync: false });
      } catch (error) {
        this.setBankStatus(error instanceof Error ? error.message : "Could not refresh transactions.");
      } finally {
        this.elements.refreshTransactionsButton.removeAttribute("disabled");
      }
    }

    private async loadBudgeting(options: { sync?: boolean } = {}): Promise<void> {
      // Best-effort refresh: pull any new bank transactions on view. Failures
      // (no bank linked, Plaid still preparing data) are non-fatal — we still
      // render whatever is already stored below. Callers that just synced pass
      // { sync: false } to avoid a redundant round-trip.
      if (options.sync !== false) {
        try {
          await this.bankApiService.sync();
        } catch {
          /* ignore — show existing data */
        }
      }

      try {
        this.receipts = await this.receiptApiService.list();
      } catch {
        this.receipts = [];
      }
      try {
        this.bankTransactions = await this.bankApiService.listTransactions();
      } catch {
        this.bankTransactions = [];
      }
      try {
        this.bankConnections = await this.bankApiService.listConnections();
      } catch {
        this.bankConnections = [];
      }
      this.monthlySpend = this.spendingAggregatorService.aggregate(
        this.receipts,
        this.bankTransactions,
        this.getSelfShares()
      );
      await this.refreshRentMonths();
      this.populateMonths();
      this.renderConnections();
      this.renderRentEntries();
      void this.renderEducationExpenses();
      this.renderTransactions();
      this.renderTrend();
      this.renderRing();
    }

    /**
     * How much of each saved receipt is actually the account owner's, for the
     * receipts they split with themselves included as a participant.
     *
     * Paying the whole bill at the till does not make the whole bill your
     * spending, so a receipt that names you as one of its people contributes
     * only your share to the ring and the trend. Receipts with no split, or
     * with a split you are not part of, are left out of the map entirely and
     * keep counting in full.
     */
    private getSelfShares(): Map<string, number> {
      const shares = new Map<string, number>();

      for (const receipt of this.receipts) {
        const self = receipt.people.find((person) => person.isSelf);
        if (!self) continue;

        const lines: Domain.ReceiptLine[] = receipt.lines.map((line) => ({
          id: line.id,
          label: line.label,
          amount: Number(line.amount) || 0,
          ...(line.itemCode ? { itemCode: line.itemCode } : {}),
          confidence: 1,
          ignored: line.ignored ?? false,
          isFood: line.isFood ?? false
        }));

        const assignments: Domain.LineAssignment[] = [];
        for (const line of receipt.lines) {
          for (const assignment of line.assignments) {
            if (!assignment.personId) continue;
            assignments.push({
              id: `${line.id}:${assignment.personId}`,
              lineId: line.id,
              personId: assignment.personId,
              mode: (assignment.mode as Domain.AssignmentMode) ?? "equal",
              value: Number(assignment.value) || 0
            });
          }
        }

        // Nothing was actually divided up, so the whole receipt is still theirs.
        if (assignments.length === 0) continue;

        const people: Domain.SplitPerson[] = receipt.people.map((person) => ({
          id: person.id,
          name: person.name,
          isSelf: person.isSelf
        }));

        const summary = this.splitCalculatorService.calculate(
          people,
          lines,
          assignments,
          Number(receipt.tax) || 0
        );
        const mine = summary.totals.find((total) => total.personId === self.id);
        if (mine) shares.set(receipt.id, mine.finalTotal);
      }

      return shares;
    }

    // Months come from receipts and bank activity plus any months that only
    // have rent entries — otherwise a rent payment saved into a quiet month
    // could never be selected, and looked like it silently vanished.
    private async refreshRentMonths(): Promise<void> {
      try {
        const entries = await this.rentEntryApiService.list();
        this.rentMonths = new Set(entries.map((entry) => Services.rentMonthKey(entry.year, entry.month)));
        this.rentEntryByTransaction = new Map(
          entries
            .filter((entry): entry is Domain.RentEntry & { bankTransactionId: string } =>
              typeof entry.bankTransactionId === "string" && entry.bankTransactionId.length > 0
            )
            .map((entry) => [entry.bankTransactionId, entry.id])
        );
      } catch (error) {
        console.error("Failed to load rent months:", error);
      }
    }

    private populateMonths(): void {
      const select = this.elements.budgetMonth;
      const previous = this.selectedMonth;
      select.replaceChildren();

      const months = new Set<string>(this.monthlySpend.map((entry) => entry.month));
      for (const month of this.rentMonths) {
        months.add(month);
      }
      const ordered = [...months].sort((a, b) => (a < b ? 1 : -1));

      for (const month of ordered) {
        const option = document.createElement("option");
        option.value = month;
        option.textContent = this.formatMonthLabel(month);
        select.append(option);
      }

      if (ordered.length === 0) {
        this.selectedMonth = null;
        return;
      }
      this.selectedMonth = previous !== null && ordered.includes(previous) ? previous : ordered[0];
      select.value = this.selectedMonth;
    }

    // Show what is actually linked. Without this the only evidence of a bank
    // connection is the transaction list, so a user with a stale or doubled-up
    // link has no way to see it, let alone remove it.
    private renderConnections(): void {
      const container = this.elements.bankConnections;
      container.replaceChildren();
      if (this.bankConnections.length === 0) return;

      for (const connection of this.bankConnections) {
        const row = document.createElement("div");
        row.className = "bank-connection-row";

        const main = document.createElement("div");
        main.className = "bank-connection-main";
        const name = document.createElement("span");
        name.className = "bank-connection-name";
        name.textContent = connection.institutionName ?? "Linked bank";
        const meta = document.createElement("span");
        meta.className = "bank-connection-meta";
        const accounts = `${connection.accounts} account${connection.accounts === 1 ? "" : "s"}`;
        const transactions = `${connection.transactions} transaction${connection.transactions === 1 ? "" : "s"}`;
        meta.textContent = `${accounts} · ${transactions}`;
        main.append(name, meta);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn btn-ghost btn-small";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => void this.removeConnection(connection));

        row.append(main, remove);
        container.append(row);
      }
    }

    private async removeConnection(connection: Services.BankConnection): Promise<void> {
      const label = connection.institutionName ?? "this bank";
      if (
        !window.confirm(
          `Remove ${label}? Its ${connection.transactions} imported transaction${
            connection.transactions === 1 ? "" : "s"
          } will be deleted. Saved receipts are not affected.`
        )
      ) {
        return;
      }
      try {
        this.setBankStatus("Removing…");
        await this.bankApiService.removeConnection(connection.id);
        this.setBankStatus(`Removed ${label}.`);
        await this.loadBudgeting({ sync: false });
      } catch (error) {
        this.setBankStatus(error instanceof Error ? error.message : "Could not remove the bank.");
      }
    }

    private renderRing(): void {
      const month = this.monthlySpend.find((entry) => entry.month === this.selectedMonth) ?? null;
      this.budgetRingView.render(this.elements.budgetRing, this.elements.budgetLegend, month);
    }

    private renderTrend(): void {
      this.monthlyTrendView.render(
        this.elements.monthlyTrend,
        this.monthlySpend,
        this.selectedMonth,
        (month) => this.selectMonth(month)
      );
    }

    // Point the whole budgeting view at one month, keeping the dropdown, ring,
    // and trend-chart highlight in sync no matter which of them triggered it.
    private selectMonth(month: string | null): void {
      this.selectedMonth = month;
      this.elements.budgetMonth.value = month ?? "";
      this.renderTrend();
      this.renderRing();
      this.renderRentEntries();
      void this.renderEducationExpenses();
      this.renderTransactions();
    }

    private formatMonthLabel(key: string): string {
      const [year, month] = key.split("-").map(Number);
      if (!year || !month) return key;
      return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric"
      });
    }

    // Bank transactions carry a calendar date ("YYYY-MM-DD"), which must be
    // rendered as that same day everywhere. Handing it to `new Date(...)` would
    // read it as UTC midnight and print the day before for anyone west of UTC,
    // so build the date from its parts in local time instead.
    private formatTransactionDate(value: string): string {
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
      if (!match) return new Date(value).toLocaleDateString();
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString();
    }

    private renderTransactions(): void {
      const list = this.elements.transactionsList;
      // Scope the list to the month the rest of the view is focused on so the
      // transactions line up with the ring and the selected trend bar.
      const transactions = this.selectedMonth
        ? this.bankTransactions.filter(
            (txn) => this.spendingAggregatorService.monthKey(txn.date) === this.selectedMonth
          )
        : this.bankTransactions;
      this.elements.transactionsEmpty.classList.toggle("hidden", transactions.length > 0);
      this.setTransactionsEmptyMessage(transactions.length === 0);
      list.replaceChildren();

      for (const txn of transactions.slice(0, 100)) {
        list.append(this.buildTransactionRow(txn));
      }
    }

    private buildTransactionRow(txn: Services.BankTransaction): HTMLElement {
      const row = document.createElement("div");
      row.className = "transaction-row";
      row.dataset.transactionId = txn.id;

      const main = document.createElement("div");
      main.className = "transaction-main";
      const desc = document.createElement("span");
      desc.className = "transaction-desc";
      desc.textContent = txn.description ?? "Transaction";
      const meta = document.createElement("span");
      meta.className = "transaction-meta";
      const date = this.formatTransactionDate(txn.date);
      meta.textContent = txn.category ? `${date} \u00b7 ${txn.category}` : date;
      main.append(desc);

      const linkedReceipt = this.findLinkedReceipt(txn);

      // What has already been done to this transaction, said in words. The
      // previous row showed only a paperclip glyph, which never came back after
      // a reload and said nothing about rent either way.
      //
      // These sit under the description rather than in the right-hand cluster:
      // their width varies with the store name, and while they shared a flex
      // parent with the controls they shoved the food toggle and the menu to a
      // different horizontal position on every row.
      const tags = document.createElement("div");
      tags.className = "transaction-tags";
      if (this.rentEntryByTransaction.has(txn.id)) {
        tags.append(this.buildTransactionTag("Rent", "is-rent"));
      }
      if (txn.linkedReceiptId) {
        const name = linkedReceipt?.storeName?.trim();
        tags.append(
          this.buildTransactionTag(name ? `Receipt \u00b7 ${name}` : "Receipt", "is-receipt", RECEIPT_TAG_ICON)
        );
        // Also marks the row itself, so an attached receipt is visible while
        // scanning down the list without reading each tag.
        row.classList.add("has-receipt");
      }

      const submeta = document.createElement("div");
      submeta.className = "transaction-submeta";
      submeta.append(meta, tags);
      main.append(submeta);

      // Only the fixed-width controls, so they line up down the list.
      const actions = document.createElement("div");
      actions.className = "transaction-actions";
      actions.append(this.buildFoodToggle(txn), this.buildTransactionMenu(txn, linkedReceipt));

      const amount = document.createElement("span");
      amount.className = "transaction-amount";
      amount.textContent = this.currencyFormatService.format(txn.amount);

      // A receipt card dragged out of History drops onto the row it belongs to.
      row.addEventListener("dragover", (event) => {
        event.preventDefault();
        row.classList.add("is-drag-over");
      });
      row.addEventListener("dragleave", () => {
        row.classList.remove("is-drag-over");
      });
      row.addEventListener("drop", (event) => {
        event.preventDefault();
        row.classList.remove("is-drag-over");
        const receiptId = event.dataTransfer?.getData("text/plain");
        if (receiptId) {
          void this.linkReceiptToTransaction(receiptId, txn.id);
        }
      });

      row.append(main, actions, amount);
      return row;
    }

    // `text` is store-name data, so it goes in via textContent. The optional
    // icon is a trusted constant from this module and is the only thing allowed
    // to be parsed as markup.
    private buildTransactionTag(text: string, variant: string, iconSvg?: string): HTMLElement {
      const tag = document.createElement("span");
      tag.className = `transaction-tag ${variant}`;
      if (iconSvg) {
        const icon = document.createElement("span");
        icon.className = "transaction-tag-icon";
        icon.innerHTML = iconSvg;
        tag.append(icon);
      }
      const label = document.createElement("span");
      label.className = "transaction-tag-text";
      label.textContent = text;
      tag.append(label);
      return tag;
    }

    // The same food control the receipt lines use, but labelled. On a bank row
    // there is no column header to explain a lone checkbox, and an unlabelled
    // one read as decoration.
    private buildFoodToggle(txn: Services.BankTransaction): HTMLElement {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "line-food-check txn-food-toggle";
      toggle.classList.toggle("is-on", txn.isFood);
      toggle.setAttribute("aria-pressed", String(txn.isFood));
      toggle.setAttribute("aria-label", txn.isFood ? "Remove food flag" : "Count as food");
      toggle.title = txn.isFood
        ? "Counted as food in education expenses"
        : "Count this transaction as food in education expenses";
      toggle.innerHTML = UI.SplitWorkspaceView.getFoodCheckIcon(txn.isFood);

      const label = document.createElement("span");
      label.className = "txn-food-label";
      label.textContent = "Food";
      toggle.append(label);

      toggle.addEventListener("click", () => void this.toggleTransactionFood(txn.id, !txn.isFood));
      return toggle;
    }

    // Everything else a transaction can be: rent, or the receipt that belongs
    // to it. These used to be a bare click on the row, which nothing announced.
    private buildTransactionMenu(
      txn: Services.BankTransaction,
      linkedReceipt: Services.SavedReceiptSummary | null
    ): HTMLDetailsElement {
      const menu = document.createElement("details");
      menu.className = "txn-menu";

      const trigger = document.createElement("summary");
      trigger.className = "txn-menu-trigger";
      trigger.setAttribute("aria-label", "Transaction options");
      trigger.setAttribute("title", "Transaction options");
      trigger.textContent = "\u22ef";
      menu.append(trigger);

      const panel = document.createElement("div");
      panel.className = "txn-menu-panel";

      const addItem = (label: string, onSelect: () => void, variant = ""): void => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = variant ? `txn-menu-item ${variant}` : "txn-menu-item";
        button.textContent = label;
        button.addEventListener("click", () => {
          menu.open = false;
          onSelect();
        });
        panel.append(button);
      };

      const rentEntryId = this.rentEntryByTransaction.get(txn.id);
      if (rentEntryId) {
        addItem("Remove rent payment", () => void this.removeTransactionRent(rentEntryId), "is-danger");
      } else {
        addItem("Log as rent payment", () => void this.logTransactionAsRent(txn));
      }

      addItem(txn.isFood ? "Remove food flag" : "Count as food", () =>
        void this.toggleTransactionFood(txn.id, !txn.isFood)
      );

      if (txn.linkedReceiptId) {
        const receiptId = txn.linkedReceiptId;
        if (linkedReceipt?.hasImage) {
          addItem("Open receipt photo", () => this.openReceiptPhoto(receiptId));
        }
        addItem("Detach receipt", () => void this.detachReceipt(txn), "is-danger");
      } else {
        addItem("Attach a receipt file\u2026", () => this.promptForReceiptFile(txn.id));
        addItem("Link a saved receipt\u2026", () => this.openReceiptLinkModal(txn.id));
      }

      menu.append(panel);
      menu.addEventListener("toggle", () => {
        if (menu.open) this.closeTransactionMenus(menu);
      });
      return menu;
    }

    private closeTransactionMenus(except?: HTMLDetailsElement): void {
      this.elements.transactionsList
        .querySelectorAll<HTMLDetailsElement>("details.txn-menu[open]")
        .forEach((menu) => {
          if (menu !== except) menu.open = false;
        });
    }

    private findLinkedReceipt(txn: Services.BankTransaction): Services.SavedReceiptSummary | null {
      if (!txn.linkedReceiptId) return null;
      return this.receipts.find((receipt) => receipt.id === txn.linkedReceiptId) ?? null;
    }

    private openReceiptPhoto(receiptId: string): void {
      window.open(this.receiptApiService.imageUrl(receiptId), "_blank", "noopener");
    }

    // Logging a transaction as rent writes a real rent entry, so it lands in
    // the Education Expenses rent list and total exactly like one typed into
    // the rent form -- and carries the transaction id so the row remembers.
    private async logTransactionAsRent(txn: Services.BankTransaction): Promise<void> {
      const parts = Services.parseRentDateParts(txn.date);
      if (!parts) {
        this.notificationService.error("This transaction has no usable date.");
        return;
      }

      const amount = Math.abs(txn.amount);
      if (!(amount > 0)) {
        this.notificationService.error("A rent payment needs a non-zero amount.");
        return;
      }

      try {
        await this.rentEntryApiService.create({
          year: parts.year,
          month: parts.month,
          amount,
          propertyName: txn.description ?? undefined,
          date: txn.date,
          bankTransactionId: txn.id
        });
        await this.refreshRentMonths();
        this.populateMonths();
        this.selectMonth(Services.rentMonthKey(parts.year, parts.month));
        this.notificationService.success("Logged as a rent payment.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not log the rent payment.";
        this.notificationService.error(message);
      }
    }

    private async removeTransactionRent(rentEntryId: string): Promise<void> {
      try {
        await this.rentEntryApiService.delete(rentEntryId);
        await this.refreshRentMonths();
        this.populateMonths();
        this.selectMonth(this.selectedMonth);
        this.notificationService.success("Rent payment removed.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not remove the rent payment.";
        this.notificationService.error(message);
      }
    }

    private promptForReceiptFile(transactionId: string): void {
      this.attachingTransactionId = transactionId;
      // Clear first: picking the same file twice in a row fires no change event
      // otherwise, and the second attempt would look like nothing happened.
      this.elements.transactionReceiptFile.value = "";
      this.elements.transactionReceiptFile.click();
    }

    // A photo attached here becomes a saved receipt holding that image, linked
    // to the transaction -- so it shows up in History and can be itemised and
    // split later, rather than being a loose file with nowhere to live.
    private async attachReceiptFile(file: File): Promise<void> {
      const transactionId = this.attachingTransactionId;
      this.attachingTransactionId = null;
      if (!transactionId) return;

      const txn = this.bankTransactions.find((candidate) => candidate.id === transactionId);
      if (!txn) return;

      try {
        const imageDataUrl = await this.receiptImageService.toStorableDataUrl(file);
        if (!imageDataUrl) {
          this.notificationService.error("That file could not be read as an image.");
          return;
        }

        const label = (txn.description ?? "Transaction").slice(0, 200);
        const amount = Math.abs(txn.amount);
        const saved = await this.receiptApiService.save({
          storeName: label,
          category: this.categorizationService.categorize(label).category,
          subtotal: null,
          tax: null,
          total: amount,
          people: [],
          lines: [{ clientId: this.idService.create(), label, amount, ignored: false }],
          assignments: [],
          imageDataUrl
        });

        await this.receiptApiService.linkTransactionToReceipt(saved.id, transactionId);
        this.receipts = [saved, ...this.receipts];
        this.applyReceiptLink(transactionId, saved.id);
        this.renderTransactions();
        this.notificationService.success("Receipt attached.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not attach the receipt.";
        this.notificationService.error(`Failed to attach the receipt. ${message}`);
      }
    }

    private async detachReceipt(txn: Services.BankTransaction): Promise<void> {
      const receiptId = txn.linkedReceiptId;
      if (!receiptId) return;

      try {
        await this.receiptApiService.unlinkTransactionFromReceipt(receiptId);
        this.applyReceiptLink(txn.id, null);
        this.renderTransactions();
        this.notificationService.success("Receipt detached.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not detach the receipt.";
        this.notificationService.error(`Failed to detach the receipt. ${message}`);
      }
    }

    // Keep the in-memory transactions in step with the server so the row's tag
    // and menu are right without another round-trip, and recompute the ring:
    // an attached receipt stops counting as a purchase of its own.
    private applyReceiptLink(transactionId: string, receiptId: string | null): void {
      this.bankTransactions = this.bankTransactions.map((txn) =>
        txn.id === transactionId ? { ...txn, linkedReceiptId: receiptId } : txn
      );
      this.monthlySpend = this.spendingAggregatorService.aggregate(
        this.receipts,
        this.bankTransactions,
        this.getSelfShares()
      );
      this.renderTrend();
      this.renderRing();
    }

    private async toggleTransactionFood(transactionId: string, isFood: boolean): Promise<void> {
      try {
        await this.bankApiService.updateTransactionFood(transactionId, isFood);
        this.bankTransactions = this.bankTransactions.map((txn) =>
          txn.id === transactionId ? { ...txn, isFood } : txn
        );
        this.renderTransactions();
        void this.renderEducationExpenses();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not update the transaction.";
        this.notificationService.error(`Failed to update food flag. ${message}`);
      }
    }

    // The empty state does double duty: no bank linked at all, versus a linked
    // bank that simply has no activity in the month currently in focus.
    private setTransactionsEmptyMessage(isEmpty: boolean): void {
      if (!isEmpty) return;
      const heading = this.elements.transactionsEmpty.querySelector("strong");
      const detail = this.elements.transactionsEmpty.querySelector("span");
      const hasAnyTransactions = this.bankTransactions.length > 0;
      if (heading) {
        heading.textContent = hasAnyTransactions ? "No transactions this month" : "No transactions yet";
      }
      if (detail) {
        detail.textContent = hasAnyTransactions
          ? "Pick another month to see its activity."
          : "Connect a bank to import read-only transactions.";
      }
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

    private renderRentEntries(): void {
      void (async () => {
        try {
          // No month in focus (fresh account) still shows the current month's
          // rent, mirroring renderEducationExpenses' fallback.
          const month =
            this.selectedMonth ?? this.spendingAggregatorService.monthKey(new Date().toISOString());
          if (!month) {
            this.rentEntriesView.render(this.elements.rentEntriesList, []);
            return;
          }

          this.rentEntries = await this.rentEntryApiService.list(month);
          this.rentEntriesView.render(this.elements.rentEntriesList, this.rentEntries);
        } catch (error) {
          console.error("Failed to load rent entries:", error);
          this.rentEntriesView.render(this.elements.rentEntriesList, []);
        }
      })();
    }

    private openRentEntryForm(entry?: Domain.RentEntry): void {
      this.editingRentEntryId = entry?.id ?? null;
      this.rentEntriesView.renderForm(this.elements.rentEntryModal, entry);
      this.elements.rentEntryModal.classList.remove("hidden");
    }

    private closeRentEntryModal(): void {
      this.editingRentEntryId = null;
      this.elements.rentEntryModal.classList.add("hidden");
    }

    private async saveRentEntry(): Promise<void> {
      const date = this.elements.rentEntryDate.value.trim();
      const amount = Number(this.elements.rentEntryAmount.value);
      const propertyName = this.elements.rentEntryProperty.value.trim();
      const photoFile = this.elements.rentEntryPhoto.files?.[0];

      if (!date || !amount || amount <= 0) {
        this.notificationService.error("Please fill in the date and amount.");
        return;
      }

      const parts = Services.parseRentDateParts(date);
      if (!parts) {
        this.notificationService.error("Please enter the date as YYYY-MM-DD.");
        return;
      }

      this.elements.rentEntrySaveButton.setAttribute("disabled", "true");

      try {
        const { year, month } = parts;

        let photoDataUrl: string | undefined;
        if (photoFile) {
          photoDataUrl = await this.fileToDataUrl(photoFile);
        }

        const payload: Services.CreateRentEntryPayload = {
          year,
          month,
          amount,
          propertyName: propertyName || undefined,
          date,
          photoDataUrl
        };

        const wasEditing = this.editingRentEntryId !== null;
        if (this.editingRentEntryId) {
          await this.rentEntryApiService.update(this.editingRentEntryId, {
            amount,
            propertyName: propertyName || undefined,
            date,
            photoDataUrl
          });
        } else {
          await this.rentEntryApiService.create(payload);
        }

        this.notificationService.success(wasEditing ? "Rent entry updated." : "Rent entry saved.");
        this.closeRentEntryModal();

        // Focus the view on the month the entry was saved into, so the new
        // payment is on screen even if a different month was selected.
        const savedMonth = Services.rentMonthKey(year, month);
        this.rentMonths.add(savedMonth);
        this.populateMonths();
        this.selectMonth(savedMonth);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not save rent entry.";
        if (message.includes("already exists")) {
          this.notificationService.error("A rent entry already exists for this month. Please edit the existing entry.");
        } else {
          this.notificationService.error(message);
        }
      } finally {
        this.elements.rentEntrySaveButton.removeAttribute("disabled");
      }
    }

    private async deleteRentEntry(entry: Domain.RentEntry): Promise<void> {
      const label = this.formatTransactionDate(entry.date);
      if (!window.confirm(`Delete rent entry for ${label}? This can't be undone.`)) {
        return;
      }

      try {
        await this.rentEntryApiService.delete(entry.id);
        this.notificationService.success("Rent entry deleted.");
        // The deleted entry may have been the only thing keeping its month in
        // the dropdown, so rebuild the options before re-rendering the view.
        await this.refreshRentMonths();
        this.populateMonths();
        this.selectMonth(this.selectedMonth);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not delete rent entry.";
        this.notificationService.error(`Failed to delete rent entry. ${message}`);
      }
    }

    private fileToDataUrl(file: File): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve(reader.result as string);
        };
        reader.onerror = () => {
          reject(new Error("Could not read file."));
        };
        reader.readAsDataURL(file);
      });
    }

    private openReceiptLinkModal(transactionId: string): void {
      this.linkingTransactionId = transactionId;
      this.elements.receiptLinkEmpty.classList.add("hidden");
      this.renderReceiptLinkList();
      this.elements.receiptLinkModal.classList.remove("hidden");
    }

    private closeReceiptLinkModal(): void {
      this.linkingTransactionId = null;
      this.elements.receiptLinkModal.classList.add("hidden");
    }

    private renderReceiptLinkList(): void {
      const list = this.elements.receiptLinkList;
      list.replaceChildren();

      void (async () => {
        try {
          const receipts = await this.receiptApiService.list();
          this.receipts = receipts;
          if (receipts.length === 0) {
            this.elements.receiptLinkEmpty.classList.remove("hidden");
            return;
          }

          receipts.forEach((receipt) => {
            const card = document.createElement("button");
            card.className = "receipt-link-item";
            card.type = "button";
            card.dataset.receiptId = receipt.id;

            const main = document.createElement("div");
            main.className = "receipt-link-main";

            const storeName = document.createElement("strong");
            storeName.textContent = receipt.storeName || "Untitled receipt";

            const meta = document.createElement("span");
            meta.className = "receipt-link-meta";
            const when = new Date(receipt.createdAt).toLocaleDateString();
            meta.textContent = `${receipt.category} · ${when}`;

            const amount = document.createElement("span");
            amount.className = "receipt-link-amount";
            amount.textContent = this.currencyFormatService.format(Number(receipt.total ?? 0));

            main.append(storeName, meta, amount);
            card.append(main);

            if (receipt.hasImage) {
              const thumb = document.createElement("img");
              thumb.className = "receipt-link-thumb";
              thumb.src = this.receiptApiService.imageUrl(receipt.id);
              thumb.alt = `Receipt from ${receipt.storeName || "an unknown store"}`;
              card.append(thumb);
            }

            list.append(card);
          });
        } catch (error) {
          const msg = document.createElement("p");
          msg.textContent = "Could not load receipts.";
          list.append(msg);
        }
      })();
    }

    // --- Linking from the History side -------------------------------------
    // The transaction menu can already pick a receipt; this is the same link
    // made from the other end, for when you are looking at the receipt.

    private openTransactionLinkModal(receiptId: string): void {
      this.linkingReceiptId = receiptId;
      this.elements.transactionLinkEmpty.classList.add("hidden");
      this.renderTransactionLinkList();
      this.elements.transactionLinkModal.classList.remove("hidden");
    }

    private closeTransactionLinkModal(): void {
      this.linkingReceiptId = null;
      this.elements.transactionLinkModal.classList.add("hidden");
    }

    private renderTransactionLinkList(): void {
      const list = this.elements.transactionLinkList;
      list.replaceChildren();

      void (async () => {
        try {
          const transactions = await this.bankApiService.listTransactions();
          this.bankTransactions = transactions;

          // A transaction can hold one receipt, so anything already spoken for
          // would only fail on submit. Outflows first: a receipt pays for
          // something, so a refund or a Zelle credit is rarely the match.
          const available = transactions
            .filter((txn) => !txn.linkedReceiptId)
            .sort((a, b) => (a.date < b.date ? 1 : -1));

          if (available.length === 0) {
            this.elements.transactionLinkEmpty.classList.remove("hidden");
            return;
          }

          available.slice(0, 100).forEach((txn) => {
            const card = document.createElement("button");
            card.className = "transaction-link-item";
            card.type = "button";

            const main = document.createElement("div");
            main.className = "transaction-link-main";

            const desc = document.createElement("strong");
            desc.textContent = txn.description ?? "Transaction";

            const meta = document.createElement("span");
            meta.className = "transaction-link-meta";
            const when = this.formatTransactionDate(txn.date);
            meta.textContent = txn.category ? `${when} · ${txn.category}` : when;

            main.append(desc, meta);

            const amount = document.createElement("span");
            amount.className = "transaction-link-amount";
            amount.textContent = this.currencyFormatService.format(txn.amount);

            card.append(main, amount);
            card.addEventListener("click", () => void this.selectTransactionForLink(txn.id));
            list.append(card);
          });
        } catch (error) {
          const msg = document.createElement("p");
          msg.className = "assign-hint";
          msg.textContent =
            error instanceof Error ? error.message : "Could not load transactions.";
          list.append(msg);
        }
      })();
    }

    private async selectTransactionForLink(transactionId: string): Promise<void> {
      const receiptId = this.linkingReceiptId;
      if (!receiptId) return;

      if (await this.linkReceiptToTransaction(receiptId, transactionId)) {
        this.closeTransactionLinkModal();
        await this.loadHistory();
      }
    }

    private async unlinkReceiptFromHistory(
      receipt: Services.SavedReceiptSummary
    ): Promise<void> {
      try {
        await this.receiptApiService.unlinkTransactionFromReceipt(receipt.id);
        const transactionId = receipt.linkedTransaction?.id;
        if (transactionId) this.applyReceiptLink(transactionId, null);
        this.notificationService.success("Receipt unlinked from its transaction.");
        await this.loadHistory();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not unlink receipt.";
        this.notificationService.error(message);
      }
    }

    private async selectReceiptForLink(receiptId: string): Promise<void> {
      if (!this.linkingTransactionId) return;

      if (await this.linkReceiptToTransaction(receiptId, this.linkingTransactionId)) {
        this.closeReceiptLinkModal();
      }
    }

    // Returns whether the link stuck. Callers that fire this off from a drop
    // handler have nowhere to catch a rejection, so the toast happens here.
    private async linkReceiptToTransaction(receiptId: string, transactionId: string): Promise<boolean> {
      try {
        await this.receiptApiService.linkTransactionToReceipt(receiptId, transactionId);
        this.applyReceiptLink(transactionId, receiptId);
        this.renderTransactions();
        this.notificationService.success("Receipt attached to the transaction.");
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not link receipt to transaction.";
        this.notificationService.error(`Failed to attach the receipt. ${message}`);
        return false;
      }
    }

    /**
     * A receipt's food spend as one collapsed row that opens to show the
     * individual items. Shared items show the owner's share against what the
     * line cost, so a split is legible without opening the receipt itself.
     */
    private buildFoodReceiptRow(group: Services.FoodSummaryReceipt): HTMLElement {
      const details = document.createElement("details");
      details.className = "food-receipt";

      const summary = document.createElement("summary");
      summary.className = "food-receipt-summary";

      const label = document.createElement("span");
      label.className = "food-item-label";
      label.textContent = group.storeName || "Unknown store";

      const meta = document.createElement("span");
      meta.className = "food-item-store";
      const itemCount = `${group.items.length} ${group.items.length === 1 ? "item" : "items"}`;
      meta.textContent = `${this.formatTransactionDate(group.date)} · ${itemCount}`;

      const amount = document.createElement("span");
      amount.className = "food-item-amount";
      amount.textContent = this.currencyFormatService.format(group.total);

      summary.append(label, meta, amount);
      details.append(summary);

      const body = document.createElement("div");
      body.className = "food-receipt-items";

      for (const item of group.items) {
        const row = document.createElement("div");
        row.className = "food-receipt-item";

        const itemLabel = document.createElement("span");
        itemLabel.className = "food-receipt-item-label";
        itemLabel.textContent = item.label;

        const note = document.createElement("span");
        note.className = "food-receipt-item-note";
        if (item.shared) {
          // Name who it was split with, so a share that looks too small to be
          // the item's price explains itself.
          const names = item.sharedWith.length > 0 ? ` with ${item.sharedWith.join(", ")}` : "";
          note.textContent = `your share of ${this.currencyFormatService.format(item.fullAmount)}${names}`;
        }

        const itemAmount = document.createElement("span");
        itemAmount.className = "food-receipt-item-amount";
        itemAmount.textContent = this.currencyFormatService.format(item.amount);

        row.append(itemLabel, note, itemAmount);
        body.append(row);
      }

      // Tax rides along with the total above, so it is spelled out here rather
      // than leaving the items looking like they do not add up.
      if (group.taxTotal !== 0) {
        const taxRow = document.createElement("div");
        taxRow.className = "food-receipt-item is-tax";

        const taxLabel = document.createElement("span");
        taxLabel.className = "food-receipt-item-label";
        taxLabel.textContent = "Tax on your food";

        const spacer = document.createElement("span");
        spacer.className = "food-receipt-item-note";

        const taxAmount = document.createElement("span");
        taxAmount.className = "food-receipt-item-amount";
        taxAmount.textContent = this.currencyFormatService.format(group.taxTotal);

        taxRow.append(taxLabel, spacer, taxAmount);
        body.append(taxRow);
      }

      details.append(body);
      return details;
    }

    private async renderEducationExpenses(): Promise<void> {
      try {
        const month = this.selectedMonth ?? (this.spendingAggregatorService.monthKey(new Date().toISOString()) ?? undefined);
        const foodSummary = await this.receiptApiService.getFoodSummary(month);
        const rentSummary = await this.rentEntryApiService.getSummary(month);

        const foodTotal = foodSummary.foodTotal;
        const rentTotal = rentSummary.rentTotal;
        const combinedTotal = foodTotal + rentTotal;

        // Update totals display
        this.elements.educationFoodTotal.textContent = this.currencyFormatService.format(foodTotal);
        this.elements.educationRentTotal.textContent = this.currencyFormatService.format(rentTotal);
        this.elements.educationExpensesTotal.textContent = this.currencyFormatService.format(combinedTotal);

        // Render food items list: itemized receipt lines first, then whole
        // bank transactions flagged as food in the budgeting view.
        const foodList = this.elements.foodItemsList;
        foodList.replaceChildren();
        const foodReceipts = foodSummary.foodReceipts ?? [];
        const foodTransactions = foodSummary.foodTransactions ?? [];
        this.elements.foodEmpty.classList.toggle(
          "hidden",
          foodReceipts.length + foodTransactions.length > 0
        );

        const appendFoodRow = (labelText: string, sourceText: string, amountValue: number): void => {
          const row = document.createElement("div");
          row.className = "food-item-row";
          // A food-flagged inflow is a reimbursement (a friend paying their
          // share back), so it offsets the total rather than adding to it.
          // Tinted differently so a negative row reads as a credit, not a typo.
          row.classList.toggle("is-credit", amountValue < 0);

          const label = document.createElement("span");
          label.className = "food-item-label";
          label.textContent = labelText;

          const store = document.createElement("span");
          store.className = "food-item-store";
          store.textContent = sourceText;

          const amount = document.createElement("span");
          amount.className = "food-item-amount";
          amount.textContent = this.currencyFormatService.format(amountValue);

          row.append(label, store, amount);
          foodList.append(row);
        };

        // One compact row per receipt: the number that counts toward the
        // education expense is the owner's food total, and the items behind it
        // are detail, so they live in a disclosure rather than flooding the
        // list with a row per grocery item.
        for (const group of foodReceipts) {
          foodList.append(this.buildFoodReceiptRow(group));
        }
        for (const txn of foodTransactions) {
          appendFoodRow(
            txn.description || "Bank transaction",
            `Bank · ${this.formatTransactionDate(txn.date)}`,
            txn.amount
          );
        }

        // Rent rows themselves are rendered by renderRentEntries; the summary
        // (fetched for the same month) decides the empty state so it can't
        // disagree with a stale this.rentEntries.
        this.elements.rentEmpty.classList.toggle("hidden", rentSummary.entries.length > 0);
      } catch (error) {
        console.error("Failed to render education expenses:", error);
        this.elements.foodEmpty.classList.remove("hidden");
        this.elements.rentEmpty.classList.remove("hidden");
      }
    }

  }
}
