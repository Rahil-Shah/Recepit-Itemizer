-- Records that a rent entry was created from a bank transaction, so the
-- budgeting view can keep showing that row as rent after a reload and offer to
-- remove it again. Unique: a transaction can back at most one rent entry.
--
-- This migration was originally stamped 20260819230000, which sorted it ahead
-- of 20260820030020_add_education_expense_tracking -- the migration that
-- creates "rent_entries" -- so a fresh database could never get past it. It
-- now sorts after that one. Databases that applied it under the old name
-- already have the column and the index, so both statements are conditional:
-- there, `prisma migrate deploy` records this migration as applied without
-- changing anything.
ALTER TABLE "rent_entries" ADD COLUMN IF NOT EXISTS "bankTransactionId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "rent_entries_bankTransactionId_key" ON "rent_entries"("bankTransactionId");
