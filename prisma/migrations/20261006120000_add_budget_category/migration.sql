-- The category a Gemini pass sorted a receipt or bank transaction into for the
-- budget ring. Kept beside the original category, which is never overwritten.
ALTER TABLE "receipts" ADD COLUMN "budgetCategory" TEXT;
ALTER TABLE "bank_transactions" ADD COLUMN "budgetCategory" TEXT;
