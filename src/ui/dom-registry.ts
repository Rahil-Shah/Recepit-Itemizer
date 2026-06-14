namespace ReceiptRing.UI {
  export interface DomRegistry {
    sampleButton: HTMLButtonElement;
    receiptImage: HTMLInputElement;
    dropzone: HTMLElement;
    receiptPreviewWrap: HTMLElement;
    receiptPreview: HTMLImageElement;
    ocrOverlay: HTMLElement;
    ocrReviewTools: HTMLElement;
    ocrOverlayToggle: HTMLInputElement;
    diagnosticsToggle: HTMLButtonElement;
    diagnosticsPanel: HTMLElement;
    diagnosticsGrid: HTMLElement;
    diagnosticsText: HTMLElement;
    diagnosticsSummary: HTMLElement;
    clearImageButton: HTMLButtonElement;
    ocrStatus: HTMLElement;
    ocrStatusText: HTMLElement;
    ocrProgressBar: HTMLElement;
    receiptText: HTMLTextAreaElement;
    openCameraButton: HTMLButtonElement;
    cameraModal: HTMLElement;
    cameraVideo: HTMLVideoElement;
    cameraCanvas: HTMLCanvasElement;
    closeCameraButton: HTMLButtonElement;
    capturePhotoButton: HTMLButtonElement;
    parseButton: HTMLButtonElement;
    clearButton: HTMLButtonElement;
    addItemButton: HTMLButtonElement;
    receiptLinesList: HTMLElement;
    emptyState: HTMLElement;
    unassignedCount: HTMLElement;
    receiptCategory: HTMLSelectElement;
    personNameInput: HTMLInputElement;
    addPersonButton: HTMLButtonElement;
    peopleList: HTMLElement;
    assignmentMode: HTMLSelectElement;
    assignmentValue: HTMLInputElement;
    assignLinesButton: HTMLButtonElement;
    taxInput: HTMLInputElement;
    splitTotalsList: HTMLElement;
    itemCount: HTMLElement;
    receiptTotal: HTMLElement;
    categoryPrompt: HTMLElement;
    categoryPromptItem: HTMLElement;
    categoryPromptSelect: HTMLSelectElement;
    categoryPromptRemember: HTMLInputElement;
    categoryPromptSkip: HTMLButtonElement;
    categoryPromptSave: HTMLButtonElement;
    settingsButton: HTMLButtonElement;
    settingsModal: HTMLElement;
    geminiApiKey: HTMLInputElement;
    geminiModel: HTMLSelectElement;
    closeSettingsButton: HTMLButtonElement;
    saveSettingsButton: HTMLButtonElement;
  }

  export class DomRegistryFactory {
    create(): DomRegistry {
      return {
        sampleButton: this.getElement("#sampleButton", HTMLButtonElement),
        receiptImage: this.getElement("#receiptImage", HTMLInputElement),
        dropzone: this.getElement("#dropzone", HTMLElement),
        receiptPreviewWrap: this.getElement("#receiptPreviewWrap", HTMLElement),
        receiptPreview: this.getElement("#receiptPreview", HTMLImageElement),
        ocrOverlay: this.getElement("#ocrOverlay", HTMLElement),
        ocrReviewTools: this.getElement("#ocrReviewTools", HTMLElement),
        ocrOverlayToggle: this.getElement("#ocrOverlayToggle", HTMLInputElement),
        diagnosticsToggle: this.getElement("#diagnosticsToggle", HTMLButtonElement),
        diagnosticsPanel: this.getElement("#diagnosticsPanel", HTMLElement),
        diagnosticsGrid: this.getElement("#diagnosticsGrid", HTMLElement),
        diagnosticsText: this.getElement("#diagnosticsText", HTMLElement),
        diagnosticsSummary: this.getElement("#diagnosticsSummary", HTMLElement),
        clearImageButton: this.getElement("#clearImageButton", HTMLButtonElement),
        ocrStatus: this.getElement("#ocrStatus", HTMLElement),
        ocrStatusText: this.getElement("#ocrStatusText", HTMLElement),
        ocrProgressBar: this.getElement("#ocrProgressBar", HTMLElement),
        receiptText: this.getElement("#receiptText", HTMLTextAreaElement),
        openCameraButton: this.getElement("#openCameraButton", HTMLButtonElement),
        cameraModal: this.getElement("#cameraModal", HTMLElement),
        cameraVideo: this.getElement("#cameraVideo", HTMLVideoElement),
        cameraCanvas: this.getElement("#cameraCanvas", HTMLCanvasElement),
        closeCameraButton: this.getElement("#closeCameraButton", HTMLButtonElement),
        capturePhotoButton: this.getElement("#capturePhotoButton", HTMLButtonElement),
        parseButton: this.getElement("#parseButton", HTMLButtonElement),
        clearButton: this.getElement("#clearButton", HTMLButtonElement),
        addItemButton: document.createElement("button"),
        receiptLinesList: this.getElement("#receiptLinesList", HTMLElement),
        emptyState: this.getElement("#emptyState", HTMLElement),
        unassignedCount: this.getElement("#unassignedCount", HTMLElement),
        receiptCategory: this.getElement("#receiptCategory", HTMLSelectElement),
        personNameInput: this.getElement("#personNameInput", HTMLInputElement),
        addPersonButton: this.getElement("#addPersonButton", HTMLButtonElement),
        peopleList: this.getElement("#peopleList", HTMLElement),
        assignmentMode: this.getElement("#assignmentMode", HTMLSelectElement),
        assignmentValue: this.getElement("#assignmentValue", HTMLInputElement),
        assignLinesButton: this.getElement("#assignLinesButton", HTMLButtonElement),
        taxInput: this.getElement("#taxInput", HTMLInputElement),
        splitTotalsList: this.getElement("#splitTotalsList", HTMLElement),
        itemCount: this.getElement("#itemCount", HTMLElement),
        receiptTotal: this.getElement("#receiptTotal", HTMLElement),
        categoryPrompt: this.getElement("#categoryPrompt", HTMLElement),
        categoryPromptItem: this.getElement("#categoryPromptItem", HTMLElement),
        categoryPromptSelect: this.getElement("#categoryPromptSelect", HTMLSelectElement),
        categoryPromptRemember: this.getElement("#categoryPromptRemember", HTMLInputElement),
        categoryPromptSkip: this.getElement("#categoryPromptSkip", HTMLButtonElement),
        categoryPromptSave: this.getElement("#categoryPromptSave", HTMLButtonElement),
        settingsButton: this.getElement("#settingsButton", HTMLButtonElement),
        settingsModal: this.getElement("#settingsModal", HTMLElement),
        geminiApiKey: this.getElement("#geminiApiKey", HTMLInputElement),
        geminiModel: this.getElement("#geminiModel", HTMLSelectElement),
        closeSettingsButton: this.getElement("#closeSettingsButton", HTMLButtonElement),
        saveSettingsButton: this.getElement("#saveSettingsButton", HTMLButtonElement)
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
