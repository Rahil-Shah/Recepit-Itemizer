namespace ReceiptRing.Services {
  export type AssistantScope = "receipts:read" | "receipts:write";

  export interface ApiTokenSummary {
    id: string;
    name: string;
    prefix: string;
    scopes: AssistantScope[];
    expiresAt: string;
    lastUsedAt: string | null;
    createdAt: string;
  }

  /** A freshly created token: the only time `token` is ever sent. */
  export interface CreatedApiToken extends ApiTokenSummary {
    token: string;
  }

  export interface ConnectedApp {
    id: string;
    name: string;
    scopes: AssistantScope[];
    connectedAt: string;
    lastUsedAt: string | null;
    expiresAt: string;
  }

  /**
   * Personal access tokens and OAuth-connected apps, for connecting an AI
   * assistant such as Claude to the MCP endpoint (see server/api-tokens.mjs).
   */
  export class AssistantApiService {
    private async send<T>(path: string, init: RequestInit = {}): Promise<T> {
      const response = await fetch(path, {
        credentials: "same-origin",
        ...init,
        headers: init.body ? { "Content-Type": "application/json" } : undefined
      });
      if (response.status === 204) return undefined as T;
      const body = (await response.json().catch(() => ({}))) as T & { error?: string };
      if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
      return body;
    }

    /** The address an assistant connects to, on this site. */
    mcpUrl(origin: string = window.location.origin): string {
      return `${origin}/api/mcp`;
    }

    tokens(): Promise<ApiTokenSummary[]> {
      return this.send<ApiTokenSummary[]>("/api/tokens");
    }

    createToken(name: string, expiresInDays: number, canWrite: boolean): Promise<CreatedApiToken> {
      return this.send<CreatedApiToken>("/api/tokens", {
        method: "POST",
        body: JSON.stringify({ name, expiresInDays, canWrite })
      });
    }

    async revokeToken(id: string): Promise<void> {
      await this.send(`/api/tokens/${encodeURIComponent(id)}`, { method: "DELETE" });
    }

    apps(): Promise<ConnectedApp[]> {
      return this.send<ConnectedApp[]>("/api/connected-apps");
    }

    async disconnectApp(id: string): Promise<void> {
      await this.send(`/api/connected-apps/${encodeURIComponent(id)}`, { method: "DELETE" });
    }
  }
}
