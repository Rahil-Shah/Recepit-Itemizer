namespace ReceiptRing.UI {
  interface Stat {
    label: string;
    value: string;
    sub?: string;
    tone?: "up" | "down";
  }

  /**
   * The panels beside the main content on wide screens: the History
   * overview, the Split tab's recent receipts, and the budgeting view's month
   * at a glance. Everything is built with textContent -- store names are text
   * someone else printed.
   */
  export class InsightsView {
    constructor(private readonly currency: Services.CurrencyFormatService) {}

    renderHistoryOverview(container: HTMLElement, overview: Services.HistoryOverview): void {
      container.replaceChildren();
      if (overview.receiptCount === 0) {
        container.append(this.note("Save a receipt and its totals show up here."));
        return;
      }

      container.append(
        this.stats([
          {
            label: "This month",
            value: this.currency.format(overview.thisMonthSpent),
            sub: this.plural(overview.thisMonthCount, "receipt")
          },
          {
            label: "All time",
            value: this.currency.format(overview.totalSpent),
            sub: this.plural(overview.receiptCount, "receipt")
          },
          { label: "Average receipt", value: this.currency.format(overview.averageReceipt) },
          {
            label: "With photos",
            value: `${overview.withPhotos}`,
            sub: `of ${overview.receiptCount}`
          }
        ]),
        this.bars("Top stores", overview.topStores, (entry) => this.plural(entry.count, "visit")),
        this.bars("By category", overview.categories)
      );
    }

    renderMonthGlance(container: HTMLElement, glance: Services.MonthGlance | null, monthLabel: string): void {
      container.replaceChildren();
      if (!glance || glance.total <= 0) {
        container.append(this.note(`Nothing spent in ${monthLabel || "this month"} yet.`));
        return;
      }

      const change = glance.changeRatio;
      const changeStat: Stat =
        change === null
          ? { label: "vs last month", value: "—", sub: "No spending last month" }
          : {
              label: "vs last month",
              value: `${change > 0 ? "+" : change < 0 ? "−" : ""}${Math.round(Math.abs(change) * 100)}%`,
              sub: `${this.currency.format(glance.previousTotal ?? 0)} last month`,
              tone: change > 0 ? "up" : change < 0 ? "down" : undefined
            };

      container.append(
        this.stats([
          { label: "Spent", value: this.currency.format(glance.total), sub: monthLabel },
          changeStat,
          { label: "Per day", value: this.currency.format(glance.dailyAverage), sub: "on average" },
          {
            label: "Purchases",
            value: `${glance.receiptCount + glance.transactionCount}`,
            sub:
              glance.transactionCount > 0
                ? `${this.plural(glance.receiptCount, "receipt")} · ${glance.transactionCount} from your bank`
                : this.plural(glance.receiptCount, "receipt")
          }
        ])
      );

      const facts = document.createElement("dl");
      facts.className = "insight-facts";
      const fact = (term: string, name: string, amount: number): void => {
        const dt = document.createElement("dt");
        dt.textContent = term;
        const dd = document.createElement("dd");
        const label = document.createElement("span");
        label.className = "insight-fact-name";
        label.textContent = name;
        const value = document.createElement("span");
        value.className = "insight-fact-value";
        value.textContent = this.currency.format(amount);
        dd.append(label, value);
        facts.append(dt, dd);
      };
      if (glance.biggestCategory) fact("Biggest category", glance.biggestCategory.name, glance.biggestCategory.amount);
      if (glance.topMerchant) fact("Most spent at", glance.topMerchant.name, glance.topMerchant.amount);
      if (glance.largestPurchase) fact("Largest purchase", glance.largestPurchase.name, glance.largestPurchase.amount);
      if (facts.children.length > 0) container.append(facts);
    }

    renderRecentReceipts(
      container: HTMLElement,
      receipts: readonly Services.SavedReceiptSummary[],
      onOpen: (receipt: Services.SavedReceiptSummary) => void
    ): void {
      container.replaceChildren();
      if (receipts.length === 0) {
        container.append(this.note("Receipts you save land here, ready to reopen."));
        return;
      }

      const list = document.createElement("ul");
      list.className = "recent-list";
      for (const receipt of receipts) {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "recent-item";
        button.title = "Open in Split to edit";

        const icon = document.createElement("span");
        icon.className = "recent-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = (receipt.storeName || "?").trim().charAt(0).toUpperCase() || "?";

        const main = document.createElement("span");
        main.className = "recent-main";
        const name = document.createElement("span");
        name.className = "recent-name";
        name.textContent = receipt.storeName || "Untitled receipt";
        const meta = document.createElement("span");
        meta.className = "recent-meta";
        meta.textContent = `${new Date(receipt.createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric"
        })} · ${this.plural(receipt.lines.length, "item")}`;
        main.append(name, meta);

        const total = document.createElement("span");
        total.className = "recent-total";
        total.textContent = this.currency.format(Number(receipt.total ?? 0));

        button.append(icon, main, total);
        button.addEventListener("click", () => onOpen(receipt));
        item.append(button);
        list.append(item);
      }
      container.append(list);
    }

    private stats(stats: readonly Stat[]): HTMLElement {
      const grid = document.createElement("div");
      grid.className = "insight-stats";
      for (const stat of stats) {
        const cell = document.createElement("div");
        cell.className = "insight-stat";
        if (stat.tone) cell.classList.add(`is-${stat.tone}`);
        const label = document.createElement("span");
        label.className = "stat-label";
        label.textContent = stat.label;
        const value = document.createElement("span");
        value.className = "insight-value";
        value.textContent = stat.value;
        cell.append(label, value);
        if (stat.sub) {
          const sub = document.createElement("span");
          sub.className = "insight-sub";
          sub.textContent = stat.sub;
          cell.append(sub);
        }
        grid.append(cell);
      }
      return grid;
    }

    private bars(
      title: string,
      entries: readonly Services.NamedAmount[],
      describe?: (entry: Services.NamedAmount) => string
    ): HTMLElement {
      const section = document.createElement("section");
      section.className = "insight-section";
      const heading = document.createElement("h3");
      heading.className = "insight-heading";
      heading.textContent = title;
      section.append(heading);

      const max = Math.max(...entries.map((entry) => entry.amount), 0);
      const list = document.createElement("ul");
      list.className = "insight-bars";
      for (const entry of entries) {
        const row = document.createElement("li");
        const name = document.createElement("span");
        name.className = "insight-bar-name";
        name.textContent = entry.name;
        const value = document.createElement("span");
        value.className = "insight-bar-value";
        value.textContent = this.currency.format(entry.amount);
        const track = document.createElement("span");
        track.className = "insight-bar-track";
        const fill = document.createElement("span");
        fill.style.width = `${max > 0 ? Math.max(4, Math.round((entry.amount / max) * 100)) : 0}%`;
        track.append(fill);
        row.append(name, value, track);
        if (describe) {
          row.title = describe(entry);
        }
        list.append(row);
      }
      section.append(list);
      return section;
    }

    private note(text: string): HTMLElement {
      const note = document.createElement("p");
      note.className = "insight-note";
      note.textContent = text;
      return note;
    }

    private plural(count: number, noun: string): string {
      return `${count} ${noun}${count === 1 ? "" : "s"}`;
    }
  }
}
