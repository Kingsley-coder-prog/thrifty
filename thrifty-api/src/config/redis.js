import Redis from "ioredis";
import { env } from "./env.js";
import { logger } from "../lib/logger.js";

export const redis = new Redis(env.REDIS_URL, {
  // retry connection with exponential backoff, up to 30 seconds
  retryStrategy(times) {
    const delay = Math.min(times * 200, 30000);
    logger.warn({ times, delay }, "Redis reconnecting...");
    return delay;
  },

  // do not crash on connection loss — reconnect automatically
  enableOfflineQueue: true,

  maxRetriesPerRequest: null, // required by BullMQ
  lazyConnect: false,
});

redis.on("connect", () => {
  logger.info("Redis connected");
});

redis.on("error", (err) => {
  // log but don't crash — ioredis handles reconnection
  logger.error({ err }, "Redis error");
});

redis.on("close", () => {
  logger.warn("Redis connection closed");
});

// verify the connection is alive on startup
export async function connectRedis() {
  try {
    await redis.ping();
    logger.info("Redis ping OK");
  } catch (err) {
    logger.error({ err }, "Redis connection failed");
    process.exit(1);
  }
}
