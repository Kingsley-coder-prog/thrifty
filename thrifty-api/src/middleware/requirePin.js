import argon2 from "argon2";
import { db } from "../config/database.js";
import { AppError, ErrorCode } from "../lib/errors.js";

/**
 * Transaction PIN middleware.
 *
 * Reads the PIN from the X-Transaction-Pin header and verifies it
 * against the user's stored pin_hash using Argon2id.
 *
 * Must be used AFTER the authenticate middleware so req.user is available.
 *
 * Usage in routes:
 *   router.post('/bank-accounts', authenticate, requirePin, handler)
 *
 * The PIN is a 6-digit number the user sets during registration.
 * It is separate from the login password — it guards financial actions only.
 */
export async function requirePin(req, res, next) {
  try {
    const pin = req.headers["x-transaction-pin"];

    if (!pin) {
      throw new AppError(ErrorCode.PIN_INVALID, 403, {
        message:
          "Transaction PIN is required. Send it in the X-Transaction-Pin header.",
      });
    }

    if (!/^\d{6}$/.test(pin)) {
      throw new AppError(ErrorCode.PIN_INVALID, 403, {
        message: "PIN must be exactly 6 digits.",
      });
    }

    const user = await db("users")
      .where({ id: req.user.id })
      .select("pin_hash")
      .first();

    const valid = await argon2.verify(user.pin_hash, pin);

    if (!valid) {
      throw new AppError(ErrorCode.PIN_INVALID, 403, {
        message: "Incorrect PIN.",
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}
