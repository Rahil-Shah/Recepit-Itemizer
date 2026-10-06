namespace ReceiptRing.UI {
  export type AdminSortKey = "email" | "joinedAt" | "lastSignInAt" | "receipts" | "lines" | "spend" | "photos";

  export interface AdminDetailHandlers {
    onSignOut(account: Services.AdminAccountDetail): void;
    onClose(): void;
  }

  /**
   * The admin tools page. Everything here is someone else's data -- names and
   * store names typed by other people -- so every value goes in through
   * textContent, and nothing is ever parsed as markup.
   */
  export class AdminView {
    constructor(private readonly currency: Services.CurrencyFormatService) {}

    renderStats(container: HTMLElement, overview: Services.AdminOverview): void {
      const users = overview.users;
      const receipts = overview.receipts;
      const identified = receipts.lines > 0 ? receipts.identifiedLines / receipts.lines : 0;
      container.replaceChildren(
        this.card("Accounts", String(users.total), `${users.admins} admin · ${users.newLast7Days} new this week`, "is-moss"),
        this.card("Active, 30 days", String(users.activeLast30Days), `${this.percent(users.total ? users.activeLast30Days / users.total : 0)} of accounts`),
        this.card("Receipts", String(receipts.total), `${receipts.last30Days} in the last 30 days`, "is-clay"),
        this.card("Items itemized", String(receipts.lines), `${this.percent(identified)} named · ${receipts.foodLines} food`),
        this.card("Spend recorded", this.currency.format(receipts.totalSpend), `across ${receipts.total} receipts`),
        this.card("Photos", String(receipts.withPhotos), `${this.bytes(overview.storage.photoBytes)} stored`),
        this.card("Bank links", String(overview.bank.connections), `${overview.bank.transactions} transactions`),
        this.card("Rent & names", String(overview.rent.entries), `${overview.savedNames} saved item names`)
      );
    }

    renderChart(container: HTMLElement, months: readonly Services.AdminMonth[]): void {
      container.replaceChildren();
      const maxReceipts = Math.max(1, ...months.map((month) => month.receipts));
      const maxSignups = Math.max(1, ...months.map((month) => month.signups ?? 0));
      const chart = document.createElement("div");
      chart.className = "admin-chart-bars";
      chart.setAttribute("role", "img");
      chart.setAttribute(
        "aria-label",
        `Receipts and sign-ups per month: ${months.map((m) => `${this.monthLabel(m.month)} ${m.receipts} receipts, ${m.signups ?? 0} sign-ups`).join("; ")}`
      );
      for (const month of months) {
        const column = document.createElement("div");
        column.className = "admin-chart-col";
        column.title = `${this.monthLabel(month.month, true)}: ${month.receipts} receipts, ${month.signups ?? 0} sign-ups, ${this.currency.format(month.spend)}`;
        const bars = document.createElement("div");
        bars.className = "admin-chart-pair";
        bars.append(
          this.bar("is-receipts", month.receipts / maxReceipts, month.receipts),
          this.bar("is-signups", (month.signups ?? 0) / maxSignups, month.signups ?? 0)
        );
        const label = document.createElement("span");
        label.className = "admin-chart-label";
        label.textContent = this.monthLabel(month.month);
        column.append(bars, label);
        chart.append(column);
      }
      container.append(chart);
    }

    renderCapacity(container: HTMLElement, overview: Services.AdminOverview): void {
      const { users, receipts, limits } = overview;
      container.replaceChildren(
        this.meter("Accounts", users.total, limits.maxUsers, `${users.total} of ${limits.maxUsers} (admins are exempt)`),
        this.meter("Items named", receipts.identifiedLines, receipts.lines, `${this.percent(receipts.lines ? receipts.identifiedLines / receipts.lines : 0)} of ${receipts.lines} lines`),
        this.meter("Own Gemini key", users.withOwnGeminiKey, users.total, `${users.withOwnGeminiKey} of ${users.total} accounts`),
        this.meter("Receipts with photos", receipts.withPhotos, receipts.total, `${receipts.withPhotos} of ${receipts.total}`),
        this.fact("Photo storage", this.bytes(overview.storage.photoBytes)),
        this.fact("Receipt limit", `${limits.maxReceiptsPerUser} per regular account`)
      );
    }

    renderAccounts(
      body: HTMLElement,
      accounts: readonly Services.AdminAccount[],
      limits: { maxReceiptsPerUser: number },
      selectedId: string | null,
      onSelect: (id: string) => void
    ): void {
      body.replaceChildren();
      for (const account of accounts) {
        const row = document.createElement("tr");
        row.className = "admin-row";
        row.classList.toggle("is-selected", account.id === selectedId);
        row.tabIndex = 0;
        row.dataset.userId = account.id;
        row.addEventListener("click", () => onSelect(account.id));
        row.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(account.id);
          }
        });

        const who = document.createElement("td");
        who.append(this.identity(account));

        const joined = this.cell(this.date(account.joinedAt));
        const seen = this.cell(account.lastSignInAt ? this.relative(account.lastSignInAt) : "Not signed in");

        const receipts = this.cell(
          account.isAdmin ? String(account.receipts) : `${account.receipts} / ${limits.maxReceiptsPerUser}`,
          "is-number"
        );
        if (!account.isAdmin && account.receipts >= limits.maxReceiptsPerUser) receipts.classList.add("is-warning");

        const lines = this.cell(String(account.lines), "is-number");
        if (account.lines > 0) {
          const named = document.createElement("span");
          named.className = "admin-subvalue";
          named.textContent = `${this.percent(account.identifiedLines / account.lines)} named`;
          lines.append(named);
        }

        const setup = document.createElement("td");
        setup.className = "admin-setup";
        if (account.hasOwnGeminiKey) setup.append(this.tag("Own key"));
        if (account.bankConnections > 0) setup.append(this.tag("Bank"));
        if (account.people > 1) setup.append(this.tag(`${account.people} people`));

        row.append(
          who,
          joined,
          seen,
          receipts,
          lines,
          this.cell(this.currency.format(account.spend), "is-number"),
          this.cell(String(account.photos), "is-number"),
          setup
        );
        body.append(row);
      }
    }

    renderDetail(
      container: HTMLElement,
      account: Services.AdminAccountDetail,
      isSelf: boolean,
      handlers: AdminDetailHandlers
    ): void {
      container.replaceChildren();

      const header = document.createElement("header");
      header.className = "panel-header admin-detail-header";
      header.append(this.identity(account, true));
      const close = document.createElement("button");
      close.type = "button";
      close.className = "btn btn-ghost btn-small";
      close.textContent = "Close";
      close.addEventListener("click", () => handlers.onClose());
      header.append(close);

      const body = document.createElement("div");
      body.className = "panel-body";

      const stats = document.createElement("div");
      stats.className = "admin-detail-stats";
      const named = account.lines > 0 ? this.percent(account.identifiedLines / account.lines) : "—";
      stats.append(
        this.card("Receipts", String(account.receipts), account.lastReceiptAt ? `last ${this.relative(account.lastReceiptAt)}` : "none yet"),
        this.card("Items itemized", String(account.lines), `${named} named · ${account.foodLines} food`),
        this.card("Spend saved", this.currency.format(account.spend), `${account.photos} with photos`),
        this.card("Signed in", String(account.activeSessions), account.lastSignInAt ? `latest ${this.relative(account.lastSignInAt)}` : "no active sessions"),
        this.card("People", String(account.people), `${account.savedNames} saved item names`),
        this.card("Bank", String(account.bankConnections), `${account.bankTransactions} transactions · ${account.rentEntries} rent`)
      );

      const chartTitle = document.createElement("h3");
      chartTitle.className = "insight-heading";
      chartTitle.textContent = "Receipts, last 12 months";
      const chart = document.createElement("div");
      chart.className = "admin-chart admin-chart-small";
      this.renderChart(chart, account.monthly.map((month) => ({ ...month, signups: 0 })));

      const recentTitle = document.createElement("h3");
      recentTitle.className = "insight-heading";
      recentTitle.textContent = "Recent receipts";
      const recent = document.createElement("ul");
      recent.className = "admin-recent";
      if (account.recentReceipts.length === 0) {
        const none = document.createElement("li");
        none.className = "insight-note";
        none.textContent = "No receipts saved yet.";
        recent.append(none);
      }
      for (const receipt of account.recentReceipts) {
        const item = document.createElement("li");
        const name = document.createElement("span");
        name.className = "admin-recent-name";
        name.textContent = receipt.storeName || "Untitled receipt";
        const meta = document.createElement("span");
        meta.className = "admin-recent-meta";
        meta.textContent = `${this.date(receipt.createdAt)} · ${receipt.category} · ${receipt.lines} items${receipt.hasImage ? " · photo" : ""}`;
        const total = document.createElement("span");
        total.className = "admin-recent-total";
        total.textContent = this.currency.format(receipt.total ?? 0);
        item.append(name, meta, total);
        recent.append(item);
      }

      const actions = document.createElement("div");
      actions.className = "admin-detail-actions";
      if (isSelf) {
        const note = document.createElement("p");
        note.className = "settings-note";
        note.textContent = "This is your account. Manage your own sessions in Settings.";
        actions.append(note);
      } else {
        const signOut = document.createElement("button");
        signOut.type = "button";
        signOut.className = "btn btn-secondary";
        signOut.dataset.action = "sign-out";
        signOut.textContent = account.activeSessions > 0 ? "Sign out everywhere" : "No active sessions";
        signOut.disabled = account.activeSessions === 0;
        signOut.addEventListener("click", () => handlers.onSignOut(account));
        const note = document.createElement("p");
        note.className = "settings-note";
        note.textContent = "Ends every session this account holds. Their data is untouched; they can sign straight back in.";
        actions.append(signOut, note);
      }

      body.append(stats, chartTitle, chart, recentTitle, recent, actions);
      container.append(header, body);
    }

    /** Sort a copy of the accounts by one column, text ascending, numbers and dates descending. */
    sort(accounts: readonly Services.AdminAccount[], key: AdminSortKey, ascending: boolean): Services.AdminAccount[] {
      const value = (account: Services.AdminAccount): string | number => {
        switch (key) {
          case "email":
            return (account.name || account.email).toLowerCase();
          case "joinedAt":
          case "lastSignInAt":
            return account[key] ? Date.parse(account[key] as string) : 0;
          default:
            return account[key];
        }
      };
      const direction = ascending ? 1 : -1;
      return [...accounts].sort((left, right) => {
        const a = value(left);
        const b = value(right);
        return (a < b ? -1 : a > b ? 1 : 0) * direction;
      });
    }

    filter(accounts: readonly Services.AdminAccount[], query: string): Services.AdminAccount[] {
      const needle = query.trim().toLowerCase();
      if (!needle) return [...accounts];
      return accounts.filter((account) => `${account.name ?? ""} ${account.email}`.toLowerCase().includes(needle));
    }

    private identity(account: Services.AdminAccount, large = false): HTMLElement {
      const wrap = document.createElement("div");
      wrap.className = large ? "admin-identity is-large" : "admin-identity";
      const avatar = document.createElement("span");
      avatar.className = "profile-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = (account.name || account.email).trim().charAt(0).toUpperCase() || "?";
      const text = document.createElement("span");
      text.className = "admin-identity-text";
      const name = document.createElement("strong");
      name.textContent = account.name || account.email;
      const email = document.createElement("span");
      email.className = "admin-subvalue";
      email.textContent = large ? `${account.email} · joined ${this.date(account.joinedAt)}` : account.email;
      text.append(name, email);
      wrap.append(avatar, text);
      if (account.isAdmin) {
        const badge = document.createElement("span");
        badge.className = "role-badge is-admin";
        badge.textContent = "Admin";
        wrap.append(badge);
      }
      return wrap;
    }

    private card(label: string, value: string, sub: string, tone = ""): HTMLElement {
      const card = document.createElement("div");
      card.className = tone ? `admin-stat ${tone}` : "admin-stat";
      const title = document.createElement("span");
      title.className = "stat-label";
      title.textContent = label;
      const figure = document.createElement("span");
      figure.className = "admin-stat-value";
      figure.textContent = value;
      const note = document.createElement("span");
      note.className = "insight-sub";
      note.textContent = sub;
      card.append(title, figure, note);
      return card;
    }

    private meter(label: string, value: number, max: number, caption: string): HTMLElement {
      const row = document.createElement("div");
      row.className = "admin-meter";
      const head = document.createElement("div");
      head.className = "admin-meter-head";
      const name = document.createElement("span");
      name.textContent = label;
      const text = document.createElement("span");
      text.className = "admin-subvalue";
      text.textContent = caption;
      head.append(name, text);
      const track = document.createElement("div");
      track.className = "admin-meter-track";
      const ratio = max > 0 ? Math.min(1, value / max) : 0;
      track.setAttribute("role", "meter");
      track.setAttribute("aria-label", label);
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", String(max));
      track.setAttribute("aria-valuenow", String(value));
      const fill = document.createElement("span");
      fill.style.width = `${Math.round(ratio * 100)}%`;
      if (ratio >= 0.9) fill.className = "is-full";
      track.append(fill);
      row.append(head, track);
      return row;
    }

    private fact(label: string, value: string): HTMLElement {
      const row = document.createElement("div");
      row.className = "admin-meter-head admin-fact";
      const name = document.createElement("span");
      name.textContent = label;
      const text = document.createElement("strong");
      text.textContent = value;
      row.append(name, text);
      return row;
    }

    private bar(variant: string, ratio: number, value: number): HTMLElement {
      const bar = document.createElement("span");
      bar.className = `admin-chart-bar ${variant}`;
      bar.style.height = `${value > 0 ? Math.max(4, Math.round(ratio * 100)) : 0}%`;
      return bar;
    }

    private cell(text: string, variant = ""): HTMLTableCellElement {
      const cell = document.createElement("td");
      if (variant) cell.className = variant;
      cell.textContent = text;
      return cell;
    }

    private tag(text: string): HTMLElement {
      const tag = document.createElement("span");
      tag.className = "admin-tag";
      tag.textContent = text;
      return tag;
    }

    percent(ratio: number): string {
      return `${Math.round(ratio * 100)}%`;
    }

    bytes(count: number): string {
      if (count < 1024) return `${count} B`;
      if (count < 1024 * 1024) return `${(count / 1024).toFixed(1)} KB`;
      if (count < 1024 * 1024 * 1024) return `${(count / (1024 * 1024)).toFixed(1)} MB`;
      return `${(count / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }

    relative(iso: string, now: number = Date.now()): string {
      const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
      if (days <= 0) return "today";
      if (days === 1) return "yesterday";
      if (days < 30) return `${days} days ago`;
      return this.date(iso);
    }

    private date(iso: string): string {
      return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }

    private monthLabel(month: string, long = false): string {
      const [year, number] = month.split("-").map(Number);
      return new Date(year, number - 1, 1).toLocaleDateString(undefined, long ? { month: "long", year: "numeric" } : { month: "short" });
    }
  }
}
