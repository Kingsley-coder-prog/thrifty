import crypto from "crypto";

/**
 * Cryptographically fair Fisher-Yates shuffle.
 *
 * Math.random() is NOT cryptographically secure — it can be predicted
 * if the seed is known. crypto.randomInt() uses the OS CSPRNG (same
 * source as crypto.randomBytes) and is genuinely unpredictable.
 *
 * This function is called exactly once per group — when the 7th member
 * joins and the group activates. The result is written to group_members
 * as turn_position values and is immutable after that point.
 *
 * @param {string[]} memberIds — array of group_member UUIDs
 * @returns {string[]} — shuffled copy (original array is not mutated)
 */
export function generateTurnOrder(memberIds) {
  const arr = [...memberIds]; // never mutate the input

  for (let i = arr.length - 1; i > 0; i--) {
    // crypto.randomInt(min, max) is uniform with no modulo bias
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

/**
 * Commit-reveal scheme for provably fair turn order.
 *
 * Before activation, generate a commitment:
 *   commitment = SHA256(memberIds.join(',') + '|' + seed)
 *
 * Publish the commitment publicly (store on the group record).
 * After activation, reveal the seed so members can verify the shuffle
 * was not rigged — anyone can recompute the commitment and check it matches.
 *
 * @param {string[]} memberIds
 * @returns {{ seed: string, commitment: string }}
 */
export function createShuffleCommitment(memberIds) {
  const seed = crypto.randomBytes(32).toString("hex");
  const input = memberIds.join(",") + "|" + seed;
  const commitment = crypto.createHash("sha256").update(input).digest("hex");

  return { seed, commitment };
}
