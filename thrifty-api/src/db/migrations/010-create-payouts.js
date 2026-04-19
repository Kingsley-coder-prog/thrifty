/**
 * Migration 010 — payouts table
 *
 * One row per cycle — records the disbursement to the cycle recipient.
 *
 * gross_amount = tier.total_payout (sum of all 7 contributions)
 * platform_fee = gross_amount * tier.platform_fee_pct / 100
 * net_amount   = gross_amount - platform_fee (what the recipient actually receives)
 *
 * transfer_reference is generated before the DB transaction and used as
 * the idempotency key for the Paystack transfer API call.
 * UNIQUE constraint on transfer_reference prevents double-payout even if
 * the job processor runs twice.
 *
 * Financial records are append-only — no DELETE, no UPDATE on completed rows.
 */

export async function up(knex) {
  await knex.schema.createTable("payouts", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));

    t.uuid("cycle_id")
      .notNullable()
      .unique() // one payout per cycle, ever
      .references("id")
      .inTable("cycles");

    t.uuid("recipient_user_id").notNullable().references("id").inTable("users");

    t.uuid("recipient_account_id")
      .notNullable()
      .references("id")
      .inTable("bank_accounts");

    t.decimal("gross_amount", 12, 2).notNullable();
    t.decimal("platform_fee", 12, 2).notNullable();
    t.decimal("net_amount", 12, 2).notNullable();

    t.enu("status", ["pending", "processing", "completed", "failed"])
      .notNullable()
      .defaultTo("pending");

    // idempotency key for the transfer API call
    t.string("transfer_reference", 100).notNullable().unique();
    // reference returned by the processor
    t.string("processor_ref", 100);

    t.timestamp("initiated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.timestamp("completed_at", { useTz: true });

    t.timestamps(true, true);

    t.index("recipient_user_id");
    t.index("status");
  });

  await knex.raw(`
    ALTER TABLE payouts
      ADD CONSTRAINT chk_payouts_amounts
        CHECK (
          gross_amount > 0
          AND platform_fee >= 0
          AND net_amount > 0
          AND net_amount = gross_amount - platform_fee
        )
  `);

  // completed payouts are immutable
  await knex.raw(`
    CREATE RULE no_completed_payout_update AS
      ON UPDATE TO payouts
      WHERE (OLD.status = 'completed')
      DO INSTEAD NOTHING
  `);
}

export async function down(knex) {
  await knex.raw("DROP RULE IF EXISTS no_completed_payout_update ON payouts");
  await knex.schema.dropTableIfExists("payouts");
}
