import { Router } from "express";
import { paystack } from "../lib/paystack.js";
import { debitService } from "../services/debit.service.js";
import { payoutService } from "../services/payout.service.js";
import { logger } from "../lib/logger.js";

export const webhookRouter = Router();

/**
 * POST /webhooks/paystack
 *
 * Receives event notifications from Paystack.
 * Raw body is required for HMAC-SHA512 signature verification —
 * this route is mounted BEFORE express.json() in app.js.
 *
 * Events handled:
 *   charge.success  — debit payment confirmed
 *   charge.failed   — debit payment declined
 *   transfer.success — payout transfer confirmed
 *   transfer.failed  — payout transfer failed
 *   transfer.reversed — payout transfer reversed
 */
webhookRouter.post("/paystack", async (req, res) => {
  try {
    // verify the request is genuinely from Paystack
    const signature = req.headers["x-paystack-signature"];

    // in development with placeholder key, skip verification
    if (
      process.env.PAYSTACK_WEBHOOK_SECRET !== "placeholder_replace_with_real"
    ) {
      paystack.verifyWebhookSignature(req.body, signature);
    }

    const event = JSON.parse(req.body.toString());

    logger.info(
      { event: event.event, reference: event.data?.reference },
      "Paystack webhook received",
    );

    // always respond 200 immediately — Paystack retries if we don't
    res.sendStatus(200);

    // process the event asynchronously after responding
    setImmediate(async () => {
      try {
        switch (event.event) {
          case "charge.success":
            await debitService.handleChargeSuccess(event.data.reference);
            break;

          case "charge.failed":
            await debitService.handleChargeFailed(
              event.data.reference,
              event.data.gateway_response ?? "Unknown reason",
            );
            break;

          case "transfer.success":
            await payoutService.handleTransferSuccess(event.data.reference);
            break;

          case "transfer.failed":
          case "transfer.reversed":
            await payoutService.handleTransferFailed(
              event.data.reference,
              event.data.reason ?? event.event,
            );
            break;

          default:
            logger.info(
              { event: event.event },
              "Unhandled Paystack webhook event",
            );
        }
      } catch (err) {
        logger.error({ err, event: event.event }, "Webhook processing error");
      }
    });
  } catch (err) {
    if (err.message === "INVALID_WEBHOOK_SIGNATURE") {
      logger.warn(
        { ip: req.ip },
        "Invalid Paystack webhook signature — possible spoofing attempt",
      );
      return res.sendStatus(401);
    }

    logger.error({ err }, "Webhook handler error");
    res.sendStatus(500);
  }
});
