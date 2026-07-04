namespace ReceiptRing.Services {
  export interface AuthUser {
    id: string;
    email: string;
    name: string | null;
  }

  export class AuthApiService {
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

    /** Returns the current user, or throws if not authenticated. */
    async me(): Promise<AuthUser> {
      const response = await this.request("/api/auth/me");
      if (!response.ok) throw new Error(await this.parseError(response));
      return (await response.json()) as AuthUser;
    }

    async login(email: string, password: string): Promise<AuthUser> {
      const response = await this.request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) throw new Error(await this.parseError(response));
      return (await response.json()) as AuthUser;
    }

    async register(email: string, password: string, name: string | null): Promise<AuthUser> {
      const response = await this.request("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name })
      });
      if (!response.ok) throw new Error(await this.parseError(response));
      return (await response.json()) as AuthUser;
    }

    async logout(): Promise<void> {
      await this.request("/api/auth/logout", { method: "POST" });
    }
  }
}
