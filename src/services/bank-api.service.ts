// Ambient declaration for the Teller Connect widget loaded from cdn.teller.io.
interface TellerConnectEnrollment {
  accessToken: string;
  enrollment?: { id?: string; institution?: { name?: string } };
}

interface TellerConnectInstance {
  open(): void;
}

interface TellerConnectSetupOptions {
  applicationId: string;
  environment?: string;
  products?: string[];
  onSuccess: (enrollment: TellerConnectEnrollment) => void;
  onExit?: () => void;
  onFailure?: (error: unknown) => void;
}

declare const TellerConnect: {
  setup(options: TellerConnectSetupOptions): TellerConnectInstance;
};

namespace ReceiptRing.Services {
  export interface TellerConfig {
    applicationId: string;
    environment: string;
  }

  export interface BankTransaction {
    id: string;
    date: string;
    description: string | null;
    amount: number;
    category: string | null;
    account: string | null;
  }

  export interface EnrollResult {
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

    async config(): Promise<TellerConfig> {
      const response = await this.request("/api/teller/config");
      if (!response.ok) throw new Error(await this.parseError(response));
      return (await response.json()) as TellerConfig;
    }

    async enroll(enrollment: TellerConnectEnrollment): Promise<EnrollResult> {
      const response = await this.request("/api/teller/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: enrollment.accessToken,
          enrollment: enrollment.enrollment ?? null
        })
      });
      if (!response.ok) throw new Error(await this.parseError(response));
      return (await response.json()) as EnrollResult;
    }

    async sync(): Promise<{ imported: number }> {
      const response = await this.request("/api/teller/sync", { method: "POST" });
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
