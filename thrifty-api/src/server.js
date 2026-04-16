import { createApp } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { connectRedis } from "./config/redis.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

async function start() {
  // verify infrastructure connections before accepting any requests
  await connectDatabase();
  await connectRedis();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`Thrifty API running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  // ── Graceful shutdown ──────────────────────────────────────────
  // On SIGTERM (Docker stop, Render deploy) or SIGINT (Ctrl+C):
  // stop accepting new requests, finish in-flight requests, close DB pool.
  async function shutdown(signal) {
    logger.info({ signal }, "Shutdown signal received");

    server.close(async () => {
      logger.info("HTTP server closed");

      try {
        const { db } = await import("./config/database.js");
        const { redis } = await import("./config/redis.js");

        await db.destroy();
        logger.info("Database pool closed");

        await redis.quit();
        logger.info("Redis connection closed");
      } catch (err) {
        logger.error({ err }, "Error during shutdown");
      }

      process.exit(0);
    });

    // if server hasn't closed in 10s, force exit
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // catch unhandled promise rejections — log and exit rather than
  // continuing in an unknown state
  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "Unhandled promise rejection");
    process.exit(1);
  });

  process.on("uncaughtException", (err) => {
    logger.error({ err }, "Uncaught exception");
    process.exit(1);
  });
}

start();
