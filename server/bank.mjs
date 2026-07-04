// Bank (Teller) routes. Everything here is read-only and user-scoped: each
// endpoint requires authentication and only ever touches the current user's
// own connections, accounts, and transactions.

import { tellerConfig, listAccounts, listTransactions } from "./teller.mjs";
import { encryptSecret, decryptSecret } from "./crypto.mjs";

export function createBank(prisma) {
  // Persist (or refresh) the accounts Teller returns for a connection.
  async function storeAccounts(connectionId, accounts) {
    for (const account of accounts ?? []) {
      if (!account?.id) continue;
      const fields = {
        name: account.name ?? null,
        type: account.type ?? null,
        lastFour: account.last_four ?? null
      };
      await prisma.bankAccount.upsert({
        where: { tellerAccountId: account.id },
        update: { connectionId, ...fields },
        create: { connectionId, tellerAccountId: account.id, ...fields }
      });
    }
  }

  function register(app, requireAuth) {
    // Public, non-secret config the browser needs to open Teller Connect.
    // Gated behind auth so only logged-in users can read it.
    app.get("/api/teller/config", requireAuth, (_req, res) => {
      res.json(tellerConfig());
    });

    // Receive the access token from Teller Connect, verify it by fetching
    // accounts, then store it encrypted. The token is never returned.
    app.post("/api/teller/enroll", requireAuth, async (req, res) => {
      const accessToken = String(req.body?.accessToken ?? "").trim();
      if (!accessToken) {
        return res.status(400).json({ error: "accessToken is required." });
      }
      const enrollment = req.body?.enrollment ?? {};
      const institutionName = enrollment?.institution?.name ?? null;
      const enrollmentId = enrollment?.id ?? null;

      try {
        // Fetching accounts both validates the token and gives us something to store.
        const accounts = await listAccounts(accessToken);
        const encrypted = encryptSecret(accessToken);
        const connection = await prisma.bankConnection.create({
          data: {
            userId: req.userId,
            provider: "teller",
            institutionName,
            enrollmentId,
            encryptedToken: encrypted.ciphertext,
            tokenIv: encrypted.iv,
            tokenAuthTag: encrypted.authTag
          }
        });
        await storeAccounts(connection.id, accounts);
        res.status(201).json({
          id: connection.id,
          institutionName,
          accounts: Array.isArray(accounts) ? accounts.length : 0
        });
      } catch (error) {
        console.error("Teller enroll failed:", error);
        res.status(502).json({ error: "Could not connect the bank account." });
      }
    });

    // Pull transactions for all of the user's connected accounts and upsert
    // them (deduped by Teller's transaction id). Read-only.
    app.post("/api/teller/sync", requireAuth, async (req, res) => {
      try {
        const connections = await prisma.bankConnection.findMany({
          where: { userId: req.userId },
          include: { accounts: true }
        });

        let imported = 0;
        for (const connection of connections) {
          const token = decryptSecret({
            ciphertext: connection.encryptedToken,
            iv: connection.tokenIv,
            authTag: connection.tokenAuthTag
          });
          for (const account of connection.accounts) {
            const transactions = await listTransactions(token, account.tellerAccountId);
            for (const txn of transactions ?? []) {
              if (!txn?.id) continue;
              const data = {
                accountId: account.id,
                date: new Date(txn.date),
                description: txn.description ?? null,
                amount: txn.amount ?? 0,
                category: txn.details?.category ?? null
              };
              await prisma.bankTransaction.upsert({
                where: { tellerTxnId: txn.id },
                update: data,
                create: { tellerTxnId: txn.id, ...data }
              });
              imported += 1;
            }
          }
        }
        res.json({ imported });
      } catch (error) {
        console.error("Teller sync failed:", error);
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
