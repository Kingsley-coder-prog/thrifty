import axios from "axios";
import crypto from "crypto";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

const client = axios.create({
  baseURL: "https://api.paystack.co",
  headers: {
    Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

export const paystack = {
  /**
   * Verify webhook signature.
   * Call this before processing any webhook payload.
   * Throws if the signature is invalid.
   */
  verifyWebhookSignature(rawBody, signature) {
    const hash = crypto
      .createHmac("sha512", env.PAYSTACK_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (hash !== signature) {
      throw new Error("INVALID_WEBHOOK_SIGNATURE");
    }
  },

  /**
   * Resolve an account number — verify it exists and get the account name.
   * Used when a user adds a bank account.
   */
  async resolveAccount({ accountNumber, bankCode }) {
    const { data } = await client.get("/bank/resolve", {
      params: { account_number: accountNumber, bank_code: bankCode },
    });

    if (!data.status) throw new Error("ACCOUNT_RESOLUTION_FAILED");
    return data.data;
  },

  /**
   * Create a transfer recipient — required before initiating a transfer.
   * Returns a recipient_code that is stored as the account_token.
   */
  async createTransferRecipient({ accountNumber, bankCode, accountName }) {
    const { data } = await client.post("/transferrecipient", {
      type: "nuban",
      name: accountName,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: "NGN",
    });

    if (!data.status) throw new Error("RECIPIENT_CREATION_FAILED");
    return data.data;
  },

  /**
   * Charge a bank account using a stored authorisation code (direct debit).
   * Returns the charge object — final status comes via webhook.
   */
  async chargeAuthorization({ authorizationCode, amount, reference, email }) {
    const { data } = await client.post("/transaction/charge_authorization", {
      authorization_code: authorizationCode,
      amount: Math.round(amount * 100), // convert to kobo
      reference,
      email,
      currency: "NGN",
    });

    if (!data.status) throw new Error("CHARGE_FAILED");

    if (data.data.status === "failed") {
      const err = new Error("CHARGE_DECLINED");
      err.paystackData = data.data;
      throw err;
    }

    return data.data;
  },

  /**
   * Initiate a transfer to a bank account.
   * Returns transfer object — confirmation comes via webhook.
   */
  async initiateTransfer({ amount, recipientCode, reference, reason }) {
    const { data } = await client.post("/transfer", {
      source: "balance",
      amount: Math.round(amount * 100), // convert to kobo
      recipient: recipientCode,
      reference,
      reason: reason ?? "Thrifty monthly payout",
    });

    if (!data.status) throw new Error("TRANSFER_FAILED");
    return data.data;
  },

  /**
   * Verify a transaction by reference.
   * Use this to double-check webhook payloads.
   */
  async verifyTransaction(reference) {
    const { data } = await client.get(`/transaction/verify/${reference}`);
    if (!data.status) throw new Error("VERIFICATION_FAILED");
    return data.data;
  },

  /**
   * Get list of banks supported by Paystack.
   */
  async getBanks() {
    const { data } = await client.get("/bank", {
      params: { country: "nigeria", use_cursor: false, perPage: 100 },
    });
    if (!data.status) throw new Error("BANKS_FETCH_FAILED");
    return data.data;
  },
};
