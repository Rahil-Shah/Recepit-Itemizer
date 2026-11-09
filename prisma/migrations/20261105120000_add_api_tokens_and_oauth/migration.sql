-- Connecting an AI assistant (Claude) through the MCP endpoint.
--
-- api_tokens:    personal access tokens a user creates in Settings.
-- oauth_clients: apps registered through dynamic client registration.
-- oauth_codes:   one-time authorization codes, valid for minutes.
-- oauth_grants:  an app a user approved, with its current access and
--                refresh tokens.
--
-- Every token column holds a SHA-256 hash, never the token itself. All of it
-- goes with the user (or the client) it belongs to.

CREATE TABLE "api_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_clients" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretHash" TEXT,
    "name" VARCHAR(100) NOT NULL,
    "redirectUris" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_codes" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "accessExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "previousRefreshTokenHash" TEXT,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_tokens_tokenHash_key" ON "api_tokens"("tokenHash");
CREATE INDEX "api_tokens_userId_idx" ON "api_tokens"("userId");

CREATE UNIQUE INDEX "oauth_clients_clientId_key" ON "oauth_clients"("clientId");
CREATE INDEX "oauth_clients_createdAt_idx" ON "oauth_clients"("createdAt");

CREATE UNIQUE INDEX "oauth_codes_codeHash_key" ON "oauth_codes"("codeHash");
CREATE INDEX "oauth_codes_expiresAt_idx" ON "oauth_codes"("expiresAt");

CREATE UNIQUE INDEX "oauth_grants_accessTokenHash_key" ON "oauth_grants"("accessTokenHash");
CREATE UNIQUE INDEX "oauth_grants_refreshTokenHash_key" ON "oauth_grants"("refreshTokenHash");
CREATE UNIQUE INDEX "oauth_grants_previousRefreshTokenHash_key" ON "oauth_grants"("previousRefreshTokenHash");
CREATE INDEX "oauth_grants_userId_idx" ON "oauth_grants"("userId");
CREATE INDEX "oauth_grants_clientId_idx" ON "oauth_grants"("clientId");

ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "oauth_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "oauth_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Consistent with every other table (see 20260917120000): the app connects as
-- the owner and bypasses this; any other role sees nothing.
ALTER TABLE "api_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_grants" ENABLE ROW LEVEL SECURITY;
