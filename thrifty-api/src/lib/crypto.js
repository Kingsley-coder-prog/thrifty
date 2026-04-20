import crypto from "crypto";
import { env } from "../config/env.js";

const KEY = Buffer.from(env.ENCRYPTION_KEY, "hex"); // 32 bytes
const ALG = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits — recommended for GCM
const TAG_LENGTH = 16; // 128 bits — GCM auth tag

/**
 * Randomised encryption — each call produces different ciphertext.
 * Use for fields that are never used as lookup keys: full_name.
 *
 * Format stored in DB: base64(iv[12] + tag[16] + ciphertext)
 */
export function encrypt(plaintext) {
  if (!plaintext) return null;

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
 * Decrypt a value encrypted with encrypt().
 */
export function decrypt(encoded) {
  if (!encoded) return null;

  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALG, KEY, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted, undefined, "utf8") + decipher.final("utf8");
}

/**
 * Deterministic encryption — same plaintext always produces same ciphertext.
 * Required for fields used in WHERE clauses or UNIQUE constraints: phone_number, email.
 *
 * Uses a fixed IV derived from the key — acceptable tradeoff for lookup columns.
 * Do NOT use for free-text fields where value uniqueness matters for security.
 *
 * Format stored in DB: base64(ciphertext) — no IV prefix needed (it's fixed)
 */
export function encryptDeterministic(plaintext) {
  if (!plaintext) return null;

  // derive a fixed 12-byte IV from the key itself
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

  return encrypted.toString("base64");
}

/**
 * Hash a value with SHA-256 — for non-sensitive deduplication checks.
 * Not suitable for passwords or BVNs (use Argon2id for those).
 */
export function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}
