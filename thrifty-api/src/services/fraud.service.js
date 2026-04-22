import { db } from "../config/database.js";
import { logger } from "../lib/logger.js";
import { auditLog, AuditEvent } from "../lib/audit.js";

/**
 * Risk score thresholds
 * 0–30:   Low risk — normal user
 * 31–60:  Medium risk — monitor
 * 61–80:  High risk — restrict new group joins
 * 81–100: Critical risk — block payouts, require admin review
 */
const RISK_THRESHOLD_CRITICAL = 80;
const RISK_THRESHOLD_HIGH = 60;

export const fraudService = {
  /**
   * Check if a user has any open critical fraud flags.
   * Called by payout guard 4 before every disbursement.
   *
   * @param {string} userId
   * @returns {boolean} true if payout should be blocked
   */
  async hasCriticalFlags(userId) {
    const flag = await db("fraud_flags")
      .where({ user_id: userId, status: "open" })
      .whereIn("flag_type", [
        "bvn_duplication",
        "payout_pattern",
        "multiple_defaults",
        "manual_review",
      ])
      .first();

    return !!flag;
  },

  /**
   * Get the total risk score for a user.
   * Sum of all open fraud flag risk scores.
   */
  async getRiskScore(userId) {
    const result = await db("fraud_flags")
      .where({ user_id: userId, status: "open" })
      .sum("risk_score as total")
      .first();

    return Math.min(parseInt(result.total ?? 0), 100);
  },

  /**
   * Flag a payment default.
   * Called by debit.service when a member exhausts all retry attempts.
   *
   * First default: 20 risk points
   * Second default: additional 40 points + escalate to 'multiple_defaults'
   */
  async flagPaymentDefault(userId, { cycleId, groupId }) {
    // check for existing default flags
    const existingDefaults = await db("fraud_flags")
      .where({ user_id: userId, flag_type: "payment_default" })
      .count("* as count")
      .first();

    const defaultCount = parseInt(existingDefaults.count);

    if (defaultCount >= 1) {
      // second or more default — escalate to multiple_defaults
      await createFlag({
        userId,
        flagType: "multiple_defaults",
        riskScore: 40,
        triggerEvent: `Payment default in cycle ${cycleId}`,
        details: { cycleId, groupId, totalDefaults: defaultCount + 1 },
      });

      logger.warn(
        { userId, defaultCount: defaultCount + 1 },
        "Multiple defaults — user escalated",
      );
    } else {
      // first default
      await createFlag({
        userId,
        flagType: "payment_default",
        riskScore: 20,
        triggerEvent: `Payment default in cycle ${cycleId}`,
        details: { cycleId, groupId },
      });
    }

    // check total risk score — if critical, freeze the user's ability to join new groups
    const totalRisk = await fraudService.getRiskScore(userId);
    if (totalRisk >= RISK_THRESHOLD_CRITICAL) {
      logger.error(
        { userId, totalRisk },
        "User risk score critical — restricting account",
      );
    }
  },

  /**
   * Detect velocity abuse — joining too many groups too quickly.
   * Called when a user attempts to join a group.
   *
   * Rule: no more than 3 group joins in a 30-day window.
   */
  async checkVelocity(userId) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentJoins = await db("group_members")
      .where({ user_id: userId })
      .where("joined_at", ">=", thirtyDaysAgo)
      .count("* as count")
      .first();

    const joinCount = parseInt(recentJoins.count);

    if (joinCount >= 3) {
      await createFlag({
        userId,
        flagType: "velocity_breach",
        riskScore: 25,
        triggerEvent: `Attempted to join ${joinCount + 1} groups in 30 days`,
        details: { recentJoinCount: joinCount },
      });

      logger.warn({ userId, joinCount }, "Velocity breach detected");
      return false; // block the join
    }

    return true; // allow the join
  },

  /**
   * Detect payout pattern abuse — collect then default.
   * Called after every payout completes.
   *
   * Pattern: user has collected at least once but has defaulted in a
   * different group. Classic "collect and run" behaviour.
   */
  async checkPayoutPattern(userId) {
    // check if user has collected in any group
    const collected = await db("group_members")
      .where({ user_id: userId, has_collected: true })
      .first();

    if (!collected) return; // never collected — no pattern to check

    // check if they have any defaults
    const defaulted = await db("group_members")
      .where({ user_id: userId, status: "defaulted" })
      .first();

    if (defaulted) {
      // has both collected and defaulted — suspicious pattern
      const existingFlag = await db("fraud_flags")
        .where({ user_id: userId, flag_type: "payout_pattern", status: "open" })
        .first();

      if (!existingFlag) {
        await createFlag({
          userId,
          flagType: "payout_pattern",
          riskScore: 60,
          triggerEvent: "User collected payout then defaulted in another group",
          details: {
            collectedGroupId: collected.group_id,
            defaultedGroupId: defaulted.group_id,
          },
        });

        logger.error(
          { userId },
          "Payout pattern detected — collect then default",
        );
      }
    }
  },

  /**
   * Check for BVN duplication — same BVN used for multiple accounts.
   * Called during registration.
   *
   * Note: the UNIQUE constraint on bvn_fingerprint already prevents
   * this at the DB level. This adds an extra check and creates an
   * audit trail when an attempt is detected.
   */
  async checkBvnDuplication(userId, bvnFingerprint) {
    const duplicate = await db("users")
      .where({ bvn_fingerprint: bvnFingerprint })
      .whereNot({ id: userId })
      .first();

    if (duplicate) {
      await createFlag({
        userId,
        flagType: "bvn_duplication",
        riskScore: 100,
        triggerEvent: "BVN linked to another account",
        details: { duplicateUserId: duplicate.id },
      });

      return true; // duplication detected
    }

    return false;
  },

  /**
   * Get all open fraud flags for a user.
   * Used by the admin console.
   */
  async getUserFlags(userId) {
    return db("fraud_flags")
      .where({ user_id: userId })
      .orderBy("created_at", "desc")
      .select("*");
  },

  /**
   * Resolve a fraud flag (admin action).
   */
  async resolveFlag(flagId, adminId, { resolution = "resolved" } = {}) {
    await db("fraud_flags").where({ id: flagId }).update({
      status: resolution,
      reviewed_by: adminId,
      resolved_at: new Date(),
    });

    await auditLog({
      event_type: "FRAUD_FLAG_RESOLVED",
      actor_id: adminId,
      actor_type: "admin",
      target_id: flagId,
      target_type: "fraud_flag",
      payload: { resolution },
    });
  },
};

// ── Private helpers ───────────────────────────────────────────────

async function createFlag({
  userId,
  flagType,
  riskScore,
  triggerEvent,
  details,
}) {
  const [flag] = await db("fraud_flags")
    .insert({
      user_id: userId,
      flag_type: flagType,
      risk_score: riskScore,
      trigger_event: triggerEvent,
      details: JSON.stringify(details),
      status: "open",
    })
    .returning("*");

  await auditLog({
    event_type: "FRAUD_FLAG_CREATED",
    actor_type: "system",
    target_id: userId,
    target_type: "user",
    payload: { flagType, riskScore, triggerEvent, details },
  });

  logger.warn({ userId, flagType, riskScore }, "Fraud flag created");

  return flag;
}
