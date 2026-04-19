/**
 * Migration 008 — cycles table
 *
 * One cycle = one month of contributions + one payout.
 * A group of 7 has exactly 7 cycles total.
 *
 * recipient_member_id is set when the cycle is created based on turn_position.
 * It never changes after creation.
 *
 * debit_window_start: always the 25th of the current month
 * debit_window_end:   always the 5th of the following month
 *
 * collected_total is updated as contributions settle.
 * When collected_total = expected_total, payout can be triggered.
 *
 * Unique constraint on (group_id, cycle_number) ensures
 * a group cannot have two cycles with the same number.
 */

export async function up(knex) {
  await knex.schema.createTable("cycles", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));

    t.uuid("group_id")
      .notNullable()
      .references("id")
      .inTable("thrift_groups")
      .onDelete("CASCADE");

    t.uuid("recipient_member_id")
      .notNullable()
      .references("id")
      .inTable("group_members");

    t.smallint("cycle_number").notNullable(); // 1–7

    t.enu("status", [
      "collecting", // debit window is open
      "pending_payout", // all contributions settled, awaiting payout
      "disbursing", // payout transfer initiated
      "completed", // payout confirmed by processor
      "frozen", // admin hold
    ])
      .notNullable()
      .defaultTo("collecting");

    t.date("debit_window_start").notNullable();
    t.date("debit_window_end").notNullable();

    t.decimal("expected_total", 12, 2).notNullable();
    t.decimal("collected_total", 12, 2).notNullable().defaultTo(0);

    t.timestamp("payout_triggered_at", { useTz: true });
    t.timestamp("payout_completed_at", { useTz: true });
    t.timestamps(true, true);

    // one cycle number per group
    t.unique(["group_id", "cycle_number"]);

    t.index("group_id");
    t.index("status");
  });

  await knex.raw(`
    ALTER TABLE cycles
      ADD CONSTRAINT chk_cycles_cycle_number
        CHECK (cycle_number BETWEEN 1 AND 7),
      ADD CONSTRAINT chk_cycles_collected_total
        CHECK (collected_total >= 0),
      ADD CONSTRAINT chk_cycles_window
        CHECK (debit_window_end > debit_window_start)
  `);
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("cycles");
}
