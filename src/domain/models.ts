namespace ReceiptRing.Domain {
  export type CategoryName =
    | "Groceries"
    | "Dining"
    | "Home"
    | "Health"
    | "Transport"
    | "Personal"
    | "Entertainment"
    | "Other";

  export interface Category {
    name: CategoryName;
    color: string;
    keywords: readonly string[];
  }

  export interface PurchaseItem {
    id: string;
    label: string;
    amount: number;
    category: CategoryName;
  }

  export type CategoryTotals = Record<CategoryName, number>;
}
