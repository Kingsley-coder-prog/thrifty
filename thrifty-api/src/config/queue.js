import { Queue, Worker } from "bullmq";
import { redis } from "./redis.js";
import { logger } from "../lib/logger.js";

// BullMQ requires a dedicated ioredis connection with specific options
// We create a separate connection factory for BullMQ
const connection = redis;

// ── Queue definitions ─────────────────────────────────────────────

export const debitQueue = new Queue("debit", {
  connection,
  defaultJobOptions: {
    attempts: 1, // retry logic handled inside job processor
    removeOnComplete: { age: 86400 * 7 }, // keep 7 days
    removeOnFail: { age: 86400 * 30 }, // keep 30 days for audit
  },
});

export const payoutQueue = new Queue("payout", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 86400 * 30 },
    removeOnFail: false, // never auto-delete failed payouts
  },
});

export const notificationQueue = new Queue("notification", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 1000 },
  },
});

// ── Worker startup ────────────────────────────────────────────────
// Called only from worker.js — never from server.js

export async function startWorkers() {
  const { debitJobProcessor } = await import("../jobs/debit.job.js");
  const { payoutJobProcessor } = await import("../jobs/payout.job.js");
  const { notificationJobProcessor } = await import(
    "../jobs/notification.job.js"
  );

  const debitWorker = new Worker("debit", debitJobProcessor, {
    connection,
    concurrency: 10,
  });

  const payoutWorker = new Worker("payout", payoutJobProcessor, {
    connection,
    concurrency: 5,
  });

  const notificationWorker = new Worker(
    "notification",
    notificationJobProcessor,
    {
      connection,
      concurrency: 20,
    },
  );

  // log worker events
  for (const worker of [debitWorker, payoutWorker, notificationWorker]) {
    worker.on("completed", (job) => {
      logger.info({ jobId: job.id, queue: job.queueName }, "Job completed");
    });

    worker.on("failed", (job, err) => {
      logger.error(
        { jobId: job?.id, queue: job?.queueName, err },
        "Job failed",
      );
    });

    worker.on("error", (err) => {
      logger.error({ err }, "Worker error");
    });
  }

  logger.info("BullMQ workers started");

  return { debitWorker, payoutWorker, notificationWorker };
}
