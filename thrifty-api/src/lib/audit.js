import crypto from "crypto";
import { db } from "../config/database.js";
import { logger } from "./logger.js";

/**
 * Write a tamper-evident audit log entry.
 *
 * Each row's checksum is SHA-256 of its own content PLUS the previous
 * row's checksum — forming a hash chain. Any tampering with a row
 * invalidates all subsequent checksums, making it detectable.
 *
 * The audit_logs table has no UPDATE or DELETE granted to the
 * application DB user — rows are append-only by design.
 *
 * @param {object} params
 * @param {string} params.event_type   — e.g. 'USER_REGISTERED', 'DEBIT_INITIATED'
 * @param {string} [params.actor_id]   — UUID of user/admin who triggered this
 * @param {string} [params.actor_type] — 'user' | 'admin' | 'system'
 * @param {string} [params.target_id]  — UUID of the entity being acted upon
 * @param {string} [params.target_type] — e.g. 'user', 'group', 'contribution'
 * @param {object} [params.payload]    — additional context
 * @param {string} [params.ip_address]
 * @param {object} [params.trx]        — pass a knex transaction if inside one
 */
export async function auditLog({
  event_type,
  actor_id = null,
  actor_type = "system",
  target_id = null,
  target_type = null,
  payload = {},
  ip_address = null,
  trx = db,
}) {
  try {
    // get the previous row's checksum for chaining
    const prev = await trx("audit_logs")
      .orderBy("id", "desc")
      .select("checksum")
      .first();

    const prevChecksum = prev?.checksum ?? "genesis";
    const createdAt = new Date().toISOString();

    const rowData = {
      event_type,
      actor_id,
      actor_type,
      target_id,
      target_type,
      ip_address,
      payload: JSON.stringify(payload),
      prev_checksum: prevChecksum,
      created_at: createdAt,
    };

    const checksum = crypto
      .createHash("sha256")
      .update(JSON.stringify(rowData))
      .digest("hex");

    await trx("audit_logs").insert({ ...rowData, checksum });
  } catch (err) {
    // audit log failure should never crash the app
    // log the error but continue
    logger.error({ err, event_type }, "Audit log write failed");
  }
}

// ── Common event type constants ────────────────────────────────────
export const AuditEvent = {
  // auth
  USER_REGISTERED: "USER_REGISTERED",
  USER_LOGGED_IN: "USER_LOGGED_IN",
  USER_LOGGED_OUT: "USER_LOGGED_OUT",
  USER_TOKEN_REFRESHED: "USER_TOKEN_REFRESHED",

  // groups
  GROUP_CREATED: "GROUP_CREATED",
  GROUP_JOINED: "GROUP_JOINED",
  GROUP_ACTIVATED: "GROUP_ACTIVATED",
  GROUP_COMPLETED: "GROUP_COMPLETED",
  GROUP_FROZEN: "GROUP_FROZEN",

  // financial
  DEBIT_INITIATED: "DEBIT_INITIATED",
  DEBIT_SUCCEEDED: "DEBIT_SUCCEEDED",
  DEBIT_FAILED: "DEBIT_FAILED",
  DEBIT_DEFAULTED: "DEBIT_DEFAULTED",
  PAYOUT_INITIATED: "PAYOUT_INITIATED",
  PAYOUT_COMPLETED: "PAYOUT_COMPLETED",
  PAYOUT_FAILED: "PAYOUT_FAILED",
  PAYOUT_GUARD_FAILED: "PAYOUT_GUARD_FAILED",

  // admin
  ADMIN_USER_FROZEN: "ADMIN_USER_FROZEN",
  ADMIN_GROUP_FROZEN: "ADMIN_GROUP_FROZEN",
  ADMIN_PAYOUT_OVERRIDE: "ADMIN_PAYOUT_OVERRIDE",
};
