/**
 * Migration 006 — thrift_groups table
 *
 * A group moves through these statuses exactly once in sequence:
 *   forming → active → completed
 *
 * With two possible interruptions at any point:
 *   any status → frozen  (admin hold)
 *   any status → disbanded (admin force-close)
 *
 * Groups are capped at 7 members (max_members).
 * Once member_count reaches 7, status moves to 'active' and the group is closed.
 * invite_code allows members to invite others directly to a forming group.
 */

export async function up(knex) {
  await knex.schema.createTable("thrift_groups", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));

    t.uuid("tier_id").notNullable().references("id").inTable("tiers");

    t.uuid("created_by").notNullable().references("id").inTable("users");

    t.string("name", 80);

    t.enu("status", ["forming", "active", "completed", "frozen", "disbanded"])
      .notNullable()
      .defaultTo("forming");

    t.smallint("current_cycle").notNullable().defaultTo(0);
    t.smallint("max_members").notNullable().defaultTo(7);
    t.smallint("member_count").notNullable().defaultTo(0);

    t.date("start_date");

    t.boolean("is_private").notNullable().defaultTo(false);
    t.string("invite_code", 12).unique();

    t.timestamps(true, true);

    t.index("tier_id");
    t.index("status");
  });

  await knex.raw(`
    ALTER TABLE thrift_groups
      ADD CONSTRAINT chk_groups_member_count
        CHECK (member_count >= 0 AND member_count <= max_members),
      ADD CONSTRAINT chk_groups_max_members
        CHECK (max_members = 7),
      ADD CONSTRAINT chk_groups_current_cycle
        CHECK (current_cycle >= 0 AND current_cycle <= 7)
  `);

  // partial index — only open (forming) groups need to be found quickly for joining
  await knex.raw(`
    CREATE INDEX idx_groups_forming
      ON thrift_groups (tier_id, created_at)
      WHERE status = 'forming'
  `);
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("thrift_groups");
}
