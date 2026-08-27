namespace ReceiptRing.Services {
  /**
   * Aliases over HTTP.
   *
   * The whole set is loaded once per session rather than queried per line: a
   * receipt is forty questions, the table is small, and forty round trips to
   * answer them would cost more than the model call the aliases exist to
   * avoid.
   */
  export class ItemAliasApiService implements ItemAliasBackend {
    async load(): Promise<readonly ItemAlias[]> {
      const response = await fetch("/api/item-aliases", { credentials: "same-origin" });
      if (!response.ok) {
        throw new Error(`Could not load saved item names (${response.status}).`);
      }
      const payload = (await response.json()) as { aliases?: ItemAlias[] };
      return payload.aliases ?? [];
    }

    async save(alias: ItemAlias): Promise<void> {
      const response = await fetch("/api/item-aliases", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lookupKey: alias.lookupKey,
          storeKey: alias.storeKey,
          resolvedName: alias.resolvedName,
          ...(alias.brand ? { brand: alias.brand } : {}),
          ...(alias.size ? { size: alias.size } : {})
        })
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Could not save that name (${response.status}).`);
      }
    }

    async remove(alias: ItemAlias): Promise<void> {
      // The key goes in the query string, not the path: a lookup key is
      // arbitrary user text and a path segment is the wrong place for it.
      const query = new URLSearchParams({
        lookupKey: alias.lookupKey,
        storeKey: alias.storeKey
      });
      const response = await fetch(`/api/item-aliases?${query.toString()}`, {
        method: "DELETE",
        credentials: "same-origin"
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Could not forget that name (${response.status}).`);
      }
    }
  }
}
