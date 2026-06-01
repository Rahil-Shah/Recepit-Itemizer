namespace ReceiptRing.Services {
  export class IdService {
    create(): string {
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }
}
