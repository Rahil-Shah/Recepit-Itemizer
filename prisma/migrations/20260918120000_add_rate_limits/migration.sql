-- Rate limit counters, shared by every instance.
--
-- In-memory counters are per-process, so on a serverless host they reset on
-- every cold start and each instance counts separately. That is no limit at
-- all on an app anyone can sign up to. These rows give the whole deployment
-- one window per key.
--
-- Rows are disposable: losing the table loses only the current windows.
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

-- For the periodic sweep of windows nobody came back to.
CREATE INDEX "rate_limits_resetAt_idx" ON "rate_limits"("resetAt");

-- Consistent with every other table (see 20260917120000): the app connects as
-- the owner and bypasses RLS, while Supabase's REST roles see nothing.
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;
