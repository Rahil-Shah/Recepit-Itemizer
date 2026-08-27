-- Names the user has confirmed for abbreviated receipt items.
--
-- This is the memory that makes identification cheap. A correction made once
-- should never have to be made again, and on the next receipt from the same
-- shop it should cost nothing -- no model call, no wait, and full confidence,
-- because a human wrote it.
CREATE TABLE "item_aliases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    -- What the alias is filed under: "code:<sku>" where the receipt printed
    -- one, otherwise the normalized label. A code outlives the shorthand
    -- beside it, so it is the preferred key.
    "lookupKey" TEXT NOT NULL,
    -- The store it was learned at, lowercased, or "" for one learned with no
    -- store name to hand. The same shorthand means different things at
    -- different chains, so a general answer must not override a specific one.
    "storeKey" TEXT NOT NULL DEFAULT '',
    "resolvedName" TEXT NOT NULL,
    "brand" TEXT,
    "size" TEXT,
    -- How many times a human has agreed with this. A name confirmed on three
    -- receipts carries more weight than one accepted in passing.
    "timesConfirmed" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_aliases_pkey" PRIMARY KEY ("id")
);

-- One alias per key per store per user. This is what makes confirming the same
-- name again an update rather than a second row that shadows the first.
CREATE UNIQUE INDEX "item_aliases_userId_storeKey_lookupKey_key"
    ON "item_aliases"("userId", "storeKey", "lookupKey");

-- The whole table for one user is loaded at once, so the lookups happen in the
-- browser; this index is what makes that load cheap.
CREATE INDEX "item_aliases_userId_idx" ON "item_aliases"("userId");

ALTER TABLE "item_aliases" ADD CONSTRAINT "item_aliases_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
