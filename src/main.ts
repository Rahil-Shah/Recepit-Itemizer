namespace ReceiptRing {
  const categories = Config.CATEGORIES;
  const idService = new Services.IdService();
  const currencyFormatService = new Services.CurrencyFormatService();
  const categoryRuleStorageService = new Services.CategoryRuleStorageService("receipt-ring-category-rules");
  const categorizationService = new Services.CategorizationService(categories, categoryRuleStorageService);
  const parserService = new Services.ReceiptParserService(categorizationService, idService);
  const storageService = new Services.StorageService("receipt-ring-items");
  const splitCalculatorService = new Services.SplitCalculatorService();
  const imagePreviewService = new Services.ImagePreviewService();
  const geminiService = new Services.GeminiService();
  const receiptApiService = new Services.ReceiptApiService();
  const authApiService = new Services.AuthApiService();
  const elements = new UI.DomRegistryFactory().create();
  const categoryPromptView = new UI.CategoryPromptView(categories, elements);
  const splitWorkspaceView = new UI.SplitWorkspaceView(currencyFormatService);
  const authView = new UI.AuthView(elements, authApiService);

  const controller = new App.AppController(
    elements,
    parserService,
    categorizationService,
    categoryRuleStorageService,
    storageService,
    currencyFormatService,
    imagePreviewService,
    geminiService,
    categoryPromptView,
    splitWorkspaceView,
    splitCalculatorService,
    idService,
    receiptApiService
  );

  // Gate the app behind authentication: nothing starts until a session exists.
  let started = false;
  const startApp = (): void => {
    if (started) return;
    started = true;
    controller.start();
  };

  authView.init();
  authView.onAuthenticated = () => {
    authView.hide();
    startApp();
  };
  elements.logoutButton.addEventListener("click", () => {
    void authApiService.logout().finally(() => window.location.reload());
  });

  void (async () => {
    try {
      await authApiService.me();
      authView.hide();
      startApp();
    } catch {
      authView.show();
    }
  })();
}
