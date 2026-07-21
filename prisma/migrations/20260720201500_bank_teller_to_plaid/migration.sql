-- Bank integration moved from Teller to Plaid. Rename the provider-specific
-- columns/indexes and add the fields Plaid's Link + /transactions/sync flow
-- needs (item id, sync cursor). Data is preserved by renaming in place.

-- AlterTable: bank_connections
ALTER TABLE "bank_connections" ALTER COLUMN "provider" SET DEFAULT 'plaid';
ALTER TABLE "bank_connections" RENAME COLUMN "enrollmentId" TO "itemId";
ALTER TABLE "bank_connections" ADD COLUMN "transactionCursor" TEXT;

-- AlterTable: bank_accounts
ALTER TABLE "bank_accounts" RENAME COLUMN "tellerAccountId" TO "plaidAccountId";
ALTER INDEX "bank_accounts_tellerAccountId_key" RENAME TO "bank_accounts_plaidAccountId_key";

-- AlterTable: bank_transactions
ALTER TABLE "bank_transactions" RENAME COLUMN "tellerTxnId" TO "plaidTxnId";
ALTER INDEX "bank_transactions_tellerTxnId_key" RENAME TO "bank_transactions_plaidTxnId_key";
