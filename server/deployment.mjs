// Where this process is running. Kept apart from what it does about it, so a
// route or a policy can ask "is this production?" without each one reading
// the environment its own way.

/** True inside a Vercel build or function (Vercel sets VERCEL=1 for both). */
export function isVercel() {
  return Boolean(process.env.VERCEL);
}

/**
 * True for any deployment that faces the public internet.
 *
 * Vercel sets NODE_ENV=production for preview deployments as well as the
 * production one, and both get a public URL, so both count. A self-hosted
 * server opts in by setting NODE_ENV=production.
 */
export function isProduction() {
  return process.env.NODE_ENV === "production" || isVercel();
}

/**
 * The connection string the app runs on.
 *
 * DATABASE_URL is the one this project documents. POSTGRES_URL is what the
 * Vercel Postgres and Supabase marketplace integrations set automatically (the
 * pooled endpoint, which is the right one for a serverless function), so a
 * project wired up through the integration needs nothing pasted by hand.
 */
export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}
