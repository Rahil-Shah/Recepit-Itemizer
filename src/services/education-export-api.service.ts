namespace ReceiptRing.Services {
  /** What an education-expense export covers: one month, or a whole year. */
  export type EducationExportPeriod = { kind: "month"; month: string } | { kind: "year"; year: number };

  export interface EducationExportFile {
    blob: Blob;
    fileName: string;
  }

  /**
   * The export URL for a period, or null when the period is not one the server
   * would accept -- caught here so a half-filled form never costs a request
   * against the export's rate limit.
   */
  export function educationExportUrl(period: EducationExportPeriod): string | null {
    if (period.kind === "month") {
      const match = /^(\d{4})-(\d{2})$/.exec(period.month);
      if (!match) return null;
      const month = Number(match[2]);
      if (month < 1 || month > 12) return null;
      return `/api/education-expenses/export?month=${encodeURIComponent(period.month)}`;
    }
    if (!Number.isInteger(period.year) || period.year < 2000 || period.year > 2100) return null;
    return `/api/education-expenses/export?year=${period.year}`;
  }

  /** The file name the server chose, from its Content-Disposition header. */
  export function exportFileName(disposition: string | null, fallback: string): string {
    const match = disposition ? /filename="?([^";]+)"?/i.exec(disposition) : null;
    return match ? match[1] : fallback;
  }

  export class EducationExportApiService {
    async download(period: EducationExportPeriod): Promise<EducationExportFile> {
      const url = educationExportUrl(period);
      if (!url) {
        throw new Error("Choose a month or a year to export.");
      }

      const response = await fetch(url);
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

      const fallback =
        period.kind === "month" ? `education-expenses-${period.month}.xlsx` : `education-expenses-${period.year}.xlsx`;
      return {
        blob: await response.blob(),
        fileName: exportFileName(response.headers.get("Content-Disposition"), fallback)
      };
    }
  }
}
