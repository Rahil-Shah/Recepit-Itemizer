// Bank (Plaid) routes. Everything here is read-only and user-scoped: each
// endpoint requires authentication and only ever touches the current user's
// own connections, accounts, and transactions.

import {
  plaidConfig,
  createLinkToken,
  exchangePublicToken,
  getAccounts,
  syncTransactions,
  removeItem,
  getItem
} from "./plaid.mjs";
import { encryptSecret, decryptSecret } from "./crypto.mjs";

// Plaid error codes that mean the stored access token can no longer be used and
// the user has to go through Link again. Everything else is treated as a
// transient failure worth retrying on the next sync.
const RECONNECT_ERROR_CODES = new Set([
  "ITEM_LOGIN_REQUIRED",
  "ITEM_LOCKED",
  "INVALID_ACCESS_TOKEN",
  "INVALID_CREDENTIALS",
  "INVALID_MFA",
  "USER_PERMISSION_REVOKED",
  "PENDING_EXPIRATION",
  "ITEM_NOT_FOUND"
]);

export function createBank(prisma) {
  // Revoke access tokens for connections we have already deleted locally.
  // Always best-effort: the rows are gone either way, and a stale Item left at
  // Plaid is harmless, so a failure here must never fail the caller's request.
  async function releaseItems(connections) {
    for (const connection of connections ?? []) {
      try {
        await removeItem(
          decryptSecret({
            ciphertext: connection.encryptedToken,
            iv: connection.tokenIv,
            authTag: connection.tokenAuthTag
          })
        );
      } catch (error) {
        console.warn("Could not release Plaid item:", error?.message ?? error);
      }
    }
  }

  // Fill in institutionId for a user's connections stored before we recorded
  // it. Without this, an existing connection can never match a re-link of the
  // same bank, so the duplicate-import it is meant to prevent would happen once
  // more for anyone who linked before this field existed. Best-effort: a
  // connection we cannot ask about is simply left alone.
  async function backfillInstitutionIds(userId) {
    const stale = await prisma.bankConnection.findMany({
      where: { userId, institutionId: null },
      select: { id: true, encryptedToken: true, tokenIv: true, tokenAuthTag: true }
    });

    for (const connection of stale) {
      try {
        const item = await getItem(
          decryptSecret({
            ciphertext: connection.encryptedToken,
            iv: connection.tokenIv,
            authTag: connection.tokenAuthTag
          })
        );
        const institutionId = item?.item?.institution_id ?? null;
        if (institutionId) {
          await prisma.bankConnection.update({
            where: { id: connection.id },
            data: { institutionId }
          });
        }
      } catch (error) {
        console.warn("Could not backfill institution for connection:", connection.id, error?.message ?? error);
      }
    }
  }

  // Persist (or refresh) the accounts Plaid returns for a connection.
  //
  // plaidAccountId is globally unique, so a naive upsert-by-id would let one
  // user reassign a row that already belongs to another user. This can happen
  // in Plaid's sandbox, where linking the same test bank returns stable ids.
  // Guard against it: never touch a row owned by a different user.
  //
  // `client` is either the shared Prisma client or a transaction handle, so the
  // caller decides whether these writes join a surrounding transaction.
  async function storeAccounts(client, connectionId, userId, accounts) {
    for (const account of accounts ?? []) {
      if (!account?.account_id) continue;
      const existing = await client.bankAccount.findUnique({
        where: { plaidAccountId: account.account_id },
        include: { connection: { select: { userId: true } } }
      });
      if (existing && existing.connection?.userId !== userId) {
        console.warn("Skipping bank account owned by another user:", account.account_id);
        continue;
      }
      const fields = {
        name: account.name ?? null,
        type: account.subtype ?? account.type ?? null,
        lastFour: account.mask ?? null
      };
      await client.bankAccount.upsert({
        where: { plaidAccountId: account.account_id },
        update: { connectionId, ...fields },
        create: { connectionId, plaidAccountId: account.account_id, ...fields }
      });
    }
  }

  // Pull every page of /transactions/sync for one connection, upserting the
  // added/modified batches and deleting the removed ones. Returns the number of
  // rows written and the cursor to persist for next time.
  async function syncConnection(connection, userId) {
    // Map Plaid account ids to our own account row ids for this connection.
    let accountRowByPlaidId = new Map(
      connection.accounts.map((account) => [account.plaidAccountId, account.id])
    );

    const token = decryptSecret({
      ciphertext: connection.encryptedToken,
      iv: connection.tokenIv,
      authTag: connection.tokenAuthTag
    });

    let cursor = connection.transactionCursor ?? null;
    let imported = 0;
    let skipped = 0;
    let hasMore = true;
    let refetchedAccounts = false;

    // Accounts are captured at link time, but an Item's account list can grow
    // afterwards (the user adds a card, or opens a new account at the same
    // bank). A transaction whose account we have never seen used to be dropped
    // on the floor while the cursor still advanced past it, so it could never
    // be recovered by refreshing. Re-fetch the account list once per sync when
    // an unknown id shows up, and treat anything still unresolved as a reason
    // not to advance the cursor.
    const resolveAccountRow = async (plaidAccountId) => {
      const known = accountRowByPlaidId.get(plaidAccountId);
      if (known) return known;
      if (!refetchedAccounts) {
        refetchedAccounts = true;
        const response = await getAccounts(token);
        await storeAccounts(prisma, connection.id, userId, response?.accounts ?? []);
        const rows = await prisma.bankAccount.findMany({
          where: { connectionId: connection.id },
          select: { id: true, plaidAccountId: true }
        });
        accountRowByPlaidId = new Map(rows.map((row) => [row.plaidAccountId, row.id]));
      }
      return accountRowByPlaidId.get(plaidAccountId) ?? null;
    };

    while (hasMore) {
      let page;
      try {
        page = await syncTransactions(token, cursor);
      } catch (error) {
        // Right after linking (especially in production), Plaid may still be
        // pulling the Item's initial transactions. That's expected, not a
        // failure: report it as pending so the next sync picks the data up.
        if (error?.plaidErrorCode === "PRODUCT_NOT_READY") {
          return { imported, cursor, pending: true, incomplete: skipped > 0 };
        }
        throw error;
      }
      cursor = page?.next_cursor ?? cursor;
      hasMore = Boolean(page?.has_more);

      for (const txn of [...(page?.added ?? []), ...(page?.modified ?? [])]) {
        if (!txn?.transaction_id) continue;
        const accountId = await resolveAccountRow(txn.account_id);
        if (!accountId) {
          skipped += 1;
          continue;
        }

        // plaidTxnId is globally unique; the same cross-user guard as for
        // accounts prevents reassigning a transaction owned by someone else.
        const existing = await prisma.bankTransaction.findUnique({
          where: { plaidTxnId: txn.transaction_id },
          include: { account: { include: { connection: { select: { userId: true } } } } }
        });
        if (existing && existing.account?.connection?.userId !== userId) {
          continue;
        }

        const data = {
          accountId,
          date: new Date(txn.date),
          description: txn.name ?? null,
          // Plaid reports outflows as positive; the rest of the app expects
          // outflows to be negative (spending), so normalize the sign here.
          amount: typeof txn.amount === "number" ? -txn.amount : 0,
          category: txn.personal_finance_category?.primary ?? txn.category?.[0] ?? null
        };
        await prisma.bankTransaction.upsert({
          where: { plaidTxnId: txn.transaction_id },
          update: data,
          create: { plaidTxnId: txn.transaction_id, ...data }
        });
        imported += 1;
      }

      for (const removed of page?.removed ?? []) {
        if (!removed?.transaction_id) continue;
        await prisma.bankTransaction.deleteMany({
          where: {
            plaidTxnId: removed.transaction_id,
            account: { connection: { userId } }
          }
        });
      }
    }

    if (skipped > 0) {
      console.warn(
        `Sync for connection ${connection.id} skipped ${skipped} transaction(s) with unknown accounts; holding the cursor so the next sync retries them.`
      );
    }
    // Holding the old cursor when anything was skipped keeps the next sync
    // replaying those pages. The writes are upserts keyed on Plaid's
    // transaction id, so replaying costs a little work and duplicates nothing.
    return { imported, cursor, pending: false, incomplete: skipped > 0 };
  }

  function register(app, requireAuth, requireAdmin) {
    // Every route here is an admin feature: the Plaid credentials belong to
    // the operator, and so does the decision of whose bank they are used on.
    const guard = [requireAuth, requireAdmin];

    // Mint a short-lived Plaid Link token for the browser. Scoped to auth so
    // only a logged-in user can start a link, and to their own user id.
    app.get("/api/plaid/link-token", ...guard, async (req, res) => {
      const { configured } = plaidConfig();
      if (!configured) {
        return res.status(400).json({ error: "Plaid is not configured on the server." });
      }
      try {
        const result = await createLinkToken(req.userId);
        res.json({ linkToken: result?.link_token ?? "" });
      } catch (error) {
        console.error("Plaid link token failed:", error);
        res.status(502).json({ error: "Could not start a bank connection." });
      }
    });

    // Exchange the public token from Plaid Link for a permanent access token,
    // verify it by fetching accounts, then store it encrypted. Tokens are never
    // returned to the browser.
    app.post("/api/plaid/exchange", ...guard, async (req, res) => {
      const publicToken = String(req.body?.publicToken ?? "").trim();
      if (!publicToken) {
        return res.status(400).json({ error: "publicToken is required." });
      }
      const metadata = req.body?.metadata ?? {};
      const institutionName = metadata?.institution?.name ?? null;
      const institutionId = metadata?.institution?.institution_id ?? null;

      try {
        const exchange = await exchangePublicToken(publicToken);
        const accessToken = exchange?.access_token;
        if (!accessToken) {
          throw new Error("Plaid did not return an access token.");
        }
        const itemId = exchange?.item_id ?? null;
        // Fetching accounts both validates the token and gives us rows to store.
        const accountsResponse = await getAccounts(accessToken);
        const accounts = accountsResponse?.accounts ?? [];

        const encrypted = encryptSecret(accessToken);

        // Going through Link again for a bank the user already has is a
        // re-link, not a second bank — but Plaid hands back a new Item whose
        // account and transaction ids share nothing with the old one, so
        // storing it alongside the old connection imports a duplicate copy of
        // every transaction. Replace instead: drop the superseded connections
        // (cascading their accounts and transactions) in the same transaction
        // that creates the new one, so the user is never left with two copies
        // or with none.
        // Make sure older connections know their institution before matching.
        await backfillInstitutionIds(req.userId);

        const supersededFilters = [];
        if (itemId) supersededFilters.push({ itemId });
        if (institutionId) supersededFilters.push({ institutionId });

        const { connection, superseded } = await prisma.$transaction(async (tx) => {
          let stale = [];
          if (supersededFilters.length > 0) {
            stale = await tx.bankConnection.findMany({
              where: { userId: req.userId, OR: supersededFilters },
              select: { id: true, encryptedToken: true, tokenIv: true, tokenAuthTag: true }
            });
            if (stale.length > 0) {
              await tx.bankConnection.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
            }
          }

          const created = await tx.bankConnection.create({
            data: {
              userId: req.userId,
              provider: "plaid",
              institutionName,
              institutionId,
              itemId,
              encryptedToken: encrypted.ciphertext,
              tokenIv: encrypted.iv,
              tokenAuthTag: encrypted.authTag
            }
          });
          await storeAccounts(tx, created.id, req.userId, accounts);
          return { connection: created, superseded: stale };
        });

        // The superseded Items are no longer referenced by anything we store,
        // so release them at Plaid too. Best-effort: the local replacement has
        // already committed, and a leftover Item costs the user nothing.
        await releaseItems(superseded);

        res.status(201).json({
          id: connection.id,
          institutionName,
          accounts: accounts.length,
          // Lets the client explain that an existing link was refreshed rather
          // than a second one added.
          replaced: superseded.length > 0
        });
      } catch (error) {
        console.error("Plaid exchange failed:", error);
        res.status(502).json({ error: "Could not connect the bank account." });
      }
    });

    // Pull transactions for all of the user's connections via cursor-based
    // sync, upserting them (deduped by Plaid's transaction id). Read-only.
    app.post("/api/plaid/sync", ...guard, async (req, res) => {
      try {
        const connections = await prisma.bankConnection.findMany({
          where: { userId: req.userId },
          include: { accounts: true }
        });

        let imported = 0;
        let pending = false;
        const errors = [];
        for (const connection of connections) {
          let result;
          try {
            result = await syncConnection(connection, req.userId);
          } catch (error) {
            // One unhealthy connection must not blank out the others. Report it
            // per-bank instead, and say plainly when the fix is to reconnect --
            // an expired login used to surface as a generic failure, which
            // reads as "refresh is broken" rather than "this bank needs
            // re-authenticating".
            console.error(`Plaid sync failed for connection ${connection.id}:`, error);
            errors.push({
              institutionName: connection.institutionName,
              reconnectRequired: RECONNECT_ERROR_CODES.has(error?.plaidErrorCode),
              message: RECONNECT_ERROR_CODES.has(error?.plaidErrorCode)
                ? "This bank needs to be reconnected."
                : "Could not reach this bank."
            });
            continue;
          }

          imported += result.imported;
          if (result.pending) pending = true;
          // Skipped transactions mean the cursor would step over data we never
          // stored, so leave it where it is and let the next sync retry.
          if (!result.incomplete && result.cursor && result.cursor !== connection.transactionCursor) {
            await prisma.bankConnection.update({
              where: { id: connection.id },
              data: { transactionCursor: result.cursor }
            });
          }
        }
        // `pending` means at least one bank is still preparing data; the client
        // can tell the user to retry shortly rather than showing an error.
        res.json({ imported, pending, errors });
      } catch (error) {
        console.error("Plaid sync failed:", error);
        res.status(502).json({ error: "Could not sync transactions." });
      }
    });

    // List the user's linked banks. Sanitized: no tokens, no Plaid item or
    // account ids — just enough for the UI to show what is connected and how
    // much data each link accounts for.
    app.get("/api/plaid/connections", ...guard, async (req, res) => {
      try {
        const connections = await prisma.bankConnection.findMany({
          where: { userId: req.userId },
          orderBy: { createdAt: "asc" },
          include: {
            accounts: { select: { id: true, _count: { select: { transactions: true } } } }
          }
        });
        res.json(
          connections.map((connection) => ({
            id: connection.id,
            institutionName: connection.institutionName,
            accounts: connection.accounts.length,
            transactions: connection.accounts.reduce(
              (sum, account) => sum + account._count.transactions,
              0
            ),
            linkedAt: connection.createdAt
          }))
        );
      } catch (error) {
        console.error("Failed to list bank connections:", error);
        res.status(500).json({ error: "Could not load linked banks." });
      }
    });

    // Unlink a bank. Scoped to the caller, and cascades to that connection's
    // accounts and transactions so nothing is left stranded.
    app.delete("/api/plaid/connections/:id", ...guard, async (req, res) => {
      try {
        const connection = await prisma.bankConnection.findFirst({
          where: { id: req.params.id, userId: req.userId },
          select: { id: true, encryptedToken: true, tokenIv: true, tokenAuthTag: true }
        });
        if (!connection) {
          return res.status(404).json({ error: "Bank connection not found." });
        }
        await prisma.bankConnection.delete({ where: { id: connection.id } });
        await releaseItems([connection]);
        res.status(204).end();
      } catch (error) {
        console.error("Failed to remove bank connection:", error);
        res.status(500).json({ error: "Could not remove the bank." });
      }
    });

    // Return the user's stored transactions (sanitized — no tokens/ids leaked).
    app.get("/api/transactions", ...guard, async (req, res) => {
      try {
        const transactions = await prisma.bankTransaction.findMany({
          where: { account: { connection: { userId: req.userId } } },
          orderBy: { date: "desc" },
          include: { account: { select: { name: true, lastFour: true } } }
        });
        res.json(
          transactions.map((txn) => ({
            id: txn.id,
            // A transaction date is a calendar date, not an instant. Sending
            // the full timestamp made the browser re-interpret UTC midnight in
            // its own zone, showing every row a day early west of UTC. Send
            // "YYYY-MM-DD" so the wire format carries the right semantics.
            date: txn.date.toISOString().slice(0, 10),
            description: txn.description,
            amount: Number(txn.amount),
            category: txn.category,
            isFood: txn.isFood,
            account: txn.account?.name ?? null,
            linkedReceiptId: txn.linkedReceiptId
          }))
        );
      } catch (error) {
        console.error("Failed to list transactions:", error);
        res.status(500).json({ error: "Could not load transactions." });
      }
    });

    // PATCH /api/bank-transactions/:txnId/food - flag a whole transaction as
    // food so it counts toward the education-expense food total.
    app.patch("/api/bank-transactions/:txnId/food", ...guard, async (req, res) => {
      const body = req.body ?? {};
      if (typeof body.isFood !== "boolean") {
        return res.status(400).json({ error: "isFood must be a boolean." });
      }

      try {
        // updateMany so the ownership check and the write are one statement —
        // a transaction id belonging to another user is a plain 404.
        const result = await prisma.bankTransaction.updateMany({
          where: { id: req.params.txnId, account: { connection: { userId: req.userId } } },
          data: { isFood: body.isFood }
        });

        if (result.count === 0) {
          return res.status(404).json({ error: "Transaction not found." });
        }

        res.json({ success: true });
      } catch (error) {
        console.error("Failed to update transaction food flag:", error);
        res.status(500).json({ error: "Could not update the transaction." });
      }
    });
  }

  return { register };
}
