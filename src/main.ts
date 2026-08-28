namespace ReceiptRing {
  const categories = Config.CATEGORIES;
  const idService = new Services.IdService();
  const currencyFormatService = new Services.CurrencyFormatService();
  const categoryRuleStorageService = new Services.CategoryRuleStorageService("receipt-ring-category-rules");
  const categorizationService = new Services.CategorizationService(categories, categoryRuleStorageService);
  const parserService = new Services.ReceiptParserService(categorizationService, idService);
  const storageService = new Services.StorageService("receipt-ring-items");
  const splitCalculatorService = new Services.SplitCalculatorService();
  const lineSelectionService = new Services.LineSelectionService();
  const imagePreviewService = new Services.ImagePreviewService();
  const receiptImageService = new Services.ReceiptImageService();
  const geminiService = new Services.GeminiService();
  const receiptApiService = new Services.ReceiptApiService();
  const authApiService = new Services.AuthApiService();
  const bankApiService = new Services.BankApiService();
  const peopleApiService = new Services.PeopleApiService();
  const spendingAggregatorService = new Services.SpendingAggregatorService(categories);
  const rentEntryApiService = new Services.RentEntryApiService();
  const notificationService = new Services.NotificationService();

  // Identification, cheapest tier first. The alias store is what makes the
  // second receipt from a shop mostly free, so it gets the API backend that
  // keeps corrections between sessions; the dictionary and the model sit
  // behind it in that order.
  const labelNormalizerService = new Services.LabelNormalizerService();
  const itemAliasStoreService = new Services.ItemAliasStoreService(
    labelNormalizerService,
    new Services.ItemAliasApiService()
  );
  const dictionaryResolverService = new Services.DictionaryResolverService(labelNormalizerService);
  const itemIdentityService = new Services.ItemIdentityService(
    itemAliasStoreService,
    dictionaryResolverService,
    new Services.ItemIdentityApiService()
  );
  const elements = new UI.DomRegistryFactory().create();
  const categoryPromptView = new UI.CategoryPromptView(categories, elements);
  const splitWorkspaceView = new UI.SplitWorkspaceView(currencyFormatService, receiptApiService);
  const budgetRingView = new UI.BudgetRingView(currencyFormatService);
  const monthlyTrendView = new UI.MonthlyTrendView(currencyFormatService);
  const rentEntriesView = new UI.RentEntriesView(currencyFormatService);
  const authView = new UI.AuthView(elements, authApiService);

  const controller = new App.AppController(
    elements,
    parserService,
    categorizationService,
    categoryRuleStorageService,
    storageService,
    currencyFormatService,
    imagePreviewService,
    receiptImageService,
    geminiService,
    categoryPromptView,
    splitWorkspaceView,
    splitCalculatorService,
    lineSelectionService,
    idService,
    receiptApiService,
    bankApiService,
    spendingAggregatorService,
    budgetRingView,
    monthlyTrendView,
    peopleApiService,
    rentEntryApiService,
    rentEntriesView,
    notificationService,
    itemIdentityService,
    itemAliasStoreService
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
