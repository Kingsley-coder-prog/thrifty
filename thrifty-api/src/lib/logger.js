import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",

  // pretty-print in development, structured JSON in staging/production
  ...(env.NODE_ENV === "development" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
  }),

  // never log these fields — they could contain PII or secrets
  redact: {
    paths: [
      "password",
      "password_hash",
      "pin",
      "pin_hash",
      "bvn",
      "bvn_hash",
      "totp_secret",
      "token",
      "refreshToken",
      "authorization",
      "req.headers.authorization",
      "body.password",
      "body.pin",
      "body.bvn",
    ],
    censor: "[REDACTED]",
  },

  base: {
    env: env.NODE_ENV,
  },
});
