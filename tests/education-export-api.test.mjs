import test from "node:test";
import assert from "node:assert/strict";
import { loadReceiptRing } from "./helpers/load-bundle.mjs";

const { ReceiptRing } = loadReceiptRing();
const { educationExportUrl, exportFileName, isEducationExportFormat } = ReceiptRing.Services;

test("educationExportUrl builds the month and year URLs, spreadsheet by default", () => {
  assert.equal(
    educationExportUrl({ kind: "month", month: "2026-08" }),
    "/api/education-expenses/export?month=2026-08&format=xlsx"
  );
  assert.equal(
    educationExportUrl({ kind: "year", year: 2026 }),
    "/api/education-expenses/export?year=2026&format=xlsx"
  );
});

test("educationExportUrl asks for a PDF when told to", () => {
  assert.equal(
    educationExportUrl({ kind: "month", month: "2026-08" }, "pdf"),
    "/api/education-expenses/export?month=2026-08&format=pdf"
  );
  assert.equal(
    educationExportUrl({ kind: "year", year: 2026 }, "pdf"),
    "/api/education-expenses/export?year=2026&format=pdf"
  );
});

test("educationExportUrl refuses a period or format the server would reject", () => {
  // An empty <input type="month"> reads as "".
  assert.equal(educationExportUrl({ kind: "month", month: "" }), null);
  assert.equal(educationExportUrl({ kind: "month", month: "2026-13" }), null);
  assert.equal(educationExportUrl({ kind: "month", month: "2026-8" }), null);
  assert.equal(educationExportUrl({ kind: "year", year: Number.NaN }), null);
  assert.equal(educationExportUrl({ kind: "year", year: 1999 }), null);
  assert.equal(educationExportUrl({ kind: "year", year: 2026.5 }), null);
  assert.equal(educationExportUrl({ kind: "year", year: 2026 }, "docx"), null);
});

test("isEducationExportFormat knows the two formats and nothing else", () => {
  assert.equal(isEducationExportFormat("pdf"), true);
  assert.equal(isEducationExportFormat("xlsx"), true);
  assert.equal(isEducationExportFormat("PDF"), false);
  assert.equal(isEducationExportFormat(null), false);
});

test("exportFileName takes the server's name, or falls back", () => {
  assert.equal(
    exportFileName('attachment; filename="education-expenses-2026.xlsx"', "fallback.xlsx"),
    "education-expenses-2026.xlsx"
  );
  assert.equal(exportFileName("attachment; filename=plain.pdf", "fallback.pdf"), "plain.pdf");
  assert.equal(exportFileName(null, "fallback.xlsx"), "fallback.xlsx");
  assert.equal(exportFileName("attachment", "fallback.xlsx"), "fallback.xlsx");
});

// --- download() -----------------------------------------------------------------

function withFetch(respond) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    return respond(url, init);
  };
  const { ReceiptRing: Ring } = loadReceiptRing({ fetch });
  return { service: new Ring.Services.EducationExportApiService(), calls };
}

function response({ ok = true, status = 200, headers = {}, json, blob = "file" }) {
  return {
    ok,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => {
      if (json === undefined) throw new SyntaxError("not json");
      return json;
    },
    blob: async () => blob
  };
}

test("download fetches the PDF and names it as the server did", async () => {
  const signal = { aborted: false };
  const { service, calls } = withFetch(() =>
    response({ headers: { "content-disposition": 'attachment; filename="education-expenses-2026-08.pdf"' } })
  );

  const file = await service.download({ kind: "month", month: "2026-08" }, "pdf", signal);
  assert.equal(calls[0].url, "/api/education-expenses/export?month=2026-08&format=pdf");
  assert.equal(calls[0].init.signal, signal, "Cancel's signal reaches the fetch");
  assert.equal(file.fileName, "education-expenses-2026-08.pdf");
  assert.equal(file.blob, "file");
});

test("download falls back to a name with the right extension", async () => {
  const { service } = withFetch(() => response({}));
  const file = await service.download({ kind: "year", year: 2026 }, "pdf");
  assert.equal(file.fileName, "education-expenses-2026.pdf");
});

test("download passes on the server's explanation, like a rate limit's", async () => {
  const { service } = withFetch(() =>
    response({ ok: false, status: 429, json: { error: "Too many exports in a row. Give it a few minutes and try again." } })
  );
  await assert.rejects(service.download({ kind: "year", year: 2026 }, "pdf"), /Too many exports in a row/);

  const { service: bare } = withFetch(() => response({ ok: false, status: 502 }));
  await assert.rejects(bare.download({ kind: "year", year: 2026 }, "pdf"), /Export failed \(502\)/);
});

test("download never sends a request for a period that is not one", async () => {
  const { service, calls } = withFetch(() => response({}));
  await assert.rejects(service.download({ kind: "month", month: "" }, "pdf"), /Choose a month or a year/);
  assert.equal(calls.length, 0);
});
