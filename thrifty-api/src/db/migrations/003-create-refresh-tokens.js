/**
 * Migration 003 — refresh_tokens table
 *
 * Stores hashed refresh tokens for JWT rotation.
 * Raw tokens are never stored — only their Argon2id hash.
 *
 * On every token refresh:
 *   1. The old token row is marked is_revoked = true
 *   2. A new token row is inserted
 *
 * This gives us a full history of all sessions and enables
 * detecting refresh token reuse (a sign of token theft).
 */

export async function up(knex) {
  await knex.schema.createTable("refresh_tokens", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));

    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    t.string("token_hash", 255).notNullable().unique();
    t.string("device_fingerprint", 255);
    t.specificType("ip_address", "inet");
    t.text("user_agent");

    t.boolean("is_revoked").notNullable().defaultTo(false);
    t.timestamp("expires_at", { useTz: true }).notNullable();
    t.timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    t.index("user_id");
    t.index("is_revoked");
    t.index("expires_at");
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("refresh_tokens");
}
