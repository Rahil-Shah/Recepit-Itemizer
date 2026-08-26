namespace ReceiptRing.Services {
  export interface SaveReceiptPerson {
    clientId: string;
  }

  /** An identification as it travels to and from the server. */
  export interface StoredIdentification {
    resolvedName: string;
    brand?: string | null;
    size?: string | null;
    confidence: number;
    source: Domain.IdentificationSource;
    reasoning?: string | null;
    alternatives: Domain.IdentificationCandidate[];
    confirmed: boolean;
  }

  export interface SaveReceiptLine {
    clientId: string;
    label: string;
    amount: number;
    ignored: boolean;
    isFood?: boolean;
    itemCode?: string;
    // What the line was worked out to be, saved with it so a receipt reopened
    // from history reads the way it did on the day it was split.
    identification?: StoredIdentification | null;
  }

  export interface SaveReceiptAssignment {
    lineClientId: string;
    personClientId: string;
    mode: string;
    value: number;
  }

  export interface SaveReceiptPayload {
    storeName: string | null;
    category: string;
    subtotal: number | null;
    tax: number | null;
    total: number | null;
    people: SaveReceiptPerson[];
    lines: SaveReceiptLine[];
    assignments: SaveReceiptAssignment[];
    // The receipt photo as a base64 data URL, kept with the saved receipt.
    // Null when the receipt was typed or pasted rather than photographed.
    imageDataUrl: string | null;
  }

  export interface SavedReceiptLineAssignment {
    // Account-level person id, matching SavedReceiptSummary.people[].id.
    personId: string;
    personName: string;
    mode: string;
    value: number;
  }

  export interface SavedReceiptLineSummary {
    id: string;
    label: string;
    amount: number;
    ignored?: boolean;
    isFood?: boolean;
    itemCode?: string | null;
    identification?: StoredIdentification | null;
    assignments: SavedReceiptLineAssignment[];
  }

  /** The bank transaction a saved receipt is attached to, if any. */
  export interface LinkedTransactionSummary {
    id: string;
    description: string | null;
    date: string;
    amount: number;
  }

  export interface SavedReceiptSummary {
    id: string;
    storeName: string | null;
    category: string;
    subtotal: number | null;
    tax: number | null;
    total: number | null;
    createdAt: string;
    // Whether a photo was stored with this receipt. The image itself is loaded
    // on demand from imageUrl(), never inlined in the history payload.
    hasImage: boolean;
    linkedTransaction: LinkedTransactionSummary | null;
    people: { id: string; name: string; isSelf?: boolean }[];
    lines: SavedReceiptLineSummary[];
  }

  export interface FoodSummaryItem {
    lineId: string;
    label: string;
    // The owner's share of this line -- what actually counts toward their
    // budget. `fullAmount` is what the line cost before it was split, so a
    // shared item can show both.
    amount: number;
    fullAmount: number;
    shared: boolean;
    sharedWith: string[];
  }

  /** One receipt's worth of food the owner paid for, with the items behind it. */
  export interface FoodSummaryReceipt {
    receiptId: string;
    storeName: string | null;
    date: string;
    itemTotal: number;
    // The share of the receipt's tax that was charged on the owner's food.
    taxTotal: number;
    total: number;
    items: FoodSummaryItem[];
  }

  export interface FoodSummaryTransaction {
    transactionId: string;
    description: string | null;
    amount: number;
    date: string;
  }

  export interface FoodSummary {
    foodTotal: number;
    // Grouped per receipt: the budgeting list shows one row per shop, with the
    // individual items behind a disclosure.
    foodReceipts: FoodSummaryReceipt[];
    // Whole bank transactions flagged as food in the budgeting view.
    foodTransactions: FoodSummaryTransaction[];
  }

  export class ReceiptApiService {
    // The photo lives behind the session cookie, so it is fetched from the API
    // like any other request rather than linked from a public path.
    imageUrl(receiptId: string): string {
      return `/api/receipts/${encodeURIComponent(receiptId)}/image`;
    }

    async save(payload: SaveReceiptPayload): Promise<SavedReceiptSummary> {
      const response = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(`Save failed (${response.status}): ${message}`);
      }
      return (await response.json()) as SavedReceiptSummary;
    }

    async list(): Promise<SavedReceiptSummary[]> {
      const response = await fetch("/api/receipts");
      if (!response.ok) {
        throw new Error(`Could not load history (${response.status}).`);
      }
      return (await response.json()) as SavedReceiptSummary[];
    }

    async remove(id: string): Promise<void> {
      const response = await fetch(`/api/receipts/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(`Delete failed (${response.status}): ${message}`);
      }
    }

    async updateLineFood(receiptId: string, lineId: string, isFood: boolean): Promise<void> {
      const response = await fetch(`/api/receipts/${encodeURIComponent(receiptId)}/lines/${encodeURIComponent(lineId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFood })
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(`Update failed (${response.status}): ${message}`);
      }
    }

    async getFoodSummary(month?: string): Promise<FoodSummary> {
      const url = month
        ? `/api/receipts/food-summary?month=${encodeURIComponent(month)}`
        : "/api/receipts/food-summary";
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Could not load food summary (${response.status}).`);
      }
      return (await response.json()) as FoodSummary;
    }

    async linkTransactionToReceipt(receiptId: string, bankTransactionId: string): Promise<void> {
      const response = await fetch(`/api/receipts/${encodeURIComponent(receiptId)}/link-transaction`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankTransactionId })
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(`Link failed (${response.status}): ${message}`);
      }
    }

    async unlinkTransactionFromReceipt(receiptId: string): Promise<void> {
      const response = await fetch(`/api/receipts/${encodeURIComponent(receiptId)}/link-transaction`, {
        method: "DELETE"
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(`Unlink failed (${response.status}): ${message}`);
      }
    }
  }
}
