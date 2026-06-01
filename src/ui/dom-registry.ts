namespace ReceiptRing.UI {
  export interface DomRegistry {
    sampleButton: HTMLButtonElement;
    receiptImage: HTMLInputElement;
    dropzone: HTMLElement;
    receiptPreviewWrap: HTMLElement;
    receiptPreview: HTMLImageElement;
    clearImageButton: HTMLButtonElement;
    receiptText: HTMLTextAreaElement;
    parseButton: HTMLButtonElement;
    clearButton: HTMLButtonElement;
    addItemButton: HTMLButtonElement;
    itemsList: HTMLElement;
    emptyState: HTMLElement;
    itemCount: HTMLElement;
    receiptTotal: HTMLElement;
    ringTotal: HTMLElement;
    categoryRing: SVGSVGElement;
    categoryList: HTMLElement;
  }

  export class DomRegistryFactory {
    create(): DomRegistry {
      return {
        sampleButton: this.getElement("#sampleButton", HTMLButtonElement),
        receiptImage: this.getElement("#receiptImage", HTMLInputElement),
        dropzone: this.getElement("#dropzone", HTMLElement),
        receiptPreviewWrap: this.getElement("#receiptPreviewWrap", HTMLElement),
        receiptPreview: this.getElement("#receiptPreview", HTMLImageElement),
        clearImageButton: this.getElement("#clearImageButton", HTMLButtonElement),
        receiptText: this.getElement("#receiptText", HTMLTextAreaElement),
        parseButton: this.getElement("#parseButton", HTMLButtonElement),
        clearButton: this.getElement("#clearButton", HTMLButtonElement),
        addItemButton: this.getElement("#addItemButton", HTMLButtonElement),
        itemsList: this.getElement("#itemsList", HTMLElement),
        emptyState: this.getElement("#emptyState", HTMLElement),
        itemCount: this.getElement("#itemCount", HTMLElement),
        receiptTotal: this.getElement("#receiptTotal", HTMLElement),
        ringTotal: this.getElement("#ringTotal", HTMLElement),
        categoryRing: this.getElement("#categoryRing", SVGSVGElement),
        categoryList: this.getElement("#categoryList", HTMLElement)
      };
    }

    private getElement<T extends Element>(
      selector: string,
      constructorReference: new (...args: any[]) => T
    ): T {
      const element = document.querySelector(selector);
      if (!(element instanceof constructorReference)) {
        throw new Error(`Missing expected element: ${selector}`);
      }

      return element;
    }
  }
}
