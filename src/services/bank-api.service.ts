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
    account: string | null;
  }

  export interface LinkResult {
    id: string;
    institutionName: string | null;
    accounts: number;
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

    async sync(): Promise<{ imported: number }> {
      const response = await this.request("/api/plaid/sync", { method: "POST" });
      if (!response.ok) throw new Error(await this.parseError(response));
      return (await response.json()) as { imported: number };
    }

    async listTransactions(): Promise<BankTransaction[]> {
      const response = await this.request("/api/transactions");
      if (!response.ok) throw new Error(await this.parseError(response));
      return (await response.json()) as BankTransaction[];
    }
  }
}
