/**
 * Migration 012 — disputes table
 *
 * Tracks user-raised complaints about contributions or payouts.
 * Each dispute is assigned to an admin for resolution.
 *
 * SLA target: 72 hours from creation to resolution.
 * The admin console flags disputes older than 72 hours as past SLA.
 */

export async function up(knex) {
  await knex.schema.createTable("disputes", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));

    t.uuid("raised_by").notNullable().references("id").inTable("users");

    // a dispute is linked to either a contribution OR a payout, not both
    t.uuid("related_contribution_id").references("id").inTable("contributions");

    t.uuid("related_payout_id").references("id").inTable("payouts");

    t.enu("category", [
      "wrong_amount_debited",
      "debit_not_authorised",
      "payout_not_received",
      "payout_wrong_amount",
      "account_issue",
      "other",
    ]).notNullable();

    t.text("description").notNullable();

    t.enu("status", ["open", "under_review", "resolved", "dismissed"])
      .notNullable()
      .defaultTo("open");

    t.uuid("assigned_admin_id");
    t.text("resolution_notes");
    t.timestamp("resolved_at", { useTz: true });

    t.timestamps(true, true);

    t.index("raised_by");
    t.index("status");
    t.index("created_at");
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("disputes");
}
