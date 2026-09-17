import { defineConfig } from "prisma/config";
import "dotenv/config";

// The CLI needs a database only for migrations. `prisma generate` runs on
// every build -- including builds with no database in reach -- so the URL is
// optional here, and a migration command reports its own error when it finds
// none. (The `env()` helper from prisma/config throws the moment the variable
// is missing, which made `npm run build` fail without a DATABASE_URL.)
//
// Migrations must not run through a transaction-mode connection pooler
// (PgBouncer, Neon's pooled endpoint), so they take a direct URL when one is
// given: DIRECT_DATABASE_URL, or the DATABASE_URL_UNPOOLED that the Vercel
// Postgres / Neon integration sets. The app itself always uses DATABASE_URL.
const migrationUrl =
  process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  ...(migrationUrl ? { datasource: { url: migrationUrl } } : {})
});
