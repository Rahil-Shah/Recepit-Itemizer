namespace ReceiptRing.App {
  const TOKEN_PLACEHOLDER = "YOUR_TOKEN";

  /**
   * Settings → Claude & AI assistants: the connection URL and how to add it to
   * Claude, personal access tokens for tools that cannot sign in through a
   * browser, and the apps already connected. A new token is shown once, filled
   * into the setup snippets, and forgotten when Settings is opened again.
   */
  export class AssistantSettingsController {
    constructor(
      private readonly api: Services.AssistantApiService,
      private readonly notifications: Services.NotificationService,
      private readonly root: ParentNode = document
    ) {}

    private el<T extends HTMLElement>(id: string): T {
      const element = this.root.querySelector<T>(`#${id}`);
      if (!element) throw new Error(`Missing #${id}`);
      return element;
    }

    start(): void {
      this.el<HTMLFormElement>("apiTokenForm").addEventListener("submit", (event) => {
        event.preventDefault();
        void this.createToken();
      });
      this.root.querySelectorAll<HTMLButtonElement>("[data-copy-target]").forEach((button) => {
        button.addEventListener("click", () => void this.copy(button));
      });
      this.el("apiTokenList").addEventListener("click", (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-token-id]");
        if (button) void this.revokeToken(button);
      });
      this.el("connectedAppList").addEventListener("click", (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-app-id]");
        if (button) void this.disconnectApp(button);
      });
    }

    /** Called each time Settings opens. */
    show(): void {
      this.el("mcpUrl").textContent = this.api.mcpUrl();
      this.el("newApiToken").classList.add("hidden");
      this.el("newApiTokenValue").textContent = "";
      this.el<HTMLFormElement>("apiTokenForm").reset();
      this.setStatus("");
      this.renderSnippets(null);
      void this.load();
    }

    private async load(): Promise<void> {
      await Promise.all([this.loadTokens(), this.loadApps()]);
    }

    private async loadTokens(): Promise<void> {
      try {
        this.renderTokens(await this.api.tokens());
      } catch (error) {
        this.setStatus(this.reason(error, "Could not load your tokens."), true);
      }
    }

    private async loadApps(): Promise<void> {
      try {
        this.renderApps(await this.api.apps());
      } catch (error) {
        this.setStatus(this.reason(error, "Could not load your connected apps."), true);
      }
    }

    private renderSnippets(token: string | null): void {
      const url = this.api.mcpUrl();
      const value = token ?? TOKEN_PLACEHOLDER;
      this.el("claudeCodeCommand").textContent =
        `claude mcp add --transport http receipt-ring ${url} --header "Authorization: Bearer ${value}"`;
      this.el("desktopConfig").textContent = JSON.stringify(
        {
          mcpServers: {
            "receipt-ring": {
              command: "npx",
              args: ["-y", "mcp-remote", url, "--header", "Authorization:${RECEIPT_RING_AUTH}"],
              env: { RECEIPT_RING_AUTH: `Bearer ${value}` }
            }
          }
        },
        null,
        2
      );
    }

    private async createToken(): Promise<void> {
      const name = this.el<HTMLInputElement>("apiTokenName").value.trim();
      if (!name) {
        this.setStatus("Give the token a name, such as \"Claude Code on my laptop\".", true);
        return;
      }
      const days = Number(this.el<HTMLSelectElement>("apiTokenExpiry").value);
      const canWrite = this.el<HTMLInputElement>("apiTokenCanWrite").checked;
      const button = this.el<HTMLButtonElement>("createApiTokenButton");
      UI.setBusy(button, true);
      this.setStatus("");
      try {
        const created = await this.api.createToken(name, days, canWrite);
        this.el("newApiTokenValue").textContent = created.token;
        this.el("newApiToken").classList.remove("hidden");
        this.renderSnippets(created.token);
        this.el<HTMLFormElement>("apiTokenForm").reset();
        this.notifications.success("Token created. Copy it now: it won't be shown again.");
        await this.loadTokens();
      } catch (error) {
        this.setStatus(this.reason(error, "Could not create the token."), true);
      } finally {
        UI.setBusy(button, false);
      }
    }

    private async revokeToken(button: HTMLButtonElement): Promise<void> {
      const name = button.dataset.tokenName ?? "this token";
      if (!window.confirm(`Revoke "${name}"? Anything using it stops working straight away.`)) return;
      UI.setBusy(button, true);
      try {
        await this.api.revokeToken(button.dataset.tokenId ?? "");
        this.notifications.success(`Revoked "${name}".`);
        await this.loadTokens();
      } catch (error) {
        this.notifications.error(this.reason(error, "Could not revoke the token."));
        UI.setBusy(button, false);
      }
    }

    private async disconnectApp(button: HTMLButtonElement): Promise<void> {
      const name = button.dataset.appName ?? "this app";
      if (!window.confirm(`Disconnect ${name}? It loses access until you connect it again.`)) return;
      UI.setBusy(button, true);
      try {
        await this.api.disconnectApp(button.dataset.appId ?? "");
        this.notifications.success(`Disconnected ${name}.`);
        await this.loadApps();
      } catch (error) {
        this.notifications.error(this.reason(error, "Could not disconnect the app."));
        UI.setBusy(button, false);
      }
    }

    private renderTokens(tokens: readonly Services.ApiTokenSummary[]): void {
      const list = this.el("apiTokenList");
      if (tokens.length === 0) {
        list.replaceChildren(this.empty("No tokens yet."));
        return;
      }
      list.replaceChildren(
        ...tokens.map((token) =>
          this.row(
            token.name,
            [
              `${token.prefix}…`,
              this.access(token.scopes),
              `Expires ${this.date(token.expiresAt)}`,
              token.lastUsedAt ? `Last used ${this.ago(token.lastUsedAt)}` : "Never used"
            ],
            "Revoke",
            { tokenId: token.id, tokenName: token.name }
          )
        )
      );
    }

    private renderApps(apps: readonly Services.ConnectedApp[]): void {
      const list = this.el("connectedAppList");
      if (apps.length === 0) {
        list.replaceChildren(this.empty("Nothing connected yet. Apps you allow show up here."));
        return;
      }
      list.replaceChildren(
        ...apps.map((app) =>
          this.row(
            app.name,
            [
              this.access(app.scopes),
              `Connected ${this.date(app.connectedAt)}`,
              app.lastUsedAt ? `Last used ${this.ago(app.lastUsedAt)}` : "Not used yet"
            ],
            "Disconnect",
            { appId: app.id, appName: app.name }
          )
        )
      );
    }

    private row(title: string, details: string[], action: string, data: Record<string, string>): HTMLElement {
      const item = document.createElement("li");
      item.className = "assistant-item";
      const text = document.createElement("div");
      text.className = "assistant-item-text";
      const name = document.createElement("strong");
      name.textContent = title;
      const meta = document.createElement("span");
      meta.textContent = details.join(" · ");
      text.append(name, meta);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-ghost btn-small";
      button.textContent = action;
      button.setAttribute("aria-label", `${action} ${title}`);
      Object.assign(button.dataset, data);
      item.append(text, button);
      return item;
    }

    private empty(message: string): HTMLElement {
      const item = document.createElement("li");
      item.className = "assistant-empty";
      item.textContent = message;
      return item;
    }

    private access(scopes: readonly Services.AssistantScope[]): string {
      return scopes.includes("receipts:write") ? "Read & correct" : "Read only";
    }

    private date(value: string): string {
      return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
    }

    private ago(value: string): string {
      const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
      if (minutes < 1) return "just now";
      if (minutes < 60) return `${minutes} min ago`;
      const hours = Math.round(minutes / 60);
      if (hours < 24) return `${hours} h ago`;
      return this.date(value);
    }

    private async copy(button: HTMLButtonElement): Promise<void> {
      const target = this.el(button.dataset.copyTarget ?? "");
      const text = target.textContent ?? "";
      try {
        await navigator.clipboard.writeText(text);
        const label = button.textContent;
        button.textContent = "Copied";
        window.setTimeout(() => {
          button.textContent = label;
        }, 1500);
      } catch {
        // No clipboard (an insecure origin, or permission refused): select the
        // text so a keyboard copy still works.
        const selection = window.getSelection?.();
        const range = document.createRange();
        range.selectNodeContents(target);
        selection?.removeAllRanges();
        selection?.addRange(range);
        this.notifications.error("Couldn't copy automatically. The text is selected, so copy it from there.");
      }
    }

    private reason(error: unknown, fallback: string): string {
      return error instanceof Error && error.message ? error.message : fallback;
    }

    private setStatus(message: string, isError = false): void {
      const status = this.el("assistantStatus");
      status.textContent = message;
      status.classList.toggle("is-error", isError);
      status.classList.toggle("is-active", Boolean(message) && !isError);
    }
  }
}
