namespace ReceiptRing.UI {
  export interface PersonFilterLine {
    id: string;
    name: string;
    amount: number;
    ignored?: boolean;
    assignments: { personId: string; mode: string; value: number }[];
  }

  export interface PersonFilterData {
    people: { id: string; name: string }[];
    lines: PersonFilterLine[];
    tax: number;
  }

  /**
   * A row of names above a receipt's lines. Clicking one swaps the lines for what
   * that person bought, how each line was split and what it cost them; "Everyone"
   * brings the lines back. Used on History cards and on the shared receipt page.
   */
  export class PersonFilterView {
    constructor(
      private readonly currencyFormatService: Services.CurrencyFormatService,
      private readonly splitCalculatorService: Services.SplitCalculatorService
    ) {}

    /** `lineList` is the element a selected person's items stand in for. */
    build(data: PersonFilterData, lineList: HTMLElement): HTMLElement {
      const wrap = document.createElement("div");
      wrap.className = "person-filter";

      const chips = document.createElement("div");
      chips.className = "person-chips";
      chips.setAttribute("role", "group");
      chips.setAttribute("aria-label", "Filter by person");

      const panel = document.createElement("div");
      panel.className = "person-breakdown hidden";

      const select = (chosen: HTMLButtonElement, personId: string | null): void => {
        chips.querySelectorAll("button").forEach((chip) => {
          chip.setAttribute("aria-pressed", String(chip === chosen));
        });
        lineList.classList.toggle("hidden", personId !== null);
        panel.classList.toggle("hidden", personId === null);
        if (personId === null) {
          panel.replaceChildren();
        } else {
          this.renderBreakdown(panel, data, personId);
        }
      };

      const addChip = (label: string, personId: string | null): HTMLButtonElement => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "person-chip";
        chip.textContent = label;
        chip.setAttribute("aria-pressed", String(personId === null));
        chip.addEventListener("click", () => select(chip, personId));
        chips.append(chip);
        return chip;
      };
      addChip("Everyone", null);
      data.people.forEach((person) => addChip(person.name, person.id));

      wrap.append(chips, panel);
      return wrap;
    }

    /** "Split evenly · 3 people", "Split by % · 40%", and so on. */
    describeSplit(item: Domain.PersonBreakdownItem): string {
      if (item.mode === "percentage") return `Split by % · ${item.value}%`;
      if (item.mode === "amount") return "Custom amount";
      return item.splitCount > 1 ? `Split evenly · ${item.splitCount} people` : "Not split";
    }

    private renderBreakdown(panel: HTMLElement, data: PersonFilterData, personId: string): void {
      const breakdown = this.splitCalculatorService.personBreakdown(
        data.people,
        data.lines.map((line) => ({
          id: line.id,
          label: line.name,
          amount: line.amount,
          confidence: 1,
          ignored: line.ignored ?? false
        })),
        data.lines.flatMap((line) =>
          line.assignments.map((assignment) => ({
            id: `${line.id}:${assignment.personId}`,
            lineId: line.id,
            personId: assignment.personId,
            mode: assignment.mode as Domain.AssignmentMode,
            value: assignment.value
          }))
        ),
        data.tax,
        personId
      );

      panel.replaceChildren();
      if (breakdown.items.length === 0) {
        const empty = document.createElement("p");
        empty.className = "person-breakdown-empty";
        empty.textContent = "Nothing on this receipt is assigned to them.";
        panel.append(empty);
        return;
      }

      breakdown.items.forEach((item) => {
        const row = document.createElement("div");
        row.className = "person-breakdown-row";
        const text = document.createElement("span");
        text.className = "person-breakdown-item";
        const name = document.createElement("span");
        name.textContent = item.label;
        const how = document.createElement("span");
        how.className = "person-breakdown-how";
        how.textContent = this.describeSplit(item);
        text.append(name, how);
        const amounts = document.createElement("span");
        amounts.className = "person-breakdown-amounts";
        const share = document.createElement("b");
        share.textContent = this.currencyFormatService.format(item.share);
        amounts.append(share);
        if (item.share !== item.lineAmount) {
          const whole = document.createElement("span");
          whole.textContent = `of ${this.currencyFormatService.format(item.lineAmount)}`;
          amounts.append(whole);
        }
        row.append(text, amounts);
        panel.append(row);
      });

      const addTotal = (label: string, amount: number, className = "person-breakdown-total"): void => {
        const row = document.createElement("div");
        row.className = className;
        const name = document.createElement("span");
        name.textContent = label;
        const value = document.createElement("b");
        value.textContent = this.currencyFormatService.format(amount);
        row.append(name, value);
        panel.append(row);
      };
      if (breakdown.allocatedTax !== 0) addTotal("Share of tax", breakdown.allocatedTax);
      addTotal("Total", breakdown.finalTotal, "person-breakdown-total is-final");
    }
  }
}
