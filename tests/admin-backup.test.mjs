import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { startTestServer, JPEG_DATA_URL } from "./helpers/test-server.mjs";
import { loadReceiptRing } from "./helpers/load-bundle.mjs";
import { BACKUP_TABLES, backupTable, readBackupPage, wantsSecrets } from "../server/admin-backup.mjs";

const server = await startTestServer();
test.after(() => server.close());

async function seed(user, count) {
  for (let i = 0; i < count; i += 1) {
    const saved = await user.post("/api/receipts", {
      storeName: `Store ${i}`,
      category: "Groceries",
      subtotal: 3,
      tax: 0,
      total: 3,
      people: [],
      lines: [{ clientId: `l${i}`, label: `Item ${i}`, amount: 3, ignored: false }],
      assignments: [],
      imageDataUrl: JPEG_DATA_URL
    });
    assert.equal(saved.status, 201, JSON.stringify(saved.body));
  }
}

test("only admins may back up", async () => {
  const user = await server.signUp();
  assert.equal((await user.get("/api/admin/backup")).status, 403);
  assert.equal((await user.get("/api/admin/backup/users")).status, 403);
  assert.equal((await server.client().get("/api/admin/backup")).status, 401);
});

test("the manifest lists every table with its row count, credentials left out by default", async () => {
  const admin = await server.admin();
  await seed(admin, 2);
  const manifest = await admin.get("/api/v1/admin/backup");
  assert.equal(manifest.status, 200);
  assert.equal(manifest.body.format, "receipt-ring-backup/1");
  assert.equal(manifest.body.includesSecrets, false);
  assert.deepEqual(manifest.body.tables.map((t) => t.name), BACKUP_TABLES.map((t) => t.name));
  const receipts = manifest.body.tables.find((t) => t.name === "receipts");
  assert.equal(receipts.rows, await server.prisma.receipt.count());
  assert.deepEqual(manifest.body.tables[0].omittedColumns, ["passwordHash", "geminiKeyCiphertext", "geminiKeyIv", "geminiKeyAuthTag"]);
});

test("a table page leaves credentials out unless asked, and includes photos", async () => {
  const admin = await server.admin();
  const users = await admin.get("/api/admin/backup/users");
  assert.equal(users.status, 200);
  assert.ok(users.body.rows.length >= 1);
  assert.ok(users.body.rows.every((row) => !("passwordHash" in row)));

  const withSecrets = await admin.get("/api/admin/backup/users?secrets=true");
  assert.ok(withSecrets.body.rows.some((row) => typeof row.passwordHash === "string"));

  const receipts = await admin.get("/api/admin/backup/receipts");
  assert.ok(receipts.body.rows.some((row) => typeof row.imageData === "string"));
});

test("unknown tables and malformed cursors are refused", async () => {
  const admin = await server.admin();
  assert.equal((await admin.get("/api/admin/backup/sessions")).status, 404);
  assert.equal((await admin.get("/api/admin/backup/users?cursor=../../x")).status, 400);
});

test("pages follow the cursor, and the byte budget trims a page without losing rows", async () => {
  const table = backupTable("receipts");
  const all = await server.prisma.receipt.findMany({ orderBy: { id: "asc" }, select: { id: true } });
  assert.ok(all.length >= 2);

  const seen = [];
  let cursor = null;
  do {
    const page = await readBackupPage(server.prisma, table, { cursor, byteBudget: 10 });
    assert.equal(page.rows.length, 1, "a tiny budget still moves one row at a time");
    seen.push(...page.rows.map((row) => row.id));
    cursor = page.nextCursor;
  } while (cursor);
  assert.deepEqual(seen, all.map((row) => row.id));
});

test("wantsSecrets is strict about its flag", () => {
  assert.equal(wantsSecrets({ secrets: "true" }), true);
  assert.equal(wantsSecrets({ secrets: "TRUE" }), true);
  assert.equal(wantsSecrets({ secrets: "1" }), false);
  assert.equal(wantsSecrets(undefined), false);
});

test("the app's backup service turns the pages into a restorable ZIP", async (t) => {
  const admin = await server.admin();
  const { ReceiptRing } = loadReceiptRing({ TextEncoder, Blob, DataView, Uint8Array, Uint32Array, ArrayBuffer, encodeURIComponent });
  const fetchJson = async (url) => {
    const response = await admin.get(url);
    if (response.status !== 200) throw new Error(response.body.error);
    return response.body;
  };
  const service = new ReceiptRing.Services.AdminBackupService(fetchJson);
  const progress = [];
  const blob = await service.build(true, (p) => progress.push(p.rowsDone), new Date(2026, 9, 6));
  assert.equal(service.fileName(new Date(2026, 9, 6)), "receipt-ring-backup-2026-10-06.zip");
  assert.ok(progress.length >= BACKUP_TABLES.length);

  const dir = mkdtempSync(path.join(tmpdir(), "rr-backup-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "backup.zip");
  writeFileSync(file, new Uint8Array(await blob.arrayBuffer()));

  let summary;
  try {
    summary = JSON.parse(
      execFileSync("python3", [
        "-c",
        [
          "import sys, json, zipfile",
          "z = zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None",
          "names = z.namelist()",
          "receipts = [json.loads(l) for l in z.read('tables/04-receipts.jsonl').decode().splitlines()]",
          "users = [json.loads(l) for l in z.read('tables/01-users.jsonl').decode().splitlines()]",
          "print(json.dumps({'names': names, 'receipts': len(receipts), 'hash': all('passwordHash' in u for u in users)}))"
        ].join("\n"),
        file
      ]).toString()
    );
  } catch (error) {
    if (error.code === "ENOENT") return t.skip("python3 is not available");
    throw error;
  }
  assert.equal(summary.names[0], "manifest.json");
  assert.equal(summary.names.at(-1), "README.txt");
  assert.equal(summary.names.length, BACKUP_TABLES.length + 2);
  assert.equal(summary.receipts, await server.prisma.receipt.count());
  assert.equal(summary.hash, true);
});

test("the backup service stops on a server error", async () => {
  const { ReceiptRing } = loadReceiptRing({ TextEncoder, Blob, DataView, Uint8Array, Uint32Array, ArrayBuffer, encodeURIComponent });
  const service = new ReceiptRing.Services.AdminBackupService(async () => {
    throw new Error("This feature is only available to admin accounts.");
  });
  await assert.rejects(service.build(false), /admin accounts/);
});
