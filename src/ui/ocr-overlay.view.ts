namespace ReceiptRing.UI {
  export interface OcrOverlayHandlers {
    onWordUpdate(wordId: string, text: string): void;
    onLineSelect(lineId: string): void;
  }

  export class OcrOverlayView {
    render(
      container: HTMLElement,
      document: Domain.OcrDocument | null,
      handlers: OcrOverlayHandlers
    ): void {
      container.innerHTML = "";
      if (!document) return;

      document.lines.forEach((line) => {
        const lineElement = this.createLineElement(line, document, handlers);
        container.append(lineElement);

        line.words.forEach((word) => {
          container.append(this.createWordElement(word, line, document, handlers));
        });
      });
    }

    setVisible(container: HTMLElement, isVisible: boolean): void {
      container.classList.toggle("is-hidden", !isVisible);
    }

    highlightLine(container: HTMLElement, lineId: string): void {
      container.querySelectorAll("[data-ocr-line-id]").forEach((element) => {
        element.classList.toggle("is-selected", element.getAttribute("data-ocr-line-id") === lineId);
      });
    }

    highlightLines(container: HTMLElement, lineIds: ReadonlySet<string>): void {
      container.querySelectorAll("[data-ocr-line-id]").forEach((element) => {
        const lineId = element.getAttribute("data-ocr-line-id");
        element.classList.toggle("is-selected", Boolean(lineId && lineIds.has(lineId)));
      });
    }

    private createLineElement(
      line: Domain.OcrLine,
      document: Domain.OcrDocument,
      handlers: OcrOverlayHandlers
    ): HTMLElement {
      const box = this.getLineBox(line);
      const element = documentFragmentElement("button");
      element.type = "button";
      element.className = `ocr-line-box ${this.getConfidenceClass(line.confidence)}`;
      element.title = `Line confidence: ${Math.round(line.confidence)}%`;
      element.setAttribute("data-ocr-line-id", line.id);
      this.positionElement(element, box, document);
      element.addEventListener("click", () => handlers.onLineSelect(line.id));
      return element;
    }

    private createWordElement(
      word: Domain.OcrWord,
      line: Domain.OcrLine,
      document: Domain.OcrDocument,
      handlers: OcrOverlayHandlers
    ): HTMLElement {
      const element = documentFragmentElement("button");
      element.type = "button";
      element.className = `ocr-word-box ${this.getConfidenceClass(word.confidence)}`;
      element.textContent = word.text;
      element.title = `${word.text} (${Math.round(word.confidence)}%)`;
      element.setAttribute("data-ocr-line-id", line.id);
      element.setAttribute("data-ocr-word-id", word.id);
      this.positionElement(element, word, document);
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        handlers.onLineSelect(line.id);
        this.editWord(element, word, handlers);
      });
      return element;
    }

    private editWord(element: HTMLElement, word: Domain.OcrWord, handlers: OcrOverlayHandlers): void {
      const input = document.createElement("input");
      input.className = "ocr-word-editor";
      input.value = word.text;
      element.replaceChildren(input);
      input.focus();
      input.select();

      const save = (): void => {
        const nextText = input.value.trim();
        if (nextText && nextText !== word.text) {
          handlers.onWordUpdate(word.id, nextText);
        } else {
          element.textContent = word.text;
        }
      };

      input.addEventListener("change", save);
      input.addEventListener("blur", save, { once: true });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") input.blur();
        if (event.key === "Escape") {
          element.textContent = word.text;
        }
      });
    }

    private getLineBox(line: Domain.OcrLine): { x: number; y: number; width: number; height: number } {
      const minX = Math.min(...line.words.map((word) => word.x));
      const minY = Math.min(...line.words.map((word) => word.y));
      const maxX = Math.max(...line.words.map((word) => word.x + word.width));
      const maxY = Math.max(...line.words.map((word) => word.y + word.height));

      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      };
    }

    private positionElement(
      element: HTMLElement,
      box: { x: number; y: number; width: number; height: number },
      document: Domain.OcrDocument
    ): void {
      element.style.left = `${(box.x / document.imageWidth) * 100}%`;
      element.style.top = `${(box.y / document.imageHeight) * 100}%`;
      element.style.width = `${(box.width / document.imageWidth) * 100}%`;
      element.style.height = `${(box.height / document.imageHeight) * 100}%`;
    }

    private getConfidenceClass(confidence: number): string {
      if (confidence >= 95) return "is-high";
      if (confidence >= 80) return "is-medium";
      return "is-low";
    }
  }

  function documentFragmentElement(tagName: "button"): HTMLButtonElement {
    return document.createElement(tagName);
  }
}
