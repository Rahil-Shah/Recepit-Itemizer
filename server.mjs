import "dotenv/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertCryptoEnv } from "./server/crypto.mjs";
import { assertAccessPolicy } from "./server/access.mjs";
import { databaseUrl, isProduction } from "./server/deployment.mjs";
import { createApp } from "./server/app.mjs";


// True when started as `node server.mjs`. False when imported: by the Vercel
// function in api/index.mjs, where the platform owns the socket and the
// process, so this module only builds the app and must not listen or exit.
const isMain = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

// A configuration problem is fatal either way. As a process, say what is
// wrong and stop; as a module, throw, so the import fails and the platform's
// function logs carry the reason instead of a generic 500.
function fatal(message) {
  if (isMain) {
    console.error(message);
    process.exit(1);
  }
  throw new Error(message);
}

if (!databaseUrl()) {
  fatal("DATABASE_URL is not set. Copy .env.example to .env and start Postgres (npm run db:up).");
}

// Fail fast if the auth/encryption secrets are missing or malformed, or if a
// public deployment would let anyone sign up (see server/access.mjs).
try {
  assertCryptoEnv();
  assertAccessPolicy({ production: isProduction() });
} catch (error) {
  fatal(error.message);
}

// Prisma 7 connects through a driver adapter; swap DATABASE_URL to scale to managed Postgres.
const adapter = new PrismaPg({ connectionString: databaseUrl() });
const prisma = new PrismaClient({ adapter });
const app = createApp({ prisma });
const PORT = Number(process.env.PORT) || 4173;

export default app;

if (isMain) {
  app.listen(PORT, () => {
    console.log(`Receipt Ring running at http://localhost:${PORT}`);
  });
}
