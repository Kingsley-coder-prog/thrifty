import argon2 from "argon2";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { AppError, ErrorCode } from "../lib/errors.js";
import { encrypt, encryptDeterministic } from "../lib/crypto.js";
import { verifyBVN, namesMatch } from "../lib/nibss.js";

// ── Argon2id config ──────────────────────────────────────────────
// memoryCost: 64MB — makes brute force expensive
// timeCost:   3 iterations
// parallelism: 1 thread
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64MB in KB
  timeCost: 3,
  parallelism: 1,
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export const authService = {
  // ── Register ───────────────────────────────────────────────────
  async register({ fullName, phone, email, bvn, password, pin }) {
    // 1. verify BVN — throws if invalid
    const bvnData = await verifyBVN(bvn);

    // 2. name on BVN must loosely match submitted name
    if (!namesMatch(bvnData.full_name, fullName)) {
      throw new AppError(ErrorCode.BVN_NAME_MISMATCH, 422, {
        message: "The name you provided does not match your BVN record",
      });
    }

    // 3. check for duplicate BVN — one person, one account
    const bvnHash = await argon2.hash(bvn, ARGON2_OPTIONS);

    // we can't do a direct DB lookup with argon2 (it's non-deterministic)
    // so we check by hashing all existing BVN hashes — this is why we
    // also store a deterministic SHA-256 BVN fingerprint for fast lookup
    const bvnFingerprint = crypto
      .createHash("sha256")
      .update(bvn)
      .digest("hex");

    const existingBvn = await db("users")
      .where({ bvn_fingerprint: bvnFingerprint })
      .first();

    if (existingBvn) {
      throw new AppError(ErrorCode.BVN_ALREADY_REGISTERED, 409);
    }

    // 4. check for duplicate phone
    const encryptedPhone = encryptDeterministic(phone);
    const existingPhone = await db("users")
      .where({ phone_number: encryptedPhone })
      .first();

    if (existingPhone) {
      throw new AppError(ErrorCode.PHONE_ALREADY_REGISTERED, 409);
    }

    // 5. check for duplicate email (if provided)
    let encryptedEmail = null;
    if (email) {
      encryptedEmail = encryptDeterministic(email.toLowerCase());
      const existingEmail = await db("users")
        .where({ email: encryptedEmail })
        .first();

      if (existingEmail) {
        throw new AppError(ErrorCode.EMAIL_ALREADY_REGISTERED, 409);
      }
    }

    // 6. hash password and PIN with Argon2id
    const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
    const pinHash = await argon2.hash(pin, ARGON2_OPTIONS);

    // 7. insert user — all PII encrypted
    const [user] = await db("users")
      .insert({
        full_name: encrypt(fullName),
        phone_number: encryptedPhone,
        email: encryptedEmail,
        bvn_hash: bvnHash,
        bvn_fingerprint: bvnFingerprint,
        bvn_verified_at: new Date(),
        password_hash: passwordHash,
        pin_hash: pinHash,
        kyc_status: "bvn_verified",
        kyc_level: 1,
        account_status: "active",
      })
      .returning(["id", "kyc_status", "kyc_level", "account_status"]);

    logger.info({ userId: user.id }, "User registered");

    // 8. issue tokens
    return issueTokenPair(user);
  },

  // ── Login ──────────────────────────────────────────────────────
  async login({ phone, password, deviceFingerprint, ipAddress }) {
    const encryptedPhone = encryptDeterministic(phone);

    const user = await db("users")
      .where({ phone_number: encryptedPhone })
      .first();

    // always run password verification even if user not found
    // prevents timing attacks that reveal whether a phone is registered
    const dummyHash = "$argon2id$v=19$m=65536,t=3,p=1$dummy$dummy";
    const hashToVerify = user?.password_hash ?? dummyHash;

    // check lockout BEFORE verifying password
    if (user?.locked_until && new Date(user.locked_until) > new Date()) {
      const secondsLeft = Math.ceil(
        (new Date(user.locked_until) - new Date()) / 1000,
      );
      throw new AppError(ErrorCode.ACCOUNT_LOCKED, 429, { secondsLeft });
    }

    let passwordValid = false;
    try {
      passwordValid = await argon2.verify(hashToVerify, password);
    } catch {
      passwordValid = false;
    }

    if (!user || !passwordValid) {
      // increment failed attempts if user exists
      if (user) {
        await incrementFailedAttempts(user);
      }
      // same error whether user exists or not — prevents user enumeration
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 401);
    }

    // check account status
    if (user.account_status === "suspended") {
      throw new AppError(ErrorCode.ACCOUNT_SUSPENDED, 403);
    }
    if (user.account_status === "frozen") {
      throw new AppError(ErrorCode.ACCOUNT_FROZEN, 403);
    }

    // reset failed attempts on successful login
    await db("users")
      .where({ id: user.id })
      .update({ failed_login_count: 0, locked_until: null });

    logger.info({ userId: user.id, ip: ipAddress }, "User logged in");

    return issueTokenPair(user, deviceFingerprint, ipAddress);
  },

  // ── Refresh tokens ─────────────────────────────────────────────
  async refresh({ refreshToken, deviceFingerprint }) {
    // find the stored token — we store a hash, not the raw token
    const tokenFingerprint = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const stored = await db("refresh_tokens")
      .where({
        token_fingerprint: tokenFingerprint,
        is_revoked: false,
      })
      .where("expires_at", ">", new Date())
      .first();

    if (!stored) {
      throw new AppError(ErrorCode.TOKEN_INVALID, 401);
    }

    // verify the full hash
    const valid = await argon2.verify(stored.token_hash, refreshToken);
    if (!valid) {
      // possible token theft — revoke all tokens for this user
      await db("refresh_tokens")
        .where({ user_id: stored.user_id })
        .update({ is_revoked: true });

      logger.warn(
        { userId: stored.user_id },
        "Refresh token reuse detected — all sessions revoked",
      );
      throw new AppError(ErrorCode.TOKEN_INVALID, 401);
    }

    // token rotation — revoke old, issue new
    await db("refresh_tokens")
      .where({ id: stored.id })
      .update({ is_revoked: true });

    const user = await db("users")
      .where({ id: stored.user_id })
      .select("id", "account_status", "kyc_status", "kyc_level")
      .first();

    if (!user || user.account_status !== "active") {
      throw new AppError(ErrorCode.TOKEN_INVALID, 401);
    }

    return issueTokenPair(user, deviceFingerprint);
  },

  // ── Logout ─────────────────────────────────────────────────────
  async logout({ refreshToken, logoutAll = false, userId }) {
    if (logoutAll) {
      // revoke all sessions for this user
      await db("refresh_tokens")
        .where({ user_id: userId })
        .update({ is_revoked: true });

      logger.info({ userId }, "All sessions revoked");
      return;
    }

    if (refreshToken) {
      const tokenFingerprint = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");

      await db("refresh_tokens")
        .where({ token_fingerprint: tokenFingerprint })
        .update({ is_revoked: true });
    }
  },
};

