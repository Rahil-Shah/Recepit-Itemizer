namespace ReceiptRing.UI {
  export interface SplitWorkspaceHandlers {
    onLineSelectToggle(lineId: string, extendFromAnchor: boolean): void;
    onLineIgnore(lineId: string): void;
    onPersonDelete(personId: string): void;
    onAssignToggle(lineId: string, personId: string): void;
    onLineModeChange(lineId: string, mode: Domain.AssignmentMode): void;
    onAssignValueChange(lineId: string, personId: string, value: number): void;
    onLineFood(lineId: string, isFood: boolean): void;
    onBatchAssign(personId: string): void;
    onBatchFood(isFood: boolean): void;
    onBatchIgnore(ignored: boolean): void;
  }

  /**
   * How much of the current selection a person already holds: none of it, some
   * of it, or all of it. The bar's buttons read this to say what a click will
   * do, since clicking a name that is already on every line takes it off again.
   */
  export type BatchAssignState = "none" | "some" | "all";

  /** What the whole selection has in common, for the bar's flag buttons. */
  export interface BatchLineState {
    // False when every selected line is ignored, which is the one case where
    // there is nothing for the food flag to act on.
    hasActive: boolean;
    allFood: boolean;
    allIgnored: boolean;
  }

  const MODE_LABELS: Record<Domain.AssignmentMode, string> = {
    equal: "Split evenly",
    percentage: "Split by percentage",
    amount: "Split by custom amount"
  };

  export class SplitWorkspaceView {
    // Scopes the scroll/resize listeners each render's dropdowns register.
    // Discarding a row does not fire its `toggle` event, so an open dropdown's
    // listeners used to outlive the element; aborting per render collects them
    // deterministically instead of waiting for the next scroll to notice.
    private panelListeners: AbortController | null = null;

    constructor(
      private readonly currencyFormatService: Services.CurrencyFormatService,
      private readonly receiptApiService: Services.ReceiptApiService
    ) {}

    renderLines(
      container: HTMLElement,
      lines: readonly Domain.ReceiptLine[],
      assignments: readonly Domain.LineAssignment[],
      people: readonly Domain.SplitPerson[],
      lineModes: ReadonlyMap<string, Domain.AssignmentMode>,
      selectedLineIds: ReadonlySet<string>,
      identifications: ReadonlyMap<string, Domain.ItemIdentification>,
      handlers: SplitWorkspaceHandlers
    ): void {
      // Ticking a person or changing the split mode re-renders every row, which
      // destroyed and recreated the popup the user was working in -- so it shut
      // after each click and assigning one line to three people meant reopening
      // it three times. Remember what was open and restore it below.
      const openLineIds = new Set<string>();
      container
        .querySelectorAll<HTMLDetailsElement>("details.assign-dropdown[open]")
        .forEach((dropdown) => {
          if (dropdown.dataset.lineId) openLineIds.add(dropdown.dataset.lineId);
        });

      this.panelListeners?.abort();
      this.panelListeners = new AbortController();

      container.innerHTML = "";
      lines.forEach((line) => {
        const isSelected = selectedLineIds.has(line.id);
        const row = document.createElement("div");
        row.className = "table-row";
        row.classList.toggle("is-ignored", line.ignored);
        row.classList.toggle("is-selected", isSelected);

        const select = document.createElement("input");
        select.type = "checkbox";
        select.className = "line-select";
        select.checked = isSelected;
        select.setAttribute("aria-label", `Select ${line.label}`);
        // `click`, not `change`: only the mouse event carries shiftKey, and the
        // range shortcut is worth more than the keyboard's own toggle event,
        // which still arrives here as a click with no modifier.
        select.addEventListener("click", (event) =>
          handlers.onLineSelectToggle(line.id, event.shiftKey)
        );

        const name = this.buildLabelCell(line, identifications.get(line.id));

        const foodCheck = document.createElement("button");
        foodCheck.className = "line-food-check";
        foodCheck.type = "button";
        foodCheck.setAttribute("aria-label", line.isFood ? "Mark as non-food" : "Mark as food");
        foodCheck.setAttribute("aria-pressed", String(line.isFood ?? false));
        foodCheck.innerHTML = SplitWorkspaceView.getFoodCheckIcon(line.isFood ?? false);
        foodCheck.addEventListener("click", () => handlers.onLineFood(line.id, !(line.isFood ?? false)));

        const assignCell = document.createElement("div");
        assignCell.className = "assign-cell";
        const dropdown = this.buildAssignDropdown(line, assignments, people, lineModes, handlers);
        assignCell.append(dropdown);

        const amount = document.createElement("span");
        amount.className = "amount-cell";
        amount.textContent = this.currencyFormatService.format(line.amount);

        const ignore = document.createElement("button");
        ignore.className = "icon-button delete-row";
        ignore.type = "button";
        ignore.textContent = line.ignored ? "+" : "x";
        ignore.setAttribute("aria-label", line.ignored ? "Restore line" : "Ignore line");
        ignore.addEventListener("click", () => handlers.onLineIgnore(line.id));

        row.append(select, name, foodCheck, assignCell, amount, ignore);
        container.append(row);

        // Reopen after insertion so there is a laid-out summary to measure.
        // `toggle` fires asynchronously, so the popup is also anchored here and
        // now -- waiting for the event left it unpositioned for a frame.
        if (openLineIds.has(line.id)) {
          dropdown.open = true;
          this.anchorDropdown(dropdown);
        }
      });
    }

    /**
     * The item cell: what the receipt printed, and underneath it what that
     * turned out to be.
     *
     * The receipt text stays on top and stays primary. It is the line the user
     * can check against the paper in their hand, and demoting it in favour of
     * a name that might be a guess would make the row harder to verify, not
     * easier. The identification is support, so it reads as support.
     */
    private buildLabelCell(
      line: Domain.ReceiptLine,
      identification: Domain.ItemIdentification | undefined
    ): HTMLElement {
      const cell = document.createElement("span");
      cell.className = "line-label-cell";

      const name = document.createElement("span");
      name.className = "line-label";
      // textContent, never innerHTML: this is receipt text, which came from a
      // photo of something a stranger printed.
      name.textContent = line.label;
      cell.append(name);

      if (!identification || identification.source === "unresolved") return cell;
      // A "resolved" name identical to what is already printed adds a second
      // copy of the same string and nothing else.
      if (this.saysTheSameThing(identification.resolvedName, line.label)) return cell;

      const resolved = document.createElement("span");
      resolved.className = "line-resolved";
      resolved.classList.toggle("is-confirmed", identification.confirmed);
      resolved.textContent = this.describeIdentification(identification);
      cell.append(resolved);

      return cell;
    }

    /** The product line: the name, and the size when there is one to add. */
    private describeIdentification(identification: Domain.ItemIdentification): string {
      return identification.size
        ? `${identification.resolvedName} - ${identification.size}`
        : identification.resolvedName;
    }

    // Casing, spacing and punctuation differences are not new information.
    private saysTheSameThing(left: string, right: string): boolean {
      const flatten = (value: string): string =>
        value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      return flatten(left) === flatten(right);
    }

    private buildAssignDropdown(
      line: Domain.ReceiptLine,
      assignments: readonly Domain.LineAssignment[],
      people: readonly Domain.SplitPerson[],
      lineModes: ReadonlyMap<string, Domain.AssignmentMode>,
      handlers: SplitWorkspaceHandlers
    ): HTMLDetailsElement {
      const lineAssignments = assignments.filter((assignment) => assignment.lineId === line.id);
      const mode = lineModes.get(line.id) ?? "equal";

      const details = document.createElement("details");
      details.className = "assign-dropdown";
      // Lets the next render find this row's dropdown and restore its open state.
      details.dataset.lineId = line.id;

      const summary = document.createElement("summary");
      summary.className = "assign-summary";
      summary.textContent = this.getAssignmentSummary(lineAssignments, people);
      details.append(summary);

      const panel = document.createElement("div");
      panel.className = "assign-panel-pop";

      // The panel is rendered with position: fixed (computed on open) so it
      // escapes the `.items-table` overflow:hidden clip and the viewport edge.
      // Without this, the popup for the last row in a long list gets cut off.
      const reposition = (): void => {
        if (!details.isConnected) {
          this.teardownPanelPositioning(reposition);
          return;
        }
        // Scrolling the row itself off screen leaves the popup pinned to a
        // summary the user can no longer see, which reads as a menu floating
        // over unrelated rows. Close it instead of chasing an absent anchor.
        const summaryRect = summary.getBoundingClientRect();
        if (summaryRect.bottom < 0 || summaryRect.top > window.innerHeight) {
          details.open = false;
          return;
        }
        this.positionPanel(summary, panel);
      };
      details.addEventListener("toggle", () => {
        if (details.open) {
          this.closeOtherDropdowns(details);
          this.positionPanel(summary, panel);
          const signal = this.panelListeners?.signal;
          window.addEventListener("scroll", reposition, { capture: true, signal });
          window.addEventListener("resize", reposition, { signal });
        } else {
          this.teardownPanelPositioning(reposition);
          this.resetPanelPosition(panel);
        }
      });

      if (people.length === 0) {
        const hint = document.createElement("p");
        hint.className = "assign-hint";
        hint.textContent = "Add people first, then assign them here.";
        panel.append(hint);
        details.append(panel);
        return details;
      }

      const modeSelect = document.createElement("select");
      modeSelect.className = "table-select assign-mode";
      (Object.keys(MODE_LABELS) as Domain.AssignmentMode[]).forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = MODE_LABELS[value];
        modeSelect.append(option);
      });
      modeSelect.value = mode;
      modeSelect.addEventListener("change", () =>
        handlers.onLineModeChange(line.id, modeSelect.value as Domain.AssignmentMode)
      );
      panel.append(modeSelect);

      people.forEach((person) => {
        const assignment = lineAssignments.find((candidate) => candidate.personId === person.id);
        const personRow = document.createElement("label");
        personRow.className = "assign-person-row";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = Boolean(assignment);
        checkbox.addEventListener("change", () => handlers.onAssignToggle(line.id, person.id));

        const personName = document.createElement("span");
        personName.className = "assign-person-name";
        personName.textContent = person.name;

        personRow.append(checkbox, personName);

        if (mode !== "equal") {
          const valueInput = document.createElement("input");
          valueInput.type = "number";
          valueInput.min = "0";
          valueInput.step = "0.01";
          valueInput.className = "table-input assign-value";
          valueInput.placeholder = mode === "percentage" ? "%" : "$";
          valueInput.value = assignment ? String(assignment.value) : "";
          valueInput.disabled = !assignment;
          valueInput.addEventListener("input", () =>
            handlers.onAssignValueChange(line.id, person.id, Number(valueInput.value))
          );
          personRow.append(valueInput);
        }

        panel.append(personRow);
      });

      details.append(panel);
      return details;
    }

    /**
     * The controls inside the batch bar. Rebuilt whenever the selection or the
     * cast of people changes, which is often, so it stays a plain redraw
     * rather than anything that has to be kept in sync.
     */
    renderBatchActions(
      container: HTMLElement,
      people: readonly Domain.SplitPerson[],
      assignStates: ReadonlyMap<string, BatchAssignState>,
      lineState: BatchLineState,
      handlers: SplitWorkspaceHandlers
    ): void {
      container.innerHTML = "";

      if (people.length === 0) {
        const hint = document.createElement("span");
        hint.className = "batch-hint";
        hint.textContent = "Add people to assign these lines to.";
        container.append(hint);
        container.append(this.buildBatchFlagButtons(lineState, handlers));
        return;
      }

      const label = document.createElement("span");
      label.className = "batch-label";
      label.textContent = "Assign to";
      container.append(label);

      people.forEach((person) => {
        const state = assignStates.get(person.id) ?? "none";
        const button = document.createElement("button");
        button.type = "button";
        button.className = `batch-person is-${state}`;
        // "mixed" is exactly what a partial selection is, and screen readers
        // say so; without it a half-assigned person is announced as unassigned.
        button.setAttribute("aria-pressed", state === "all" ? "true" : state === "some" ? "mixed" : "false");
        button.title =
          state === "all"
            ? `Take ${person.name} off the selected lines`
            : `Put ${person.name} on the selected lines`;
        // textContent, never innerHTML: person names are user data.
        button.textContent = person.name;
        button.addEventListener("click", () => handlers.onBatchAssign(person.id));
        container.append(button);
      });

      container.append(this.buildBatchFlagButtons(lineState, handlers));
    }

    /**
     * Food and ignore, applied to the selection. Both are written as one
     * intent rather than a per-row toggle -- "make these food" is a decision
     * about the whole selection, and flipping each row's own state would leave
     * a mixed selection exactly as mixed as it started.
     */
    private buildBatchFlagButtons(
      lineState: BatchLineState,
      handlers: SplitWorkspaceHandlers
    ): HTMLElement {
      const group = document.createElement("span");
      group.className = "batch-flags";

      const food = document.createElement("button");
      food.type = "button";
      food.className = "btn btn-secondary btn-small";
      food.textContent = lineState.allFood ? "Not food" : "Food";
      // Food describes a line in the split, so with the whole selection struck
      // off there is nothing to say it about. Disabled rather than dead.
      food.disabled = !lineState.hasActive;
      food.title = lineState.allFood
        ? "Stop counting the selected lines as food"
        : "Count the selected lines as food";
      food.addEventListener("click", () => handlers.onBatchFood(!lineState.allFood));

      const ignore = document.createElement("button");
      ignore.type = "button";
      ignore.className = "btn btn-secondary btn-small";
      ignore.textContent = lineState.allIgnored ? "Restore" : "Ignore";
      ignore.title = lineState.allIgnored
        ? "Put the selected lines back on the receipt"
        : "Leave the selected lines out of the split";
      ignore.addEventListener("click", () => handlers.onBatchIgnore(!lineState.allIgnored));

      group.append(food, ignore);
      return group;
    }

    renderPeople(
      container: HTMLElement,
      people: readonly Domain.SplitPerson[],
      handlers: SplitWorkspaceHandlers
    ): void {
      container.innerHTML = "";
      people.forEach((person) => {
        const row = document.createElement("div");
        row.className = "person-chip";
        row.classList.toggle("is-self", Boolean(person.isSelf));

        const label = document.createElement("span");
        label.textContent = person.name;
        row.append(label);

        // The account owner's own entry: assignable like anyone else, but the
        // server will not delete it, so no remove button is offered.
        if (person.isSelf) {
          const you = document.createElement("span");
          you.className = "person-chip-you";
          you.textContent = "You";
          row.append(you);
        } else {
          const remove = document.createElement("button");
          remove.type = "button";
          remove.textContent = "x";
          remove.setAttribute("aria-label", `Remove ${person.name}`);
          remove.addEventListener("click", () => handlers.onPersonDelete(person.id));
          row.append(remove);
        }

        container.append(row);
      });
    }

    renderTotals(container: HTMLElement, summary: Domain.SplitSummary): void {
      container.innerHTML = "";

      // Only surface the food line on receipts where anything was flagged, and
      // then on every person's row so the column reads consistently -- including
      // the people who owe nothing toward it.
      const anyFood = summary.totals.some((total) => total.foodTotal > 0);
      // The food figure carries its share of the tax, so next to a Tax line of
      // its own it would otherwise read as if the two were being counted twice.
      const anyTax = summary.totals.some((total) => total.allocatedTax !== 0);
      const foodLabel = anyTax ? "Food (incl. tax)" : "Food";

      summary.totals.forEach((total) => {
        const row = document.createElement("div");
        row.className = "split-total-row";

        // Build with textContent (never innerHTML) — person names are
        // attacker-influenced data and must not be parsed as HTML.
        const name = document.createElement("strong");
        name.textContent = total.personName;
        const items = document.createElement("span");
        items.textContent = `Items ${this.currencyFormatService.format(total.itemTotal)}`;
        const tax = document.createElement("span");
        tax.textContent = `Tax ${this.currencyFormatService.format(total.allocatedTax)}`;
        const final = document.createElement("b");
        final.textContent = this.currencyFormatService.format(total.finalTotal);

        row.append(name, items);
        if (anyFood) {
          const food = document.createElement("span");
          food.className = "is-food-line";
          food.textContent = `${foodLabel} ${this.currencyFormatService.format(total.foodTotal)}`;
          row.append(food);
        }
        row.append(tax, final);
        container.append(row);
      });

      // Custom amounts and percentages can leave part of a line on nobody's
      // tab. Say so, rather than letting the shares quietly total less than
      // the receipt.
      if (Math.abs(summary.unallocated) >= 0.01) {
        const row = document.createElement("div");
        row.className = "split-total-row is-unallocated";

        const name = document.createElement("strong");
        name.textContent = "Unallocated";
        const detail = document.createElement("span");
        detail.textContent = "Not covered by the amounts entered";
        const spacer = document.createElement("span");
        const value = document.createElement("b");
        value.textContent = this.currencyFormatService.format(summary.unallocated);

        row.append(name, detail, spacer, value);
        container.append(row);
      }

      if (summary.totals.length > 0) {
        container.append(this.buildReconciliation(summary));
      }
    }

    /**
     * The check the user actually cares about at the end of a split: does what
     * everyone owes add back up to what the receipt says? Both figures are shown
     * side by side, because "balanced" is only trustworthy if you can see the
     * two numbers it is claiming are equal.
     */
    private buildReconciliation(summary: Domain.SplitSummary): HTMLElement {
      const block = document.createElement("div");
      block.className = "split-reconcile";
      block.classList.toggle("is-balanced", summary.isBalanced);

      const addLine = (label: string, amount: number, variant = ""): void => {
        const line = document.createElement("div");
        line.className = variant ? `split-reconcile-line ${variant}` : "split-reconcile-line";
        const text = document.createElement("span");
        text.textContent = label;
        const value = document.createElement("b");
        value.textContent = this.currencyFormatService.format(amount);
        line.append(text, value);
        block.append(line);
      };

      addLine("Split across everyone", summary.assignedTotal);
      addLine("Receipt total", summary.receiptTotal);

      const status = document.createElement("div");
      status.className = "split-reconcile-status";
      if (summary.isBalanced) {
        status.textContent = "Balanced — the split matches the receipt.";
      } else {
        const gap = summary.receiptTotal - summary.assignedTotal;
        const amount = this.currencyFormatService.format(Math.abs(gap));
        status.textContent =
          gap > 0
            ? `${amount} of the receipt is not on anyone's tab yet.`
            : `The split is over the receipt total by ${amount}.`;
      }
      block.append(status);

      return block;
    }

    renderHistory(
      container: HTMLElement,
      receipts: readonly Services.SavedReceiptSummary[],
      onDelete?: (receipt: Services.SavedReceiptSummary) => void,
      onLineFood?: (receiptId: string, lineId: string, isFood: boolean) => void,
      onLinkTransaction?: (receipt: Services.SavedReceiptSummary) => void,
      onUnlinkTransaction?: (receipt: Services.SavedReceiptSummary) => void
    ): void {
      container.innerHTML = "";
      receipts.forEach((receipt) => {
        const card = document.createElement("details");
        card.className = "history-card";
        card.draggable = true;

        card.addEventListener("dragstart", (event) => {
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "copy";
            event.dataTransfer.setData("text/plain", receipt.id);
          }
        });

        const summary = document.createElement("summary");
        summary.className = "history-summary";

        const heading = document.createElement("div");
        heading.className = "history-heading";
        const title = document.createElement("strong");
        title.textContent = receipt.storeName || "Untitled receipt";
        const meta = document.createElement("span");
        meta.className = "history-meta";
        const when = new Date(receipt.createdAt).toLocaleDateString();
        meta.textContent = `${receipt.category} · ${when}`;
        heading.append(title, meta);

        // Say on the collapsed card that this receipt is already accounted
        // for against a bank transaction, so it is visible without opening it.
        if (receipt.linkedTransaction) {
          card.classList.add("is-linked");
          const linked = document.createElement("span");
          linked.className = "history-linked-tag";
          linked.title = `Attached to ${receipt.linkedTransaction.description ?? "a bank transaction"}`;
          linked.textContent = "Linked";
          heading.append(linked);
        }

        const total = document.createElement("b");
        total.className = "history-total";
        total.textContent = this.currencyFormatService.format(Number(receipt.total ?? 0));

        summary.append(heading, total);
        card.append(summary);

        const body = document.createElement("div");
        body.className = "history-body";

        if (receipt.hasImage) {
          // Inside the collapsed card, so the photos only load for receipts the
          // user actually opens.
          const figure = document.createElement("a");
          figure.className = "history-image";
          figure.href = this.receiptApiService.imageUrl(receipt.id);
          figure.target = "_blank";
          figure.rel = "noopener";
          figure.title = "Open the full-size receipt photo";

          const photo = document.createElement("img");
          photo.src = figure.href;
          photo.loading = "lazy";
          photo.alt = `Photo of the receipt from ${receipt.storeName || "an unknown store"}`;
          figure.append(photo);
          body.append(figure);
        }

        if (receipt.lines.length > 0) {
          const linesWrap = document.createElement("div");
          linesWrap.className = "history-lines";
          receipt.lines.forEach((line) => {
            const lineRow = document.createElement("div");
            lineRow.className = "history-line";
            const names = line.assignments
              .map((assignment) => assignment.personName)
              .filter((value): value is string => Boolean(value));

            // line.label comes from OCR of arbitrary receipt images and from
            // the server; render as text, never HTML, to prevent stored XSS.
            const label = document.createElement("span");
            label.textContent = line.label;

            const foodCheck = document.createElement("button");
            foodCheck.className = "line-food-check";
            foodCheck.type = "button";
            foodCheck.setAttribute("aria-label", line.isFood ? "Mark as non-food" : "Mark as food");
            foodCheck.setAttribute("aria-pressed", String(line.isFood ?? false));
            foodCheck.innerHTML = SplitWorkspaceView.getFoodCheckIcon(line.isFood ?? false);
            if (onLineFood) {
              foodCheck.addEventListener("click", () => onLineFood(receipt.id, line.id, !(line.isFood ?? false)));
            } else {
              foodCheck.disabled = true;
            }

            const peopleSpan = document.createElement("span");
            peopleSpan.className = "history-line-people";
            peopleSpan.textContent = names.length ? names.join(", ") : "Unassigned";
            const amountEl = document.createElement("b");
            amountEl.textContent = this.currencyFormatService.format(Number(line.amount));
            lineRow.append(label, foodCheck, peopleSpan, amountEl);
            linesWrap.append(lineRow);
          });
          body.append(linesWrap);
        }

        if (receipt.people.length > 0) {
          const peopleWrap = document.createElement("div");
          peopleWrap.className = "history-people";
          peopleWrap.textContent = `People: ${receipt.people.map((person) => person.name).join(", ")}`;
          body.append(peopleWrap);
        }

        const linked = receipt.linkedTransaction;
        if (linked) {
          const detail = document.createElement("div");
          detail.className = "history-linked-detail";
          const what = linked.description ?? "Bank transaction";
          const when = new Date(`${linked.date}T00:00:00`).toLocaleDateString();
          detail.textContent = `Attached to ${what} · ${when} · ${this.currencyFormatService.format(
            linked.amount
          )}`;
          body.append(detail);
        }

        if (onDelete || onLinkTransaction || onUnlinkTransaction) {
          const actions = document.createElement("div");
          actions.className = "history-actions";

          // Linking from this side saves hunting for the receipt again from the
          // budgeting tab once it is already saved and in front of you.
          if (linked && onUnlinkTransaction) {
            const unlink = document.createElement("button");
            unlink.type = "button";
            unlink.className = "btn btn-secondary btn-small";
            unlink.textContent = "Unlink transaction";
            unlink.addEventListener("click", () => onUnlinkTransaction(receipt));
            actions.append(unlink);
          } else if (!linked && onLinkTransaction) {
            const link = document.createElement("button");
            link.type = "button";
            link.className = "btn btn-secondary btn-small";
            link.textContent = "Link to transaction";
            link.addEventListener("click", () => onLinkTransaction(receipt));
            actions.append(link);
          }

          if (onDelete) {
            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "btn btn-danger btn-small";
            deleteButton.textContent = "Delete receipt";
            deleteButton.addEventListener("click", () => onDelete(receipt));
            actions.append(deleteButton);
          }

          body.append(actions);
        }

        card.append(body);
        container.append(card);
      });
    }

    /**
     * Re-anchor an already-open dropdown to its own summary. Used after a
     * re-render, where the row is a brand new element that the pending `toggle`
     * event has not caught up with yet.
     */
    private anchorDropdown(details: HTMLDetailsElement): void {
      const summary = details.querySelector<HTMLElement>("summary.assign-summary");
      const panel = details.querySelector<HTMLElement>(".assign-panel-pop");
      if (summary && panel) this.positionPanel(summary, panel);
    }

    private positionPanel(summary: HTMLElement, panel: HTMLElement): void {
      const margin = 8;
      const summaryRect = summary.getBoundingClientRect();

      // Measure the panel at its natural size before committing a position.
      panel.style.position = "fixed";
      panel.style.maxHeight = "";
      panel.style.width = `${Math.max(230, summaryRect.width)}px`;

      // `position: fixed` is only viewport-relative while nothing up the tree
      // establishes a containing block, and a `transform` anywhere above --
      // including the identity one an animation fill mode can leave behind --
      // quietly re-bases top/left onto that ancestor instead. Rather than trust
      // the tree to stay clean, park the panel at 0,0 and ask the browser where
      // that actually landed; subtracting the answer makes the coordinates
      // below mean viewport pixels either way.
      panel.style.top = "0px";
      panel.style.left = "0px";
      const origin = panel.getBoundingClientRect();
      const panelHeight = panel.scrollHeight;

      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - summaryRect.bottom - margin;
      const spaceAbove = summaryRect.top - margin;

      let top: number;
      if (panelHeight <= spaceBelow || spaceBelow >= spaceAbove) {
        // Drop down.
        top = summaryRect.bottom + margin;
        panel.style.maxHeight = `${Math.max(0, spaceBelow)}px`;
      } else {
        // Flip up when there isn't enough room below (e.g. the last row).
        panel.style.maxHeight = `${Math.max(0, spaceAbove)}px`;
        top = Math.max(margin, summaryRect.top - margin - Math.min(panelHeight, spaceAbove));
      }

      const panelWidth = origin.width;
      const left = Math.max(margin, Math.min(summaryRect.left, viewportWidth - margin - panelWidth));

      panel.style.top = `${top - origin.top}px`;
      panel.style.left = `${left - origin.left}px`;
      panel.style.overflowY = "auto";
      // Only now is it safe to paint: the panel is over its own summary.
      panel.classList.add("is-anchored");
    }

    private resetPanelPosition(panel: HTMLElement): void {
      panel.classList.remove("is-anchored");
      panel.style.position = "";
      panel.style.top = "";
      panel.style.left = "";
      panel.style.width = "";
      panel.style.maxHeight = "";
      panel.style.overflowY = "";
    }

    private teardownPanelPositioning(reposition: () => void): void {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    }

    private closeOtherDropdowns(current: HTMLDetailsElement): void {
      document
        .querySelectorAll<HTMLDetailsElement>("details.assign-dropdown[open]")
        .forEach((dropdown) => {
          if (dropdown !== current) {
            dropdown.open = false;
          }
        });
    }

    private getAssignmentSummary(
      lineAssignments: readonly Domain.LineAssignment[],
      people: readonly Domain.SplitPerson[]
    ): string {
      const names = lineAssignments
        .map((assignment) => people.find((person) => person.id === assignment.personId)?.name)
        .filter((name): name is string => Boolean(name));

      return names.length > 0 ? names.join(", ") : "Assign ▾";
    }

    // Static so other views of food-flaggable rows (e.g. the budgeting
    // transaction list) render the identical control.
    // A bare outlined circle did not read as something you could click, and at
    // 16px on a dark panel it was easy to miss entirely. Draw an actual
    // checkbox: a rounded square that fills in and gains a tick when checked.
    static getFoodCheckIcon(isFood: boolean): string {
      const box = isFood
        ? `<rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor"/>
           <path d="m7.5 12.4 3 3 6-6.5" fill="none" stroke="var(--surface)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`
        : `<rect x="3.9" y="3.9" width="16.2" height="16.2" rx="4.4" fill="none" stroke="currentColor" stroke-width="1.8"/>`;
      return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="food-check-icon" aria-hidden="true">${box}</svg>`;
    }
  }
}
