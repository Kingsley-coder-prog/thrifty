import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./lib/logger.js";
import { authRouter } from "./routes/auth.routes.js";
import { userRouter } from "./routes/user.routes.js";
import { groupRouter } from "./routes/group.routes.js";
import { webhookRouter } from "./routes/webhook.routes.js";

export function createApp() {
  const app = express();

  app.use(helmet());

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (env.ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
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
        "X-Device-Fingerprint",
      ],
    }),
  );

  // ── Webhooks — raw body BEFORE json parser ──────────────────────
  // Paystack HMAC verification requires the raw request body buffer.
  // Once express.json() runs, the raw buffer is gone.
  app.use(
    "/webhooks",
    express.raw({ type: "application/json" }),
    webhookRouter,
  );

  // ── Body parser for all other routes ───────────────────────────
  app.use(express.json({ limit: "50kb" }));

  // ── Health check ────────────────────────────────────────────────
  app.get("/health", (req, res) => {
    res.json({ status: "ok", env: env.NODE_ENV });
  });

  // ── Development only — manually trigger debit cycle ─────────────
  if (env.NODE_ENV === "development") {
    app.post("/dev/trigger-debits", async (req, res) => {
      const { triggerDebitsNow } = await import("./jobs/scheduler.js");
      await triggerDebitsNow();
      res.json({ message: "Debit jobs enqueued" });
    });
  }

  // ── API routes ───────────────────────────────────────────────────
  app.use("/auth", authRouter);
  app.use("/users", userRouter);
  app.use("/groups", groupRouter);
  // app.use('/admin', adminRouter)  — Phase 8

  app.use((req, res) => {
    res.status(404).json({ error: "NOT_FOUND" });
  });

  app.use(errorHandler);

  return app;
}
