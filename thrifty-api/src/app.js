import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./lib/logger.js";

export function createApp() {
  const app = express();

  // ── Security headers ────────────────────────────────────────────
  app.use(helmet());

  // ── CORS ────────────────────────────────────────────────────────
  app.use(
    cors({
      origin(origin, callback) {
        // allow requests with no origin (e.g. mobile apps, Postman, curl)
        if (!origin) return callback(null, true);

        if (env.ALLOWED_ORIGINS.includes(origin)) {
          return callback(null, true);
        }

        logger.warn({ origin }, "CORS blocked request from unlisted origin");
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Transaction-Pin",
        "X-Idempotency-Key",
      ],
    }),
  );

  // ── Webhook routes — must be mounted BEFORE json parser ─────────
  // Paystack webhook signature verification requires the raw request body.
  // Once express.json() parses the body, the raw buffer is gone.
  // Routes registered here receive a Buffer in req.body, not a parsed object.
  // (webhook router will be wired in here in Phase 6)

  // ── Body parser ─────────────────────────────────────────────────
  app.use(express.json({ limit: "50kb" }));

  // ── Health check — no auth, no rate limit ───────────────────────
  app.get("/health", (req, res) => {
    res.json({ status: "ok", env: env.NODE_ENV });
  });

  // ── API routes (wired in as each phase is built) ─────────────────
  // app.use('/auth',   authRoutes)
  // app.use('/users',  userRoutes)
  // app.use('/groups', groupRoutes)
  // app.use('/admin',  adminRoutes)

  // ── 404 handler — must come after all routes ────────────────────
  app.use((req, res) => {
    res.status(404).json({ error: "NOT_FOUND" });
  });

  // ── Error handler — must be last ────────────────────────────────
  app.use(errorHandler);

  return app;
}
