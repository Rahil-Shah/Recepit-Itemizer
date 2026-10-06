namespace ReceiptRing.Services {
  export type StartTab = "receipts" | "history" | "budgeting";

  export interface Preferences {
    startTab: StartTab;
    defaultCategory: Domain.ReceiptCategory;
  }

  const START_TABS: readonly StartTab[] = ["receipts", "history", "budgeting"];
  const CATEGORIES: readonly Domain.ReceiptCategory[] = ["Groceries", "Dining", "Entertainment", "Travel", "Other"];
  export const DEFAULT_PREFERENCES: Preferences = { startTab: "receipts", defaultCategory: "Groceries" };

  /**
   * Preferences kept on this device. Anything unreadable -- storage blocked,
   * a value from an older version -- falls back to the default rather than
   * breaking the app at start.
   */
  export class PreferencesService {
    constructor(
      private readonly storage: Pick<Storage, "getItem" | "setItem">,
      private readonly key = "receipt-ring-preferences"
    ) {}

    load(): Preferences {
      try {
        const raw = JSON.parse(this.storage.getItem(this.key) ?? "{}") as Partial<Preferences>;
        return {
          startTab: START_TABS.includes(raw.startTab as StartTab) ? (raw.startTab as StartTab) : DEFAULT_PREFERENCES.startTab,
          defaultCategory: CATEGORIES.includes(raw.defaultCategory as Domain.ReceiptCategory)
            ? (raw.defaultCategory as Domain.ReceiptCategory)
            : DEFAULT_PREFERENCES.defaultCategory
        };
      } catch {
        return { ...DEFAULT_PREFERENCES };
      }
    }

    save(changes: Partial<Preferences>): Preferences {
      const next = { ...this.load(), ...changes };
      try {
        this.storage.setItem(this.key, JSON.stringify(next));
      } catch {
        // Private browsing and the like: it simply is not remembered.
      }
      return next;
    }
  }
}
