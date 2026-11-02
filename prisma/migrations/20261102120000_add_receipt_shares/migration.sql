-- Public, expiring links to a receipt. Goes with the receipt when it is deleted.
CREATE TABLE "receipt_shares" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_shares_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "receipt_shares_tokenHash_key" ON "receipt_shares"("tokenHash");

CREATE INDEX "receipt_shares_receiptId_idx" ON "receipt_shares"("receiptId");

-- For the sweep of links that have run out.
CREATE INDEX "receipt_shares_expiresAt_idx" ON "receipt_shares"("expiresAt");

ALTER TABLE "receipt_shares" ADD CONSTRAINT "receipt_shares_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Consistent with every other table (see 20260917120000): the app connects as
-- the owner and bypasses this; any other role sees nothing.
ALTER TABLE "receipt_shares" ENABLE ROW LEVEL SECURITY;
