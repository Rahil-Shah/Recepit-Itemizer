namespace ReceiptRing.UI {
  export interface DomRegistry {
    sampleButton: HTMLButtonElement;
    receiptImage: HTMLInputElement;
    dropzone: HTMLElement;
    receiptPreviewWrap: HTMLElement;
    receiptPreview: HTMLImageElement;
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
    receiptLinesList: HTMLElement;
    emptyState: HTMLElement;
    unassignedCount: HTMLElement;
    storeNameInput: HTMLInputElement;
    receiptCategory: HTMLSelectElement;
    personNameInput: HTMLInputElement;
    addPersonButton: HTMLButtonElement;
    peopleList: HTMLElement;
    taxInput: HTMLInputElement;
    splitTotalsList: HTMLElement;
    saveReceiptButton: HTMLButtonElement;
    saveStatus: HTMLElement;
    itemCount: HTMLElement;
    receiptTotal: HTMLElement;
    tabButtons: HTMLButtonElement[];
    receiptsView: HTMLElement;
    historyView: HTMLElement;
    budgetingView: HTMLElement;
    historyList: HTMLElement;
    historyEmpty: HTMLElement;
    refreshHistoryButton: HTMLButtonElement;
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
    authOverlay: HTMLElement;
    authForm: HTMLFormElement;
    authTitle: HTMLElement;
    authNameField: HTMLElement;
    authName: HTMLInputElement;
    authEmail: HTMLInputElement;
    authPassword: HTMLInputElement;
    authSubmit: HTMLButtonElement;
    authError: HTMLElement;
    authSwitchText: HTMLElement;
    authToggle: HTMLButtonElement;
    logoutButton: HTMLButtonElement;
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
        receiptLinesList: this.getElement("#receiptLinesList", HTMLElement),
        emptyState: this.getElement("#emptyState", HTMLElement),
        unassignedCount: this.getElement("#unassignedCount", HTMLElement),
        storeNameInput: this.getElement("#storeNameInput", HTMLInputElement),
        receiptCategory: this.getElement("#receiptCategory", HTMLSelectElement),
        personNameInput: this.getElement("#personNameInput", HTMLInputElement),
        addPersonButton: this.getElement("#addPersonButton", HTMLButtonElement),
        peopleList: this.getElement("#peopleList", HTMLElement),
        taxInput: this.getElement("#taxInput", HTMLInputElement),
        splitTotalsList: this.getElement("#splitTotalsList", HTMLElement),
        saveReceiptButton: this.getElement("#saveReceiptButton", HTMLButtonElement),
        saveStatus: this.getElement("#saveStatus", HTMLElement),
        itemCount: this.getElement("#itemCount", HTMLElement),
        receiptTotal: this.getElement("#receiptTotal", HTMLElement),
        tabButtons: Array.from(document.querySelectorAll(".tab-button")).filter(
          (element): element is HTMLButtonElement => element instanceof HTMLButtonElement
        ),
        receiptsView: this.getElement("#receiptsView", HTMLElement),
        historyView: this.getElement("#historyView", HTMLElement),
        budgetingView: this.getElement("#budgetingView", HTMLElement),
        historyList: this.getElement("#historyList", HTMLElement),
        historyEmpty: this.getElement("#historyEmpty", HTMLElement),
        refreshHistoryButton: this.getElement("#refreshHistoryButton", HTMLButtonElement),
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
        saveSettingsButton: this.getElement("#saveSettingsButton", HTMLButtonElement),
        authOverlay: this.getElement("#authOverlay", HTMLElement),
        authForm: this.getElement("#authForm", HTMLFormElement),
        authTitle: this.getElement("#authTitle", HTMLElement),
        authNameField: this.getElement("#authNameField", HTMLElement),
        authName: this.getElement("#authName", HTMLInputElement),
        authEmail: this.getElement("#authEmail", HTMLInputElement),
        authPassword: this.getElement("#authPassword", HTMLInputElement),
        authSubmit: this.getElement("#authSubmit", HTMLButtonElement),
        authError: this.getElement("#authError", HTMLElement),
        authSwitchText: this.getElement("#authSwitchText", HTMLElement),
        authToggle: this.getElement("#authToggle", HTMLButtonElement),
        logoutButton: this.getElement("#logoutButton", HTMLButtonElement)
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
