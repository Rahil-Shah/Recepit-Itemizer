namespace ReceiptRing.Services {
  export class StorageService {
    constructor(private readonly storageKey: string) {}

    load(): Domain.PurchaseItem[] {
      try {
        const rawValue = localStorage.getItem(this.storageKey);
        return rawValue ? (JSON.parse(rawValue) as Domain.PurchaseItem[]) : [];
      } catch {
        return [];
      }
    }

    save(items: readonly Domain.PurchaseItem[]): void {
      localStorage.setItem(this.storageKey, JSON.stringify(items));
    }
  }
}
