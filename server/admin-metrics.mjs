// Admin tools: how the instance is being used, account by account.
//
// Admin-only on every route (requireAuth + requireAdmin; the page hiding the
// button is a convenience, not the guard). What an admin sees is counts and
// metadata -- how many receipts, how many lines were identified, when an
// account was last signed in -- never anyone's credentials, keys, photos or
// the contents of their receipts. The one action is signing an account out
// everywhere, which takes nothing away and is the first thing to reach for
// when an account looks compromised.

import { isAdmin, maxReceiptsPerUser, maxUsers } from "./access.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS_SHOWN = 12;
const ID_PATTERN = /^[\w-]{1,64}$/;

export const ADMIN_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: "Too many admin requests. Give it a minute."
};

const num = (value) => (value === null || value === undefined ? 0 : Number(value));

/** "YYYY-MM" for each of the last `count` months, oldest first, in UTC. */
export function recentMonths(count = MONTHS_SHOWN, now = new Date()) {
  const months = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    months.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

function monthStart(months) {
  const [year, month] = months[0].split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

/** Rows of { month, ...counts } filled out to every month in `months`. */
function fillMonths(months, rows, fields) {
  const byMonth = new Map(rows.map((row) => [row.month, row]));
  return months.map((month) => {
    const row = byMonth.get(month) ?? {};
    return { month, ...Object.fromEntries(fields.map((field) => [field, num(row[field])])) };
  });
}

/** Per-account usage, keyed by user id. One query per measure, not per user. */
async function usageByUser(prisma, userIds = null) {
  const where = userIds ? { userId: { in: userIds } } : { userId: { not: null } };
  const [receipts, photos, lines, sessions] = await Promise.all([
    prisma.receipt.groupBy({ by: ["userId"], where, _count: { _all: true }, _sum: { total: true }, _max: { createdAt: true } }),
    prisma.receipt.groupBy({ by: ["userId"], where: { ...where, imageMimeType: { not: null } }, _count: { _all: true } }),
    prisma.$queryRaw`
      SELECT r."userId" AS "userId",
             COUNT(l.id)::int AS "lines",
             COUNT(l."resolvedName")::int AS "identified",
             COUNT(*) FILTER (WHERE l."isFood")::int AS "food"
      FROM receipt_lines l JOIN receipts r ON r.id = l."receiptId"
      WHERE r."userId" IS NOT NULL
      GROUP BY r."userId"`,
    prisma.session.groupBy({
      by: ["userId"],
      where: { ...(userIds ? { userId: { in: userIds } } : {}), expiresAt: { gt: new Date() } },
      _count: { _all: true },
      _max: { createdAt: true }
    })
  ]);

  const usage = new Map();
  const entry = (userId) => {
    if (!usage.has(userId)) {
      usage.set(userId, {
        receipts: 0, spend: 0, lastReceiptAt: null, photos: 0, lines: 0, identifiedLines: 0,
        foodLines: 0, activeSessions: 0, lastSignInAt: null
      });
    }
    return usage.get(userId);
  };
  for (const row of receipts) {
    const e = entry(row.userId);
    e.receipts = row._count._all;
    e.spend = num(row._sum.total);
    e.lastReceiptAt = row._max.createdAt;
  }
  for (const row of photos) entry(row.userId).photos = row._count._all;
  for (const row of lines) {
    if (userIds && !userIds.includes(row.userId)) continue;
    const e = entry(row.userId);
    e.lines = num(row.lines);
    e.identifiedLines = num(row.identified);
    e.foodLines = num(row.food);
  }
  for (const row of sessions) {
    const e = entry(row.userId);
    e.activeSessions = row._count._all;
    e.lastSignInAt = row._max.createdAt;
  }
  return usage;
}

const EMPTY_USAGE = {
  receipts: 0, spend: 0, lastReceiptAt: null, photos: 0, lines: 0, identifiedLines: 0,
  foodLines: 0, activeSessions: 0, lastSignInAt: null
};

// The fields an admin is shown about an account. Built field by field, so a
// column added to the users table later is not shown by accident.
function accountSummary(user, usage) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: isAdmin(user.email),
    joinedAt: user.createdAt,
    hasOwnGeminiKey: Boolean(user.geminiKeyCiphertext),
    people: user._count.accountPeople,
    rentEntries: user._count.rentEntries,
    savedNames: user._count.itemAliases,
    bankConnections: user._count.bankConnections,
    ...usage
  };
}

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
  // Selected only to say whether there is one; never returned.
  geminiKeyCiphertext: true,
  _count: { select: { accountPeople: true, rentEntries: true, itemAliases: true, bankConnections: true } }
};

