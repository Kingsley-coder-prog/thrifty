/**
 * Migration 013 — fraud_flags table
 *
 * Records suspicious activity detected by the fraud engine.
 * A user with an open CRITICAL flag cannot receive a payout (payout guard 4).
 * A user with multiple defaults is automatically escalated to CRITICAL.
 *
 * risk_score: 0–100, higher = more suspicious
 * flag_type determines severity and required action
 */

export async function up(knex) {
  await knex.schema.createTable("fraud_flags", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));

    t.uuid("user_id").notNullable().references("id").inTable("users");

    t.enu("flag_type", [
      "payment_default", // failed to pay in a cycle
      "multiple_defaults", // defaulted in more than one group
      "bvn_duplication", // BVN linked to another account
      "device_duplication", // same device used for multiple accounts
      "velocity_breach", // joined too many groups too quickly
      "suspicious_login", // login from new country or device
      "payout_pattern", // joins, collects, leaves repeatedly
      "manual_review", // flagged by admin manually
    ]).notNullable();

    t.smallint("risk_score").notNullable().defaultTo(0);
    t.string("trigger_event", 100);
    t.jsonb("details");

    t.enu("status", ["open", "under_review", "resolved", "dismissed"])
      .notNullable()
      .defaultTo("open");

    t.uuid("reviewed_by");
    t.timestamp("resolved_at", { useTz: true });

    t.timestamps(true, true);

    t.index("user_id");
    t.index("status");
    t.index("flag_type");
    t.index("created_at");
  });

  await knex.raw(`
    ALTER TABLE fraud_flags
      ADD CONSTRAINT chk_fraud_flags_risk_score
        CHECK (risk_score BETWEEN 0 AND 100)
  `);
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("fraud_flags");
}
