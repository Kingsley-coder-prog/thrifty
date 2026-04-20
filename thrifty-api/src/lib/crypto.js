import crypto from "crypto";
import { env } from "../config/env.js";

const KEY = Buffer.from(env.ENCRYPTION_KEY, "hex");
const ALG = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Randomised encryption.
 * Every call generates a fresh IV so identical plaintexts
 * produce different ciphertext each time.
 *
 * Use for: full_name (never used as a DB lookup key)
 *
 * Stored format: base64( iv[12] + tag[16] + ciphertext )
 */
export function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALG, KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(String(plaintext), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypt a value produced by encrypt() or encryptDeterministic().
 * Both functions store data in the same format: iv + tag + ciphertext.
 */
export function decrypt(encoded) {
  if (encoded === null || encoded === undefined) return null;

  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALG, KEY, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted, undefined, "utf8") + decipher.final("utf8");
}

/**
 * Deterministic encryption.
 * Same plaintext always produces the same ciphertext — required for
 * columns used in WHERE clauses and UNIQUE constraints.
 *
 * Use for: phone_number, email
 *
 * Uses a fixed IV derived from the key. Stores the auth tag in the
 * same format as encrypt() so the same decrypt() function works on both.
 *
 * Stored format: base64( iv[12] + tag[16] + ciphertext )
 */
export function encryptDeterministic(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;

  const iv = crypto
    .createHash("sha256")
    .update(KEY)
    .digest()
    .subarray(0, IV_LENGTH);

  const cipher = crypto.createCipheriv(ALG, KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(String(plaintext).toLowerCase(), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Alias for decrypt() — use when decrypting deterministically encrypted values.
 * Kept separate for code clarity so it's obvious which encrypt function was used.
 */
export function decryptDeterministic(encoded) {
  return decrypt(encoded);
}

/**
 * SHA-256 hash — for fast deduplication lookups (BVN fingerprint, token fingerprint).
 * Not suitable for passwords — use Argon2id for those.
 */
export function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}