export function registerAdminMetrics(app, requireAuth, requireAdmin, prisma, limiters = []) {
  const guards = [requireAuth, requireAdmin, ...[limiters].flat().filter(Boolean)];

  app.get("/api/admin/overview", ...guards, async (req, res) => {
    try {
      const now = new Date();
      const months = recentMonths(MONTHS_SHOWN, now);
      const since = monthStart(months);
      const last7 = new Date(now.getTime() - 7 * DAY_MS);
      const last30 = new Date(now.getTime() - 30 * DAY_MS);

      const [
        users,
        newLast7,
        newLast30,
        activeSessions,
        withOwnKey,
        receipts,
        receiptsLast30,
        withPhotos,
        spend,
        lines,
        identifiedLines,
        foodLines,
        connections,
        transactions,
        rent,
        aliases,
        photoChars,
        receiptMonths,
        signupMonths
      ] = await Promise.all([
        prisma.user.findMany({ select: { email: true } }),
        prisma.user.count({ where: { createdAt: { gte: last7 } } }),
        prisma.user.count({ where: { createdAt: { gte: last30 } } }),
        prisma.session.findMany({
          where: { expiresAt: { gt: now }, createdAt: { gte: last30 } },
          distinct: ["userId"],
          select: { userId: true }
        }),
        prisma.user.count({ where: { geminiKeyCiphertext: { not: null } } }),
        prisma.receipt.count(),
        prisma.receipt.count({ where: { createdAt: { gte: last30 } } }),
        prisma.receipt.count({ where: { imageMimeType: { not: null } } }),
        prisma.receipt.aggregate({ _sum: { total: true } }),
        prisma.receiptLine.count(),
        prisma.receiptLine.count({ where: { resolvedName: { not: null } } }),
        prisma.receiptLine.count({ where: { isFood: true } }),
        prisma.bankConnection.count(),
        prisma.bankTransaction.count(),
        prisma.rentEntry.aggregate({ _count: { _all: true }, _sum: { amount: true } }),
        prisma.itemAlias.count(),
        prisma.$queryRaw`
          SELECT COALESCE(SUM(LENGTH("imageData")), 0)::bigint AS receipts,
                 (SELECT COALESCE(SUM(LENGTH("photoData")), 0) FROM rent_entries)::bigint AS rent
          FROM receipts`,
        prisma.$queryRaw`
          SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM') AS month,
                 COUNT(*)::int AS receipts,
                 COALESCE(SUM(total), 0)::float AS spend
          FROM receipts WHERE "createdAt" >= ${since}
          GROUP BY 1`,
        prisma.$queryRaw`
          SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM') AS month,
                 COUNT(*)::int AS signups
          FROM users WHERE "createdAt" >= ${since}
          GROUP BY 1`
      ]);

      // Base64 is four characters for every three bytes.
      const [chars] = photoChars;
      const photoBytes = Math.round(((num(chars.receipts) + num(chars.rent)) * 3) / 4);

      res.setHeader("Cache-Control", "no-store");
      res.json({
        generatedAt: now.toISOString(),
        limits: { maxUsers: maxUsers(), maxReceiptsPerUser: maxReceiptsPerUser() },
        users: {
          total: users.length,
          admins: users.filter((user) => isAdmin(user.email)).length,
          newLast7Days: newLast7,
          newLast30Days: newLast30,
          activeLast30Days: activeSessions.length,
          withOwnGeminiKey: withOwnKey
        },
        receipts: {
          total: receipts,
          last30Days: receiptsLast30,
          withPhotos,
          totalSpend: num(spend._sum.total),
          lines,
          identifiedLines,
          foodLines
        },
        bank: { connections, transactions },
        rent: { entries: rent._count._all, total: num(rent._sum.amount) },
        savedNames: aliases,
        storage: { photoBytes },
        monthly: fillMonths(
          months,
          receiptMonths.map((row) => ({
            ...row,
            signups: signupMonths.find((signup) => signup.month === row.month)?.signups ?? 0
          })).concat(
            signupMonths
              .filter((signup) => !receiptMonths.some((row) => row.month === signup.month))
              .map((signup) => ({ month: signup.month, signups: signup.signups }))
          ),
          ["receipts", "spend", "signups"]
        )
      });
    } catch (error) {
      console.error("Admin overview failed:", error);
      res.status(500).json({ error: "Could not load the overview." });
    }
  });

  app.get("/api/admin/users", ...guards, async (req, res) => {
    try {
      const [users, usage] = await Promise.all([
        prisma.user.findMany({ select: USER_SELECT, orderBy: { createdAt: "desc" } }),
        usageByUser(prisma)
      ]);
      res.setHeader("Cache-Control", "no-store");
      res.json({
        users: users.map((user) => accountSummary(user, usage.get(user.id) ?? EMPTY_USAGE))
      });
    } catch (error) {
      console.error("Admin user list failed:", error);
      res.status(500).json({ error: "Could not load the accounts." });
    }
  });

  app.get("/api/admin/users/:id", ...guards, async (req, res) => {
    if (!ID_PATTERN.test(req.params.id)) return res.status(400).json({ error: "That id is not valid." });
    try {
      const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: USER_SELECT });
      if (!user) return res.status(404).json({ error: "No such account." });

      const months = recentMonths(MONTHS_SHOWN);
      const [usage, recent, perMonth, transactions] = await Promise.all([
        usageByUser(prisma, [user.id]),
        prisma.receipt.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            storeName: true,
            category: true,
            total: true,
            createdAt: true,
            imageMimeType: true,
            _count: { select: { lines: true } }
          }
        }),
        prisma.$queryRaw`
          SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM') AS month,
                 COUNT(*)::int AS receipts,
                 COALESCE(SUM(total), 0)::float AS spend
          FROM receipts WHERE "userId" = ${user.id} AND "createdAt" >= ${monthStart(months)}
          GROUP BY 1`,
        prisma.bankTransaction.count({ where: { account: { connection: { userId: user.id } } } })
      ]);

      res.setHeader("Cache-Control", "no-store");
      res.json({
        ...accountSummary(user, usage.get(user.id) ?? EMPTY_USAGE),
        bankTransactions: transactions,
        monthly: fillMonths(months, perMonth, ["receipts", "spend"]),
        recentReceipts: recent.map((receipt) => ({
          id: receipt.id,
          storeName: receipt.storeName,
          category: receipt.category,
          total: receipt.total === null ? null : Number(receipt.total),
          createdAt: receipt.createdAt,
          hasImage: Boolean(receipt.imageMimeType),
          lines: receipt._count.lines
        }))
      });
    } catch (error) {
      console.error("Admin user detail failed:", error);
      res.status(500).json({ error: "Could not load that account." });
    }
  });

  // Ends every session the account holds. Not offered on your own account:
  // Settings has "sign out everywhere else" for that, which keeps this one.
  app.post("/api/admin/users/:id/sign-out", ...guards, async (req, res) => {
    if (!ID_PATTERN.test(req.params.id)) return res.status(400).json({ error: "That id is not valid." });
    if (req.params.id === req.userId) {
      return res.status(400).json({ error: "To sign out your own other sessions, use Settings." });
    }
    try {
      const exists = await prisma.user.count({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "No such account." });
      const { count } = await prisma.session.deleteMany({ where: { userId: req.params.id } });
      console.log(`Admin ${req.userEmail} signed out account ${req.params.id} (${count} session(s)).`);
      res.json({ revoked: count });
    } catch (error) {
      console.error("Admin sign-out failed:", error);
      res.status(500).json({ error: "Could not sign that account out." });
    }
  });
}
