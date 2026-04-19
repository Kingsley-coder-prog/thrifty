/**
 * Migration 001 — PostgreSQL extensions
 *
 * uuid-ossp: generates UUID v4 values as default column values
 * pgcrypto:  provides gen_random_bytes() for additional crypto operations
 *
 * Must run before any other migration since tables depend on uuid_generate_v4()
 */

export async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
}

export async function down(knex) {
  await knex.raw('DROP EXTENSION IF EXISTS "pgcrypto"');
  await knex.raw('DROP EXTENSION IF EXISTS "uuid-ossp"');
}
