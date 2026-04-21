import { redis } from "../config/redis.js";

const DEFAULT_TTL = 86400; // 24 hours in seconds

/**
 * Generate a deterministic idempotency key for a debit operation.
 * Same inputs always produce the same key.
 */
export function generateDebitKey(cycleId, memberId, attemptNumber = 0) {
  return `idem:debit:${cycleId}:${memberId}:attempt:${attemptNumber}`;
}

/**
 * Generate a deterministic idempotency key for a payout operation.
 */
export function generatePayoutKey(cycleId) {
  return `idem:payout:${cycleId}`;
}

/**
 * Check if an idempotency key has already been processed.
 * Returns the cached result if found, null if not.
 */
export async function checkIdempotency(key) {
  const cached = await redis.get(key);
  if (!cached) return null;
  return JSON.parse(cached);
}

/**
 * Store the result of an operation against its idempotency key.
 * Subsequent calls with the same key return the cached result.
 */
export async function setIdempotency(key, result, ttl = DEFAULT_TTL) {
  await redis.setex(key, ttl, JSON.stringify(result));
}

/**
 * Mark an idempotency key as in-progress using a Redis lock.
 * Returns true if the lock was acquired, false if already locked.
 *
 * Prevents two workers from processing the same job simultaneously
 * (e.g. if BullMQ retries before the first attempt completes).
 */
export async function acquireLock(key, ttl = 300) {
  const lockKey = `lock:${key}`;
  const result = await redis.set(lockKey, "1", "EX", ttl, "NX");
  return result === "OK";
}

export async function releaseLock(key) {
  await redis.del(`lock:${key}`);
}
