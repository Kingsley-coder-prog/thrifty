import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError, ErrorCode } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

/**
 * Admin authentication middleware.
 *
 * Uses a completely separate JWT secret from regular user auth.
 * Admin tokens are issued manually (seeded or created via a
 * secure admin creation script — never via a public endpoint).
 *
 * Token payload shape:
 * {
 *   sub:   adminId (uuid),
 *   role:  'super_admin' | 'operations' | 'finance' | 'compliance' | 'support',
 *   email: admin email,
 * }
 *
 * Usage:
 *   router.get('/users', adminAuth, requireAdminRole('operations'), handler)
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

    req.admin = {
      id: decoded.sub,
      role: decoded.role,
      email: decoded.email,
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
 * Use after adminAuth middleware.
 *
 * Usage:
 *   router.post('/payouts/:id/override',
 *     adminAuth,
 *     requireAdminRole('finance', 'super_admin'),
 *     handler
 *   )
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

/**
 * Generate a temporary admin token for development/testing.
 * In production, admin tokens are issued through a secure internal process.
 *
 * Run from Node REPL:
 *   node --env-file=.env -e "
 *     import('./src/middleware/adminAuth.js').then(m => console.log(m.generateDevAdminToken()))
 *   "
 */
export function generateDevAdminToken(role = "super_admin") {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "Cannot generate admin tokens in production via this method",
    );
  }

  return jwt.sign(
    {
      sub: "dev-admin-001",
      role,
      email: "admin@thrifty.dev",
    },
    env.ADMIN_JWT_SECRET,
    { algorithm: "HS256", expiresIn: "7d" },
  );
}
