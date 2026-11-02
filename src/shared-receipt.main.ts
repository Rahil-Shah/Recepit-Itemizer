// The public page behind a share link (public/shared.html). Its own small bundle,
// so someone opening a link never downloads the app.
namespace ReceiptRing {
  const root = document.getElementById("sharedReceipt");
  if (root) {
    const currencyFormatService = new Services.CurrencyFormatService();
    const splitCalculatorService = new Services.SplitCalculatorService();
    const token = window.location.pathname.split("/").pop() ?? "";
    void new UI.SharedReceiptView(
      root,
      token,
      new Services.SharedReceiptApiService(),
      currencyFormatService,
      splitCalculatorService,
      new UI.PersonFilterView(currencyFormatService, splitCalculatorService)
    ).load();
  }
}
