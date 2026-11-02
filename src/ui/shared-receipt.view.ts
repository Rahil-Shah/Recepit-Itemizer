namespace ReceiptRing.UI {
  /** What someone sees when they open a share link. */
  export class SharedReceiptView {
    constructor(
      private readonly root: HTMLElement,
      private readonly token: string,
      private readonly api: Services.SharedReceiptApiService,
      private readonly currencyFormatService: Services.CurrencyFormatService,
      private readonly splitCalculatorService: Services.SplitCalculatorService,
      private readonly personFilterView: PersonFilterView
    ) {}

    async load(): Promise<void> {
      this.root.replaceChildren(createLoader({ label: "Loading this receipt…" }));
      try {
        const receipt = await this.api.get(this.token);
        if (receipt) {
          this.render(receipt);
        } else {
          this.renderMessage("This link is no longer available", "It has expired, or it was turned off by the person who shared it.");
        }
      } catch {
        this.renderMessage("Couldn't load this receipt", "Check your connection and reload the page.");
      }
    }

    private renderMessage(title: string, detail: string): void {
      const heading = document.createElement("h1");
      heading.className = "page-title";
      heading.textContent = title;
      const text = document.createElement("p");
      text.textContent = detail;
      this.root.replaceChildren(heading, text);
    }

    private render(receipt: Services.SharedReceipt): void {
      const money = (value: number): string => this.currencyFormatService.format(value);
      const heading = document.createElement("h1");
      heading.className = "page-title";
      heading.textContent = receipt.storeName || "Shared receipt";
      document.title = `${heading.textContent} · Receipt Ring`;

      const meta = document.createElement("p");
      meta.className = "page-updated";
      meta.textContent = `${receipt.category} · ${new Date(receipt.createdAt).toLocaleDateString()}`;

      const card = document.createElement("section");
      card.className = "shared-card";

      const lines = document.createElement("div");
      lines.className = "shared-lines";
      receipt.lines.forEach((line) => {
        const names = line.assignments
          .map((assignment) => receipt.people.find((person) => person.id === assignment.personId)?.name)
          .filter((name): name is string => Boolean(name));
        lines.append(this.row(line.name, money(line.amount), names.join(", ")));
      });

      if (receipt.people.length > 0) {
        card.append(
          this.personFilterView.build(
            { people: receipt.people, lines: receipt.lines, tax: receipt.tax ?? 0 },
            lines
          )
        );
      }
      card.append(lines);

      const totals = document.createElement("div");
      totals.className = "shared-totals";
      if (receipt.subtotal !== null) totals.append(this.row("Subtotal", money(receipt.subtotal)));
      if (receipt.tax !== null) totals.append(this.row("Tax", money(receipt.tax)));
      const total = this.row("Total", money(receipt.total ?? 0));
      total.classList.add("is-final");
      totals.append(total);
      card.append(totals);

      const split = this.renderSplit(receipt);
      const expiry = document.createElement("p");
      expiry.className = "shared-expiry";
      expiry.textContent = `This link expires ${new Date(receipt.expiresAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      })}.`;

      this.root.replaceChildren(heading, meta, card, ...(split ? [split] : []), expiry);
    }

    /** Who owes what, using the same arithmetic the app's Split tab does. */
    private renderSplit(receipt: Services.SharedReceipt): HTMLElement | null {
      const assignments = receipt.lines.flatMap((line) =>
        line.assignments.map((assignment) => ({
          id: `${line.id}:${assignment.personId}`,
          lineId: line.id,
          personId: assignment.personId,
          mode: assignment.mode as Domain.AssignmentMode,
          value: assignment.value
        }))
      );
      if (assignments.length === 0) return null;

      const summary = this.splitCalculatorService.calculate(
        receipt.people,
        receipt.lines.map((line) => ({ id: line.id, label: line.name, amount: line.amount, confidence: 1, ignored: false })),
        assignments,
        receipt.tax ?? 0
      );

      const section = document.createElement("section");
      section.className = "shared-card shared-split";
      const title = document.createElement("h2");
      title.textContent = "Who owes what";
      section.append(title);
      summary.totals.forEach((entry) => {
        section.append(this.row(entry.personName, this.currencyFormatService.format(entry.finalTotal)));
      });
      const unassigned = summary.receiptTotal - summary.assignedTotal;
      if (Math.abs(unassigned) >= 0.005) {
        section.append(this.row("Not assigned to anyone", this.currencyFormatService.format(unassigned)));
      }
      return section;
    }

    private row(label: string, amount: string, note = ""): HTMLElement {
      const row = document.createElement("div");
      row.className = "shared-row";
      const text = document.createElement("span");
      text.className = "shared-row-label";
      const name = document.createElement("span");
      name.textContent = label;
      text.append(name);
      if (note) {
        const detail = document.createElement("span");
        detail.className = "shared-row-note";
        detail.textContent = note;
        text.append(detail);
      }
      const value = document.createElement("b");
      value.textContent = amount;
      row.append(text, value);
      return row;
    }
  }
}
