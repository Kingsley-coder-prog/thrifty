import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./lib/logger.js";
import { authRouter } from "./routes/auth.routes.js";
import { userRouter } from "./routes/user.routes.js";
import { groupRouter } from "./routes/group.routes.js";

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

  app.use(express.json({ limit: "50kb" }));

  app.get("/health", (req, res) => {
    res.json({ status: "ok", env: env.NODE_ENV });
  });

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
