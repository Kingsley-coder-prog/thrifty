import { z } from "zod";

const schema = z.object({
  // ── Server ────────────────────────────────────────────────────
  NODE_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  PORT: z.string().default("3000").transform(Number),

  ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((s) => s.split(",")),

  // ── Database ──────────────────────────────────────────────────
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),

  // ── Redis ─────────────────────────────────────────────────────
  REDIS_URL: z.string().url("REDIS_URL must be a valid URL"),

  // ── JWT ───────────────────────────────────────────────────────
  JWT_PRIVATE_KEY: z
    .string()
    .min(100, "JWT_PRIVATE_KEY looks too short — paste the full PEM"),
  JWT_PUBLIC_KEY: z
    .string()
    .min(100, "JWT_PUBLIC_KEY looks too short — paste the full PEM"),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("30d"),

  // ── Encryption ────────────────────────────────────────────────
  ENCRYPTION_KEY: z
    .string()
    .length(64, "ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)"),

  // ── Paystack ──────────────────────────────────────────────────
  PAYSTACK_SECRET_KEY: z
    .string()
    .startsWith("sk_", "PAYSTACK_SECRET_KEY must start with sk_"),
  PAYSTACK_WEBHOOK_SECRET: z.string().min(1),

  // ── Mono ──────────────────────────────────────────────────────
  MONO_SECRET_KEY: z.string().min(1),

  // ── BVN verification ─────────────────────────────────────────
  BVN_PROVIDER_KEY: z.string().min(1),
  BVN_PROVIDER_URL: z.string().url(),

  // ── SMS ───────────────────────────────────────────────────────
  TERMII_API_KEY: z.string().min(1),
  TERMII_SENDER_ID: z.string().default("Thrifty"),

  // ── Admin ─────────────────────────────────────────────────────
  ADMIN_JWT_SECRET: z
    .string()
    .min(32, "ADMIN_JWT_SECRET must be at least 32 characters"),
});

function loadEnv() {
  const result = schema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");

    console.error("\n[env] Missing or invalid environment variables:\n");
    console.error(issues);
    console.error("\nCopy .env.example to .env and fill in the values.\n");

    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
