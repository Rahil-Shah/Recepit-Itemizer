namespace ReceiptRing.UI {
  export class CategoryRingView {
    private readonly svgNamespace = "http://www.w3.org/2000/svg";
    private readonly center = 120;
    private readonly radius = 84;
    private readonly gapDegrees = 2.6;

    constructor(private readonly categories: readonly Domain.Category[]) {}

    render(container: SVGSVGElement, totals: Domain.CategoryTotals, grandTotal: number): void {
      container.innerHTML = "";
      container.append(this.createBackgroundCircle());

      if (grandTotal <= 0) return;

      let startAngle = -90;
      this.categories
        .filter((category) => totals[category.name] > 0)
        .forEach((category) => {
          const share = totals[category.name] / grandTotal;
          const sweep = Math.max(share * 360 - this.gapDegrees, 2);
          container.append(this.createSegment(category, startAngle, startAngle + sweep));
          startAngle += share * 360;
        });
    }

    setFocus(categoryName: Domain.CategoryName | null): void {
      document.querySelectorAll<SVGPathElement>(".ring-segment").forEach((segment) => {
        const isMuted = Boolean(categoryName) && segment.dataset.category !== categoryName;
        segment.classList.toggle("is-muted", isMuted);
      });
    }

    private createBackgroundCircle(): SVGCircleElement {
      const circle = document.createElementNS(this.svgNamespace, "circle");
      circle.setAttribute("class", "ring-bg");
      circle.setAttribute("cx", String(this.center));
      circle.setAttribute("cy", String(this.center));
      circle.setAttribute("r", String(this.radius));
      return circle;
    }

    private createSegment(category: Domain.Category, startAngle: number, endAngle: number): SVGPathElement {
      const path = document.createElementNS(this.svgNamespace, "path");
      path.setAttribute("class", "ring-segment");
      path.setAttribute("stroke", category.color);
      path.setAttribute("d", this.describeArc(startAngle, endAngle));
      path.dataset.category = category.name;
      path.addEventListener("mouseenter", () => this.setFocus(category.name));
      path.addEventListener("mouseleave", () => this.setFocus(null));
      return path;
    }

    private describeArc(startAngle: number, endAngle: number): string {
      const start = this.polarToCartesian(endAngle);
      const end = this.polarToCartesian(startAngle);
      const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

      return [
        "M",
        start.x,
        start.y,
        "A",
        this.radius,
        this.radius,
        0,
        largeArcFlag,
        0,
        end.x,
        end.y
      ].join(" ");
    }

    private polarToCartesian(angleInDegrees: number): { x: number; y: number } {
      const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;

      return {
        x: this.center + this.radius * Math.cos(angleInRadians),
        y: this.center + this.radius * Math.sin(angleInRadians)
      };
    }
  }
}
