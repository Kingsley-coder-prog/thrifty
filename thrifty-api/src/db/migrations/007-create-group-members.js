/**
 * Migration 007 — group_members table
 *
 * Junction table between users and thrift_groups.
 * One row per user per group.
 *
 * turn_position is assigned when the group activates (7th member joins).
 * It is determined by a cryptographic shuffle and is IMMUTABLE after that point.
 * No application code should ever UPDATE turn_position after activation.
 *
 * has_collected is the critical double-collection guard.
 * Once set to true it is NEVER set back to false under any circumstance.
 * collected_cycle records which cycle number they collected in.
 *
 * Two unique constraints:
 *   (group_id, user_id)       — a user can only be in a group once
 *   (group_id, turn_position) — two members cannot share the same turn
 */

export async function up(knex) {
  await knex.schema.createTable("group_members", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));

    t.uuid("group_id")
      .notNullable()
      .references("id")
      .inTable("thrift_groups")
      .onDelete("CASCADE");

    t.uuid("user_id").notNullable().references("id").inTable("users");

    t.smallint("turn_position"); // 1–7, assigned on group activation

    // payout collection tracking — the most important fields in this table
    t.boolean("has_collected").notNullable().defaultTo(false);
    t.timestamp("collected_at", { useTz: true });
    t.smallint("collected_cycle");

    t.enu("status", ["active", "defaulted", "left", "removed"])
      .notNullable()
      .defaultTo("active");

    t.timestamp("joined_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.timestamp("left_at", { useTz: true });

    // one user per group
    t.unique(["group_id", "user_id"]);

    t.index("group_id");
    t.index("user_id");
    t.index("status");
  });

  // turn positions must be unique within a group
  // partial index — only applies once turn_position is assigned (not null)
  await knex.raw(`
    CREATE UNIQUE INDEX idx_group_members_turn_position
      ON group_members (group_id, turn_position)
      WHERE turn_position IS NOT NULL
  `);

  // has_collected can never be set back to false once true
  await knex.raw(`
    CREATE RULE no_uncollect AS
      ON UPDATE TO group_members
      WHERE (OLD.has_collected = true AND NEW.has_collected = false)
      DO INSTEAD NOTHING
  `);
}

export async function down(knex) {
  await knex.raw("DROP RULE IF EXISTS no_uncollect ON group_members");
  await knex.schema.dropTableIfExists("group_members");
}
