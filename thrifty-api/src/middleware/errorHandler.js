import { logger } from "../lib/logger.js";

/**
 * Express error handler — must be the last middleware registered in app.js.
 * Has four parameters — Express identifies error handlers by arity.
 */
export function errorHandler(err, req, res, next) {
  // eslint-disable-line no-unused-vars

  // known, typed application error — return its code and status
  if (err.isAppError) {
    return res.status(err.statusCode).json({
      error: err.code,
      ...(Object.keys(err.meta).length > 0 && { meta: err.meta }),
    });
  }

  // Zod validation error surfaced outside of validate() middleware
  if (err.name === "ZodError") {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      fields: err.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
  }

  // unexpected crash — log full details, return nothing useful to client
  logger.error(
    {
      err: {
        message: err.message,
        stack: err.stack,
        name: err.name,
      },
      req: {
        method: req.method,
        path: req.path,
        query: req.query,
        userId: req.user?.id,
        ip: req.ip,
      },
    },
    "unhandled error",
  );

  return res.status(500).json({
    error: "INTERNAL_ERROR",
  });
}
