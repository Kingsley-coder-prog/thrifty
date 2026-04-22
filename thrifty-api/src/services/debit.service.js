import { db } from "../config/database.js";
import { paystack } from "../lib/paystack.js";
import { logger } from "../lib/logger.js";
import { auditLog, AuditEvent } from "../lib/audit.js";
import { payoutQueue } from "../config/queue.js";
import { fraudService } from "./fraud.service.js";
import { notificationService } from "./notification.service.js";

const MAX_RETRY_ATTEMPTS = 4;

export const debitService = {
  async initiateDebit({ cycleId, memberId, attemptNumber = 0 }) {
    const contribution = await db("contributions")
      .where({ cycle_id: cycleId, member_id: memberId })
      .first();

    if (!contribution)
      throw new Error(
        `No contribution found for cycle ${cycleId} member ${memberId}`,
      );
    if (contribution.status === "settled") return contribution;

    const member = await db("group_members")
      .join("users", "users.id", "group_members.user_id")
      .where({ "group_members.id": memberId })
      .select(
        "group_members.id",
        "group_members.user_id",
        "group_members.group_id",
        "users.email",
      )
      .first();

    const accounts = await db("bank_accounts")
      .where({ user_id: member.user_id, mandate_status: "active" })
      .orderBy([
        { column: "is_primary", order: "desc" },
        { column: "fallback_order", order: "asc" },
      ]);

    // dev simulation
    if (
      process.env.NODE_ENV === "development" &&
      process.env.PAYSTACK_SECRET_KEY ===
        "sk_test_placeholder_replace_with_real"
    ) {
      return debitService.simulateDebit(contribution, member);
    }

    for (const account of accounts) {
      try {
        const reference = `debit_${cycleId}_${memberId}_${attemptNumber}_${Date.now()}`;

        const charge = await paystack.chargeAuthorization({
          authorizationCode: account.mandate_reference,
          amount: contribution.amount,
          reference,
          email: `${member.user_id}@thrifty.ng`,
        });

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
          payload: { cycleId, memberId, reference },
        });

        // notify user
        const cycle = await db("cycles").where({ id: cycleId }).first();
        await notificationService.notifyDebitInitiated(member.user_id, {
          amount: contribution.amount,
          cycleNumber: cycle.cycle_number,
          groupId: member.group_id,
        });

        return { reference, status: "pending" };
      } catch (err) {
        logger.warn(
          { cycleId, memberId, accountId: account.id, err: err.message },
          "Debit attempt failed — trying next account",
        );
        continue;
      }
    }

    await handleAllAccountsFailed(contribution, member, attemptNumber);
    throw new Error("ALL_ACCOUNTS_FAILED");
  },

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

    await debitService.checkCycleCompletion(contribution.cycle_id);

    return { reference, status: "settled" };
  },

  async checkCycleCompletion(cycleId) {
    const result = await db("contributions")
      .where({ cycle_id: cycleId, status: "settled" })
      .select(db.raw("COUNT(*) as count"), db.raw("SUM(amount) as total"))
      .first();

    const cycle = await db("cycles").where({ id: cycleId }).first();

    if (
      parseInt(result.count) === 7 &&
      parseFloat(result.total) >= parseFloat(cycle.expected_total)
    ) {
      logger.info({ cycleId }, "All contributions settled — triggering payout");

      await db("cycles")
        .where({ id: cycleId })
        .update({ status: "pending_payout" });

      await payoutQueue.add(
        "trigger_payout",
        { cycleId },
        {
          jobId: `payout_${cycleId}`,
        },
      );
    }
  },

  async handleChargeSuccess(reference) {
    const contribution = await db("contributions")
      .where({ payment_reference: reference })
      .orWhere({ processor_ref: reference })
      .first();

    if (!contribution || contribution.status === "settled") return;

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

  async handleChargeFailed(reference, reason) {
    const contribution = await db("contributions")
      .where({ payment_reference: reference })
      .orWhere({ processor_ref: reference })
      .first();

    if (!contribution) return;

    const member = await db("group_members")
      .where({ id: contribution.member_id })
      .first();

    await db("contributions").where({ id: contribution.id }).update({
      status: "failed",
      failure_reason: reason,
    });

    await notificationService.notifyDebitFailed(member.user_id, {
      amount: contribution.amount,
      reason,
      groupId: member.group_id,
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

async function handleAllAccountsFailed(contribution, member, attemptNumber) {
  const newAttemptCount = (contribution.attempt_count ?? 0) + 1;

  if (newAttemptCount >= MAX_RETRY_ATTEMPTS) {
    await db("contributions").where({ id: contribution.id }).update({
      status: "defaulted",
      attempt_count: newAttemptCount,
      last_attempt_at: new Date(),
      failure_reason: "All accounts failed — maximum retry attempts reached",
    });

    await db("group_members")
      .where({ id: member.id })
      .update({ status: "defaulted" });

    const cycle = await db("cycles")
      .where({ id: contribution.cycle_id })
      .first();

    // flag the default in the fraud engine
    await fraudService.flagPaymentDefault(member.user_id, {
      cycleId: contribution.cycle_id,
      groupId: member.group_id,
    });

    // check for payout pattern (collect then default)
    await fraudService.checkPayoutPattern(member.user_id);

    // notify the user
    await notificationService.notifyDebitDefaulted(member.user_id, {
      groupId: member.group_id,
    });

    await auditLog({
      event_type: AuditEvent.DEBIT_DEFAULTED,
      actor_type: "system",
      target_id: contribution.id,
      target_type: "contribution",
      payload: { memberId: member.id, attemptNumber: newAttemptCount },
    });

    logger.error(
      { memberId: member.id, contributionId: contribution.id },
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
