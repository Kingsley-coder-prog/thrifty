import { logger } from "../lib/logger.js";

/**
 * BullMQ job processor for the 'notification' queue.
 *
 * Phase 7 will implement the full SMS, push, and email dispatch.
 * For now this logs the notification and returns successfully
 * so the queue doesn't back up during testing.
 */
export async function notificationJobProcessor(job) {
  const { type, ...data } = job.data;

  logger.info(
    { jobId: job.id, type, data },
    "Notification job received (Phase 7 stub)",
  );

  // Phase 7: route to Termii (SMS), FCM (push), or email based on type
}
