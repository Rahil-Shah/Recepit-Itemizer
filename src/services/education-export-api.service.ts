namespace ReceiptRing.Services {
  /** What an education-expense export covers: one month, or a whole year. */
  export type EducationExportPeriod = { kind: "month"; month: string } | { kind: "year"; year: number };

  /** The file it comes as: a PDF to read, print or send, or a spreadsheet to work in. */
  export type EducationExportFormat = "pdf" | "xlsx";

  export const EDUCATION_EXPORT_FORMATS: readonly EducationExportFormat[] = ["pdf", "xlsx"];

  export interface EducationExportFile {
    blob: Blob;
    fileName: string;
  }

  export function isEducationExportFormat(value: unknown): value is EducationExportFormat {
    return typeof value === "string" && (EDUCATION_EXPORT_FORMATS as readonly string[]).includes(value);
  }

  /**
   * The export URL for a period and format, or null when the server would not
   * accept them -- caught here so a half-filled form never costs a request
   * against the export's rate limit.
   */
  export function educationExportUrl(
    period: EducationExportPeriod,
    format: EducationExportFormat = "xlsx"
  ): string | null {
    if (!isEducationExportFormat(format)) return null;

    let query: string;
    if (period.kind === "month") {
      const match = /^(\d{4})-(\d{2})$/.exec(period.month);
      if (!match) return null;
      const month = Number(match[2]);
      if (month < 1 || month > 12) return null;
      query = `month=${encodeURIComponent(period.month)}`;
    } else {
      if (!Number.isInteger(period.year) || period.year < 2000 || period.year > 2100) return null;
      query = `year=${period.year}`;
    }
    return `/api/education-expenses/export?${query}&format=${format}`;
  }

  /** The file name the server chose, from its Content-Disposition header. */
  export function exportFileName(disposition: string | null, fallback: string): string {
    const match = disposition ? /filename="?([^";]+)"?/i.exec(disposition) : null;
    return match ? match[1] : fallback;
  }

  export class EducationExportApiService {
    /**
     * Fetch the file. `signal` lets the dialog's Cancel stop waiting for it;
     * the fetch then rejects with an AbortError.
     */
    async download(
      period: EducationExportPeriod,
      format: EducationExportFormat = "xlsx",
      signal?: AbortSignal
    ): Promise<EducationExportFile> {
      const url = educationExportUrl(period, format);
      if (!url) {
        throw new Error("Choose a month or a year to export.");
      }

      const response = await fetch(url, { signal });
      if (!response.ok) {
        // The server explains itself in an { error } body, including how long
        // to wait when the export's rate limit has been reached.
        let message = `Export failed (${response.status}).`;
        try {
          const data = (await response.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          // Keep the status-only message.
        }
        throw new Error(message);
      }

      const base = period.kind === "month" ? `education-expenses-${period.month}` : `education-expenses-${period.year}`;
      return {
        blob: await response.blob(),
        fileName: exportFileName(response.headers.get("Content-Disposition"), `${base}.${format}`)
      };
    }
  }
}
