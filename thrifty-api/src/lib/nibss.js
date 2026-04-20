import axios from "axios";
import { env } from "../config/env.js";
import { logger } from "./logger.js";
import { AppError, ErrorCode } from "./errors.js";

const client = axios.create({
  baseURL: env.BVN_PROVIDER_URL,
  headers: {
    Authorization: env.BVN_PROVIDER_KEY,
    AppId: env.BVN_APP_ID ?? "",
  },
  timeout: 30000,
});

/**
 * Verify a BVN with NIBSS via Dojah (or compatible provider).
 *
 * Returns the name and phone on the BVN record so the caller
 * can cross-check against the user's submitted details.
 *
 * In development with a placeholder BVN_PROVIDER_KEY, this returns
 * mock data so you can test registration without a real provider account.
 */
export async function verifyBVN(bvn) {
  // dev mock — bypass real API call when using placeholder key
  if (
    env.NODE_ENV === "development" &&
    env.BVN_PROVIDER_KEY === "placeholder"
  ) {
    logger.warn("BVN verification bypassed — using mock data in development");
    return {
      bvn,
      first_name: "Test",
      last_name: "User",
      middle_name: "",
      full_name: "Test User",
      phone: "08012345678",
      dob: "1990-01-01",
    };
  }

  try {
    const { data } = await client.get("/api/v1/kyc/bvn/advance", {
      params: { bvn },
    });

    if (!data?.entity) {
      throw new AppError(ErrorCode.BVN_INVALID, 422);
    }

    const entity = data.entity;

    return {
      bvn,
      first_name: entity["First Name"] ?? "",
      last_name: entity["Last Name"] ?? "",
      middle_name: entity["Middle Name"] ?? "",
      full_name: `${entity["First Name"]} ${entity["Last Name"]}`.trim(),
      phone: entity["Phone Number1"] ?? "",
      dob: entity["Date Of Birth"] ?? "",
    };
  } catch (err) {
    if (err.isAppError) throw err;

    logger.error({ err, bvn: "[REDACTED]" }, "BVN verification failed");
    throw new AppError(ErrorCode.BVN_INVALID, 422);
  }
}

/**
 * Loose name match — checks whether the name on the BVN record
 * sufficiently matches the name the user submitted during registration.
 *
 * Allows for:
 *   - Different ordering (first/last swapped)
 *   - Extra middle names
 *   - Minor spacing differences
 *
 * Returns true if at least 2 name parts match.
 */
export function namesMatch(bvnFullName, submittedName) {
  const normalise = (str) =>
    str.toLowerCase().trim().replace(/\s+/g, " ").split(" ");

  const bvnParts = normalise(bvnFullName);
  const submittedParts = normalise(submittedName);

  const matches = submittedParts.filter(
    (part) => part.length > 1 && bvnParts.includes(part),
  );

  return matches.length >= 2;
}
