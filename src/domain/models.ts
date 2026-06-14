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
    categorizationConfidence: number;
    categorizationSource: CategorizationSource;
    needsCategoryReview: boolean;
  }

  export type CategorizationSource = "saved-rule" | "keyword-match" | "uncertain";

  export interface CategorizationResult {
    category: CategoryName;
    confidence: number;
    source: CategorizationSource;
    matchedTerms: readonly string[];
    shouldPrompt: boolean;
  }

  export interface StoredCategoryRule {
    normalizedLabel: string;
    category: CategoryName;
    createdAt: string;
  }

  export type ReceiptCategory = "Dining" | "Groceries" | "Entertainment" | "Travel" | "Other";

  export interface ReceiptLine {
    id: string;
    label: string;
    amount: number;
    confidence: number;
    ignored: boolean;
  }

  export interface SplitPerson {
    id: string;
    name: string;
  }

  export type AssignmentMode = "equal" | "percentage" | "amount";

  export interface LineAssignment {
    id: string;
    lineId: string;
    personId: string;
    mode: AssignmentMode;
    value: number;
  }

  export interface PersonSplitTotal {
    personId: string;
    personName: string;
    itemTotal: number;
    allocatedTax: number;
    finalTotal: number;
  }
}
