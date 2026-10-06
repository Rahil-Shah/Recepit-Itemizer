// Ambient declaration for the Plaid Link widget loaded from cdn.plaid.com.
interface PlaidLinkAccount {
  id: string;
  name?: string;
  mask?: string;
  type?: string;
  subtype?: string;
}

interface PlaidLinkMetadata {
  institution?: { name?: string; institution_id?: string } | null;
  accounts?: PlaidLinkAccount[];
  link_session_id?: string;
}

interface PlaidLinkHandler {
  open(): void;
  exit(): void;
  destroy(): void;
}

interface PlaidLinkOptions {
  token: string;
  onSuccess: (publicToken: string, metadata: PlaidLinkMetadata) => void;
  onExit?: (error: unknown, metadata: PlaidLinkMetadata) => void;
  onEvent?: (eventName: string, metadata: unknown) => void;
}

declare const Plaid: {
  create(options: PlaidLinkOptions): PlaidLinkHandler;
};

namespace ReceiptRing.Services {
  export interface BankTransaction {
    id: string;
    date: string;
    description: string | null;
    amount: number;
    category: string | null;
    // See SavedReceiptSummary.budgetCategory.
    budgetCategory?: string | null;
    isFood: boolean;
    account: string | null;
    // The receipt attached to this transaction, if any. Sent on every list so
    // the paperclip survives a reload instead of only appearing for the rest of
    // the session in which the link was made.
    linkedReceiptId: string | null;
  }

  export interface LinkResult {
    id: string;
    institutionName: string | null;
    accounts: number;
    // True when this link replaced an earlier one for the same bank.
    replaced?: boolean;
  }

  export interface BankConnection {
    id: string;
    institutionName: string | null;
    accounts: number;
    transactions: number;
    linkedAt: string;
  }

  export interface SyncError {
    institutionName: string | null;
    message: string;
    reconnectRequired: boolean;
  }

  export interface CategorizeResult {
    updated: number;
    receipts: Record<string, string>;
    transactions: Record<string, string>;
  }

  export interface SyncResult {
    imported: number;
    pending?: boolean;
    errors?: SyncError[];
  }

  export class BankApiService {
    private async request(path: string, init?: RequestInit): Promise<Response> {
      return fetch(path, { credentials: "same-origin", ...init });
    }

    private async parseError(response: Response): Promise<string> {
      try {
        const data = (await response.json()) as { error?: string };
        return data.error ?? `Request failed (${response.status}).`;
      } catch {
        return `Request failed (${response.status}).`;
      }
    }

    async createLinkToken(): Promise<{ linkToken: string }> {
      const response = await this.request("/api/plaid/link-token");
      if (!response.ok) throw new Error(await this.parseError(response));
      return (await response.json()) as { linkToken: string };
    }

    async exchange(publicToken: string, metadata: PlaidLinkMetadata): Promise<LinkResult> {
      const response = await this.request("/api/plaid/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken, metadata })
      });
      if (!response.ok) throw new Error(await this.parseError(response));
      return (await response.json()) as LinkResult;
    }

    async sync(): Promise<SyncResult> {
      const response = await this.request("/api/plaid/sync", { method: "POST" });
      if (!response.ok) throw new Error(await this.parseError(response));
      return (await response.json()) as SyncResult;
    }

    async listConnections(): Promise<BankConnection[]> {
      const response = await this.request("/api/plaid/connections");
      if (!response.ok) throw new Error(await this.parseError(response));
      return (await response.json()) as BankConnection[];
    }

    async removeConnection(id: string): Promise<void> {
      const response = await this.request(`/api/plaid/connections/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error(await this.parseError(response));
    }

    async listTransactions(): Promise<BankTransaction[]> {
      const response = await this.request("/api/transactions");
      if (!response.ok) throw new Error(await this.parseError(response));
      return (await response.json()) as BankTransaction[];
    }

    /**
     * Ask Gemini to sort one month's receipts and transactions into budget
     * categories. Answers with the category given to each id.
     */
    async categorizeMonth(
      month: string,
      receiptIds: readonly string[],
      transactionIds: readonly string[],
      model: string
    ): Promise<CategorizeResult> {
      const response = await this.request("/api/budget/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, receiptIds, transactionIds, model })
      });
      if (!response.ok) throw new Error(await this.parseError(response));
      return (await response.json()) as CategorizeResult;
    }

    async updateTransactionFood(id: string, isFood: boolean): Promise<void> {
      const response = await this.request(`/api/bank-transactions/${encodeURIComponent(id)}/food`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFood })
      });
      if (!response.ok) throw new Error(await this.parseError(response));
    }
  }
}
