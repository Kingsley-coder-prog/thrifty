import { db } from "../config/database.js";
import { decrypt, decryptDeterministic } from "../lib/crypto.js";
import { auditLog, AuditEvent } from "../lib/audit.js";
import { notificationService } from "./notification.service.js";
import { AppError, ErrorCode } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env.js";
import { sha256 } from "../lib/crypto.js";

export const adminService = {
  // ── Dashboard metrics ──────────────────────────────────────────
  async getDashboardMetrics() {
    const [
      userStats,
      groupStats,
      financialStats,
      openDisputes,
      openFraudFlags,
      recentPayouts,
    ] = await Promise.all([
      // user stats
      db("users")
        .select(
          db.raw("COUNT(*) as total"),
          db.raw("COUNT(*) FILTER (WHERE account_status = 'active') as active"),
          db.raw("COUNT(*) FILTER (WHERE account_status = 'frozen') as frozen"),
          db.raw(
            "COUNT(*) FILTER (WHERE account_status = 'suspended') as suspended",
          ),
          db.raw(
            "COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as new_this_week",
          ),
        )
        .first(),

      // group stats
      db("thrift_groups")
        .select(
          db.raw("COUNT(*) as total"),
          db.raw("COUNT(*) FILTER (WHERE status = 'forming') as forming"),
          db.raw("COUNT(*) FILTER (WHERE status = 'active') as active"),
          db.raw("COUNT(*) FILTER (WHERE status = 'completed') as completed"),
          db.raw("COUNT(*) FILTER (WHERE status = 'frozen') as frozen"),
        )
        .first(),

      // financial stats
      db("payouts")
        .select(
          db.raw("COUNT(*) as total_payouts"),
          db.raw(
            "SUM(net_amount) FILTER (WHERE status = 'completed') as total_disbursed",
          ),
          db.raw(
            "COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= NOW() - INTERVAL '24 hours') as payouts_today",
          ),
          db.raw(
            "SUM(net_amount) FILTER (WHERE status = 'completed' AND completed_at >= NOW() - INTERVAL '24 hours') as disbursed_today",
          ),
          db.raw("COUNT(*) FILTER (WHERE status = 'failed') as failed_payouts"),
        )
        .first(),

      // open disputes
      db("disputes").where({ status: "open" }).count("* as count").first(),

      // open fraud flags
      db("fraud_flags").where({ status: "open" }).count("* as count").first(),

      // recent payouts
      db("payouts")
        .join("users", "users.id", "payouts.recipient_user_id")
        .join("cycles", "cycles.id", "payouts.cycle_id")
        .where({ "payouts.status": "completed" })
        .orderBy("payouts.completed_at", "desc")
        .limit(5)
        .select(
          "payouts.id",
          "payouts.net_amount",
          "payouts.completed_at",
          "users.full_name",
          "cycles.cycle_number",
        ),
    ]);

    return {
      users: {
        total: parseInt(userStats.total),
        active: parseInt(userStats.active),
        frozen: parseInt(userStats.frozen),
        suspended: parseInt(userStats.suspended),
        newThisWeek: parseInt(userStats.new_this_week),
      },
      groups: {
        total: parseInt(groupStats.total),
        forming: parseInt(groupStats.forming),
        active: parseInt(groupStats.active),
        completed: parseInt(groupStats.completed),
        frozen: parseInt(groupStats.frozen),
      },
      financial: {
        totalPayouts: parseInt(financialStats.total_payouts),
        totalDisbursed: parseFloat(financialStats.total_disbursed ?? 0),
        payoutsToday: parseInt(financialStats.payouts_today),
        disbursedToday: parseFloat(financialStats.disbursed_today ?? 0),
        failedPayouts: parseInt(financialStats.failed_payouts),
      },
      alerts: {
        openDisputes: parseInt(openDisputes.count),
        openFraudFlags: parseInt(openFraudFlags.count),
      },
      recentPayouts: recentPayouts.map((p) => ({
        id: p.id,
        netAmount: parseFloat(p.net_amount),
        completedAt: p.completed_at,
        cycleNumber: p.cycle_number,
        recipientName: decrypt(p.full_name),
      })),
    };
  },

  // ── User management ────────────────────────────────────────────
  async listUsers({ page = 1, limit = 20, status, search, kycStatus } = {}) {
    const offset = (page - 1) * limit;
    const query = db("users").select(
      "id",
      "full_name",
      "phone_number",
      "email",
      "kyc_status",
      "kyc_level",
      "account_status",
      "bvn_verified_at",
      "created_at",
    );

    if (status) query.where({ account_status: status });
    if (kycStatus) query.where({ kyc_status: kycStatus });

    const { count } = await db("users")
      .count("* as count")
      .modify((q) => {
        if (status) q.where({ account_status: status });
        if (kycStatus) q.where({ kyc_status: kycStatus });
      })
      .first();

    const users = await query
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset);

    return {
      users: users.map((u) => ({
        id: u.id,
        fullName: decrypt(u.full_name),
        phone: decryptDeterministic(u.phone_number),
        email: u.email ? decryptDeterministic(u.email) : null,
        kycStatus: u.kyc_status,
        kycLevel: u.kyc_level,
        accountStatus: u.account_status,
        bvnVerifiedAt: u.bvn_verified_at,
        createdAt: u.created_at,
      })),
      pagination: {
        page,
        limit,
        total: parseInt(count),
        totalPages: Math.ceil(parseInt(count) / limit),
      },
    };
  },

  async getUserDetail(userId) {
    const user = await db("users").where({ id: userId }).first();
    if (!user) throw new AppError(ErrorCode.NOT_FOUND, 404);

    const [groups, fraudFlags, bankAccounts] = await Promise.all([
      db("group_members")
        .join("thrift_groups", "thrift_groups.id", "group_members.group_id")
        .join("tiers", "tiers.id", "thrift_groups.tier_id")
        .where({ "group_members.user_id": userId })
        .select(
          "thrift_groups.id",
          "thrift_groups.status",
          "thrift_groups.current_cycle",
          "tiers.name as tier_name",
          "tiers.monthly_amount",
          "group_members.turn_position",
          "group_members.has_collected",
          "group_members.status as member_status",
          "group_members.joined_at",
        )
        .orderBy("group_members.joined_at", "desc"),

      db("fraud_flags")
        .where({ user_id: userId })
        .orderBy("created_at", "desc"),

      db("bank_accounts")
        .where({ user_id: userId })
        .select(
          "id",
          "bank_name",
          "last_4_digits",
          "is_primary",
          "mandate_status",
        ),
    ]);

    return {
      id: user.id,
      fullName: decrypt(user.full_name),
      phone: decryptDeterministic(user.phone_number),
      email: user.email ? decryptDeterministic(user.email) : null,
      kycStatus: user.kyc_status,
      kycLevel: user.kyc_level,
      accountStatus: user.account_status,
      bvnVerifiedAt: user.bvn_verified_at,
      createdAt: user.created_at,
      groups,
      fraudFlags,
      bankAccounts,
    };
  },

  async freezeUser(userId, adminId, { reason }) {
    await db("users")
      .where({ id: userId })
      .update({ account_status: "frozen" });

    await auditLog({
      event_type: AuditEvent.ADMIN_USER_FROZEN,
      actor_id: adminId,
      actor_type: "admin",
      target_id: userId,
      target_type: "user",
      payload: { reason },
    });

    await notificationService.notify(userId, "ACCOUNT_FROZEN", {});

    logger.warn({ adminId, userId, reason }, "User frozen by admin");
  },

  async unfreezeUser(userId, adminId, { reason }) {
    await db("users")
      .where({ id: userId })
      .update({ account_status: "active" });

    await auditLog({
      event_type: "ADMIN_USER_UNFROZEN",
      actor_id: adminId,
      actor_type: "admin",
      target_id: userId,
      target_type: "user",
      payload: { reason },
    });

    await notificationService.notify(userId, "ACCOUNT_UNFROZEN", {});

    logger.info({ adminId, userId, reason }, "User unfrozen by admin");
  },

  // ── Group management ───────────────────────────────────────────
  async listGroups({ page = 1, limit = 20, status, tierId } = {}) {
    const offset = (page - 1) * limit;

    const query = db("thrift_groups")
      .join("tiers", "tiers.id", "thrift_groups.tier_id")
      .select(
        "thrift_groups.id",
        "thrift_groups.status",
        "thrift_groups.current_cycle",
        "thrift_groups.member_count",
        "thrift_groups.created_at",
        "tiers.name as tier_name",
        "tiers.monthly_amount",
      );

    if (status) query.where({ "thrift_groups.status": status });
    if (tierId) query.where({ "thrift_groups.tier_id": tierId });

    const { count } = await db("thrift_groups")
      .count("* as count")
      .modify((q) => {
        if (status) q.where({ status });
        if (tierId) q.where({ tier_id: tierId });
      })
      .first();

    const groups = await query
      .orderBy("thrift_groups.created_at", "desc")
      .limit(limit)
      .offset(offset);

    return {
      groups,
      pagination: {
        page,
        limit,
        total: parseInt(count),
        totalPages: Math.ceil(parseInt(count) / limit),
      },
    };
  },

  async freezeGroup(groupId, adminId, { reason }) {
    const group = await db("thrift_groups").where({ id: groupId }).first();
    if (!group) throw new AppError(ErrorCode.GROUP_NOT_FOUND, 404);

    await db("thrift_groups")
      .where({ id: groupId })
      .update({ status: "frozen" });

    await auditLog({
      event_type: AuditEvent.ADMIN_GROUP_FROZEN,
      actor_id: adminId,
      actor_type: "admin",
      target_id: groupId,
      target_type: "group",
      payload: { reason, previousStatus: group.status },
    });

    logger.warn({ adminId, groupId, reason }, "Group frozen by admin");
  },

  async unfreezeGroup(groupId, adminId, { reason, restoreStatus = "active" }) {
    await db("thrift_groups")
      .where({ id: groupId })
      .update({ status: restoreStatus });

    await auditLog({
      event_type: "ADMIN_GROUP_UNFROZEN",
      actor_id: adminId,
      actor_type: "admin",
      target_id: groupId,
      target_type: "group",
      payload: { reason, restoreStatus },
    });

    logger.info({ adminId, groupId, restoreStatus }, "Group unfrozen by admin");
  },

  // ── Financial operations ───────────────────────────────────────
  async listPayouts({ page = 1, limit = 20, status } = {}) {
    const offset = (page - 1) * limit;

    const payouts = await db("payouts")
      .join("users", "users.id", "payouts.recipient_user_id")
      .join("cycles", "cycles.id", "payouts.cycle_id")
      .modify((q) => {
        if (status) q.where({ "payouts.status": status });
      })
      .orderBy("payouts.initiated_at", "desc")
      .limit(limit)
      .offset(offset)
      .select(
        "payouts.*",
        "users.full_name as recipient_name",
        "cycles.cycle_number",
        "cycles.group_id",
      );

    const { count } = await db("payouts")
      .count("* as count")
      .modify((q) => {
        if (status) q.where({ status });
      })
      .first();

    return {
      payouts: payouts.map((p) => ({
        ...p,
        recipientName: decrypt(p.recipient_name),
      })),
      pagination: {
        page,
        limit,
        total: parseInt(count),
        totalPages: Math.ceil(parseInt(count) / limit),
      },
    };
  },

  async listContributions({ page = 1, limit = 20, status, cycleId } = {}) {
    const offset = (page - 1) * limit;

    const query = db("contributions")
      .join("group_members", "group_members.id", "contributions.member_id")
      .join("users", "users.id", "group_members.user_id")
      .join("cycles", "cycles.id", "contributions.cycle_id")
      .select(
        "contributions.*",
        "users.full_name as member_name",
        "cycles.cycle_number",
        "cycles.group_id",
      );

    if (status) query.where({ "contributions.status": status });
    if (cycleId) query.where({ "contributions.cycle_id": cycleId });

    const { count } = await db("contributions")
      .count("* as count")
      .modify((q) => {
        if (status) q.where({ status });
        if (cycleId) q.where({ cycle_id: cycleId });
      })
      .first();

    const contributions = await query
      .orderBy("contributions.created_at", "desc")
      .limit(limit)
      .offset(offset);

    return {
      contributions: contributions.map((c) => ({
        ...c,
        memberName: decrypt(c.member_name),
      })),
      pagination: {
        page,
        limit,
        total: parseInt(count),
        totalPages: Math.ceil(parseInt(count) / limit),
      },
    };
  },

  // ── Fraud flags ────────────────────────────────────────────────
  async listFraudFlags({ page = 1, limit = 20, status = "open" } = {}) {
    const offset = (page - 1) * limit;

    const flags = await db("fraud_flags")
      .join("users", "users.id", "fraud_flags.user_id")
      .where({ "fraud_flags.status": status })
      .orderBy("fraud_flags.created_at", "desc")
      .limit(limit)
      .offset(offset)
      .select(
        "fraud_flags.*",
        "users.full_name as user_name",
        "users.account_status as user_account_status",
      );

    const { count } = await db("fraud_flags")
      .where({ status })
      .count("* as count")
      .first();

    return {
      flags: flags.map((f) => ({
        ...f,
        userName: decrypt(f.user_name),
      })),
      pagination: {
        page,
        limit,
        total: parseInt(count),
        totalPages: Math.ceil(parseInt(count) / limit),
      },
    };
  },

  async resolveFraudFlag(flagId, adminId, { resolution, notes }) {
    const flag = await db("fraud_flags").where({ id: flagId }).first();
    if (!flag) throw new AppError(ErrorCode.NOT_FOUND, 404);

    await db("fraud_flags").where({ id: flagId }).update({
      status: resolution, // 'resolved' or 'dismissed'
      reviewed_by: adminId,
      resolved_at: new Date(),
    });

    await auditLog({
      event_type: "FRAUD_FLAG_RESOLVED",
      actor_id: adminId,
      actor_type: "admin",
      target_id: flagId,
      target_type: "fraud_flag",
      payload: { resolution, notes },
    });

    logger.info({ adminId, flagId, resolution }, "Fraud flag resolved");
  },

  // ── Disputes ───────────────────────────────────────────────────
  async listDisputes({ page = 1, limit = 20, status = "open" } = {}) {
    const offset = (page - 1) * limit;

    const disputes = await db("disputes")
      .join("users", "users.id", "disputes.raised_by")
      .where({ "disputes.status": status })
      .orderBy("disputes.created_at", "desc")
      .limit(limit)
      .offset(offset)
      .select("disputes.*", "users.full_name as raised_by_name");

    const { count } = await db("disputes")
      .where({ status })
      .count("* as count")
      .first();

    return {
      disputes: disputes.map((d) => ({
        ...d,
        raisedByName: decrypt(d.raised_by_name),
      })),
      pagination: {
        page,
        limit,
        total: parseInt(count),
        totalPages: Math.ceil(parseInt(count) / limit),
      },
    };
  },

  async resolveDispute(disputeId, adminId, { resolution, notes }) {
    const dispute = await db("disputes").where({ id: disputeId }).first();
    if (!dispute) throw new AppError(ErrorCode.NOT_FOUND, 404);

    await db("disputes").where({ id: disputeId }).update({
      status: resolution, // 'resolved' or 'dismissed'
      assigned_admin_id: adminId,
      resolution_notes: notes,
      resolved_at: new Date(),
    });

    await auditLog({
      event_type: "DISPUTE_RESOLVED",
      actor_id: adminId,
      actor_type: "admin",
      target_id: disputeId,
      target_type: "dispute",
      payload: { resolution, notes },
    });

    logger.info({ adminId, disputeId, resolution }, "Dispute resolved");
  },

  // ── Audit logs ─────────────────────────────────────────────────
  async getAuditLogs({
    page = 1,
    limit = 50,
    eventType,
    actorId,
    targetId,
  } = {}) {
    const offset = (page - 1) * limit;

    const query = db("audit_logs");
    if (eventType) query.where({ event_type: eventType });
    if (actorId) query.where({ actor_id: actorId });
    if (targetId) query.where({ target_id: targetId });

    const { count } = await db("audit_logs")
      .count("* as count")
      .modify((q) => {
        if (eventType) q.where({ event_type: eventType });
        if (actorId) q.where({ actor_id: actorId });
        if (targetId) q.where({ target_id: targetId });
      })
      .first();

    const logs = await query.orderBy("id", "desc").limit(limit).offset(offset);

    return {
      logs,
      pagination: {
        page,
        limit,
        total: parseInt(count),
        totalPages: Math.ceil(parseInt(count) / limit),
      },
    };
  },

  // ── Admin authentication ───────────────────────────────────────

  async login({ email, password, ipAddress, userAgent }) {
    // find admin by email
    const admin = await db("admins")
      .where({ email: email.toLowerCase(), is_active: true })
      .first();

    if (!admin) {
      throw new AppError("ADMIN_INVALID_CREDENTIALS", 401, {
        message: "Invalid email or password.",
      });
    }

    // check if account is locked
    if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
      throw new AppError("ADMIN_ACCOUNT_LOCKED", 401, {
        message:
          "Account temporarily locked due to failed login attempts. Try again later.",
      });
    }

    // verify password
    const valid = await argon2.verify(admin.password_hash, password);

    if (!valid) {
      // increment failed attempts
      const attempts = admin.failed_login_attempts + 1;
      const lockedUntil =
        attempts >= 5
          ? new Date(Date.now() + 15 * 60 * 1000) // lock for 15 minutes
          : null;

      await db("admins").where({ id: admin.id }).update({
        failed_login_attempts: attempts,
        locked_until: lockedUntil,
      });

      throw new AppError("ADMIN_INVALID_CREDENTIALS", 401, {
        message: "Invalid email or password.",
      });
    }

    // reset failed attempts on success
    await db("admins").where({ id: admin.id }).update({
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: new Date(),
    });

    // generate token
    const token = crypto.randomBytes(48).toString("hex");
    const tokenHash = await argon2.hash(token);
    const tokenFingerprint = sha256(token);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

    await db("admin_sessions").insert({
      admin_id: admin.id,
      token_hash: tokenHash,
      token_fingerprint: tokenFingerprint,
      expires_at: expiresAt,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    // sign JWT
    const jwtToken = jwt.sign(
      {
        sub: admin.id,
        role: admin.role,
        email: admin.email,
        sid: tokenFingerprint, // session ID for revocation
      },
      env.ADMIN_JWT_SECRET,
      { algorithm: "HS256", expiresIn: "8h" },
    );

    await auditLog({
      event_type: "ADMIN_LOGIN",
      actor_id: admin.id,
      actor_type: "admin",
      ip_address: ipAddress,
      payload: { email: admin.email, role: admin.role },
    });

    logger.info({ adminId: admin.id, role: admin.role }, "Admin logged in");

    return {
      token: jwtToken,
      expiresIn: "8h",
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.full_name,
        role: admin.role,
      },
    };
  },

  async logout(adminId, sessionFingerprint) {
    await db("admin_sessions")
      .where({ admin_id: adminId, token_fingerprint: sessionFingerprint })
      .update({ is_revoked: true });

    await auditLog({
      event_type: "ADMIN_LOGOUT",
      actor_id: adminId,
      actor_type: "admin",
    });

    logger.info({ adminId }, "Admin logged out");
  },

  async getAdminProfile(adminId) {
    const admin = await db("admins")
      .where({ id: adminId })
      .select("id", "email", "full_name", "role", "last_login_at", "created_at")
      .first();
    if (!admin) throw new AppError(ErrorCode.NOT_FOUND, 404);
    return {
      id: admin.id,
      email: admin.email,
      fullName: admin.full_name,
      role: admin.role,
      lastLoginAt: admin.last_login_at,
      createdAt: admin.created_at,
    };
  },
};
