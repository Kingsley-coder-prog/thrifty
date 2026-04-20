import { redis } from "../config/redis.js";
import { logger } from "../lib/logger.js";

/**
 * Rate limit configuration per route path.
 * window: seconds
 * max:    maximum requests allowed within the window
 */
const LIMITS = {
  "/auth/register": { window: 3600, max: 5 }, // 5 registrations per hour per IP
  "/auth/login": { window: 60, max: 5 }, // 5 login attempts per minute per IP
  "/auth/refresh": { window: 60, max: 10 }, // 10 refreshes per minute per user
  "/auth/verify-otp": { window: 300, max: 5 }, // 5 OTP attempts per 5 minutes
  default: { window: 60, max: 60 }, // 60 requests per minute general
};

/**
 * Sliding window rate limiter backed by Redis sorted sets.
 *
 * Key format: rl:{path}:{userId or IP}
 * Each request adds a timestamped entry to the sorted set.
 * Entries older than the window are removed before counting.
 *
 * This is more accurate than a fixed window counter because
 * it doesn't allow a burst at the boundary of two windows.
 */
export async function rateLimiter(req, res, next) {
  try {
    const cfg = LIMITS[req.path] ?? LIMITS.default;

    // use userId if authenticated, IP address if not
    const identifier = req.user?.id ?? req.ip;
    const key = `rl:${req.path}:${identifier}`;
    const now = Date.now();
    const windowMs = cfg.window * 1000;
    const windowStart = now - windowMs;

    // pipeline: remove old entries + count + add current — atomic
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, "-inf", windowStart);
    pipeline.zcard(key);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.pexpire(key, windowMs * 2);

    const results = await pipeline.exec();
    const count = results[1][1]; // result of zcard

    res.setHeader("X-RateLimit-Limit", cfg.max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, cfg.max - count - 1));
    res.setHeader("X-RateLimit-Window", cfg.window);

    if (count >= cfg.max) {
      logger.warn({ path: req.path, identifier }, "Rate limit exceeded");
      res.setHeader("Retry-After", cfg.window);
      return res.status(429).json({
        error: "TOO_MANY_REQUESTS",
        retryAfter: cfg.window,
        message: `Too many requests. Try again in ${cfg.window} seconds.`,
      });
    }

    next();
  } catch (err) {
    // if Redis is down, fail open — don't block legitimate requests
    logger.error({ err }, "Rate limiter error — failing open");
    next();
  }
}
