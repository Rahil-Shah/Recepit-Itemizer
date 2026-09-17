-- Row-level security on every table, with no policies.
--
-- The app connects as the role that owns these tables (the one that ran the
-- migrations), and a table's owner bypasses row-level security, so nothing
-- changes for the app or for Prisma Migrate. What changes is every other
-- role. On Supabase the REST API (PostgREST) reads the public schema as
-- `anon` and `authenticated`, and without this the project's anon key alone
-- could read and write every table below. With RLS enabled and no policies,
-- those roles see nothing. On a plain Postgres this is harmless.
--
-- If the app is ever run as a role other than the owner, it will get empty
-- results rather than errors: grant that role BYPASSRLS, or add policies.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bank_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bank_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bank_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "receipt_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "item_aliases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "account_people" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "people" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "line_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rent_entries" ENABLE ROW LEVEL SECURITY;
