-- Store what each receipt line was actually identified as.
--
-- Receipts print shorthand ("GV SHRD MOZZ 8Z") and a saved split is unreadable
-- months later when nobody can tell which line was the cheese. These columns
-- hold the expansion alongside the line it belongs to, so a receipt reopened
-- from history reads the same as it did on the day it was split.
--
-- All nullable: every line saved before this migration has no identification,
-- and that is a valid state, not a backfill waiting to happen.
ALTER TABLE "receipt_lines" ADD COLUMN "itemCode" TEXT;
ALTER TABLE "receipt_lines" ADD COLUMN "resolvedName" TEXT;
ALTER TABLE "receipt_lines" ADD COLUMN "resolvedBrand" TEXT;
ALTER TABLE "receipt_lines" ADD COLUMN "resolvedSize" TEXT;
-- 0..1, so two decimal places is more precision than a self-reported
-- confidence deserves. Decimal rather than float: it is displayed as a
-- percentage and compared against thresholds, and neither wants binary
-- rounding surprises.
ALTER TABLE "receipt_lines" ADD COLUMN "resolvedConfidence" DECIMAL(3,2);
-- "user-confirmed" | "saved-alias" | "dictionary" | "ai" | "unresolved".
ALTER TABLE "receipt_lines" ADD COLUMN "resolvedSource" TEXT;
ALTER TABLE "receipt_lines" ADD COLUMN "resolvedReasoning" TEXT;
-- The runners-up, as [{ name, confidence }]. JSON because they are read and
-- written whole and never queried across -- a table of them would buy nothing.
ALTER TABLE "receipt_lines" ADD COLUMN "resolvedAlternatives" JSONB;
ALTER TABLE "receipt_lines" ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- Finding the lines still worth identifying means asking for the ones with no
-- name yet, per receipt.
CREATE INDEX "receipt_lines_receiptId_resolvedName_idx" ON "receipt_lines"("receiptId", "resolvedName");
