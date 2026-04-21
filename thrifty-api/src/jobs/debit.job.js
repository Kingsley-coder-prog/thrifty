import { debitService } from "../services/debit.service.js";
import { debitQueue } from "../config/queue.js";
import { logger } from "../lib/logger.js";
import { db } from "../config/database.js";

// retry delays in milliseconds — spread across the debit window
const RETRY_DELAYS = [
  0, // attempt 1: immediate (25th)
  172800000, // attempt 2: +2 days
  345600000, // attempt 3: +4 days
  518400000, // attempt 4: +6 days (approaching the 5th)
];

/**
 * BullMQ job processor for the 'debit' queue.
 *
 * Receives a job with { cycleId, memberId, attemptNumber }.
 * Calls debitService.initiateDebit().
 * On ALL_ACCOUNTS_FAILED: schedules a retry with increasing delay.
 * On final failure: contribution is marked DEFAULTED by the service.
 */
export async function debitJobProcessor(job) {
  const { cycleId, memberId, attemptNumber = 0 } = job.data;

  logger.info(
    { jobId: job.id, cycleId, memberId, attemptNumber },
    "Debit job started",
  );

  try {
    await debitService.initiateDebit({ cycleId, memberId, attemptNumber });
    logger.info({ jobId: job.id, cycleId, memberId }, "Debit job completed");
  } catch (err) {
    if (err.message === "ALL_ACCOUNTS_FAILED") {
      const nextAttempt = attemptNumber + 1;
      const delay = RETRY_DELAYS[nextAttempt];

      if (delay !== undefined) {
        // schedule retry
        await debitQueue.add(
          "debit_retry",
          {
            cycleId,
            memberId,
            attemptNumber: nextAttempt,
          },
          {
            delay,
            jobId: `debit_${cycleId}_${memberId}_attempt_${nextAttempt}`,
          },
        );

        logger.info(
          {
            cycleId,
            memberId,
            nextAttempt,
            delayHours: delay / 3600000,
          },
          "Debit retry scheduled",
        );
      } else {
        logger.error(
          { cycleId, memberId },
          "Debit exhausted all retries — member defaulted",
        );
      }

      // don't re-throw — this is a handled failure, not a job crash
      return;
    }

    // unexpected error — re-throw so BullMQ marks the job as failed
    logger.error({ jobId: job.id, err }, "Debit job unexpected error");
    throw err;
  }
}
