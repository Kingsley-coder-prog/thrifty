/**
 * Development seed — creates the base tiers needed to run the application.
 * Safe to run multiple times (checks before inserting).
 *
 * Never runs in production — knex seed:run is not part of the production deploy.
 */

export async function seed(knex) {
  // only seed in development
  if (process.env.NODE_ENV === "production") {
    console.log("Skipping seed in production");
    return;
  }

  // ── Tiers ──────────────────────────────────────────────────────
  const existingTiers = await knex("tiers").select("id");
  if (existingTiers.length === 0) {
    await knex("tiers").insert([
      {
        name: "Bronze",
        description: "Entry level — ₦25,000 monthly contribution",
        monthly_amount: 25000.0,
        total_payout: 175000.0,
        currency: "NGN",
        platform_fee_pct: 1.0,
        min_kyc_level: 1,
        is_active: true,
      },
      {
        name: "Silver",
        description: "Mid tier — ₦50,000 monthly contribution",
        monthly_amount: 50000.0,
        total_payout: 350000.0,
        currency: "NGN",
        platform_fee_pct: 1.0,
        min_kyc_level: 1,
        is_active: true,
      },
      {
        name: "Gold",
        description: "High tier — ₦100,000 monthly contribution",
        monthly_amount: 100000.0,
        total_payout: 700000.0,
        currency: "NGN",
        platform_fee_pct: 0.75,
        min_kyc_level: 2,
        is_active: true,
      },
      {
        name: "Platinum",
        description: "Premium tier — ₦250,000 monthly contribution",
        monthly_amount: 250000.0,
        total_payout: 1750000.0,
        currency: "NGN",
        platform_fee_pct: 0.5,
        min_kyc_level: 2,
        is_active: true,
      },
    ]);

    console.log("✓ Tiers seeded");
  } else {
    console.log("— Tiers already exist, skipping");
  }
}
