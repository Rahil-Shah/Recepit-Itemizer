namespace ReceiptRing.Services {
  export interface SaveReceiptPerson {
    clientId: string;
    name: string;
  }

  export interface SaveReceiptLine {
    clientId: string;
    label: string;
    amount: number;
    ignored: boolean;
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
  }

  export interface SavedReceiptLineAssignment {
    personName: string;
    mode: string;
    value: number;
  }

  export interface SavedReceiptLineSummary {
    label: string;
    amount: number;
    assignments: SavedReceiptLineAssignment[];
  }

  export interface SavedReceiptSummary {
    id: string;
    storeName: string | null;
    category: string;
    subtotal: number | null;
    tax: number | null;
    total: number | null;
    createdAt: string;
    people: { id: string; name: string }[];
    lines: SavedReceiptLineSummary[];
  }

  export class ReceiptApiService {
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
  }
}
