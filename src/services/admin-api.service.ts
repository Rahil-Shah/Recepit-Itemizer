namespace ReceiptRing.Services {
  export interface AdminMonth {
    month: string;
    receipts: number;
    spend: number;
    signups?: number;
  }

  export interface AdminOverview {
    generatedAt: string;
    limits: { maxUsers: number; maxReceiptsPerUser: number };
    users: {
      total: number;
      admins: number;
      newLast7Days: number;
      newLast30Days: number;
      activeLast30Days: number;
      withOwnGeminiKey: number;
    };
    receipts: {
      total: number;
      last30Days: number;
      withPhotos: number;
      totalSpend: number;
      lines: number;
      identifiedLines: number;
      foodLines: number;
    };
    bank: { connections: number; transactions: number };
    rent: { entries: number; total: number };
    savedNames: number;
    storage: { photoBytes: number };
    monthly: AdminMonth[];
  }

  export interface AdminAccount {
    id: string;
    email: string;
    name: string | null;
    isAdmin: boolean;
    joinedAt: string;
    hasOwnGeminiKey: boolean;
    people: number;
    rentEntries: number;
    savedNames: number;
    bankConnections: number;
    receipts: number;
    spend: number;
    lastReceiptAt: string | null;
    photos: number;
    lines: number;
    identifiedLines: number;
    foodLines: number;
    activeSessions: number;
    lastSignInAt: string | null;
  }

  export interface AdminAccountDetail extends AdminAccount {
    bankTransactions: number;
    monthly: AdminMonth[];
    recentReceipts: {
      id: string;
      storeName: string | null;
      category: string;
      total: number | null;
      createdAt: string;
      hasImage: boolean;
      lines: number;
    }[];
  }

  /** The admin tools' reads. Every route answers 403 to a non-admin. */
  export class AdminApiService {
    private async send<T>(path: string, init: RequestInit = {}): Promise<T> {
      const response = await fetch(path, { credentials: "same-origin", ...init });
      const body = (await response.json().catch(() => ({}))) as T & { error?: string };
      if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
      return body;
    }

    overview(): Promise<AdminOverview> {
      return this.send<AdminOverview>("/api/admin/overview");
    }

    async accounts(): Promise<AdminAccount[]> {
      return (await this.send<{ users: AdminAccount[] }>("/api/admin/users")).users;
    }

    account(id: string): Promise<AdminAccountDetail> {
      return this.send<AdminAccountDetail>(`/api/admin/users/${encodeURIComponent(id)}`);
    }

    async signOut(id: string): Promise<number> {
      const result = await this.send<{ revoked: number }>(`/api/admin/users/${encodeURIComponent(id)}/sign-out`, {
        method: "POST"
      });
      return result.revoked;
    }
  }
}
