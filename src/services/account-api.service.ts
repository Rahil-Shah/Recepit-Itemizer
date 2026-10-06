namespace ReceiptRing.Services {
  export interface AccountSession {
    current: boolean;
    signedInAt: string;
    expiresAt: string;
  }

  export interface AccountSessions {
    active: number;
    sessions: AccountSession[];
  }

  /** The signed-in account's own settings: name, password, sessions. */
  export class AccountApiService {
    private async send<T>(path: string, init: RequestInit = {}): Promise<T> {
      const response = await fetch(path, {
        credentials: "same-origin",
        ...init,
        headers: init.body ? { "Content-Type": "application/json" } : undefined
      });
      const body = (await response.json().catch(() => ({}))) as T & { error?: string };
      if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
      return body;
    }

    updateName(name: string): Promise<AuthUser> {
      return this.send<AuthUser>("/api/auth/profile", { method: "PATCH", body: JSON.stringify({ name }) });
    }

    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
      await this.send("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword })
      });
    }

    sessions(): Promise<AccountSessions> {
      return this.send<AccountSessions>("/api/auth/sessions");
    }

    async revokeOtherSessions(): Promise<number> {
      const result = await this.send<{ revoked: number }>("/api/auth/sessions/revoke-others", { method: "POST" });
      return result.revoked;
    }
  }
}
