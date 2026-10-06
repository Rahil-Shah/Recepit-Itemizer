namespace ReceiptRing.App {
  /**
   * The parts of the Settings page that belong to the account rather than to
   * the receipt workspace: profile, password and sessions, and preferences.
   * (The Gemini key, the exports and account deletion are wired by
   * AppController, which already owned them.)
   */
  export class AccountSettingsController {
    private user: Services.AuthUser | null = null;

    constructor(
      private readonly accountApi: Services.AccountApiService,
      private readonly preferences: Services.PreferencesService,
      private readonly notifications: Services.NotificationService,
      private readonly root: ParentNode = document
    ) {}

    private el<T extends HTMLElement>(id: string): T {
      const element = this.root.querySelector<T>(`#${id}`);
      if (!element) throw new Error(`Missing #${id}`);
      return element;
    }

    start(user: Services.AuthUser): void {
      this.user = user;
      this.el<HTMLFormElement>("profileForm").addEventListener("submit", (event) => {
        event.preventDefault();
        void this.saveName();
      });
      this.el<HTMLFormElement>("passwordForm").addEventListener("submit", (event) => {
        event.preventDefault();
        void this.changePassword();
      });
      this.el<HTMLButtonElement>("revokeSessionsButton").addEventListener("click", () => void this.revokeOthers());
      this.el<HTMLSelectElement>("prefStartTab").addEventListener("change", () => this.savePreferences());
      this.el<HTMLSelectElement>("prefCategory").addEventListener("change", () => this.savePreferences());

      // The section index scrolls rather than navigating: a fragment change
      // would add history entries the Back button then has to walk through.
      this.root.querySelectorAll<HTMLAnchorElement>(".settings-nav a").forEach((link) => {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          const target = this.root.querySelector<HTMLElement>(link.getAttribute("href") ?? "");
          target?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        });
      });
    }

    /** Called each time the page opens, so it shows what is true now. */
    show(): void {
      this.renderProfile();
      const prefs = this.preferences.load();
      this.el<HTMLSelectElement>("prefStartTab").value = prefs.startTab;
      this.el<HTMLSelectElement>("prefCategory").value = prefs.defaultCategory;
      this.el<HTMLFormElement>("passwordForm").reset();
      this.setStatus("passwordStatus", "");
      this.setStatus("profileStatus", "");
      void this.loadSessions();
    }

    private renderProfile(): void {
      const user = this.user;
      if (!user) return;
      this.el("profileEmail").textContent = user.email;
      this.el("profileAvatar").textContent = (user.name || user.email).trim().charAt(0).toUpperCase() || "?";
      const role = this.el("profileRole");
      role.textContent = user.isAdmin ? "Admin" : "Standard account";
      role.classList.toggle("is-admin", user.isAdmin);
      this.el<HTMLInputElement>("profileName").value = user.name ?? "";
    }

    private async saveName(): Promise<void> {
      const button = this.el<HTMLButtonElement>("saveProfileButton");
      UI.setBusy(button, true);
      try {
        this.user = await this.accountApi.updateName(this.el<HTMLInputElement>("profileName").value);
        this.renderProfile();
        this.setStatus("profileStatus", "Saved.");
      } catch (error) {
        this.setStatus("profileStatus", error instanceof Error ? error.message : "Could not save.", true);
      } finally {
        UI.setBusy(button, false);
      }
    }

    private async changePassword(): Promise<void> {
      const current = this.el<HTMLInputElement>("currentPassword").value;
      const next = this.el<HTMLInputElement>("newPassword").value;
      const repeat = this.el<HTMLInputElement>("confirmPassword").value;
      if (next.length < 8) {
        this.setStatus("passwordStatus", "The new password needs at least 8 characters.", true);
        return;
      }
      if (next !== repeat) {
        this.setStatus("passwordStatus", "The two new passwords don't match.", true);
        return;
      }
      const button = this.el<HTMLButtonElement>("changePasswordButton");
      UI.setBusy(button, true);
      try {
        await this.accountApi.changePassword(current, next);
        this.el<HTMLFormElement>("passwordForm").reset();
        this.setStatus("passwordStatus", "Password changed. Every other session was signed out.");
        this.notifications.success("Password changed.");
        await this.loadSessions();
      } catch (error) {
        this.setStatus("passwordStatus", error instanceof Error ? error.message : "Could not change it.", true);
      } finally {
        UI.setBusy(button, false);
      }
    }

    private async loadSessions(): Promise<void> {
      const list = this.el("sessionList");
      try {
        const { active, sessions } = await this.accountApi.sessions();
        list.replaceChildren(
          ...sessions.map((session) => {
            const item = document.createElement("li");
            item.className = session.current ? "session-item is-current" : "session-item";
            const label = document.createElement("strong");
            label.textContent = session.current ? "This device" : "Another device";
            const when = document.createElement("span");
            when.textContent = `Signed in ${new Date(session.signedInAt).toLocaleString()} · until ${new Date(session.expiresAt).toLocaleDateString()}`;
            item.append(label, when);
            return item;
          })
        );
        const button = this.el<HTMLButtonElement>("revokeSessionsButton");
        button.disabled = active <= 1;
        this.setStatus("sessionStatus", active <= 1 ? "You're only signed in here." : `Signed in on ${active} devices.`);
      } catch (error) {
        this.setStatus("sessionStatus", error instanceof Error ? error.message : "Could not load sessions.", true);
      }
    }

    private async revokeOthers(): Promise<void> {
      const button = this.el<HTMLButtonElement>("revokeSessionsButton");
      UI.setBusy(button, true);
      try {
        const count = await this.accountApi.revokeOtherSessions();
        this.notifications.success(`Signed out ${count} other ${count === 1 ? "session" : "sessions"}.`);
      } catch (error) {
        this.notifications.error(error instanceof Error ? error.message : "Could not sign the others out.");
      } finally {
        UI.setBusy(button, false);
        await this.loadSessions();
      }
    }

    private savePreferences(): void {
      this.preferences.save({
        startTab: this.el<HTMLSelectElement>("prefStartTab").value as Services.StartTab,
        defaultCategory: this.el<HTMLSelectElement>("prefCategory").value as Domain.ReceiptCategory
      });
      this.notifications.success("Preferences saved on this device.");
    }

    private setStatus(id: string, message: string, isError = false): void {
      const status = this.el(id);
      status.textContent = message;
      status.classList.toggle("is-error", isError);
      status.classList.toggle("is-active", Boolean(message) && !isError);
    }
  }
}
