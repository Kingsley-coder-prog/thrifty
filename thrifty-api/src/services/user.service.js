import { db } from "../config/database.js";
import crypto from "crypto";
import {
  encrypt,
  decrypt,
  decryptDeterministic,
  encryptDeterministic,
} from "../lib/crypto.js";
import { AppError, ErrorCode } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const userService = {
  async getProfile(userId) {
    const user = await db("users")
      .where({ id: userId })
      .select(
        "id",
        "full_name",
        "phone_number",
        "email",
        "kyc_status",
        "kyc_level",
        "account_status",
        "bvn_verified_at",
        "created_at",
      )
      .first();

    if (!user) throw new AppError(ErrorCode.NOT_FOUND, 404);

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
    };
  },

  async updateProfile(userId, { fullName, email }) {
    const updates = {};

    if (fullName !== undefined) {
      updates.full_name = encrypt(fullName);
    }

    if (email !== undefined) {
      const encryptedEmail = encryptDeterministic(email.toLowerCase());
      const existing = await db("users")
        .where({ email: encryptedEmail })
        .whereNot({ id: userId })
        .first();
      if (existing) throw new AppError(ErrorCode.EMAIL_ALREADY_REGISTERED, 409);
      updates.email = encryptedEmail;
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError("NO_CHANGES", 400, {
        message: "No valid fields provided to update.",
      });
    }

    await db("users")
      .where({ id: userId })
      .update({ ...updates, updated_at: new Date() });
    logger.info({ userId }, "User profile updated");
    return userService.getProfile(userId);
  },

  async getBankAccounts(userId) {
    const accounts = await db("bank_accounts")
      .where({ user_id: userId })
      .orderBy([
        { column: "is_primary", order: "desc" },
        { column: "created_at", order: "asc" },
      ])
      .select(
        "id",
        "bank_code",
        "bank_name",
        "account_name",
        "last_4_digits",
        "is_primary",
        "fallback_order",
        "mandate_status",
        "verified_at",
        "created_at",
      );

    return accounts.map((a) => ({
      id: a.id,
      bankCode: a.bank_code,
      bankName: a.bank_name,
      accountName: a.account_name,
      last4Digits: a.last_4_digits,
      isPrimary: a.is_primary,
      fallbackOrder: a.fallback_order,
      mandateStatus: a.mandate_status,
      verifiedAt: a.verified_at,
      createdAt: a.created_at,
    }));
  },

  async addBankAccount(userId, { accountNumber, bankCode, bankName }) {
    const accountName = await resolveAccountName(accountNumber, bankCode);

    const existing = await db("bank_accounts")
      .where({ user_id: userId, bank_code: bankCode })
      .andWhere("last_4_digits", accountNumber.slice(-4))
      .first();

    if (existing) {
      throw new AppError("BANK_ACCOUNT_ALREADY_LINKED", 409, {
        message: "This bank account is already linked to your profile.",
      });
    }

    const countResult = await db("bank_accounts")
      .where({ user_id: userId })
      .count("* as count")
      .first();
    const existingCount = parseInt(countResult.count);

    const [account] = await db("bank_accounts")
      .insert({
        user_id: userId,
        account_token: `tok_${bankCode}_${crypto
          .randomBytes(16)
          .toString("hex")}`,
        bank_code: bankCode,
        bank_name: bankName,
        account_name: accountName,
        last_4_digits: accountNumber.slice(-4),
        mandate_status: "pending",
        is_primary: existingCount === 0,
        fallback_order: existingCount + 1,
      })
      .returning("*");

    logger.info({ userId, bankCode }, "Bank account added");

    return {
      id: account.id,
      bankCode: account.bank_code,
      bankName: account.bank_name,
      accountName: account.account_name,
      last4Digits: account.last_4_digits,
      isPrimary: account.is_primary,
      mandateStatus: account.mandate_status,
      fallbackOrder: account.fallback_order,
    };
  },

  async setPrimaryAccount(userId, accountId) {
    const account = await db("bank_accounts")
      .where({ id: accountId, user_id: userId })
      .first();
    if (!account) throw new AppError(ErrorCode.BANK_ACCOUNT_NOT_FOUND, 404);

    await db.transaction(async (trx) => {
      await trx("bank_accounts")
        .where({ user_id: userId, is_primary: true })
        .update({ is_primary: false });
      await trx("bank_accounts")
        .where({ id: accountId })
        .update({ is_primary: true });
    });

    logger.info({ userId, accountId }, "Primary bank account updated");
    return userService.getBankAccounts(userId);
  },

  async removeBankAccount(userId, accountId) {
    const account = await db("bank_accounts")
      .where({ id: accountId, user_id: userId })
      .first();
    if (!account) throw new AppError(ErrorCode.BANK_ACCOUNT_NOT_FOUND, 404);

    if (account.is_primary) {
      const countResult = await db("bank_accounts")
        .where({ user_id: userId })
        .count("* as count")
        .first();
      if (parseInt(countResult.count) > 1) {
        throw new AppError("CANNOT_REMOVE_PRIMARY", 409, {
          message: "Set another account as primary before removing this one.",
        });
      }
    }

    await db("bank_accounts").where({ id: accountId }).delete();
    logger.info({ userId, accountId }, "Bank account removed");
  },
};

async function resolveAccountName(accountNumber, bankCode) {
  if (process.env.NODE_ENV === "development") {
    return "Test Account Name";
  }
  try {
    const { paystack } = await import("../lib/paystack.js");
    const result = await paystack.resolveAccount({ accountNumber, bankCode });
    return result.account_name;
  } catch {
    throw new AppError("ACCOUNT_RESOLUTION_FAILED", 422, {
      message:
        "Could not verify account details. Check the account number and bank code.",
    });
  }
}
