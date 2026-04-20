import { Router } from "express";
import { z } from "zod";
import { authService } from "../services/auth.service.js";
import { validate } from "../middleware/validate.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { authenticate } from "../middleware/auth.middleware.js";

export const authRouter = Router();

// ── Schemas ───────────────────────────────────────────────────────

const registerSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100)
    .regex(
      /^[a-zA-Z\s\-']+$/,
      "Full name can only contain letters, spaces, hyphens, and apostrophes",
    ),

  phone: z
    .string()
    .regex(/^(\+234|0)[789][01]\d{8}$/, "Enter a valid Nigerian phone number"),

  email: z.string().email("Enter a valid email address").max(255).optional(),

  bvn: z.string().regex(/^\d{11}$/, "BVN must be exactly 11 digits"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password is too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^a-zA-Z0-9]/,
      "Password must contain at least one special character",
    ),

  pin: z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits"),
});

const loginSchema = z.object({
  phone: z
    .string()
    .regex(/^(\+234|0)[789][01]\d{8}$/, "Enter a valid Nigerian phone number"),

  password: z.string().min(1, "Password is required"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

const logoutSchema = z.object({
  refreshToken: z.string().optional(),
  logoutAll: z.boolean().optional().default(false),
});

// ── Routes ────────────────────────────────────────────────────────

/**
 * POST /auth/register
 * Create a new user account with BVN verification
 */
authRouter.post(
  "/register",
  rateLimiter,
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const result = await authService.register({
        fullName: req.body.fullName,
        phone: req.body.phone,
        email: req.body.email,
        bvn: req.body.bvn,
        password: req.body.password,
        pin: req.body.pin,
      });

      res.status(201).json({
        message: "Account created successfully",
        ...result,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /auth/login
 * Authenticate with phone and password
 */
authRouter.post(
  "/login",
  rateLimiter,
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const result = await authService.login({
        phone: req.body.phone,
        password: req.body.password,
        deviceFingerprint: req.headers["x-device-fingerprint"] ?? null,
        ipAddress: req.ip,
      });

      res.json({
        message: "Login successful",
        ...result,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /auth/refresh
 * Exchange a refresh token for a new access token
 */
authRouter.post(
  "/refresh",
  rateLimiter,
  validate(refreshSchema),
  async (req, res, next) => {
    try {
      const result = await authService.refresh({
        refreshToken: req.body.refreshToken,
        deviceFingerprint: req.headers["x-device-fingerprint"] ?? null,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /auth/logout
 * Revoke the current session or all sessions
 * Requires a valid access token
 */
authRouter.post(
  "/logout",
  authenticate,
  validate(logoutSchema),
  async (req, res, next) => {
    try {
      await authService.logout({
        refreshToken: req.body.refreshToken,
        logoutAll: req.body.logoutAll,
        userId: req.user.id,
      });

      res.json({ message: "Logged out successfully" });
    } catch (err) {
      next(err);
    }
  },
);
