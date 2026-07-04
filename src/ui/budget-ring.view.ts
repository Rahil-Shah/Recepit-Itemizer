namespace ReceiptRing.UI {
  const SVG_NS = "http://www.w3.org/2000/svg";

  export class BudgetRingView {
    constructor(private readonly currencyFormatService: Services.CurrencyFormatService) {}

    render(
      ringEl: HTMLElement,
      legendEl: HTMLElement,
      month: Services.MonthlySpend | null
    ): void {
      ringEl.replaceChildren();
      legendEl.replaceChildren();

      if (!month || month.total <= 0) {
        const empty = document.createElement("p");
        empty.className = "budget-ring-empty";
        empty.textContent = "No spending recorded for this month.";
        ringEl.append(empty);
        return;
      }

      ringEl.append(this.buildSvg(month));
      legendEl.append(this.buildLegend(month));
    }

    private buildSvg(month: Services.MonthlySpend): SVGElement {
      const size = 220;
      const stroke = 30;
      const radius = (size - stroke) / 2;
      const cx = size / 2;
      const cy = size / 2;
      const circumference = 2 * Math.PI * radius;

      const svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
      svg.setAttribute("width", String(size));
      svg.setAttribute("height", String(size));
      svg.setAttribute("class", "budget-ring-svg");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", `Spending by category, total ${this.currencyFormatService.format(month.total)}`);

      const track = document.createElementNS(SVG_NS, "circle");
      track.setAttribute("cx", String(cx));
      track.setAttribute("cy", String(cy));
      track.setAttribute("r", String(radius));
      track.setAttribute("fill", "none");
      track.setAttribute("stroke", "rgba(0,0,0,0.06)");
      track.setAttribute("stroke-width", String(stroke));
      svg.append(track);

      let offset = 0;
      for (const slice of month.categories) {
        const fraction = slice.amount / month.total;
        const segment = document.createElementNS(SVG_NS, "circle");
        segment.setAttribute("cx", String(cx));
        segment.setAttribute("cy", String(cy));
        segment.setAttribute("r", String(radius));
        segment.setAttribute("fill", "none");
        segment.setAttribute("stroke", slice.color);
        segment.setAttribute("stroke-width", String(stroke));
        segment.setAttribute(
          "stroke-dasharray",
          `${fraction * circumference} ${circumference}`
        );
        segment.setAttribute("stroke-dashoffset", String(-offset * circumference));
        segment.setAttribute("transform", `rotate(-90 ${cx} ${cy})`);
        const title = document.createElementNS(SVG_NS, "title");
        title.textContent = `${slice.category}: ${this.currencyFormatService.format(slice.amount)}`;
        segment.append(title);
        svg.append(segment);
        offset += fraction;
      }

      const totalText = document.createElementNS(SVG_NS, "text");
      totalText.setAttribute("x", String(cx));
      totalText.setAttribute("y", String(cy - 2));
      totalText.setAttribute("text-anchor", "middle");
      totalText.setAttribute("class", "budget-ring-total");
      totalText.textContent = this.currencyFormatService.format(month.total);
      svg.append(totalText);

      const caption = document.createElementNS(SVG_NS, "text");
      caption.setAttribute("x", String(cx));
      caption.setAttribute("y", String(cy + 18));
      caption.setAttribute("text-anchor", "middle");
      caption.setAttribute("class", "budget-ring-caption");
      caption.textContent = "spent";
      svg.append(caption);

      return svg;
    }

    private buildLegend(month: Services.MonthlySpend): HTMLElement {
      const list = document.createElement("ul");
      list.className = "budget-legend-list";

      for (const slice of month.categories) {
        const item = document.createElement("li");
        item.className = "budget-legend-item";

        const swatch = document.createElement("span");
        swatch.className = "budget-legend-swatch";
        swatch.style.backgroundColor = slice.color;

        const label = document.createElement("span");
        label.className = "budget-legend-label";
        label.textContent = slice.category;

        const value = document.createElement("span");
        value.className = "budget-legend-value";
        const percent = Math.round((slice.amount / month.total) * 100);
        value.textContent = `${this.currencyFormatService.format(slice.amount)} · ${percent}%`;

        item.append(swatch, label, value);
        list.append(item);
      }

      return list;
    }
  }
}
