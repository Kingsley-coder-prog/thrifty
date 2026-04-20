import { Router } from "express";
import { z } from "zod";
import { userService } from "../services/user.service.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePin } from "../middleware/requirePin.js";
import { validate } from "../middleware/validate.js";

export const userRouter = Router();

// all user routes require authentication
userRouter.use(authenticate);

// ── Schemas ───────────────────────────────────────────────────────

const updateProfileSchema = z
  .object({
    fullName: z
      .string()
      .min(2)
      .max(100)
      .regex(
        /^[a-zA-Z\s\-']+$/,
        "Full name can only contain letters, spaces, hyphens, and apostrophes",
      )
      .optional(),

    email: z.string().email("Enter a valid email address").max(255).optional(),
  })
  .refine((data) => data.fullName || data.email, {
    message: "Provide at least one field to update (fullName or email)",
  });

const addBankAccountSchema = z.object({
  accountNumber: z
    .string()
    .regex(/^\d{10}$/, "Account number must be exactly 10 digits"),

  bankCode: z.string().min(3, "Bank code is required"),

  bankName: z.string().min(2, "Bank name is required").max(100),
});

// ── Routes ────────────────────────────────────────────────────────

/**
 * GET /users/me
 * Returns the authenticated user's decrypted profile
 */
userRouter.get("/me", async (req, res, next) => {
  try {
    const profile = await userService.getProfile(req.user.id);
    res.json({ user: profile });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /users/me
 * Update full name or email
 */
userRouter.patch(
  "/me",
  validate(updateProfileSchema),
  async (req, res, next) => {
    try {
      const updated = await userService.updateProfile(req.user.id, {
        fullName: req.body.fullName,
        email: req.body.email,
      });
      res.json({ message: "Profile updated successfully", user: updated });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /users/me/bank-accounts
 * List all linked bank accounts
 */
userRouter.get("/me/bank-accounts", async (req, res, next) => {
  try {
    const accounts = await userService.getBankAccounts(req.user.id);
    res.json({ bankAccounts: accounts });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /users/me/bank-accounts
 * Add a new bank account
 * Requires transaction PIN
 */
userRouter.post(
  "/me/bank-accounts",
  requirePin,
  validate(addBankAccountSchema),
  async (req, res, next) => {
    try {
      const account = await userService.addBankAccount(req.user.id, {
        accountNumber: req.body.accountNumber,
        bankCode: req.body.bankCode,
        bankName: req.body.bankName,
      });
      res.status(201).json({
        message: "Bank account added successfully",
        bankAccount: account,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /users/me/bank-accounts/:id/primary
 * Set a bank account as the primary account
 * Requires transaction PIN
 */
userRouter.patch(
  "/me/bank-accounts/:id/primary",
  requirePin,
  async (req, res, next) => {
    try {
      const accounts = await userService.setPrimaryAccount(
        req.user.id,
        req.params.id,
      );
      res.json({
        message: "Primary account updated successfully",
        bankAccounts: accounts,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /users/me/bank-accounts/:id
 * Remove a bank account
 * Requires transaction PIN
 */
userRouter.delete(
  "/me/bank-accounts/:id",
  requirePin,
  async (req, res, next) => {
    try {
      await userService.removeBankAccount(req.user.id, req.params.id);
      res.json({ message: "Bank account removed successfully" });
    } catch (err) {
      next(err);
    }
  },
);
