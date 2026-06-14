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

  export type CategoryTotals = Record<CategoryName, number>;

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

  export interface OcrWord {
    id: string;
    text: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }

  export interface OcrLine {
    id: string;
    words: OcrWord[];
    confidence: number;
  }

  export interface OcrImageArtifact {
    label: string;
    dataUrl: string;
    width: number;
    height: number;
  }

  export interface ImageQualityReport {
    blurVariance: number;
    contrast: number;
    warnings: string[];
  }

  export interface ReceiptMetadata {
    storeName: string;
    date: string;
    time: string;
    receiptNumber: string;
    subtotal: number | null;
    tax: number | null;
    total: number | null;
  }

  export interface OcrDocument {
    provider: string;
    text: string;
    lines: OcrLine[];
    confidence: number;
    imageWidth: number;
    imageHeight: number;
    artifacts: OcrImageArtifact[];
    quality: ImageQualityReport;
  }

  export type ReceiptCategory = "Dining" | "Groceries" | "Entertainment" | "Travel" | "Other";

  export interface ReceiptLine {
    id: string;
    label: string;
    amount: number;
    confidence: number;
    ignored: boolean;
    ocrLineId?: string;
    bounds?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
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
