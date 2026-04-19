/**
 * Migration 005 — tiers table
 *
 * Defines the contribution tiers — the different amounts groups can be formed around.
 * Minimum is ₦25,000/month as per the product specification.
 *
 * total_payout = monthly_amount * 7 (always, since groups always have 7 members)
 * platform_fee_pct is the percentage Thrifty takes from each payout
 * min_kyc_level determines the minimum KYC a user must have to join this tier
 *
 * Tiers are managed by admins — users cannot create tiers.
 * Deactivating a tier (is_active = false) prevents new groups being formed
 * at that tier but does not affect existing active groups.
 */

export async function up(knex) {
  await knex.schema.createTable("tiers", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));

    t.string("name", 60).notNullable(); // e.g. "Bronze", "Silver", "Gold"
    t.string("description", 255);

    t.decimal("monthly_amount", 12, 2).notNullable();
    t.decimal("total_payout", 12, 2).notNullable();
    t.string("currency", 3).notNullable().defaultTo("NGN");

    t.decimal("platform_fee_pct", 5, 2).notNullable().defaultTo(1.0);

    t.smallint("min_kyc_level").notNullable().defaultTo(1);
    t.boolean("is_active").notNullable().defaultTo(true);

    t.timestamps(true, true);

    t.index("is_active");
  });

  // total_payout must always equal monthly_amount * 7
  await knex.raw(`
    ALTER TABLE tiers
      ADD CONSTRAINT chk_tiers_total_payout
        CHECK (total_payout = monthly_amount * 7),
      ADD CONSTRAINT chk_tiers_monthly_amount
        CHECK (monthly_amount >= 25000),
      ADD CONSTRAINT chk_tiers_platform_fee
        CHECK (platform_fee_pct >= 0 AND platform_fee_pct <= 10)
  `);
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("tiers");
}
