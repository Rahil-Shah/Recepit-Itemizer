// Who may use this deployment, and what each account may do.
//
// Two tiers of account:
//
//   admin    Listed in ADMIN_EMAILS. May spend the server's shared
//            GEMINI_API_KEY, and may use the Plaid integration: connect a
//            bank, import transactions, attach receipts and rent to them.
//   regular  Everyone else. Parses receipts with a personal Gemini key saved
//            in Settings, splits and saves receipts, and tracks education
//            expenses by hand (food lines on receipts, rent entries). Never
//            touches the bank side.
//
// Who may have an account at all:
//
//   ALLOWED_LOGIN_EMAILS   A closed list. Admins are always allowed, so they
//                          need not be repeated here. Anyone else is refused at
//                          registration and login, and a session they already
//                          hold stops working.
//   ALLOW_PUBLIC_SIGNUP    "true" opens registration to anyone, as a regular
//                          account, whatever the lists say.
//   neither                Only the admins. With no admins either, the app is
//                          open on a laptop (nothing configured, nothing
//                          locked) and refuses to start in production, where
//                          a public URL anyone could sign up to by accident
//                          is not an acceptable default.
//
// ALLOWED_LOGIN_EMAIL (singular), the single-account lock this replaced, is
// still honoured: that account was the owner, which is what an admin is.

const LIST_SEPARATOR = /[,;\s]+/;

// Ceilings for an instance anyone can sign up to. They exist to bound what a
// public URL can cost: rows in a free-tier database, and receipt photos, which
// are by far the largest thing stored. Admins are exempt from both -- they are
// named in the environment, so the operator can always create their own
// account and keep their own receipts on an otherwise full instance.
const DEFAULT_MAX_USERS = 20;
const DEFAULT_MAX_RECEIPTS_PER_USER = 20;

// A positive whole number from the environment, or the default. Anything else
// (blank, zero, negative, not a number) means "unset" rather than "unlimited":
// a typo in a cap must not silently remove it.
function positiveIntFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** How many accounts may exist. Admins may still register past it. */
export function maxUsers() {
  return positiveIntFromEnv("MAX_USERS", DEFAULT_MAX_USERS);
}

/** How many receipts one non-admin account may keep. */
export function maxReceiptsPerUser() {
  return positiveIntFromEnv("MAX_RECEIPTS_PER_USER", DEFAULT_MAX_RECEIPTS_PER_USER);
}

function normalize(email) {
  return String(email ?? "").trim().toLowerCase();
}

function parseList(value) {
  return new Set(String(value ?? "").split(LIST_SEPARATOR).map(normalize).filter(Boolean));
}

/** Admin addresses, lowercased. */
export function adminEmails() {
  const admins = parseList(process.env.ADMIN_EMAILS);
  const legacy = normalize(process.env.ALLOWED_LOGIN_EMAIL);
  if (legacy) admins.add(legacy);
  return admins;
}

/** Every address that may hold an account when sign-up is closed. */
export function allowedEmails() {
  const allowed = parseList(process.env.ALLOWED_LOGIN_EMAILS);
  for (const admin of adminEmails()) allowed.add(admin);
  return allowed;
}

export function isAdmin(email) {
  return adminEmails().has(normalize(email));
}

export function publicSignupAllowed() {
  return process.env.ALLOW_PUBLIC_SIGNUP === "true";
}

/** Whether sign-in is restricted to a list of accounts. */
export function isLocked() {
  return !publicSignupAllowed() && allowedEmails().size > 0;
}

/** True when the deployment is locked and this address is not on the list. */
export function isLockedOut(email) {
  return isLocked() && !allowedEmails().has(normalize(email));
}

/**
 * Whether the operator's own Gemini key may be spent on this account. It is
 * the operator's money, so only admins draw on it; everyone else brings a key.
 */
export function mayUseSharedGeminiKey(email) {
  return isAdmin(email);
}

/**
 * Refuse to run a public deployment that nobody, or anybody, could sign in to.
 *
 * Forgetting one environment variable must not silently turn a private app
 * into a free receipt store for the internet. ALLOW_PUBLIC_SIGNUP=true is the
 * deliberate opt-in for an operator who wants open registration.
 */
export function assertAccessPolicy({ production }) {
  if (!production) return;
  if (publicSignupAllowed() || allowedEmails().size > 0) return;
  throw new Error(
    "No account is allowed to sign in. Set ADMIN_EMAILS to your address (and ALLOWED_LOGIN_EMAILS " +
      "for any other accounts), or opt in to open sign-up with ALLOW_PUBLIC_SIGNUP=true."
  );
}
