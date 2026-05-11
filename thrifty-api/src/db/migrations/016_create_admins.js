/**
 * Migration 016 — admins table
 *
 * Separate from the users table entirely.
 * Admins are internal staff, not customers.
 * Passwords use Argon2id — same as user passwords.
 * Sessions tracked via admin_sessions for audit trail.
 */

export function up(knex) {
  return knex.schema
    .createTable("admins", (table) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table.string("email", 255).notNullable().unique();
      table.string("password_hash", 255).notNullable();
      table.string("full_name", 100).notNullable();
      table
        .enum("role", [
          "super_admin",
          "operations",
          "finance",
          "compliance",
          "support",
        ])
        .notNullable()
        .defaultTo("support");
      table.boolean("is_active").notNullable().defaultTo(true);
      table.timestamp("last_login_at").nullable();
      table.integer("failed_login_attempts").notNullable().defaultTo(0);
      table.timestamp("locked_until").nullable();
      table.timestamps(true, true);
    })
    .createTable("admin_sessions", (table) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table
        .uuid("admin_id")
        .notNullable()
        .references("id")
        .inTable("admins")
        .onDelete("CASCADE");
      table.string("token_hash", 255).notNullable();
      table.string("token_fingerprint", 64).notNullable().unique();
      table.boolean("is_revoked").notNullable().defaultTo(false);
      table.timestamp("expires_at").notNullable();
      table.string("ip_address", 45).nullable();
      table.text("user_agent").nullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
    });
}

export function down(knex) {
  return knex.schema
    .dropTableIfExists("admin_sessions")
    .dropTableIfExists("admins");
}
