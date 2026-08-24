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
    isFood?: boolean;
  }

  /**
   * How a receipt line's real product name was arrived at, cheapest first.
   *
   * "user-confirmed" and "saved-alias" are the same knowledge at different
   * ages: the first is a correction made on this receipt, the second is that
   * correction coming back on a later one. Keeping them apart lets the UI say
   * "you told me this" without claiming the user did it just now.
   */
  export type IdentificationSource =
    | "user-confirmed"
    | "saved-alias"
    | "dictionary"
    | "ai"
    | "unresolved";

  /** A runner-up name, offered when the winning guess is not obviously right. */
  export interface IdentificationCandidate {
    name: string;
    confidence: number;
  }

  /**
   * What a receipt line actually was. Receipts print shorthand -- "GV SHRD
   * MOZZ 8Z" -- and an itemised split is hard to check when nobody can tell
   * which line was the cheese. This is the expansion, plus how much to trust
   * it and where it came from.
   *
   * Held apart from ReceiptLine rather than folded into it: a line is what the
   * receipt says, and this is what we worked out afterwards. They are written
   * at different times, by different code, and only one of them survives if
   * the receipt is re-parsed.
   */
  export interface ItemIdentification {
    lineId: string;
    // The label exactly as the receipt printed it, kept so the detail view can
    // show what was expanded rather than only the expansion.
    rawLabel: string;
    itemCode?: string;
    resolvedName: string;
    brand?: string;
    size?: string;
    // 0..1. Never trust an upstream number here without clamping it -- the AI
    // tier reports its own confidence and will happily return 1.4.
    confidence: number;
    source: IdentificationSource;
    // One short line on why, shown in the detail view. Absent for the tiers
    // that have nothing interesting to say.
    reasoning?: string;
    alternatives: IdentificationCandidate[];
    // True once a human has agreed with it, which is what promotes an
    // identification into a saved alias.
    confirmed: boolean;
  }

  export interface SplitPerson {
    id: string;
    name: string;
    isSelf?: boolean;
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
    // What the food-flagged lines cost this person, including the share of
    // their tax that was charged on those items. Bounded by finalTotal, not by
    // itemTotal -- an all-food receipt puts every cent of their tax in here.
    foodTotal: number;
    allocatedTax: number;
    finalTotal: number;
  }

  export interface SplitSummary {
    totals: PersonSplitTotal[];
    // Money on assigned lines that custom amounts or percentages left on
    // nobody's tab. Reported so it can't go missing in silence.
    unallocated: number;
    // What the receipt asks for: every non-ignored line plus tax.
    receiptTotal: number;
    // What the split actually hands out. It falls short of receiptTotal by
    // `unallocated` plus everything on lines nobody was assigned to, so the
    // gap between the two is the wider number of the pair.
    assignedTotal: number;
    isBalanced: boolean;
  }

  export interface RentEntry {
    id: string;
    year: number;
    month: number;
    amount: number;
    propertyName?: string;
    // Calendar date, "YYYY-MM-DD".
    date: string;
    hasPhoto?: boolean;
    // Set when the entry was logged from a bank transaction in the budgeting
    // view, so that row can show it is already counted as rent.
    bankTransactionId?: string | null;
  }
}
