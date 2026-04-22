import axios from "axios";
import { db } from "../config/database.js";
import { logger } from "../lib/logger.js";
import { env } from "../config/env.js";

const termii = axios.create({
  baseURL: "https://api.ng.termii.com",
  timeout: 15000,
});

/**
 * BullMQ job processor for the 'notification' queue.
 * Sends SMS via Termii. In development, logs instead of sending.
 */
export async function notificationJobProcessor(job) {
  const { notificationId, phone, content, type } = job.data;

  logger.info(
    { jobId: job.id, type, phone: maskPhone(phone) },
    "Notification job started",
  );

  try {
    if (env.TERMII_API_KEY === "placeholder") {
      logger.info(
        {
          type,
          phone: maskPhone(phone),
          message: content,
        },
        "SMS (dev mode — not sent)",
      );

      await updateStatus(notificationId, "sent", "dev_mode");
      return;
    }

    const response = await termii.post("/api/sms/send", {
      to: phone,
      from: env.TERMII_SENDER_ID,
      sms: content,
      type: "plain",
      api_key: env.TERMII_API_KEY,
      channel: "dnd",
    });

    const providerRef = response.data?.message_id ?? null;
    await updateStatus(notificationId, "sent", providerRef);
    logger.info({ type, phone: maskPhone(phone), providerRef }, "SMS sent");
  } catch (err) {
    logger.error(
      { jobId: job.id, type, err: err.message },
      "SMS delivery failed",
    );
    await updateStatus(notificationId, "failed", null, err.message);
    throw err;
  }
}

async function updateStatus(
  id,
  status,
  providerRef = null,
  failureReason = null,
) {
  if (!id) return;
  await db("notifications")
    .where({ id })
    .update({
      status,
      provider_ref: providerRef,
      failure_reason: failureReason,
      sent_at: status === "sent" ? new Date() : null,
      attempt_count: db.raw("attempt_count + 1"),
    });
}

function maskPhone(phone) {
  if (!phone) return "unknown";
  return phone.slice(0, 4) + "****" + phone.slice(-3);
}
