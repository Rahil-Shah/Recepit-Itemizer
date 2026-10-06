// Whole-database backup, for admin accounts.
//
// Every table that holds user data is served one page at a time: first a
// manifest naming the tables and their row counts, then each table's rows in
// id order, a page per request, until there is no next cursor. Paged because
// a serverless response is capped at a few megabytes and one table of receipt
// photos is well past that; the client (the app's Settings page, or any other
// client of the API) stitches the pages into one archive.
//
// Sessions and rate-limit counters are left out: they are short-lived, a
// restored session would sign somebody in, and neither is anybody's data.
//
// Credential columns -- password hashes, the encrypted Gemini keys and Plaid
// tokens -- are left out unless the request asks for them with secrets=true.
// They are hashed or encrypted (the encryption key never leaves the server's
// environment), but they are what a restore needs to let people sign back in
// and keep their bank links, so it is the admin's call, made per backup.

export const BACKUP_FORMAT = "receipt-ring-backup/1";

/** In restore order: every table after the tables it refers to. */
export const BACKUP_TABLES = [
  { name: "users", model: "user", secrets: ["passwordHash", "geminiKeyCiphertext", "geminiKeyIv", "geminiKeyAuthTag"] },
  { name: "account_people", model: "accountPerson" },
  { name: "item_aliases", model: "itemAlias" },
  { name: "receipts", model: "receipt", heavy: true },
  { name: "receipt_lines", model: "receiptLine" },
  { name: "people", model: "person" },
  { name: "line_assignments", model: "lineAssignment" },
  { name: "rent_entries", model: "rentEntry", heavy: true },
  { name: "bank_connections", model: "bankConnection", secrets: ["encryptedToken", "tokenIv", "tokenAuthTag"] },
  { name: "bank_accounts", model: "bankAccount" },
  { name: "bank_transactions", model: "bankTransaction" }
];

// Rows fetched per page. Tables that carry base64 photos fetch fewer, and every
// page is also trimmed to a byte budget below, whatever its table.
const PAGE_ROWS = 500;
const HEAVY_PAGE_ROWS = 40;
export const PAGE_BYTE_BUDGET = 3 * 1024 * 1024;
const CURSOR_PATTERN = /^[\w-]{1,64}$/;

export const BACKUP_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 3000,
  message: "Too many backup requests. Give it a few minutes."
};

export function backupTable(name) {
  return BACKUP_TABLES.find((table) => table.name === name) ?? null;
}

export function wantsSecrets(query) {
  return String(query?.secrets ?? "").toLowerCase() === "true";
}

function omitFor(table, includeSecrets) {
  if (includeSecrets || !table.secrets) return undefined;
  return Object.fromEntries(table.secrets.map((field) => [field, true]));
}

/**
 * Up to one page of rows, as JSON-ready objects, and the cursor for the next
 * page (null on the last). Always at least one row when there are any, so a
 * single row over the byte budget still moves the backup forward.
 */
export async function readBackupPage(prisma, table, { cursor = null, includeSecrets = false, byteBudget = PAGE_BYTE_BUDGET } = {}) {
  const take = table.heavy ? HEAVY_PAGE_ROWS : PAGE_ROWS;
  const omit = omitFor(table, includeSecrets);
  const found = await prisma[table.model].findMany({
    where: cursor ? { id: { gt: cursor } } : {},
    orderBy: { id: "asc" },
    take: take + 1,
    ...(omit ? { omit } : {})
  });

  const more = found.length > take;
  const candidates = more ? found.slice(0, take) : found;
  const rows = [];
  let bytes = 0;
  for (const row of candidates) {
    const plain = JSON.parse(JSON.stringify(row));
    const size = Buffer.byteLength(JSON.stringify(plain));
    if (rows.length > 0 && bytes + size > byteBudget) break;
    rows.push(plain);
    bytes += size;
  }

  const trimmed = rows.length < candidates.length;
  return {
    rows,
    nextCursor: more || trimmed ? rows[rows.length - 1].id : null
  };
}

export function registerAdminBackup(app, requireAuth, requireAdmin, prisma, limiters = []) {
  const guards = [requireAuth, requireAdmin, ...[limiters].flat().filter(Boolean)];

  app.get("/api/admin/backup", ...guards, async (req, res) => {
    const includeSecrets = wantsSecrets(req.query);
    try {
      const counts = await Promise.all(BACKUP_TABLES.map((table) => prisma[table.model].count()));
      console.log(`Backup started by ${req.userEmail}${includeSecrets ? " (with credentials)" : ""}.`);
      res.setHeader("Cache-Control", "no-store");
      res.json({
        format: BACKUP_FORMAT,
        generatedAt: new Date().toISOString(),
        includesSecrets: includeSecrets,
        tables: BACKUP_TABLES.map((table, index) => ({
          name: table.name,
          rows: counts[index],
          omittedColumns: includeSecrets ? [] : table.secrets ?? []
        }))
      });
    } catch (error) {
      console.error("Backup manifest failed:", error);
      res.status(500).json({ error: "Could not start the backup." });
    }
  });

  app.get("/api/admin/backup/:table", ...guards, async (req, res) => {
    const table = backupTable(req.params.table);
    if (!table) return res.status(404).json({ error: "No such table in the backup." });

    const cursor = typeof req.query.cursor === "string" && req.query.cursor ? req.query.cursor : null;
    if (cursor && !CURSOR_PATTERN.test(cursor)) {
      return res.status(400).json({ error: "That cursor is not valid." });
    }

    try {
      const page = await readBackupPage(prisma, table, { cursor, includeSecrets: wantsSecrets(req.query) });
      res.setHeader("Cache-Control", "no-store");
      res.json({ table: table.name, ...page });
    } catch (error) {
      console.error(`Backup of ${table.name} failed:`, error);
      res.status(500).json({ error: "Could not read that table." });
    }
  });
}
