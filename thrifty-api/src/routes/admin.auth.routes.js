import { Router } from "express";
import { z } from "zod";
import { adminService } from "../services/admin.service.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { validate } from "../middleware/validate.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

export const adminAuthRouter = Router();

// ── Schemas ───────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

// ── Routes ────────────────────────────────────────────────────────

/**
 * POST /admin/auth/login
 * Admin login — issues a JWT token
 * Rate limited to 10 attempts per 15 minutes per IP
 */
adminAuthRouter.post(
  "/login",
  rateLimiter,
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const result = await adminService.login({
        email: req.body.email,
        password: req.body.password,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /admin/auth/logout
 * Revoke the current admin session
 */
adminAuthRouter.post("/logout", adminAuth, async (req, res, next) => {
  try {
    await adminService.logout(req.admin.id, req.admin.sid);
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin/auth/me
 * Get current admin profile
 */
adminAuthRouter.get("/me", adminAuth, async (req, res, next) => {
  try {
    const admin = await adminService.getAdminProfile(req.admin.id);
    res.json({ admin });
  } catch (err) {
    next(err);
  }
});
