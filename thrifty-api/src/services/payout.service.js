import { v4 as uuidv4 } from "uuid";
import { db } from "../config/database.js";
import { paystack } from "../lib/paystack.js";
import { auditLog, AuditEvent } from "../lib/audit.js";
import { logger } from "../lib/logger.js";
import { cycleService } from "./cycle.service.js";
import { notificationService } from "./notification.service.js";

export const payoutService = {
  /**
   * Trigger a payout for a completed cycle.
   *
   * Runs all 6 guards inside a single DB transaction with a
   * SELECT FOR UPDATE lock on the recipient row — preventing
   * any concurrent payout trigger from also succeeding.
   *
   * If all guards pass:
   *   1. Inserts the payout record
   *   2. Locks has_collected = true on the recipient
   *   3. Initiates the Paystack transfer (outside transaction)
   *
   * @param {string} cycleId
   */
  async triggerPayout(cycleId) {
    // generate transfer reference BEFORE the transaction
    // so it's available for idempotency even if the transaction retries
    const transferReference = uuidv4();

    const payout = await db.transaction(async (trx) => {
      const cycle = await trx("cycles").where({ id: cycleId }).first();

      if (!cycle) throw new Error(`Cycle ${cycleId} not found`);

      // ── GUARD 1: contribution completeness ──────────────────────
      const completionCheck = await trx("contributions")
        .where({ cycle_id: cycleId, status: "settled" })
        .select(db.raw("COUNT(*) as count"), db.raw("SUM(amount) as total"))
        .first();

      if (parseInt(completionCheck.count) !== 7) {
        throw guardFail("INCOMPLETE_CONTRIBUTIONS", cycleId, {
          settled: completionCheck.count,
          required: 7,
        });
      }

      if (
        parseFloat(completionCheck.total) < parseFloat(cycle.expected_total)
      ) {
        throw guardFail("AMOUNT_MISMATCH", cycleId, {
          collected: completionCheck.total,
          expected: cycle.expected_total,
        });
      }

      // ── GUARD 2: double-collection prevention (row lock) ────────
      const recipient = await trx("group_members")
        .where({ id: cycle.recipient_member_id })
        .forUpdate() // exclusive lock — prevents concurrent payout
        .first();

      if (recipient.has_collected) {
        throw guardFail("ALREADY_COLLECTED", cycleId, {
          memberId: recipient.id,
        });
      }

      // check no non-failed payout already exists for this cycle
      const existingPayout = await trx("payouts")
        .where({ cycle_id: cycleId })
        .whereNot({ status: "failed" })
        .first();

      if (existingPayout) {
        logger.info(
          { cycleId, payoutId: existingPayout.id },
          "Payout already exists — idempotent return",
        );
        return existingPayout;
      }

      // ── GUARD 3: recipient account validity ─────────────────────
      const recipientUser = await trx("users")
        .where({ id: recipient.user_id })
        .first();

      if (!recipientUser || recipientUser.account_status !== "active") {
        throw guardFail("RECIPIENT_ACCOUNT_INVALID", cycleId, {
          userId: recipient.user_id,
          status: recipientUser?.account_status,
        });
      }

      if (!recipientUser.bvn_verified_at) {
        throw guardFail("RECIPIENT_BVN_UNVERIFIED", cycleId);
      }

      // ── GUARD 4: fraud score check ──────────────────────────────
      const openFlag = await trx("fraud_flags")
        .where({
          user_id: recipient.user_id,
          status: "open",
        })
        .whereIn("flag_type", [
          "bvn_duplication",
          "payout_pattern",
          "multiple_defaults",
        ])
        .first();

      if (openFlag) {
        throw guardFail("FRAUD_FLAG_OPEN", cycleId, {
          flagId: openFlag.id,
          flagType: openFlag.flag_type,
        });
      }

      // ── GUARD 5: turn order enforcement ─────────────────────────
      if (cycle.cycle_number !== recipient.turn_position) {
        throw guardFail("TURN_ORDER_MISMATCH", cycleId, {
          cycleNumber: cycle.cycle_number,
          turnPosition: recipient.turn_position,
        });
      }

      // ── GUARD 6: amount validation and atomic insert ─────────────
      const tierData = await trx("thrift_groups")
        .join("tiers", "tiers.id", "thrift_groups.tier_id")
        .where({ "thrift_groups.id": cycle.group_id })
        .select("tiers.total_payout", "tiers.platform_fee_pct")
        .first();

      const grossAmount = parseFloat(tierData.total_payout);
      const platformFee = parseFloat(
        ((grossAmount * tierData.platform_fee_pct) / 100).toFixed(2),
      );
      const netAmount = parseFloat((grossAmount - platformFee).toFixed(2));

      const recipientAccount = await trx("bank_accounts")
        .where({ user_id: recipient.user_id, is_primary: true })
        .first();

      if (!recipientAccount) {
        throw guardFail("RECIPIENT_NO_BANK_ACCOUNT", cycleId);
      }

      // insert payout record atomically
      const [newPayout] = await trx("payouts")
        .insert({
          cycle_id: cycleId,
          recipient_user_id: recipient.user_id,
          recipient_account_id: recipientAccount.id,
          gross_amount: grossAmount,
          platform_fee: platformFee,
          net_amount: netAmount,
          status: "pending",
          transfer_reference: transferReference,
          initiated_at: new Date(),
        })
        .returning("*");

      // lock has_collected — this is the critical double-collection guard
      await trx("group_members").where({ id: recipient.id }).update({
        has_collected: true,
        collected_at: new Date(),
        collected_cycle: cycle.cycle_number,
      });

      await auditLog({
        event_type: AuditEvent.PAYOUT_INITIATED,
        actor_type: "system",
        target_id: newPayout.id,
        target_type: "payout",
        payload: { cycleId, recipientUserId: recipient.user_id, netAmount },
        trx,
      });

      return newPayout;
    });

    // ── Initiate transfer OUTSIDE the transaction ─────────────────
    // Transaction is committed at this point.
    // If the transfer call fails, the payout record stays as 'pending'
    // and can be retried by the job processor.

    if (
      process.env.NODE_ENV === "development" &&
      process.env.PAYSTACK_SECRET_KEY ===
        "sk_test_placeholder_replace_with_real"
    ) {
      await payoutService.simulatePayout(payout);
      return payout;
    }

    try {
      const recipientAccount = await db("bank_accounts")
        .where({ id: payout.recipient_account_id })
        .first();

      await paystack.initiateTransfer({
        amount: payout.net_amount,
        recipientCode: recipientAccount.account_token,
        reference: payout.transfer_reference,
        reason: `Thrifty payout — cycle ${payout.cycle_id}`,
      });

      await db("payouts")
        .where({ id: payout.id })
        .update({ status: "processing" });
    } catch (err) {
      logger.error({ payoutId: payout.id, err }, "Transfer initiation failed");
      // don't throw — job processor handles retry
    }

    return payout;
  },

  /**
   * Simulate a payout in development.
   * Marks payout as completed and advances the cycle.
   */
  async simulatePayout(payout) {
    await db("payouts")
      .where({ id: payout.id })
      .update({
        status: "completed",
        completed_at: new Date(),
        processor_ref: `sim_transfer_${payout.id}`,
      });

    await db("cycles")
      .where({ id: payout.cycle_id })
      .update({ status: "completed", payout_completed_at: new Date() });

    await cycleService.advanceCycle(payout.cycle_id);

    await auditLog({
      event_type: AuditEvent.PAYOUT_COMPLETED,
      actor_type: "system",
      target_id: payout.id,
      target_type: "payout",
      payload: { simulated: true },
    });

    await notificationService.notifyPayoutCompleted(payout.recipient_user_id, {
      amount: payout.net_amount,
      cycleNumber: (
        await db("cycles")
          .where({ id: payout.cycle_id })
          .select("cycle_number")
          .first()
      ).cycle_number,
      groupId: (
        await db("cycles")
          .join("thrift_groups", "thrift_groups.id", "cycles.group_id")
          .where({ "cycles.id": payout.cycle_id })
          .select("thrift_groups.id")
          .first()
      ).id,
    });

    logger.info({ payoutId: payout.id }, "Payout simulated (dev mode)");
  },

  /**
   * Handle Paystack transfer.success webhook.
   */
  async handleTransferSuccess(reference) {
    const payout = await db("payouts")
      .where({ transfer_reference: reference })
      .first();

    if (!payout) {
      logger.warn(
        { reference },
        "No payout found for transfer.success webhook",
      );
      return;
    }

    if (payout.status === "completed") {
      logger.info(
        { reference },
        "Payout already completed — webhook duplicate",
      );
      return;
    }

    await db("payouts").where({ id: payout.id }).update({
      status: "completed",
      completed_at: new Date(),
    });

    await db("cycles")
      .where({ id: payout.cycle_id })
      .update({ status: "completed", payout_completed_at: new Date() });

    await cycleService.advanceCycle(payout.cycle_id);

    await auditLog({
      event_type: AuditEvent.PAYOUT_COMPLETED,
      actor_type: "system",
      target_id: payout.id,
      target_type: "payout",
      payload: { reference },
    });

    logger.info({ payoutId: payout.id, reference }, "Payout completed");
  },

  /**
   * Handle Paystack transfer.failed webhook.
   */
  async handleTransferFailed(reference, reason) {
    const payout = await db("payouts")
      .where({ transfer_reference: reference })
      .first();

    if (!payout) return;

    await db("payouts").where({ id: payout.id }).update({ status: "failed" });

    await auditLog({
      event_type: AuditEvent.PAYOUT_FAILED,
      actor_type: "system",
      target_id: payout.id,
      target_type: "payout",
      payload: { reference, reason },
    });

    logger.error({ payoutId: payout.id, reason }, "Payout transfer failed");
  },
};

// ── Private helpers ───────────────────────────────────────────────

function guardFail(code, cycleId, details = {}) {
  const err = new Error(code);
  err.isGuardFailure = true;
  err.guardCode = code;
  err.cycleId = cycleId;
  err.details = details;

  // log immediately so admin can see which guard failed
  auditLog({
    event_type: AuditEvent.PAYOUT_GUARD_FAILED,
    actor_type: "system",
    target_id: cycleId,
    target_type: "cycle",
    payload: { code, ...details },
  }).catch(() => {});

  logger.error({ cycleId, code, details }, "Payout guard failed");

  return err;
}
