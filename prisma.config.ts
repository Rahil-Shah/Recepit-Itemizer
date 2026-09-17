import { defineConfig } from "prisma/config";
import "dotenv/config";

// The CLI needs a database only for migrations. `prisma generate` runs on
// every build -- including builds with no database in reach -- so the URL is
// optional here, and a migration command reports its own error when it finds
// none. (The `env()` helper from prisma/config throws the moment the variable
// is missing, which made `npm run build` fail without a DATABASE_URL.)
//
// Migrations must not run through a transaction-mode connection pooler
// (PgBouncer, Supabase's or Neon's pooled endpoint), so they take a direct or
// session-mode URL when one is given: DIRECT_DATABASE_URL, or the unpooled
// variable that the Vercel Postgres (DATABASE_URL_UNPOOLED) and Supabase
// (POSTGRES_URL_NON_POOLING) integrations set. Failing those, the app's own
// URL. The app itself uses DATABASE_URL, or the integrations' POSTGRES_URL
// (see server/deployment.mjs).
const migrationUrl =
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  ...(migrationUrl ? { datasource: { url: migrationUrl } } : {})
});
