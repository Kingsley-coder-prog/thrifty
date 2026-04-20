/**
 * Migration 015 — add fingerprint columns for auth lookups
 *
 * bvn_fingerprint on users:
 *   SHA-256 hash of the raw BVN — used for fast deduplication lookup.
 *   Different from bvn_hash (Argon2id) which is for security.
 *   Argon2id is intentionally non-deterministic so we can't use it for lookups.
 *
 * token_fingerprint on refresh_tokens:
 *   SHA-256 hash of the raw token — used to find the token row quickly.
 *   Different from token_hash (Argon2id) which is for security verification.
 */

export async function up(knex) {
  await knex.schema.alterTable("users", (t) => {
    t.string("bvn_fingerprint", 64).unique();
  });

  await knex.schema.alterTable("refresh_tokens", (t) => {
    t.string("token_fingerprint", 64).unique();
  });

  await knex.raw(`
    CREATE INDEX idx_users_bvn_fingerprint
      ON users (bvn_fingerprint)
      WHERE bvn_fingerprint IS NOT NULL
  `);
}

export async function down(knex) {
  await knex.schema.alterTable("users", (t) => {
    t.dropColumn("bvn_fingerprint");
  });

  await knex.schema.alterTable("refresh_tokens", (t) => {
    t.dropColumn("token_fingerprint");
  });
}
