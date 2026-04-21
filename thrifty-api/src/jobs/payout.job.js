import { payoutService } from "../services/payout.service.js";
import { logger } from "../lib/logger.js";

/**
 * BullMQ job processor for the 'payout' queue.
 *
 * Receives a job with { cycleId }.
 * Calls payoutService.triggerPayout() which runs all 6 guards.
 * If guards pass, payout is initiated.
 * If guards fail, the error is logged and the job fails —
 * admin must review and resolve manually.
 */
export async function payoutJobProcessor(job) {
  const { cycleId } = job.data;

  logger.info({ jobId: job.id, cycleId }, "Payout job started");

  try {
    const payout = await payoutService.triggerPayout(cycleId);

    logger.info(
      {
        jobId: job.id,
        cycleId,
        payoutId: payout.id,
        amount: payout.net_amount,
      },
      "Payout job completed",
    );
  } catch (err) {
    if (err.isGuardFailure) {
      // guard failures are expected — log clearly and fail the job
      // admin console will show this as a flagged payout needing review
      logger.error(
        {
          jobId: job.id,
          cycleId,
          guardCode: err.guardCode,
          details: err.details,
        },
        "Payout guard failure — requires admin review",
      );

      throw err; // mark job as failed in BullMQ
    }

    logger.error(
      { jobId: job.id, cycleId, err },
      "Payout job unexpected error",
    );
    throw err;
  }
}
