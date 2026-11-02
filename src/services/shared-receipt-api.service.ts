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

  export interface SharedReceiptEdit {
    updatedAt: string;
    storeName: string | null;
    tax: number | null;
    // A line with no id is a new one; a line left out is removed.
    lines: { id?: string; label: string; amount: number; assignments: SharedReceiptAssignment[] }[];
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

    /** The receipt as saved. Throws with the server's reason when it refuses. */
    async save(token: string, edit: SharedReceiptEdit): Promise<SharedReceipt> {
      const response = await fetch(this.url(token), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edit)
      });
      const body = (await response.json().catch(() => ({}))) as SharedReceipt & { error?: string };
      if (!response.ok) throw new Error(body.error || `Could not save (${response.status}).`);
      return body;
    }
  }
}
