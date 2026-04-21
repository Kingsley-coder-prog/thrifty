import { connectDatabase } from "./config/database.js";
import { connectRedis } from "./config/redis.js";
import { startWorkers } from "./config/queue.js";
import { startScheduler, triggerDebitsNow } from "./jobs/scheduler.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

async function start() {
  logger.info("Starting Thrifty worker process...");

  // verify infrastructure connections
  await connectDatabase();
  await connectRedis();

  // start BullMQ job processors
  await startWorkers();

  // start the monthly debit cron
  startScheduler();

  logger.info("Thrifty worker running");

  // ── Development helper ─────────────────────────────────────────
  // In development you can manually trigger the debit cycle without
  // waiting for the 25th. Run this command in a separate terminal:
  //
  //   node --env-file=.env -e "
  //     import('./src/jobs/scheduler.js').then(m => m.triggerDebitsNow())
  //   "
  //
  // Or hit: GET /dev/trigger-debits (only available in development)

  // ── Graceful shutdown ──────────────────────────────────────────
  async function shutdown(signal) {
    logger.info({ signal }, "Worker shutdown signal received");

    const { db } = await import("./config/database.js");
    const { redis } = await import("./config/redis.js");

    await db.destroy();
    await redis.quit();

    process.exit(0);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "Unhandled rejection in worker");
    process.exit(1);
  });
}

start();
