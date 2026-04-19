/**
 * Migration 011 — audit_logs table
 *
 * Tamper-evident, append-only log of every significant event in the system.
 * Uses bigserial (auto-incrementing integer) rather than UUID as primary key
 * so rows have a guaranteed insertion order for chain verification.
 *
 * Each row's checksum is a SHA-256 hash of its own content plus the
 * previous row's checksum — forming a hash chain. Modifying any row
 * invalidates all subsequent checksums, making tampering detectable.
 *
 * actor_type distinguishes whether the action was taken by:
 *   'user'   — a regular user through the app
 *   'admin'  — an admin through the console
 *   'system' — automated (scheduler, webhook handler, job processor)
 *
 * No UPDATE or DELETE is ever granted on this table.
 */

export async function up(knex) {
  await knex.schema.createTable("audit_logs", (t) => {
    // bigserial gives guaranteed ordering — critical for chain verification
    t.bigIncrements("id").primary();

    t.string("event_type", 80).notNullable();

    t.uuid("actor_id"); // null for system events
    t.enu("actor_type", ["user", "admin", "system"])
      .notNullable()
      .defaultTo("system");

    t.uuid("target_id"); // the entity being acted upon
    t.string("target_type", 40); // e.g. 'user', 'group', 'contribution', 'payout'

    t.jsonb("payload"); // full event context
    t.specificType("ip_address", "inet");

    // hash chain — each row's checksum covers its content + previous checksum
    t.string("prev_checksum", 64);
    t.string("checksum", 64).notNullable();

    t.timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    t.index("event_type");
    t.index("actor_id");
    t.index("target_id");
    t.index("created_at");
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("audit_logs");
}
