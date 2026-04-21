import { db } from "../config/database.js";
import { paystack } from "../lib/paystack.js";
import { logger } from "../lib/logger.js";
import { auditLog, AuditEvent } from "../lib/audit.js";
import { payoutQueue } from "../config/queue.js";

const MAX_RETRY_ATTEMPTS = 4; // initial attempt + 3 retries

export const debitService = {
  /**
   * Initiate a direct debit for one member in a cycle.
   *
   * Flow:
   * 1. Load the member's bank accounts ordered primary first
   * 2. Try the primary account
   * 3. On failure, try fallback accounts in order
   * 4. On all accounts failing, mark as defaulted
   *
   * In development (placeholder Paystack key), this simulates a
   * successful charge without calling the real API.
   */
  async initiateDebit({ cycleId, memberId, attemptNumber = 0 }) {
    // load contribution record
    const contribution = await db("contributions")
      .where({ cycle_id: cycleId, member_id: memberId })
      .first();

    if (!contribution) {
      throw new Error(
        `No contribution found for cycle ${cycleId} member ${memberId}`,
      );
    }

    // already settled — idempotent return
    if (contribution.status === "settled") {
      logger.info(
        { cycleId, memberId },
        "Contribution already settled — skipping",
      );
      return contribution;
    }

    // load member and their user
    const member = await db("group_members")
      .join("users", "users.id", "group_members.user_id")
      .where({ "group_members.id": memberId })
      .select("group_members.id", "group_members.user_id", "users.email")
      .first();

    // load bank accounts ordered: primary first, then fallback by order
    const accounts = await db("bank_accounts")
      .where({
        user_id: member.user_id,
        mandate_status: "active",
      })
      .orderBy([
        { column: "is_primary", order: "desc" },
        { column: "fallback_order", order: "asc" },
      ]);

    // in development with placeholder key — simulate success
    if (
      process.env.NODE_ENV === "development" &&
      process.env.PAYSTACK_SECRET_KEY ===
        "sk_test_placeholder_replace_with_real"
    ) {
      return debitService.simulateDebit(contribution, member);
    }

    // try each account in order
    for (const account of accounts) {
      try {
        const reference = `debit_${cycleId}_${memberId}_${attemptNumber}_${Date.now()}`;

        const charge = await paystack.chargeAuthorization({
          authorizationCode: account.mandate_reference,
          amount: contribution.amount,
          reference,
          email: member.email
            ? Buffer.from(member.email, "base64").toString() // decrypt email for Paystack
            : `${member.user_id}@thrifty.ng`,
        });

        // update contribution to pending (webhook confirms)
        await db("contributions")
          .where({ id: contribution.id })
          .update({
            status: "pending",
            bank_account_id: account.id,
            payment_reference: reference,
            processor_ref: charge.reference,
            attempt_count: db.raw("attempt_count + 1"),
            last_attempt_at: new Date(),
          });

        await auditLog({
          event_type: AuditEvent.DEBIT_INITIATED,
          actor_type: "system",
          target_id: contribution.id,
          target_type: "contribution",
          payload: { cycleId, memberId, reference, bankAccountId: account.id },
        });

        logger.info({ cycleId, memberId, reference }, "Debit initiated");
        return { reference, status: "pending" };
      } catch (err) {
        logger.warn(
          {
            cycleId,
            memberId,
            accountId: account.id,
            err: err.message,
          },
          "Debit attempt failed — trying next account",
        );

        // continue to next account
        continue;
      }
    }

    // all accounts failed
    await handleAllAccountsFailed(contribution, memberId, attemptNumber);
    throw new Error("ALL_ACCOUNTS_FAILED");
  },

  /**
   * Simulate a successful debit in development.
   * Marks the contribution as settled immediately without calling Paystack.
   */
  async simulateDebit(contribution, member) {
    const reference = `sim_${contribution.id}_${Date.now()}`;

    await db("contributions").where({ id: contribution.id }).update({
      status: "settled",
      payment_reference: reference,
      processor_ref: reference,
      attempt_count: 1,
      last_attempt_at: new Date(),
      settled_at: new Date(),
    });

    // update cycle collected total
    await db("cycles")
      .where({ id: contribution.cycle_id })
      .update({
        collected_total: db.raw("collected_total + ?", [contribution.amount]),
      });

    logger.info(
      {
        contributionId: contribution.id,
        memberId: member.id,
        amount: contribution.amount,
      },
      "Debit simulated (dev mode)",
    );

    // check if all contributions are now settled
    await debitService.checkCycleCompletion(contribution.cycle_id);

    return { reference, status: "settled" };
  },

  /**
   * Check if all contributions for a cycle are settled.
   * If yes, enqueue a payout job.
   */
  async checkCycleCompletion(cycleId) {
    const { count, total } = await db("contributions")
      .where({ cycle_id: cycleId, status: "settled" })
      .select(db.raw("COUNT(*) as count"), db.raw("SUM(amount) as total"))
      .first();

    const cycle = await db("cycles").where({ id: cycleId }).first();

    if (
      parseInt(count) === 7 &&
      parseFloat(total) >= parseFloat(cycle.expected_total)
    ) {
      logger.info({ cycleId }, "All contributions settled — triggering payout");

      await db("cycles")
        .where({ id: cycleId })
        .update({ status: "pending_payout" });

      await payoutQueue.add(
        "trigger_payout",
        { cycleId },
        {
          jobId: `payout_${cycleId}`, // deduplicate
        },
      );
    }
  },

  /**
   * Handle Paystack charge.success webhook.
   */
  async handleChargeSuccess(reference) {
    const contribution = await db("contributions")
      .where({ payment_reference: reference })
      .orWhere({ processor_ref: reference })
      .first();

    if (!contribution) {
      logger.warn(
        { reference },
        "No contribution found for charge.success webhook",
      );
      return;
    }

    if (contribution.status === "settled") {
      logger.info(
        { reference },
        "Contribution already settled — webhook duplicate",
      );
      return;
    }

    await db("contributions").where({ id: contribution.id }).update({
      status: "settled",
      settled_at: new Date(),
    });

    await db("cycles")
      .where({ id: contribution.cycle_id })
      .update({
        collected_total: db.raw("collected_total + ?", [contribution.amount]),
      });

    await auditLog({
      event_type: AuditEvent.DEBIT_SUCCEEDED,
      actor_type: "system",
      target_id: contribution.id,
      target_type: "contribution",
      payload: { reference },
    });

    await debitService.checkCycleCompletion(contribution.cycle_id);
  },

  /**
   * Handle Paystack charge.failed webhook.
   */
  async handleChargeFailed(reference, reason) {
    const contribution = await db("contributions")
      .where({ payment_reference: reference })
      .orWhere({ processor_ref: reference })
      .first();

    if (!contribution) return;

    await db("contributions").where({ id: contribution.id }).update({
      status: "failed",
      failure_reason: reason,
    });

    await auditLog({
      event_type: AuditEvent.DEBIT_FAILED,
      actor_type: "system",
      target_id: contribution.id,
      target_type: "contribution",
      payload: { reference, reason },
    });
  },
};

// ── Private helpers ───────────────────────────────────────────────

async function handleAllAccountsFailed(contribution, memberId, attemptNumber) {
  const newAttemptCount = (contribution.attempt_count ?? 0) + 1;

  if (newAttemptCount >= MAX_RETRY_ATTEMPTS) {
    // mark as defaulted
    await db("contributions").where({ id: contribution.id }).update({
      status: "defaulted",
      attempt_count: newAttemptCount,
      last_attempt_at: new Date(),
      failure_reason: "All accounts failed — maximum retry attempts reached",
    });

    await db("group_members")
      .where({ id: memberId })
      .update({ status: "defaulted" });

    await auditLog({
      event_type: AuditEvent.DEBIT_DEFAULTED,
      actor_type: "system",
      target_id: contribution.id,
      target_type: "contribution",
      payload: { memberId, attemptNumber: newAttemptCount },
    });

    logger.error(
      { memberId, contributionId: contribution.id },
      "Member defaulted",
    );
  } else {
    await db("contributions").where({ id: contribution.id }).update({
      status: "retrying",
      attempt_count: newAttemptCount,
      last_attempt_at: new Date(),
    });
  }
}
