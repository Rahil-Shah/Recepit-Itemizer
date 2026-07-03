// Bank (Teller) routes. Everything here is read-only and user-scoped: each
// endpoint requires authentication and only ever touches the current user's
// own connections, accounts, and transactions.

import { tellerConfig } from "./teller.mjs";

export function createBank(prisma) {
  function register(app, requireAuth) {
    // Public, non-secret config the browser needs to open Teller Connect.
    // Gated behind auth so only logged-in users can read it.
    app.get("/api/teller/config", requireAuth, (_req, res) => {
      res.json(tellerConfig());
    });
  }

  return { register };
}
