namespace ReceiptRing.Services {
  export interface AiCategorizationService {
    categorize(items: readonly Domain.PurchaseItem[]): Promise<readonly Domain.PurchaseItem[]>;
  }

  export class NoopAiCategorizationService implements AiCategorizationService {
    async categorize(items: readonly Domain.PurchaseItem[]): Promise<readonly Domain.PurchaseItem[]> {
      return items;
    }
  }
}
