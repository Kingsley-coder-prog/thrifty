/**
 * Migration 009 — contributions table
 *
 * One row per member per cycle — records every debit attempt and its outcome.
 *
 * UNIQUE(cycle_id, member_id) is the database-level guarantee that
 * a member cannot be charged twice for the same cycle. Even if the
 * application has a bug, the database will reject the duplicate insert.
 *
 * payment_reference is the idempotency key passed to the payment processor.
 * processor_ref is the reference returned by the processor.
 *
 * Financial records are append-only:
 *   - No DELETE granted to the application role
 *   - Settled contributions cannot be updated (enforced by DB rule)
 *
 * attempt_count tracks how many debit attempts have been made.
 * Max attempts before DEFAULTED status: 4 (initial + 3 retries)
 */

export async function up(knex) {
  await knex.schema.createTable("contributions", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));

    t.uuid("cycle_id").notNullable().references("id").inTable("cycles");

    t.uuid("member_id").notNullable().references("id").inTable("group_members");

    t.uuid("bank_account_id").references("id").inTable("bank_accounts");

    t.decimal("amount", 12, 2).notNullable();

    t.enu("status", ["pending", "settled", "failed", "retrying", "defaulted"])
      .notNullable()
      .defaultTo("pending");

    // idempotency key — passed to payment processor to prevent double charging
    t.string("payment_reference", 100).unique();
    // reference returned by processor after charge initiation
    t.string("processor_ref", 100);

    t.smallint("attempt_count").notNullable().defaultTo(0);
    t.timestamp("last_attempt_at", { useTz: true });
    t.text("failure_reason");
    t.timestamp("settled_at", { useTz: true });

    t.timestamps(true, true);

    // THE most important constraint — one contribution per member per cycle
    t.unique(["cycle_id", "member_id"]);

    t.index("status");
    t.index("cycle_id");
  });

  await knex.raw(`
    ALTER TABLE contributions
      ADD CONSTRAINT chk_contributions_amount
        CHECK (amount > 0),
      ADD CONSTRAINT chk_contributions_attempt_count
        CHECK (attempt_count >= 0 AND attempt_count <= 10)
  `);

  // settled contributions are immutable — no updates allowed
  await knex.raw(`
    CREATE RULE no_settled_contribution_update AS
      ON UPDATE TO contributions
      WHERE (OLD.status = 'settled')
      DO INSTEAD NOTHING
  `);
}

export async function down(knex) {
  await knex.raw(
    "DROP RULE IF EXISTS no_settled_contribution_update ON contributions",
  );
  await knex.schema.dropTableIfExists("contributions");
}
