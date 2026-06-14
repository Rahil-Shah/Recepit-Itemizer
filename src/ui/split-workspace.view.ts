namespace ReceiptRing.UI {
  export interface SplitWorkspaceHandlers {
    onLineToggle(lineId: string): void;
    onLineIgnore(lineId: string): void;
    onPersonSelect(personId: string): void;
    onPersonDelete(personId: string): void;
  }

  export class SplitWorkspaceView {
    constructor(private readonly currencyFormatService: Services.CurrencyFormatService) {}

    renderLines(
      container: HTMLElement,
      lines: readonly Domain.ReceiptLine[],
      assignments: readonly Domain.LineAssignment[],
      people: readonly Domain.SplitPerson[],
      selectedLineIds: ReadonlySet<string>,
      handlers: SplitWorkspaceHandlers
    ): void {
      container.innerHTML = "";
      lines.forEach((line) => {
        const row = document.createElement("div");
        row.className = "table-row";
        row.classList.toggle("is-selected", selectedLineIds.has(line.id));
        row.classList.toggle("is-ignored", line.ignored);

        const name = document.createElement("button");
        name.className = "line-select-button";
        name.type = "button";
        name.textContent = line.label;
        name.addEventListener("click", () => handlers.onLineToggle(line.id));

        const assigned = document.createElement("span");
        assigned.className = "assignment-summary";
        assigned.textContent = this.getAssignmentSummary(line.id, assignments, people);

        const amount = document.createElement("span");
        amount.className = "amount-cell";
        amount.textContent = this.currencyFormatService.format(line.amount);

        const ignore = document.createElement("button");
        ignore.className = "icon-button delete-row";
        ignore.type = "button";
        ignore.textContent = line.ignored ? "+" : "x";
        ignore.setAttribute("aria-label", line.ignored ? "Restore line" : "Ignore line");
        ignore.addEventListener("click", () => handlers.onLineIgnore(line.id));

        row.append(name, assigned, amount, ignore);
        container.append(row);
      });
    }

    renderPeople(
      container: HTMLElement,
      people: readonly Domain.SplitPerson[],
      activePersonId: string | null,
      handlers: SplitWorkspaceHandlers
    ): void {
      container.innerHTML = "";
      people.forEach((person) => {
        const row = document.createElement("div");
        row.className = "person-chip";
        row.classList.toggle("is-active", person.id === activePersonId);

        const select = document.createElement("button");
        select.type = "button";
        select.textContent = person.name;
        select.addEventListener("click", () => handlers.onPersonSelect(person.id));

        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "x";
        remove.setAttribute("aria-label", `Remove ${person.name}`);
        remove.addEventListener("click", () => handlers.onPersonDelete(person.id));

        row.append(select, remove);
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

    private getAssignmentSummary(
      lineId: string,
      assignments: readonly Domain.LineAssignment[],
      people: readonly Domain.SplitPerson[]
    ): string {
      const names = assignments
        .filter((assignment) => assignment.lineId === lineId)
        .map((assignment) => people.find((person) => person.id === assignment.personId)?.name)
        .filter((name): name is string => Boolean(name));

      return names.length > 0 ? names.join(", ") : "Unassigned";
    }
  }
}
