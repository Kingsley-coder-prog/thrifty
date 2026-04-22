import { db } from "../config/database.js";
import { notificationQueue } from "../config/queue.js";
import { logger } from "../lib/logger.js";
import { decrypt } from "../lib/crypto.js";

/**
 * Notification types — used to determine channel and template.
 */
export const NotificationType = {
  // auth
  WELCOME: "WELCOME",
  OTP: "OTP",

  // group
  GROUP_ACTIVATED: "GROUP_ACTIVATED",
  GROUP_SLOT_AVAILABLE: "GROUP_SLOT_AVAILABLE",

  // financial — debit
  DEBIT_UPCOMING: "DEBIT_UPCOMING", // reminder before the 25th
  DEBIT_INITIATED: "DEBIT_INITIATED",
  DEBIT_SUCCEEDED: "DEBIT_SUCCEEDED",
  DEBIT_FAILED: "DEBIT_FAILED",
  DEBIT_DEFAULTED: "DEBIT_DEFAULTED",

  // financial — payout
  PAYOUT_INCOMING: "PAYOUT_INCOMING", // reminder before payout
  PAYOUT_COMPLETED: "PAYOUT_COMPLETED",
  PAYOUT_DELAYED: "PAYOUT_DELAYED",

  // admin
  ACCOUNT_FROZEN: "ACCOUNT_FROZEN",
  ACCOUNT_UNFROZEN: "ACCOUNT_UNFROZEN",
};

export const notificationService = {
  /**
   * Enqueue a notification for a user.
   * Never sends directly — always goes through the job queue
   * so it doesn't block the calling operation.
   *
   * @param {string} userId
   * @param {string} type — one of NotificationType
   * @param {object} data — template variables
   * @param {object} options
   * @param {string} options.relatedEntityId
   * @param {string} options.relatedEntityType
   */
  async notify(userId, type, data = {}, options = {}) {
    try {
      // get user's phone for SMS
      const user = await db("users")
        .where({ id: userId })
        .select("phone_number", "full_name")
        .first();

      if (!user) return;

      const phone = decrypt(user.phone_number);
      const fullName = decrypt(user.full_name);
      const content = buildMessage(type, { ...data, fullName });

      // store notification record
      const [notification] = await db("notifications")
        .insert({
          user_id: userId,
          channel: "sms",
          type,
          content,
          status: "pending",
          related_entity_id: options.relatedEntityId ?? null,
          related_entity_type: options.relatedEntityType ?? null,
        })
        .returning("id");

      // enqueue for async delivery
      await notificationQueue.add("send_notification", {
        notificationId: notification.id,
        userId,
        phone,
        content,
        type,
      });
    } catch (err) {
      // notification failure should never crash the calling operation
      logger.error({ err, userId, type }, "Failed to enqueue notification");
    }
  },

  // ── Convenience methods for common events ──────────────────────

  async notifyDebitInitiated(userId, { amount, cycleNumber, groupId }) {
    await notificationService.notify(
      userId,
      NotificationType.DEBIT_INITIATED,
      { amount: formatNaira(amount), cycleNumber },
      { relatedEntityId: groupId, relatedEntityType: "group" },
    );
  },

  async notifyDebitFailed(userId, { amount, reason, groupId }) {
    await notificationService.notify(
      userId,
      NotificationType.DEBIT_FAILED,
      { amount: formatNaira(amount), reason },
      { relatedEntityId: groupId, relatedEntityType: "group" },
    );
  },

  async notifyPayoutCompleted(userId, { amount, cycleNumber, groupId }) {
    await notificationService.notify(
      userId,
      NotificationType.PAYOUT_COMPLETED,
      { amount: formatNaira(amount), cycleNumber },
      { relatedEntityId: groupId, relatedEntityType: "group" },
    );
  },

  async notifyGroupActivated(
    userId,
    { groupId, tierName, turnPosition, payoutDate },
  ) {
    await notificationService.notify(
      userId,
      NotificationType.GROUP_ACTIVATED,
      { tierName, turnPosition, payoutDate },
      { relatedEntityId: groupId, relatedEntityType: "group" },
    );
  },

  async notifyDebitDefaulted(userId, { groupId }) {
    await notificationService.notify(
      userId,
      NotificationType.DEBIT_DEFAULTED,
      {},
      { relatedEntityId: groupId, relatedEntityType: "group" },
    );
  },
};

// ── Private helpers ───────────────────────────────────────────────

/**
 * Build the SMS message content for each notification type.
 * Keep messages concise — SMS has a 160 character limit.
 */
function buildMessage(type, data) {
  const { fullName, amount, cycleNumber, tierName, turnPosition, reason } =
    data;

  const name = firstNameFrom(fullName);

  switch (type) {
    case NotificationType.WELCOME:
      return `Welcome to Thrifty, ${name}! Your account is ready. Start saving with your community today.`;

    case NotificationType.GROUP_ACTIVATED:
      return `Your ${tierName} group is now full and active! You are turn ${turnPosition} of 7. Debit starts on the 25th.`;

    case NotificationType.DEBIT_INITIATED:
      return `Hi ${name}, your Thrifty contribution of ${amount} for cycle ${cycleNumber} is being processed.`;

    case NotificationType.DEBIT_SUCCEEDED:
      return `Hi ${name}, your Thrifty contribution of ${amount} for cycle ${cycleNumber} was successful. Thank you!`;

    case NotificationType.DEBIT_FAILED:
      return `Hi ${name}, your Thrifty contribution of ${amount} could not be processed. Reason: ${
        reason ?? "Insufficient funds"
      }. We will retry.`;

    case NotificationType.DEBIT_DEFAULTED:
      return `Hi ${name}, your Thrifty contribution could not be collected after multiple attempts. Your group has been notified. Please contact support.`;

    case NotificationType.PAYOUT_COMPLETED:
      return `Congratulations ${name}! Your Thrifty payout of ${amount} for cycle ${cycleNumber} has been sent to your account.`;

    case NotificationType.PAYOUT_INCOMING:
      return `Great news ${name}! Your Thrifty payout is being prepared and will arrive shortly.`;

    case NotificationType.ACCOUNT_FROZEN:
      return `Hi ${name}, your Thrifty account has been temporarily frozen. Please contact support for assistance.`;

    default:
      return `Hi ${name}, you have a new update on your Thrifty account.`;
  }
}

function firstNameFrom(fullName) {
  if (!fullName) return "there";
  return fullName.split(" ")[0];
}

function formatNaira(amount) {
  const num = parseFloat(amount);
  return `₦${num.toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}
