/**
 * Migration 004 — bank_accounts table
 *
 * Raw account numbers are NEVER stored here.
 * account_token holds the tokenised reference from Paystack's vault.
 * mandate_reference holds the direct debit authorisation code.
 *
 * A user can have multiple bank accounts.
 * Exactly one must be is_primary = true at any time.
 * fallback_order determines the sequence for debit fallback sweep.
 */

export async function up(knex) {
  await knex.schema.createTable("bank_accounts", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));

    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    // tokenised account reference from payment processor — never the raw account number
    t.string("account_token", 255).notNullable().unique();

    t.string("bank_code", 10).notNullable();
    t.string("bank_name", 100).notNullable();
    t.string("account_name", 100).notNullable();

    // last 4 digits only — for display purposes in the UI
    t.string("last_4_digits", 4).notNullable();

    // Paystack direct debit mandate
    t.string("mandate_reference", 100).unique();
    t.enu("mandate_status", ["pending", "active", "inactive", "revoked"])
      .notNullable()
      .defaultTo("pending");

    // Mono account ID for balance checks
    t.string("mono_account_id", 100);

    t.boolean("is_primary").notNullable().defaultTo(false);
    t.smallint("fallback_order").notNullable().defaultTo(0);

    t.timestamp("verified_at", { useTz: true });
    t.timestamp("last_debit_attempt", { useTz: true });
    t.timestamps(true, true);

    t.index("user_id");
    t.index("is_primary");
    t.index("mandate_status");
  });

  // ensure a user cannot have two accounts with the same fallback position
  await knex.raw(`
    CREATE UNIQUE INDEX idx_bank_accounts_fallback_order
      ON bank_accounts (user_id, fallback_order)
      WHERE fallback_order > 0
  `);
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("bank_accounts");
}
