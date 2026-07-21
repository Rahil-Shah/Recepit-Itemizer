// Bank (Plaid) routes. Everything here is read-only and user-scoped: each
// endpoint requires authentication and only ever touches the current user's
// own connections, accounts, and transactions.

import {
  plaidConfig,
  createLinkToken,
  exchangePublicToken,
  getAccounts,
  syncTransactions
} from "./plaid.mjs";
import { encryptSecret, decryptSecret } from "./crypto.mjs";

export function createBank(prisma) {
  // Persist (or refresh) the accounts Plaid returns for a connection.
  //
  // plaidAccountId is globally unique, so a naive upsert-by-id would let one
  // user reassign a row that already belongs to another user. This can happen
  // in Plaid's sandbox, where linking the same test bank returns stable ids.
  // Guard against it: never touch a row owned by a different user.
  async function storeAccounts(connectionId, userId, accounts) {
    for (const account of accounts ?? []) {
      if (!account?.account_id) continue;
      const existing = await prisma.bankAccount.findUnique({
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
      await prisma.bankAccount.upsert({
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
    const accountRowByPlaidId = new Map(
      connection.accounts.map((account) => [account.plaidAccountId, account.id])
    );

    const token = decryptSecret({
      ciphertext: connection.encryptedToken,
      iv: connection.tokenIv,
      authTag: connection.tokenAuthTag
    });

    let cursor = connection.transactionCursor ?? null;
    let imported = 0;
    let hasMore = true;

    while (hasMore) {
      const page = await syncTransactions(token, cursor);
      cursor = page?.next_cursor ?? cursor;
      hasMore = Boolean(page?.has_more);

      for (const txn of [...(page?.added ?? []), ...(page?.modified ?? [])]) {
        if (!txn?.transaction_id) continue;
        const accountId = accountRowByPlaidId.get(txn.account_id);
        if (!accountId) continue;

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

    return { imported, cursor };
  }

  function register(app, requireAuth) {
    // Mint a short-lived Plaid Link token for the browser. Scoped to auth so
    // only a logged-in user can start a link, and to their own user id.
    app.get("/api/plaid/link-token", requireAuth, async (req, res) => {
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
    app.post("/api/plaid/exchange", requireAuth, async (req, res) => {
      const publicToken = String(req.body?.publicToken ?? "").trim();
      if (!publicToken) {
        return res.status(400).json({ error: "publicToken is required." });
      }
      const metadata = req.body?.metadata ?? {};
      const institutionName = metadata?.institution?.name ?? null;

      try {
        const exchange = await exchangePublicToken(publicToken);
        const accessToken = exchange?.access_token;
        if (!accessToken) {
          throw new Error("Plaid did not return an access token.");
        }
        // Fetching accounts both validates the token and gives us rows to store.
        const accountsResponse = await getAccounts(accessToken);
        const accounts = accountsResponse?.accounts ?? [];

        const encrypted = encryptSecret(accessToken);
        const connection = await prisma.bankConnection.create({
          data: {
            userId: req.userId,
            provider: "plaid",
            institutionName,
            itemId: exchange?.item_id ?? null,
            encryptedToken: encrypted.ciphertext,
            tokenIv: encrypted.iv,
            tokenAuthTag: encrypted.authTag
          }
        });
        await storeAccounts(connection.id, req.userId, accounts);
        res.status(201).json({
          id: connection.id,
          institutionName,
          accounts: accounts.length
        });
      } catch (error) {
        console.error("Plaid exchange failed:", error);
        res.status(502).json({ error: "Could not connect the bank account." });
      }
    });

    // Pull transactions for all of the user's connections via cursor-based
    // sync, upserting them (deduped by Plaid's transaction id). Read-only.
    app.post("/api/plaid/sync", requireAuth, async (req, res) => {
      try {
        const connections = await prisma.bankConnection.findMany({
          where: { userId: req.userId },
          include: { accounts: true }
        });

        let imported = 0;
        for (const connection of connections) {
          const result = await syncConnection(connection, req.userId);
          imported += result.imported;
          if (result.cursor && result.cursor !== connection.transactionCursor) {
            await prisma.bankConnection.update({
              where: { id: connection.id },
              data: { transactionCursor: result.cursor }
            });
          }
        }
        res.json({ imported });
      } catch (error) {
        console.error("Plaid sync failed:", error);
        res.status(502).json({ error: "Could not sync transactions." });
      }
    });

    // Return the user's stored transactions (sanitized — no tokens/ids leaked).
    app.get("/api/transactions", requireAuth, async (req, res) => {
      try {
        const transactions = await prisma.bankTransaction.findMany({
          where: { account: { connection: { userId: req.userId } } },
          orderBy: { date: "desc" },
          include: { account: { select: { name: true, lastFour: true } } }
        });
        res.json(
          transactions.map((txn) => ({
            id: txn.id,
            date: txn.date,
            description: txn.description,
            amount: Number(txn.amount),
            category: txn.category,
            account: txn.account?.name ?? null
          }))
        );
      } catch (error) {
        console.error("Failed to list transactions:", error);
        res.status(500).json({ error: "Could not load transactions." });
      }
    });
  }

  return { register };
}