// ── Private helpers ───────────────────────────────────────────────

async function issueTokenPair(
  user,
  deviceFingerprint = null,
  ipAddress = null,
) {
  const accessToken = issueAccessToken(user);
  const refreshToken = await issueRefreshToken(
    user.id,
    deviceFingerprint,
    ipAddress,
  );

  return {
    accessToken,
    refreshToken: refreshToken.raw,
    expiresIn: env.JWT_ACCESS_EXPIRY,
    user: {
      id: user.id,
      kycStatus: user.kyc_status,
      kycLevel: user.kyc_level,
    },
  };
}

function issueAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      kyc: user.kyc_level,
      status: user.account_status,
    },
    env.JWT_PRIVATE_KEY,
    {
      algorithm: "RS256",
      expiresIn: env.JWT_ACCESS_EXPIRY,
    },
  );
}

async function issueRefreshToken(userId, deviceFingerprint, ipAddress) {
  // generate a cryptographically random token
  const rawToken = crypto.randomBytes(64).toString("hex");
  const tokenHash = await argon2.hash(rawToken, ARGON2_OPTIONS);
  const tokenFingerprint = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

  await db("refresh_tokens").insert({
    user_id: userId,
    token_hash: tokenHash,
    token_fingerprint: tokenFingerprint,
    device_fingerprint: deviceFingerprint,
    ip_address: ipAddress,
    expires_at: expiresAt,
  });

  return { raw: rawToken };
}

async function incrementFailedAttempts(user) {
  const newCount = (user.failed_login_count ?? 0) + 1;
  const update = { failed_login_count: newCount };

  if (newCount >= MAX_FAILED_ATTEMPTS) {
    update.locked_until = new Date(Date.now() + LOCKOUT_DURATION_MS);
    logger.warn(
      { userId: user.id },
      `Account locked after ${newCount} failed attempts`,
    );
  }

  await db("users").where({ id: user.id }).update(update);
}
