/**
 * Migration 002 — users table
 *
 * Core identity table. PII fields (full_name, phone_number, email) are stored
 * encrypted — values are longer than plaintext because of the encryption overhead,
 * hence the larger varchar limits.
 *
 * bvn_hash uses Argon2id — irreversible, only used for deduplication.
 * phone_number uses deterministic encryption so UNIQUE constraint works.
 * full_name uses randomised encryption so varchar is wider.
 *
 * Security: the application DB role gets SELECT + INSERT only.
 * UPDATE is restricted to specific columns via a separate admin role.
 * DELETE is fully revoked — users are never hard-deleted.
 */

export async function up(knex) {
  await knex.schema.createTable("users", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));

    // PII — stored encrypted
    t.string("full_name", 500).notNullable();
    t.string("phone_number", 500).notNullable().unique();
    t.string("email", 500).unique();

    // BVN — hashed with Argon2id, never reversible
    // unique constraint prevents one person having multiple accounts
    t.string("bvn_hash", 255).notNullable().unique();
    t.timestamp("bvn_verified_at", { useTz: true });

    // KYC
    t.enu("kyc_status", ["pending", "bvn_verified", "full_kyc", "rejected"])
      .notNullable()
      .defaultTo("pending");
    t.smallint("kyc_level").notNullable().defaultTo(0);

    // account state
    t.enu("account_status", ["active", "suspended", "frozen", "closed"])
      .notNullable()
      .defaultTo("active");

    // credentials
    t.string("password_hash", 255).notNullable();
    t.string("pin_hash", 255).notNullable();
    t.string("totp_secret", 255); // 2FA secret, encrypted at rest

    // lockout tracking
    t.smallint("failed_login_count").notNullable().defaultTo(0);
    t.timestamp("locked_until", { useTz: true });

    t.timestamps(true, true); // created_at, updated_at

    // indexes
    t.index("kyc_status");
    t.index("account_status");
    t.index("bvn_verified_at");
  });

  // check constraints
  await knex.raw(`
    ALTER TABLE users
      ADD CONSTRAINT chk_users_kyc_level
        CHECK (kyc_level BETWEEN 0 AND 3),
      ADD CONSTRAINT chk_users_failed_logins
        CHECK (failed_login_count >= 0)
  `);

  // partial index — only indexes locked accounts, not the millions of NULL rows
  await knex.raw(`
    CREATE INDEX idx_users_locked
      ON users (locked_until)
      WHERE locked_until IS NOT NULL
  `);
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("users");
}
