namespace ReceiptRing.UI {
  const SVG_NS = "http://www.w3.org/2000/svg";

  // Match .loading-overlay in styles.css: it waits this long before fading
  // in, and takes this long to fade out.
  const APPEAR_DELAY_MS = 160;
  const LEAVE_MS = 200;

  // The receipt slip and its three printed lines, in the mark's 48-unit box.
  const SLIP_PATH = "M19.5 14h9v17.5l-1.5-1.2-1.5 1.2-1.5-1.2-1.5 1.2-1.5-1.2-1.5 1.2z";
  const LINE_PATHS = ["M21.5 18.5h5", "M21.5 22h5", "M21.5 25.5h3"];

  export type LoaderSize = "sm" | "md" | "lg";

  export interface LoaderOptions {
    /** What is happening, under the mark. Announced to screen readers. */
    label?: string;
    /** A quieter second line under the label. */
    hint?: string;
    size?: LoaderSize;
  }

  function svg<K extends keyof SVGElementTagNameMap>(
    tag: K,
    attributes: Record<string, string>
  ): SVGElementTagNameMap[K] {
    const element = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) {
      element.setAttribute(name, value);
    }
    return element;
  }

  /**
   * The loader's drawing: the brand mark in motion. The spending ring fills
   * and turns round a moss disc while the receipt slip in the middle prints
   * its lines, one after another. The animation itself lives in styles.css
   * (.loader-*). index.html's boot mark carries a copy of this drawing,
   * because it has to show before this script has run.
   */
  export function buildLoaderMark(): SVGSVGElement {
    const mark = svg("svg", {
      class: "loader-mark",
      viewBox: "0 0 48 48",
      "aria-hidden": "true",
      focusable: "false"
    });
    mark.append(
      svg("circle", { class: "loader-track", cx: "24", cy: "24", r: "21" }),
      svg("circle", { class: "loader-arc", cx: "24", cy: "24", r: "21", pathLength: "100" }),
      svg("circle", { class: "loader-disc", cx: "24", cy: "24", r: "15.5" }),
      svg("path", { class: "loader-slip", d: SLIP_PATH }),
      ...LINE_PATHS.map((d) => svg("path", { class: "loader-line", d, pathLength: "1" }))
    );
    return mark;
  }

  /** A loader: the mark, with what is loading written under it. */
  export function createLoader({ label, hint, size = "md" }: LoaderOptions = {}): HTMLElement {
    const loader = document.createElement("span");
    loader.className = `loader loader-${size}`;
    loader.append(buildLoaderMark());

    if (label) {
      const text = document.createElement("span");
      text.className = "loader-label";
      text.textContent = label;
      loader.append(text);
    }
    if (hint) {
      const note = document.createElement("span");
      note.className = "loader-hint";
      note.textContent = hint;
      loader.append(note);
    }
    return loader;
  }

  /**
   * Draw the mark into every `[data-loader]` placeholder under `root`: the
   * spinners that sit in the page's own markup, such as the one beside a
   * receipt scan's status line.
   */
  export function mountLoaders(root: ParentNode): void {
    root.querySelectorAll<HTMLElement>("[data-loader]").forEach((placeholder) => {
      if (!placeholder.querySelector(".loader-mark")) {
        placeholder.append(buildLoaderMark());
      }
    });
  }

  /**
   * A button that has started something: disabled so it cannot be pressed
   * twice, with the ring turning in front of its label until it is done.
   */
  export function setBusy(button: HTMLButtonElement, busy: boolean): void {
    button.disabled = busy;
    button.classList.toggle("is-busy", busy);
    const spinner = button.querySelector(":scope > .loader");
    if (busy) {
      button.setAttribute("aria-busy", "true");
      if (!spinner) button.prepend(createLoader({ size: "sm" }));
    } else {
      button.removeAttribute("aria-busy");
      spinner?.remove();
    }
  }

  interface ActiveOverlay {
    count: number;
    overlay: HTMLElement;
    label: HTMLElement;
    hint: HTMLElement;
    shownAt: number;
  }

  /**
   * Covers a container with the loader while something loads into it.
   *
   * Loads overlap -- the budgeting view refreshes every panel at once, and
   * the education panel again when the month changes -- so a container keeps
   * one overlay and a count of the loads holding it, and the overlay leaves
   * only when the last of them finishes. It fades in after a beat (see
   * .loading-overlay), so a load that is over at once never flashes a loader.
   */
  export class LoadingOverlays {
    private readonly active = new WeakMap<HTMLElement, ActiveOverlay>();

    /**
     * Start covering `container`. Returns the function that ends this load;
     * calling it more than once is harmless.
     */
    show(container: HTMLElement, label: string, hint?: string): () => void {
      const existing = this.active.get(container);
      if (existing) {
        existing.count += 1;
        // The newest load says what is happening now.
        existing.label.textContent = label;
        existing.hint.textContent = hint ?? "";
      } else {
        // Label and hint are both always there, so a later load can reword
        // them; an empty hint is hidden by the stylesheet.
        const loader = createLoader();
        const labelText = document.createElement("span");
        labelText.className = "loader-label";
        labelText.textContent = label;
        const hintText = document.createElement("span");
        hintText.className = "loader-hint";
        hintText.textContent = hint ?? "";
        loader.append(labelText, hintText);

        const overlay = document.createElement("div");
        overlay.className = "loading-overlay";
        overlay.setAttribute("role", "status");
        overlay.append(loader);

        container.classList.add("is-loading");
        container.setAttribute("aria-busy", "true");
        container.append(overlay);
        this.active.set(container, { count: 1, overlay, label: labelText, hint: hintText, shownAt: Date.now() });
      }

      let ended = false;
      return () => {
        if (ended) return;
        ended = true;
        this.release(container);
      };
    }

    isLoading(container: HTMLElement): boolean {
      return this.active.has(container);
    }

    private release(container: HTMLElement): void {
      const entry = this.active.get(container);
      if (!entry) return;
      entry.count -= 1;
      if (entry.count > 0) return;

      this.active.delete(container);
      container.classList.remove("is-loading");
      container.removeAttribute("aria-busy");
      // Still waiting to fade in: it was never seen, so it goes at once. A
      // fade-out would start from full opacity and flash it after all.
      if (Date.now() - entry.shownAt < APPEAR_DELAY_MS) {
        entry.overlay.remove();
        return;
      }
      entry.overlay.classList.add("is-leaving");
      window.setTimeout(() => entry.overlay.remove(), LEAVE_MS);
    }
  }
}
