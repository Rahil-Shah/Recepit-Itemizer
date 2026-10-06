namespace ReceiptRing.Services {
  /** Everything a full export covers, as the app already holds it. */
  export interface DataExportInput {
    receipts: readonly SavedReceiptSummary[];
    transactions: readonly BankTransaction[];
    rentEntries: readonly Domain.RentEntry[];
    // The owner's own share of each receipt they split, by receipt id.
    // Receipts that are absent were not split and are theirs in full.
    selfShares: ReadonlyMap<string, number>;
    exportedAt: Date;
  }

  /** One photo the export wants, and where it goes inside the ZIP. */
  export interface ExportImageRequest {
    key: string;
    // Path inside the archive without its extension, which is only known
    // once the file has arrived and said what type it is.
    basePath: string;
    url: string;
  }

  export interface DataExportProgress {
    done: number;
    total: number;
  }

  const EXTENSIONS: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "application/pdf": "pdf"
  };

  // Photos fetched at once. Enough to keep the wait short, few enough not to
  // hammer the server with a whole year at the same moment.
  const CONCURRENCY = 4;

  /**
   * Builds the "everything" export: a ZIP holding every receipt photo and
   * rent proof the account has, plus `transactions.csv` with one row for
   * every receipt, bank transaction and rent payment -- each naming the photo
   * that belongs to it -- and `items.csv` with every receipt line.
   */
  export class DataExportService {
    constructor(
      private readonly receiptImageUrl: (receiptId: string) => string,
      private readonly rentPhotoUrl: (entryId: string) => string
    ) {}

    fileName(date: Date): string {
      return `receipt-ring-export-${this.isoDate(date)}.zip`;
    }

    /** The photos to fetch, receipts first. */
    imageRequests(input: DataExportInput): ExportImageRequest[] {
      const requests: ExportImageRequest[] = [];
      for (const receipt of input.receipts) {
        if (!receipt.hasImage) continue;
        requests.push({
          key: `receipt:${receipt.id}`,
          basePath: `receipts/${this.slug(this.receiptDate(receipt), receipt.storeName || "Receipt", receipt.id)}`,
          url: this.receiptImageUrl(receipt.id)
        });
      }
      for (const entry of input.rentEntries) {
        if (!entry.hasPhoto) continue;
        requests.push({
          key: `rent:${entry.id}`,
          basePath: `rent/${this.slug(entry.date, entry.propertyName || "Rent", entry.id)}`,
          url: this.rentPhotoUrl(entry.id)
        });
      }
      return requests;
    }

    /**
     * The whole archive. `fetchImage` returns null for a photo that could not
     * be read; its row says so instead of naming a file that is not there.
     */
    async build(
      input: DataExportInput,
      fetchImage: (url: string) => Promise<Blob | null>,
      onProgress?: (progress: DataExportProgress) => void
    ): Promise<Blob> {
      const zip = new ZipWriter(input.exportedAt);
      const requests = this.imageRequests(input);
      const names = new Map<string, string>();
      let done = 0;
      onProgress?.({ done, total: requests.length });

      let next = 0;
      const worker = async (): Promise<void> => {
        while (next < requests.length) {
          const request = requests[next];
          next += 1;
          let blob: Blob | null = null;
          try {
            blob = await fetchImage(request.url);
          } catch {
            blob = null;
          }
          if (blob) {
            const path = `${request.basePath}.${EXTENSIONS[blob.type] ?? "bin"}`;
            zip.add(path, new Uint8Array(await blob.arrayBuffer()));
            names.set(request.key, path);
          }
          done += 1;
          onProgress?.({ done, total: requests.length });
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, requests.length) }, worker));

      zip.addText("transactions.csv", this.toCsv(this.transactionRows(input, names)));
      zip.addText("items.csv", this.toCsv(this.itemRows(input, names)));
      zip.addText("README.txt", this.readme(input, requests.length, names.size));
      return new Blob([zip.toBytes()], { type: "application/zip" });
    }

    /** One row per receipt, bank transaction and rent payment, oldest first. */
    transactionRows(input: DataExportInput, imageNames: ReadonlyMap<string, string>): string[][] {
      const header = [
        "Type",
        "Date",
        "Description",
        "Category",
        "Budget category",
        "Amount spent",
        "Your share",
        "Food",
        "Account",
        "Split with",
        "Image file",
        "Linked to",
        "Id"
      ];
      const rows: { date: string; cells: string[] }[] = [];
      const receiptsById = new Map(input.receipts.map((receipt) => [receipt.id, receipt]));
      const missing = (key: string, has: boolean): string => (has ? imageNames.get(key) ?? "(photo could not be exported)" : "");

      for (const receipt of input.receipts) {
        const date = this.receiptDate(receipt);
        const total = Number(receipt.total ?? 0);
        const share = input.selfShares.get(receipt.id);
        const others = receipt.people.filter((person) => !person.isSelf).map((person) => person.name);
        const linked = receipt.linkedTransaction;
        rows.push({
          date,
          cells: [
            "Receipt",
            date,
            receipt.storeName || "Untitled receipt",
            receipt.category,
            receipt.budgetCategory ?? "",
            this.money(total),
            this.money(share ?? total),
            receipt.lines.some((line) => line.isFood && !line.ignored) ? "Yes" : "No",
            "",
            others.join("; "),
            missing(`receipt:${receipt.id}`, receipt.hasImage),
            linked ? `Bank transaction: ${linked.description ?? "Transaction"} (${linked.date})` : "",
            receipt.id
          ]
        });
      }

      for (const txn of input.transactions) {
        const receipt = txn.linkedReceiptId ? receiptsById.get(txn.linkedReceiptId) : undefined;
        rows.push({
          date: txn.date,
          cells: [
            "Bank transaction",
            txn.date,
            txn.description ?? "Transaction",
            txn.category ?? "",
            txn.budgetCategory ?? "",
            // Stored negative for money out; written as money spent, so a
            // refund or deposit comes out negative.
            this.money(-txn.amount),
            this.money(-txn.amount),
            txn.isFood ? "Yes" : "No",
            txn.account ?? "",
            "",
            receipt ? missing(`receipt:${receipt.id}`, receipt.hasImage) : "",
            receipt ? `Receipt: ${receipt.storeName || "Untitled receipt"}` : "",
            txn.id
          ]
        });
      }

      for (const entry of input.rentEntries) {
        rows.push({
          date: entry.date,
          cells: [
            "Rent",
            entry.date,
            entry.propertyName || "Rent",
            "Rent",
            "",
            this.money(entry.amount),
            this.money(entry.amount),
            "No",
            "",
            "",
            missing(`rent:${entry.id}`, entry.hasPhoto === true),
            entry.bankTransactionId ? `Bank transaction ${entry.bankTransactionId}` : "",
            entry.id
          ]
        });
      }

      rows.sort((left, right) => (left.date < right.date ? -1 : left.date > right.date ? 1 : 0));
      return [header, ...rows.map((row) => row.cells)];
    }

    /** One row per receipt line. */
    itemRows(input: DataExportInput, imageNames: ReadonlyMap<string, string>): string[][] {
      const header = [
        "Receipt date",
        "Store",
        "Item (as printed)",
        "Identified as",
        "Amount",
        "Food",
        "Ignored",
        "Assigned to",
        "Image file",
        "Receipt id"
      ];
      const rows: string[][] = [header];
      for (const receipt of input.receipts) {
        const date = this.receiptDate(receipt);
        for (const line of receipt.lines) {
          rows.push([
            date,
            receipt.storeName || "Untitled receipt",
            line.label,
            line.identification?.resolvedName && line.identification.resolvedName !== line.label
              ? line.identification.resolvedName
              : "",
            this.money(Number(line.amount)),
            line.isFood ? "Yes" : "No",
            line.ignored ? "Yes" : "No",
            line.assignments.map((assignment) => assignment.personName).filter(Boolean).join("; "),
            receipt.hasImage ? imageNames.get(`receipt:${receipt.id}`) ?? "" : "",
            receipt.id
          ]);
        }
      }
      return rows;
    }

    /**
     * RFC 4180 CSV with a byte-order mark, so Excel reads accents and
     * currency symbols as UTF-8. A cell that starts like a formula is
     * prefixed with an apostrophe: store names and item labels are text from
     * a receipt, and a spreadsheet should never run them.
     */
    toCsv(rows: readonly (readonly string[])[]): string {
      const cell = (value: string): string => {
        const safe = /^[=+\-@\t\r]/.test(value) && !/^-?\d/.test(value) ? `'${value}` : value;
        return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
      };
      return "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
    }

    private readme(input: DataExportInput, wanted: number, exported: number): string {
      const lines = [
        "Receipt Ring - full data export",
        `Exported ${input.exportedAt.toLocaleString()}`,
        "",
        `transactions.csv  every receipt (${input.receipts.length}), bank transaction (${input.transactions.length}) and rent payment (${input.rentEntries.length}), oldest first.`,
        "                  The Image file column names the photo in this folder that belongs to each row.",
        "items.csv         every line of every receipt, with the name it was identified as.",
        "receipts/         receipt photos.",
        "rent/             rent proof-of-payment files.",
        "",
        `${exported} of ${wanted} photos exported.`
      ];
      return lines.join("\r\n") + "\r\n";
    }

    // A receipt's day, in the user's own zone -- the same day History shows.
    private receiptDate(receipt: SavedReceiptSummary): string {
      return this.isoDate(new Date(receipt.createdAt));
    }

    private isoDate(date: Date): string {
      if (Number.isNaN(date.getTime())) return "unknown-date";
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    // "2026-09-12 Trader Joe's (k3x9q1)": readable in a file browser, sorted
    // by date, and unique thanks to the tail of the id.
    private slug(date: string, name: string, id: string): string {
      const cleanName = name
        .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60)
        .replace(/[. ]+$/, "");
      return `${date.slice(0, 10)} ${cleanName || "Untitled"} (${id.slice(-6)})`;
    }

    private money(value: number): string {
      return Number.isFinite(value) ? value.toFixed(2) : "";
    }
  }
}
