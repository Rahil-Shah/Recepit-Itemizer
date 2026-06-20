namespace ReceiptRing.UI {
  export interface SplitWorkspaceHandlers {
    onLineIgnore(lineId: string): void;
    onPersonDelete(personId: string): void;
    onAssignToggle(lineId: string, personId: string): void;
    onLineModeChange(lineId: string, mode: Domain.AssignmentMode): void;
    onAssignValueChange(lineId: string, personId: string, value: number): void;
  }

  const MODE_LABELS: Record<Domain.AssignmentMode, string> = {
    equal: "Split evenly",
    percentage: "Split by percentage",
    amount: "Split by custom amount"
  };

  export class SplitWorkspaceView {
    constructor(private readonly currencyFormatService: Services.CurrencyFormatService) {}

    renderLines(
      container: HTMLElement,
      lines: readonly Domain.ReceiptLine[],
      assignments: readonly Domain.LineAssignment[],
      people: readonly Domain.SplitPerson[],
      lineModes: ReadonlyMap<string, Domain.AssignmentMode>,
      handlers: SplitWorkspaceHandlers
    ): void {
      container.innerHTML = "";
      lines.forEach((line) => {
        const row = document.createElement("div");
        row.className = "table-row";
        row.classList.toggle("is-ignored", line.ignored);

        const name = document.createElement("span");
        name.className = "line-label";
        name.textContent = line.label;

        const assignCell = document.createElement("div");
        assignCell.className = "assign-cell";
        assignCell.append(this.buildAssignDropdown(line, assignments, people, lineModes, handlers));

        const amount = document.createElement("span");
        amount.className = "amount-cell";
        amount.textContent = this.currencyFormatService.format(line.amount);

        const ignore = document.createElement("button");
        ignore.className = "icon-button delete-row";
        ignore.type = "button";
        ignore.textContent = line.ignored ? "+" : "x";
        ignore.setAttribute("aria-label", line.ignored ? "Restore line" : "Ignore line");
        ignore.addEventListener("click", () => handlers.onLineIgnore(line.id));

        row.append(name, assignCell, amount, ignore);
        container.append(row);
      });
    }

    private buildAssignDropdown(
      line: Domain.ReceiptLine,
      assignments: readonly Domain.LineAssignment[],
      people: readonly Domain.SplitPerson[],
      lineModes: ReadonlyMap<string, Domain.AssignmentMode>,
      handlers: SplitWorkspaceHandlers
    ): HTMLElement {
      const lineAssignments = assignments.filter((assignment) => assignment.lineId === line.id);
      const mode = lineModes.get(line.id) ?? "equal";

      const details = document.createElement("details");
      details.className = "assign-dropdown";

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
        this.positionPanel(summary, panel);
      };
      details.addEventListener("toggle", () => {
        if (details.open) {
          this.closeOtherDropdowns(details);
          this.positionPanel(summary, panel);
          window.addEventListener("scroll", reposition, true);
          window.addEventListener("resize", reposition);
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

    renderPeople(
      container: HTMLElement,
      people: readonly Domain.SplitPerson[],
      handlers: SplitWorkspaceHandlers
    ): void {
      container.innerHTML = "";
      people.forEach((person) => {
        const row = document.createElement("div");
        row.className = "person-chip";

        const label = document.createElement("span");
        label.textContent = person.name;

        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "x";
        remove.setAttribute("aria-label", `Remove ${person.name}`);
        remove.addEventListener("click", () => handlers.onPersonDelete(person.id));

        row.append(label, remove);
        container.append(row);
      });
    }

    renderTotals(container: HTMLElement, totals: readonly Domain.PersonSplitTotal[]): void {
      container.innerHTML = "";
      totals.forEach((total) => {
        const row = document.createElement("div");
        row.className = "split-total-row";
        row.innerHTML = `
          <strong>${total.personName}</strong>
          <span>Items ${this.currencyFormatService.format(total.itemTotal)}</span>
          <span>Tax ${this.currencyFormatService.format(total.allocatedTax)}</span>
          <b>${this.currencyFormatService.format(total.finalTotal)}</b>
        `;
        container.append(row);
      });
    }

    renderHistory(
      container: HTMLElement,
      receipts: readonly Services.SavedReceiptSummary[]
    ): void {
      container.innerHTML = "";
      receipts.forEach((receipt) => {
        const card = document.createElement("details");
        card.className = "history-card";

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

        const total = document.createElement("b");
        total.className = "history-total";
        total.textContent = this.currencyFormatService.format(Number(receipt.total ?? 0));

        summary.append(heading, total);
        card.append(summary);

        const body = document.createElement("div");
        body.className = "history-body";

        if (receipt.lines.length > 0) {
          const linesWrap = document.createElement("div");
          linesWrap.className = "history-lines";
          receipt.lines.forEach((line) => {
            const lineRow = document.createElement("div");
            lineRow.className = "history-line";
            const names = line.assignments
              .map((assignment) => assignment.personName)
              .filter((value): value is string => Boolean(value));
            lineRow.innerHTML = `
              <span>${line.label}</span>
              <span class="history-line-people">${names.length ? names.join(", ") : "Unassigned"}</span>
              <b>${this.currencyFormatService.format(Number(line.amount))}</b>
            `;
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

        card.append(body);
        container.append(card);
      });
    }

    private positionPanel(summary: HTMLElement, panel: HTMLElement): void {
      const margin = 8;
      const summaryRect = summary.getBoundingClientRect();

      // Measure the panel at its natural size before committing a position.
      panel.style.position = "fixed";
      panel.style.maxHeight = "";
      panel.style.width = `${Math.max(230, summaryRect.width)}px`;
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

      const panelWidth = panel.getBoundingClientRect().width;
      const left = Math.max(margin, Math.min(summaryRect.left, viewportWidth - margin - panelWidth));

      panel.style.top = `${top}px`;
      panel.style.left = `${left}px`;
      panel.style.overflowY = "auto";
    }

    private resetPanelPosition(panel: HTMLElement): void {
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
  }
}
