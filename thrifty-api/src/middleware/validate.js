import { ZodError } from "zod";
import { AppError, ErrorCode } from "../lib/errors.js";

/**
 * Validation middleware factory.
 *
 * Usage in routes:
 *   router.post('/register', validate(registerSchema), authController.register)
 *
 * On success:  req.body is replaced with the parsed, type-safe value
 * On failure:  returns 400 with structured field errors
 *
 * The 'target' parameter lets you validate req.params or req.query too:
 *   validate(schema, 'params')
 *   validate(schema, 'query')
 */
export function validate(schema, target = "body") {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[target]);
      req[target] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: ErrorCode.VALIDATION_ERROR,
          fields: err.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }
      next(err);
    }
  };
}
