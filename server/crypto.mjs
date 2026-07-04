// Security-sensitive primitives, kept in one place.
//
// - Passwords: scrypt with a random per-user salt, constant-time comparison.
// - Secrets at rest (Teller access tokens): AES-256-GCM with a key from env.
// - Session tokens: opaque random tokens; only their SHA-256 hash is stored.
//
// These modules live under /server and must never be served to the browser
// (see the BLOCKED guard in server.mjs).

import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);

const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;
const AES_IV_BYTES = 12; // GCM standard nonce length

// --- Passwords -------------------------------------------------------------

/** Hash a password. Returns a self-describing string: `scrypt$<saltHex>$<hashHex>`. */
export async function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = await scrypt(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/** Verify a password against a stored hash in constant time. */
export async function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = await scrypt(password, salt, expected.length);
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

// --- Secret encryption at rest (AES-256-GCM) -------------------------------

function encryptionKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not set. See .env.example.");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to 32 bytes (base64 of a 256-bit key).");
  }
  return key;
}

/** Encrypt a plaintext secret. Returns base64 ciphertext, iv, and auth tag. */
export function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(AES_IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64")
  };
}

/** Decrypt a secret produced by encryptSecret(). Throws if tampered with. */
export function decryptSecret({ ciphertext, iv, authTag }) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final()
  ]);
  return plaintext.toString("utf8");
}

// --- Session tokens --------------------------------------------------------

/** Generate an opaque, URL-safe session token (raw value handed to the client). */
export function generateSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

/** Hash a session token for storage. Never store the raw token. */
export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Fail fast at startup if required crypto env is missing/malformed. */
export function assertCryptoEnv() {
  encryptionKey(); // throws if TOKEN_ENCRYPTION_KEY missing or wrong size
  if (!process.env.AUTH_SESSION_SECRET) {
    throw new Error("AUTH_SESSION_SECRET is not set. See .env.example.");
  }
}
