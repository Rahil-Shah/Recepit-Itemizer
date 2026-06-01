namespace ReceiptRing.Services {
  export class CurrencyFormatService {
    private readonly formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    });

    format(value: number): string {
      return this.formatter.format(Number(value) || 0);
    }
  }
}
