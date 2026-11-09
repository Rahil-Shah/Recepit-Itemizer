-- When a user first approved this client. A client nobody ever approved is
-- swept after a day; one that was approved is kept even after every grant is
-- disconnected, so the app can still be connected again without having to
-- register anew.
ALTER TABLE "oauth_clients" ADD COLUMN "approvedAt" TIMESTAMP(3);
