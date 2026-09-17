// Who may use this deployment.
//
// A personal finance app on a public URL is single-tenant by intent: one
// person's receipts, one person's bank, one person's Gemini bill.
// ALLOWED_LOGIN_EMAIL is the switch that makes the server enforce that. With
// it set:
//
//   - only that address can create an account (once) or log in;
//   - sessions any other account already holds stop working;
//   - the shared GEMINI_API_KEY from the environment is only ever spent on
//     that account's requests -- anyone else would need a key of their own.
//
// Without it, anyone can sign up. That is fine on a laptop and wrong on the
// internet, which is why a production deployment refuses to start unless it is
// either locked or told, explicitly, that open sign-up is wanted.

export function allowedLoginEmail() {
  return process.env.ALLOWED_LOGIN_EMAIL?.trim().toLowerCase() || null;
}

/** Whether sign-in is restricted to one account. */
export function isLocked() {
  return allowedLoginEmail() !== null;
}

/** True when the deployment is locked and this address is not the one. */
export function isLockedOut(email) {
  const allowed = allowedLoginEmail();
  if (allowed === null) return false;
  return String(email ?? "").trim().toLowerCase() !== allowed;
}

/**
 * Whether the operator's own Gemini key may be spent on this account. It is
 * the owner's key: on a locked deployment only the owner's requests use it.
 */
export function mayUseSharedGeminiKey(email) {
  return !isLockedOut(email);
}

/**
 * Refuse to run a public deployment that anyone could sign up to.
 *
 * Forgetting one environment variable must not silently turn a private app
 * into a free receipt parser on the owner's API key. ALLOW_PUBLIC_SIGNUP=true
 * is the deliberate opt-out for an operator who wants a multi-user instance.
 */
export function assertAccessPolicy({ production }) {
  if (!production) return;
  if (isLocked() || process.env.ALLOW_PUBLIC_SIGNUP === "true") return;
  throw new Error(
    "ALLOWED_LOGIN_EMAIL is not set. A production deployment must be locked to one account " +
      "(set ALLOWED_LOGIN_EMAIL to your address) or opt in to open sign-up with ALLOW_PUBLIC_SIGNUP=true."
  );
}
