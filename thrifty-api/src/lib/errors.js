/**
 * AppError — typed application error.
 *
 * Services throw these for known, expected failure conditions.
 * The errorHandler middleware catches them and returns the code
 * as the JSON error field with the correct HTTP status.
 *
 * Anything that isn't an AppError is an unexpected crash —
 * errorHandler logs the full stack and returns a generic 500.
 *
 * Usage:
 *   throw new AppError('BVN_NAME_MISMATCH', 400)
 *   throw new AppError('GROUP_FULL', 409)
 *   throw new AppError('INSUFFICIENT_BALANCE', 422, { accountId: '...' })
 */
export class AppError extends Error {
  constructor(code, statusCode = 400, meta = {}) {
    super(code);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.meta = meta;
    this.isAppError = true;

    // maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

// ── Common error codes ────────────────────────────────────────────
// Centralising them here means they're searchable and consistent.
// Import the ones you need in each service.

export const ErrorCode = {
  // auth
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
  ACCOUNT_FROZEN: "ACCOUNT_FROZEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  TWO_FA_REQUIRED: "TWO_FA_REQUIRED",
  TWO_FA_INVALID: "TWO_FA_INVALID",
  PIN_INVALID: "PIN_INVALID",

  // registration / KYC
  BVN_INVALID: "BVN_INVALID",
  BVN_NAME_MISMATCH: "BVN_NAME_MISMATCH",
  BVN_ALREADY_REGISTERED: "BVN_ALREADY_REGISTERED",
  PHONE_ALREADY_REGISTERED: "PHONE_ALREADY_REGISTERED",
  EMAIL_ALREADY_REGISTERED: "EMAIL_ALREADY_REGISTERED",
  KYC_LEVEL_INSUFFICIENT: "KYC_LEVEL_INSUFFICIENT",

  // bank accounts
  BANK_ACCOUNT_NOT_FOUND: "BANK_ACCOUNT_NOT_FOUND",
  BANK_ACCOUNT_UNVERIFIED: "BANK_ACCOUNT_UNVERIFIED",
  MANDATE_INACTIVE: "MANDATE_INACTIVE",

  // groups
  NO_OPEN_GROUP: "NO_OPEN_GROUP",
  GROUP_NOT_FOUND: "GROUP_NOT_FOUND",
  GROUP_FULL: "GROUP_FULL",
  GROUP_FROZEN: "GROUP_FROZEN",
  ALREADY_IN_TIER_GROUP: "ALREADY_IN_TIER_GROUP",
  NOT_GROUP_MEMBER: "NOT_GROUP_MEMBER",

  // financial
  CONTRIBUTION_NOT_FOUND: "CONTRIBUTION_NOT_FOUND",
  PAYOUT_GUARD_FAILED: "PAYOUT_GUARD_FAILED",
  ALREADY_COLLECTED: "ALREADY_COLLECTED",
  AMOUNT_MISMATCH: "AMOUNT_MISMATCH",
  ALL_ACCOUNTS_FAILED: "ALL_ACCOUNTS_FAILED",

  // general
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};
