namespace ReceiptRing.App {
  /**
   * The admin tools page. Only ever started for an admin account, and every
   * route behind it is refused to anyone else, so a regular account that
   * opened this page by hand would get 403s and nothing to show.
   */
  export class AdminToolsController {
    private overview: Services.AdminOverview | null = null;
    private accounts: Services.AdminAccount[] = [];
    private sortKey: UI.AdminSortKey = "joinedAt";
    private ascending = false;
    private selectedId: string | null = null;
    private readonly loading = new UI.LoadingOverlays();

    constructor(
      private readonly api: Services.AdminApiService,
      private readonly view: UI.AdminView,
      private readonly notifications: Services.NotificationService,
      private readonly selfId: string,
      private readonly root: ParentNode = document
    ) {}

    private el<T extends HTMLElement>(id: string): T {
      const element = this.root.querySelector<T>(`#${id}`);
      if (!element) throw new Error(`Missing #${id}`);
      return element;
    }

    start(): void {
      this.el<HTMLButtonElement>("refreshAdminButton").addEventListener("click", () => void this.load());
      this.el<HTMLInputElement>("adminUserSearch").addEventListener("input", () => this.renderAccounts());
      this.root.querySelectorAll<HTMLButtonElement>("#adminUsersTable [data-sort]").forEach((button) => {
        button.addEventListener("click", () => {
          const key = button.dataset.sort as UI.AdminSortKey;
          this.ascending = this.sortKey === key ? !this.ascending : key === "email";
          this.sortKey = key;
          this.renderAccounts();
        });
      });
    }

    async load(): Promise<void> {
      const page = this.el("adminView");
      const done = this.loading.show(page, "Gathering the numbers…", "Every account on this instance.", { screen: "admin" });
      try {
        const [overview, accounts] = await Promise.all([this.api.overview(), this.api.accounts()]);
        this.overview = overview;
        this.accounts = accounts;
        this.el("adminGeneratedAt").textContent = `Usage across every account, as of ${new Date(overview.generatedAt).toLocaleString()}.`;
        this.view.renderStats(this.el("adminStats"), overview);
        this.view.renderChart(this.el("adminChart"), overview.monthly);
        this.view.renderCapacity(this.el("adminCapacity"), overview);
        this.renderAccounts();
        if (this.selectedId) await this.select(this.selectedId);
      } catch (error) {
        this.notifications.error(error instanceof Error ? error.message : "Could not load the admin tools.");
      } finally {
        done();
      }
    }

    private renderAccounts(): void {
      const query = this.el<HTMLInputElement>("adminUserSearch").value;
      const shown = this.view.sort(this.view.filter(this.accounts, query), this.sortKey, this.ascending);
      this.root.querySelectorAll<HTMLButtonElement>("#adminUsersTable [data-sort]").forEach((button) => {
        const th = button.closest("th");
        const active = button.dataset.sort === this.sortKey;
        th?.setAttribute("aria-sort", active ? (this.ascending ? "ascending" : "descending") : "none");
      });
      this.view.renderAccounts(
        this.el("adminUsersBody"),
        shown,
        this.overview?.limits ?? { maxReceiptsPerUser: 0 },
        this.selectedId,
        (id) => void this.select(id)
      );
      this.el("adminUsersEmpty").classList.toggle("hidden", shown.length > 0 || this.accounts.length === 0);
    }

    private async select(id: string): Promise<void> {
      this.selectedId = id;
      this.renderAccounts();
      const panel = this.el("adminUserDetail");
      try {
        const account = await this.api.account(id);
        panel.classList.remove("hidden");
        this.view.renderDetail(panel, account, account.id === this.selfId, {
          onSignOut: (target) => void this.signOut(target),
          onClose: () => {
            this.selectedId = null;
            panel.classList.add("hidden");
            this.renderAccounts();
          }
        });
        panel.scrollIntoView?.({ behavior: "smooth", block: "start" });
      } catch (error) {
        this.notifications.error(error instanceof Error ? error.message : "Could not load that account.");
      }
    }

    private async signOut(account: Services.AdminAccountDetail): Promise<void> {
      const who = account.name || account.email;
      if (!window.confirm(`Sign ${who} out of every device? Their data is not touched.`)) return;
      try {
        const count = await this.api.signOut(account.id);
        this.notifications.success(`Signed ${who} out of ${count} ${count === 1 ? "session" : "sessions"}.`);
        await this.load();
      } catch (error) {
        this.notifications.error(error instanceof Error ? error.message : "Could not sign them out.");
      }
    }
  }
}
