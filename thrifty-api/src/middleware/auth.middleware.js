import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError, ErrorCode } from "../lib/errors.js";
import { db } from "../config/database.js";

/**
 * Verifies the JWT access token in the Authorization header.
 * Attaches the decoded user payload to req.user.
 *
 * Expected header format:
 *   Authorization: Bearer <token>
 *
 * The token is verified with the RS256 public key.
 * If valid, req.user is populated and next() is called.
 * If invalid or missing, a 401 is returned.
 */
export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      throw new AppError(ErrorCode.TOKEN_INVALID, 401);
    }

    const token = header.slice(7); // remove 'Bearer ' prefix

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_PUBLIC_KEY, {
        algorithms: ["RS256"],
      });
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        throw new AppError(ErrorCode.TOKEN_EXPIRED, 401);
      }
      throw new AppError(ErrorCode.TOKEN_INVALID, 401);
    }

    // verify the user still exists and is active
    // we check account_status on every request — if an admin suspends
    // a user, their next request will be rejected even with a valid token
    const user = await db("users")
      .where({ id: decoded.sub })
      .select("id", "account_status", "kyc_status", "kyc_level")
      .first();

    if (!user) {
      throw new AppError(ErrorCode.TOKEN_INVALID, 401);
    }

    if (
      user.account_status === "suspended" ||
      user.account_status === "frozen"
    ) {
      throw new AppError(ErrorCode.ACCOUNT_SUSPENDED, 403);
    }

    if (user.account_status === "closed") {
      throw new AppError(ErrorCode.TOKEN_INVALID, 401);
    }

    req.user = {
      id: user.id,
      status: user.account_status,
      kycStatus: user.kyc_status,
      kycLevel: user.kyc_level,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Requires a minimum KYC level.
 * Use after authenticate() middleware.
 *
 * Usage:
 *   router.post('/groups/join', authenticate, requireKyc(1), ...)
 */
export function requireKyc(minLevel) {
  return (req, res, next) => {
    if (req.user.kycLevel < minLevel) {
      return next(
        new AppError(ErrorCode.KYC_LEVEL_INSUFFICIENT, 403, {
          required: minLevel,
          current: req.user.kycLevel,
        }),
      );
    }
    next();
  };
}
