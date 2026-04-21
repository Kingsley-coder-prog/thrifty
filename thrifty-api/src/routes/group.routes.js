import { Router } from "express";
import { z } from "zod";
import { groupService } from "../services/group.service.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePin } from "../middleware/requirePin.js";
import { validate } from "../middleware/validate.js";

export const groupRouter = Router();

// ── Schemas ───────────────────────────────────────────────────────

const joinGroupSchema = z.object({
  tierId: z.string().uuid("Invalid tier ID"),
});

// ── Routes ────────────────────────────────────────────────────────

/**
 * GET /groups/tiers
 * List all active contribution tiers
 * Public — no auth required
 */
groupRouter.get("/tiers", async (req, res, next) => {
  try {
    const tiers = await groupService.getTiers();
    res.json({ tiers });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /groups/my
 * Get all groups the authenticated user belongs to
 */
groupRouter.get("/my", authenticate, async (req, res, next) => {
  try {
    const groups = await groupService.getUserGroups(req.user.id);
    res.json({ groups });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /groups
 * Browse open (forming) groups
 * Optional query param: ?tierId=uuid
 */
groupRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const groups = await groupService.getOpenGroups({
      tierId: req.query.tierId,
    });
    res.json({ groups });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /groups/join
 * Join an open group for a given tier
 * Creates a new group if none is open for that tier
 * Requires authentication and transaction PIN
 */
groupRouter.post(
  "/join",
  authenticate,
  requirePin,
  validate(joinGroupSchema),
  async (req, res, next) => {
    try {
      const result = await groupService.joinGroup({
        userId: req.user.id,
        tierId: req.body.tierId,
      });

      res.json({
        message: result.isGroupActive
          ? "You joined the group. The group is now full and active — your savings cycle has begun!"
          : `You joined the group. Waiting for ${
              7 - result.memberCount
            } more member(s) to join.`,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /groups/:id
 * Get full group detail including members and current cycle
 */
groupRouter.get("/:id", authenticate, async (req, res, next) => {
  try {
    const group = await groupService.getGroupById(req.params.id, req.user.id);
    res.json({ group });
  } catch (err) {
    next(err);
  }
});
