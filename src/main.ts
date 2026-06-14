namespace ReceiptRing {
  const categories = Config.CATEGORIES;
  const idService = new Services.IdService();
  const currencyFormatService = new Services.CurrencyFormatService();
  const categoryRuleStorageService = new Services.CategoryRuleStorageService("receipt-ring-category-rules");
  const categorizationService = new Services.CategorizationService(categories, categoryRuleStorageService);
  const parserService = new Services.ReceiptParserService(categorizationService, idService);
  const storageService = new Services.StorageService("receipt-ring-items");
  const summaryService = new Services.SpendingSummaryService(categories);
  const splitCalculatorService = new Services.SplitCalculatorService();
  const imagePreviewService = new Services.ImagePreviewService();
  const receiptOcrService = new Services.ReceiptOcrService();
  const geminiService = new Services.GeminiService();
  const ringView = new UI.CategoryRingView(categories);
  const categorySummaryView = new UI.CategorySummaryView(categories, currencyFormatService, ringView);
  const itemListView = new UI.ItemListView(categories);
  const elements = new UI.DomRegistryFactory().create();
  const categoryPromptView = new UI.CategoryPromptView(categories, elements);
  const ocrOverlayView = new UI.OcrOverlayView();
  const diagnosticsView = new UI.DiagnosticsView();
  const splitWorkspaceView = new UI.SplitWorkspaceView(currencyFormatService);

  new App.AppController(
    elements,
    parserService,
    categorizationService,
    categoryRuleStorageService,
    storageService,
    summaryService,
    currencyFormatService,
    imagePreviewService,
    receiptOcrService,
    geminiService,
    itemListView,
    ringView,
    categorySummaryView,
    categoryPromptView,
    ocrOverlayView,
    diagnosticsView,
    splitWorkspaceView,
    splitCalculatorService,
    idService
  ).start();
}
