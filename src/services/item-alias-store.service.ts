namespace ReceiptRing.Services {
  /** A confirmed identification, remembered so the next receipt gets it free. */
  export interface ItemAlias {
    // What the alias is filed under: an item code where the store printed one,
    // otherwise the normalized label. Codes are preferred because they survive
    // a store rewording its own shorthand.
    lookupKey: string;
    // The store the alias was learned at, lowercased, or "" for one learned
    // with no store name to hand. Kept because the same shorthand means
    // different things at different chains -- "PC" is President's Choice at
    // Loblaws and a computer aisle everywhere else.
    storeKey: string;
    resolvedName: string;
    brand?: string;
    size?: string;
    // How many times a human has agreed with this. A correction confirmed on
    // three receipts is worth more than one accepted in passing.
    timesConfirmed: number;
    updatedAt: string;
  }

  /**
   * The memory behind the identification feature.
   *
   * Every correction the user makes is worth more than the guess it replaced,
   * and worth more still on the next receipt from the same shop. This holds
   * those corrections and hands them back, which is what turns the second
   * Costco receipt from a page of shorthand into a page of names for free.
   *
   * Lookups are tried code-first, then label, then the same key learned at a
   * different store -- widening only when the narrower key misses, so a
   * store-specific meaning is never overridden by a general one.
   */
  export class ItemAliasStoreService {
    private aliases = new Map<string, ItemAlias>();

    constructor(private readonly labelNormalizerService: LabelNormalizerService) {}

    /** Replaces everything held, as when the server's aliases arrive. */
    replaceAll(aliases: readonly ItemAlias[]): void {
      this.aliases = new Map(
        aliases.map((alias) => [this.mapKey(alias.storeKey, alias.lookupKey), alias])
      );
    }

    all(): ItemAlias[] {
      return [...this.aliases.values()];
    }

    /**
     * The alias for a line, or null. Tried narrowest key first: the item code
     * at this store, the label at this store, then either key learned
     * anywhere. A code seen at the same store is the strongest evidence there
     * is; the same shorthand at a different chain is the weakest.
     */
    find(line: Domain.ReceiptLine, storeName: string): ItemAlias | null {
      const storeKey = this.storeKeyFor(storeName);
      const labelKey = this.labelNormalizerService.keyFor(line.label);
      const codeKey = line.itemCode ? this.codeKeyFor(line.itemCode) : null;

      const candidates = [
        codeKey ? this.mapKey(storeKey, codeKey) : null,
        this.mapKey(storeKey, labelKey),
        // A code is store-agnostic enough to be worth trying across stores; a
        // label is not, but it is better than nothing, and the caller is told
        // where the answer came from either way.
        codeKey ? this.mapKey("", codeKey) : null,
        this.mapKey("", labelKey)
      ];

      for (const key of candidates) {
        if (key === null) continue;
        const alias = this.aliases.get(key);
        if (alias) return alias;
      }
      return null;
    }

    /** The alias for a line as an identification, or null when there is none. */
    resolve(line: Domain.ReceiptLine, storeName: string): Domain.ItemIdentification | null {
      const alias = this.find(line, storeName);
      if (!alias) return null;

      return {
        lineId: line.id,
        rawLabel: line.label,
        ...(line.itemCode ? { itemCode: line.itemCode } : {}),
        resolvedName: alias.resolvedName,
        ...(alias.brand ? { brand: alias.brand } : {}),
        ...(alias.size ? { size: alias.size } : {}),
        // A name a human wrote down is the one thing here worth full marks.
        confidence: 1,
        source: "saved-alias",
        reasoning:
          alias.timesConfirmed > 1
            ? `You confirmed this ${alias.timesConfirmed} times.`
            : "You confirmed this before.",
        alternatives: [],
        confirmed: true
      };
    }

    /**
     * Records a confirmed identification. Filed under the item code when there
     * is one, since a code outlives the shorthand printed beside it.
     *
     * Returns the alias as stored, so a caller can send that same object to the
     * server rather than rebuilding it and risking a different key.
     */
    remember(identification: Domain.ItemIdentification, storeName: string): ItemAlias {
      const storeKey = this.storeKeyFor(storeName);
      const lookupKey = identification.itemCode
        ? this.codeKeyFor(identification.itemCode)
        : this.labelNormalizerService.keyFor(identification.rawLabel);

      const mapKey = this.mapKey(storeKey, lookupKey);
      const existing = this.aliases.get(mapKey);

      const alias: ItemAlias = {
        lookupKey,
        storeKey,
        resolvedName: identification.resolvedName,
        ...(identification.brand ? { brand: identification.brand } : {}),
        ...(identification.size ? { size: identification.size } : {}),
        // Only count it again when the name held steady. Confirming a
        // correction is agreement; changing the name is a fresh start, and
        // inheriting the old count would make a one-off look well established.
        timesConfirmed:
          existing && existing.resolvedName === identification.resolvedName
            ? existing.timesConfirmed + 1
            : 1,
        updatedAt: new Date().toISOString()
      };

      this.aliases.set(mapKey, alias);
      return alias;
    }

    forget(alias: ItemAlias): void {
      this.aliases.delete(this.mapKey(alias.storeKey, alias.lookupKey));
    }

    clear(): void {
      this.aliases.clear();
    }

    /**
     * Codes are namespaced so a numeric label can never collide with a SKU,
     * and stripped of leading zeros so the same code padded two ways is one
     * entry rather than two.
     */
    private codeKeyFor(itemCode: string): string {
      return `code:${itemCode.replace(/^0+(?=\d)/, "")}`;
    }

    storeKeyFor(storeName: string): string {
      return storeName.trim().toLowerCase().replace(/\s+/g, " ");
    }

    // Joined on a NUL, which cannot appear in either half, so no store/key pair
    // can be spelled to impersonate another. Written as an escape rather than
    // embedded as a raw byte, same as the server's delimiters.
    private mapKey(storeKey: string, lookupKey: string): string {
      return `${storeKey}\u0000${lookupKey}`;
    }
  }
}
