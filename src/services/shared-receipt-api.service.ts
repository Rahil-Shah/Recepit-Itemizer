namespace ReceiptRing.Services {
  export interface SharedReceiptAssignment {
    personId: string;
    mode: string;
    value: number;
  }

  export interface SharedReceiptLine {
    id: string;
    name: string;
    amount: number;
    assignments: SharedReceiptAssignment[];
  }

  /** A receipt as a share link shows it (see server/receipt-share.mjs). */
  export interface SharedReceipt {
    storeName: string | null;
    category: string;
    subtotal: number | null;
    tax: number | null;
    total: number | null;
    createdAt: string;
    updatedAt: string;
    canEdit: boolean;
    expiresAt: string;
    people: { id: string; name: string }[];
    lines: SharedReceiptLine[];
  }

  export class SharedReceiptApiService {
    private url(token: string): string {
      return `/api/shared-receipts/${encodeURIComponent(token)}`;
    }

    /** Null when the link has expired or never existed. */
    async get(token: string): Promise<SharedReceipt | null> {
      const response = await fetch(this.url(token));
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Could not load this receipt (${response.status}).`);
      return (await response.json()) as SharedReceipt;
    }
  }
}
