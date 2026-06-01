namespace ReceiptRing.Services {
  export class CategorizationService {
    constructor(private readonly categories: readonly Domain.Category[]) {}

    assignCategory(label: string): Domain.CategoryName {
      const normalizedLabel = label.toLowerCase();
      const category = this.categories.find((candidate) =>
        candidate.keywords.some((keyword) => normalizedLabel.includes(keyword))
      );

      return category?.name ?? "Other";
    }
  }
}
