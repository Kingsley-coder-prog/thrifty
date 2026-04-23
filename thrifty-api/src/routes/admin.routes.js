import { Router } from "express";
import { z } from "zod";
import { adminService } from "../services/admin.service.js";
import { adminAuth, requireAdminRole } from "../middleware/adminAuth.js";
import { validate } from "../middleware/validate.js";

export const adminRouter = Router();

// all admin routes require admin authentication
adminRouter.use(adminAuth);

// ── Schemas ───────────────────────────────────────────────────────

const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => parseInt(v ?? "1")),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(parseInt(v ?? "20"), 100)),
});

const freezeSchema = z.object({
  reason: z.string().min(5, "Please provide a reason of at least 5 characters"),
});

const resolveSchema = z.object({
  resolution: z.enum(["resolved", "dismissed"]),
  notes: z.string().min(5, "Please provide resolution notes"),
});

// ── Dashboard ─────────────────────────────────────────────────────

adminRouter.get(
  "/dashboard",
  requireAdminRole("super_admin", "operations", "finance", "compliance"),
  async (req, res, next) => {
    try {
      const metrics = await adminService.getDashboardMetrics();
      res.json({ metrics });
    } catch (err) {
      next(err);
    }
  },
);

// ── User management ───────────────────────────────────────────────

adminRouter.get(
  "/users",
  requireAdminRole("super_admin", "operations", "compliance", "support"),
  validate(paginationSchema, "query"),
  async (req, res, next) => {
    try {
      const result = await adminService.listUsers({
        page: req.query.page,
        limit: req.query.limit,
        status: req.query.status,
        kycStatus: req.query.kycStatus,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.get(
  "/users/:id",
  requireAdminRole("super_admin", "operations", "compliance", "support"),
  async (req, res, next) => {
    try {
      const user = await adminService.getUserDetail(req.params.id);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.patch(
  "/users/:id/freeze",
  requireAdminRole("super_admin", "operations", "compliance"),
  validate(freezeSchema),
  async (req, res, next) => {
    try {
      await adminService.freezeUser(req.params.id, req.admin.id, {
        reason: req.body.reason,
      });
      res.json({ message: "User account frozen successfully" });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.patch(
  "/users/:id/unfreeze",
  requireAdminRole("super_admin", "operations"),
  validate(freezeSchema),
  async (req, res, next) => {
    try {
      await adminService.unfreezeUser(req.params.id, req.admin.id, {
        reason: req.body.reason,
      });
      res.json({ message: "User account unfrozen successfully" });
    } catch (err) {
      next(err);
    }
  },
);

// ── Group management ──────────────────────────────────────────────

adminRouter.get(
  "/groups",
  requireAdminRole("super_admin", "operations", "finance", "compliance"),
  validate(paginationSchema, "query"),
  async (req, res, next) => {
    try {
      const result = await adminService.listGroups({
        page: req.query.page,
        limit: req.query.limit,
        status: req.query.status,
        tierId: req.query.tierId,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.patch(
  "/groups/:id/freeze",
  requireAdminRole("super_admin", "operations", "compliance"),
  validate(freezeSchema),
  async (req, res, next) => {
    try {
      await adminService.freezeGroup(req.params.id, req.admin.id, {
        reason: req.body.reason,
      });
      res.json({ message: "Group frozen successfully" });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.patch(
  "/groups/:id/unfreeze",
  requireAdminRole("super_admin", "operations"),
  validate(freezeSchema),
  async (req, res, next) => {
    try {
      await adminService.unfreezeGroup(req.params.id, req.admin.id, {
        reason: req.body.reason,
      });
      res.json({ message: "Group unfrozen successfully" });
    } catch (err) {
      next(err);
    }
  },
);

// ── Financial operations ──────────────────────────────────────────

adminRouter.get(
  "/payouts",
  requireAdminRole("super_admin", "finance"),
  validate(paginationSchema, "query"),
  async (req, res, next) => {
    try {
      const result = await adminService.listPayouts({
        page: req.query.page,
        limit: req.query.limit,
        status: req.query.status,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.get(
  "/contributions",
  requireAdminRole("super_admin", "finance", "operations"),
  validate(paginationSchema, "query"),
  async (req, res, next) => {
    try {
      const result = await adminService.listContributions({
        page: req.query.page,
        limit: req.query.limit,
        status: req.query.status,
        cycleId: req.query.cycleId,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ── Fraud flags ───────────────────────────────────────────────────

adminRouter.get(
  "/fraud-flags",
  requireAdminRole("super_admin", "compliance", "operations"),
  validate(paginationSchema, "query"),
  async (req, res, next) => {
    try {
      const result = await adminService.listFraudFlags({
        page: req.query.page,
        limit: req.query.limit,
        status: req.query.status ?? "open",
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.patch(
  "/fraud-flags/:id/resolve",
  requireAdminRole("super_admin", "compliance"),
  validate(resolveSchema),
  async (req, res, next) => {
    try {
      await adminService.resolveFraudFlag(req.params.id, req.admin.id, {
        resolution: req.body.resolution,
        notes: req.body.notes,
      });
      res.json({ message: `Fraud flag ${req.body.resolution}` });
    } catch (err) {
      next(err);
    }
  },
);

// ── Disputes ──────────────────────────────────────────────────────

adminRouter.get(
  "/disputes",
  requireAdminRole("super_admin", "operations", "support"),
  validate(paginationSchema, "query"),
  async (req, res, next) => {
    try {
      const result = await adminService.listDisputes({
        page: req.query.page,
        limit: req.query.limit,
        status: req.query.status ?? "open",
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.patch(
  "/disputes/:id/resolve",
  requireAdminRole("super_admin", "operations", "support"),
  validate(resolveSchema),
  async (req, res, next) => {
    try {
      await adminService.resolveDispute(req.params.id, req.admin.id, {
        resolution: req.body.resolution,
        notes: req.body.notes,
      });
      res.json({ message: `Dispute ${req.body.resolution}` });
    } catch (err) {
      next(err);
    }
  },
);

// ── Audit logs ────────────────────────────────────────────────────

adminRouter.get(
  "/audit-logs",
  requireAdminRole("super_admin", "compliance"),
  validate(paginationSchema, "query"),
  async (req, res, next) => {
    try {
      const result = await adminService.getAuditLogs({
        page: req.query.page,
        limit: req.query.limit,
        eventType: req.query.eventType,
        actorId: req.query.actorId,
        targetId: req.query.targetId,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ── Dev only — generate admin token ──────────────────────────────

adminRouter.post("/dev/token", async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    const { generateDevAdminToken } = await import(
      "../middleware/adminAuth.js"
    );
    const token = generateDevAdminToken(req.body.role ?? "super_admin");
    res.json({ token, expiresIn: "7d", role: req.body.role ?? "super_admin" });
  } catch (err) {
    next(err);
  }
});
