import cron from "node-cron";
import { db } from "../config/database.js";
import { debitQueue } from "../config/queue.js";
import { logger } from "../lib/logger.js";

/**
 * Monthly debit scheduler.
 *
 * Runs at 08:00 WAT (07:00 UTC) on the 25th of every month.
 * Finds all active cycles in their debit window and enqueues
 * one debit job per unsettled member.
 *
 * BullMQ jobId deduplication ensures that if the cron fires twice
 * (e.g. after a restart), each member is only debited once per cycle.
 */
export function startScheduler() {
  // '0 7 25 * *' = 07:00 UTC on the 25th of every month
  cron.schedule("0 7 25 * *", enqueueMonthlyDebits, {
    timezone: "Africa/Lagos",
  });

  logger.info(
    "Debit scheduler started — fires at 08:00 WAT on 25th each month",
  );
}

async function enqueueMonthlyDebits() {
  logger.info("Monthly debit scheduler triggered");

  try {
    // find all cycles currently in their debit window
    const today = new Date();

    const activeCycles = await db("cycles")
      .join("thrift_groups", "thrift_groups.id", "cycles.group_id")
      .where({ "thrift_groups.status": "active" })
      .whereIn("cycles.status", ["collecting"])
      .where("cycles.debit_window_start", "<=", today)
      .where("cycles.debit_window_end", ">=", today)
      .select("cycles.id as cycle_id", "cycles.group_id");

    logger.info(
      { cycleCount: activeCycles.length },
      "Found active cycles for debit",
    );

    let enqueued = 0;

    for (const cycle of activeCycles) {
      // find members whose contributions are still pending or failed
      const pendingMembers = await db("contributions")
        .join("group_members", "group_members.id", "contributions.member_id")
        .where({ "contributions.cycle_id": cycle.cycle_id })
        .whereIn("contributions.status", ["pending", "failed", "retrying"])
        .where({ "group_members.status": "active" })
        .select("contributions.member_id");

      for (const { member_id } of pendingMembers) {
        const jobId = `debit_${cycle.cycle_id}_${member_id}_attempt_0`;

        await debitQueue.add(
          "initiate_debit",
          {
            cycleId: cycle.cycle_id,
            memberId: member_id,
            attemptNumber: 0,
          },
          {
            jobId, // BullMQ deduplicates on jobId
          },
        );

        enqueued++;
      }
    }

    logger.info(
      { enqueued, cycles: activeCycles.length },
      "Debit jobs enqueued",
    );
  } catch (err) {
    logger.error({ err }, "Debit scheduler error");
  }
}

/**
 * Manually trigger debits for testing without waiting for the 25th.
 * Called from worker.js in development mode.
 */
export { enqueueMonthlyDebits as triggerDebitsNow };
