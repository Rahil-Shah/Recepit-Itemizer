namespace ReceiptRing.Services {
  export interface BackupTableInfo {
    name: string;
    rows: number;
    omittedColumns: string[];
  }

  export interface BackupManifest {
    format: string;
    generatedAt: string;
    includesSecrets: boolean;
    tables: BackupTableInfo[];
  }

  interface BackupPage {
    table: string;
    rows: unknown[];
    nextCursor: string | null;
  }

  export interface BackupProgress {
    table: string;
    rowsDone: number;
    rowsTotal: number;
  }

  /** Reads a JSON route of the API, throwing the server's message on failure. */
  export type JsonFetcher = (url: string) => Promise<unknown>;

  /**
   * The admin's whole-database backup, as one ZIP: the manifest, then each
   * table as JSON Lines (one row per line, in id order), named in the order a
   * restore must load them. Pages are fetched one after another from
   * /api/admin/backup (see server/admin-backup.mjs) and joined here, because
   * no single serverless response could carry the whole database.
   */
  export class AdminBackupService {
    constructor(private readonly fetchJson: JsonFetcher) {}

    fileName(date: Date): string {
      const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`;
      return `receipt-ring-backup-${stamp}.zip`;
    }

    async build(
      includeSecrets: boolean,
      onProgress?: (progress: BackupProgress) => void,
      now: Date = new Date()
    ): Promise<Blob> {
      const secrets = includeSecrets ? "true" : "false";
      const manifest = (await this.fetchJson(`/api/admin/backup?secrets=${secrets}`)) as BackupManifest;
      const rowsTotal = manifest.tables.reduce((sum, table) => sum + table.rows, 0);
      const zip = new ZipWriter(now);
      zip.addText("manifest.json", JSON.stringify(manifest, null, 2) + "\n");

      let rowsDone = 0;
      for (const [index, table] of manifest.tables.entries()) {
        const lines: string[] = [];
        let cursor: string | null = null;
        do {
          const query: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
          const page = (await this.fetchJson(
            `/api/admin/backup/${encodeURIComponent(table.name)}?secrets=${secrets}${query}`
          )) as BackupPage;
          for (const row of page.rows) lines.push(JSON.stringify(row));
          rowsDone += page.rows.length;
          onProgress?.({ table: table.name, rowsDone, rowsTotal });
          // A page that claims more but brings nothing would loop forever.
          cursor = page.rows.length > 0 ? page.nextCursor : null;
        } while (cursor);
        const order = String(index + 1).padStart(2, "0");
        zip.addText(`tables/${order}-${table.name}.jsonl`, lines.length > 0 ? lines.join("\n") + "\n" : "");
      }

      zip.addText("README.txt", this.readme(manifest));
      return new Blob([zip.toBytes()], { type: "application/zip" });
    }

    private readme(manifest: BackupManifest): string {
      const lines = [
        "Receipt Ring - database backup",
        `Format ${manifest.format}, taken ${manifest.generatedAt}.`,
        "",
        "tables/NN-<table>.jsonl holds every row of one table, one JSON object per line,",
        "numbered in the order a restore must load them (each after the tables it refers to).",
        "Column names are the Prisma model's field names; photos are base64 in imageData / photoData.",
        "Sessions and rate-limit counters are not included.",
        "",
        manifest.includesSecrets
          ? "Credential columns ARE included (password hashes, encrypted Gemini keys and Plaid tokens). Keep this file private. The encrypted values only decrypt with the server's TOKEN_ENCRYPTION_KEY."
          : "Credential columns are NOT included: restored accounts will need new passwords, Gemini keys and bank links.",
        "",
        ...manifest.tables.map((table) => `${table.name}: ${table.rows} rows`)
      ];
      return lines.join("\r\n") + "\r\n";
    }
  }
}
