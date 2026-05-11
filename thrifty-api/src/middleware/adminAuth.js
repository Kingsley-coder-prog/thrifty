import jwt from "jsonwebtoken";
import argon2 from "argon2";
import { env } from "../config/env.js";
import { db } from "../config/database.js";
import { AppError, ErrorCode } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { sha256 } from "../lib/crypto.js";

/**
 * Admin authentication middleware.
 *
 * Verifies the JWT token AND checks the session is still active
 * in the admin_sessions table. This allows proper logout/revocation.
 */
export async function adminAuth(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      throw new AppError(ErrorCode.TOKEN_INVALID, 401);
    }

    const token = header.slice(7);

    let decoded;
    try {
      decoded = jwt.verify(token, env.ADMIN_JWT_SECRET, {
        algorithms: ["HS256"],
      });
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        throw new AppError(ErrorCode.TOKEN_EXPIRED, 401);
      }
      throw new AppError(ErrorCode.TOKEN_INVALID, 401);
    }

    // verify session is still active in DB (not revoked)
    if (decoded.sid) {
      const session = await db("admin_sessions")
        .where({
          admin_id: decoded.sub,
          token_fingerprint: decoded.sid,
          is_revoked: false,
        })
        .where("expires_at", ">", new Date())
        .first();

      if (!session) {
        throw new AppError(ErrorCode.TOKEN_INVALID, 401);
      }
    }

    // verify admin is still active
    const admin = await db("admins")
      .where({ id: decoded.sub, is_active: true })
      .first();

    if (!admin) {
      throw new AppError(ErrorCode.TOKEN_INVALID, 401);
    }

    req.admin = {
      id: decoded.sub,
      role: decoded.role,
      email: decoded.email,
      sid: decoded.sid,
    };

    logger.info(
      {
        adminId: decoded.sub,
        role: decoded.role,
        path: req.path,
        method: req.method,
      },
      "Admin action",
    );

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Role-based access control for admin endpoints.
 */
export function requireAdminRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.admin) {
      return next(new AppError(ErrorCode.TOKEN_INVALID, 401));
    }

    if (!allowedRoles.includes(req.admin.role)) {
      logger.warn(
        {
          adminId: req.admin.id,
          role: req.admin.role,
          requiredRole: allowedRoles,
          path: req.path,
        },
        "Admin role insufficient",
      );

      return next(
        new AppError(ErrorCode.FORBIDDEN, 403, {
          message: `This action requires one of: ${allowedRoles.join(", ")}`,
          yourRole: req.admin.role,
        }),
      );
    }

    next();
  };
}
