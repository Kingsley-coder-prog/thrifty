import knex from "knex";
import { env } from "./env.js";
import { logger } from "../lib/logger.js";

export const db = knex({
  client: "pg",
  connection: {
    connectionString: env.DATABASE_URL,
    ssl:
      env.NODE_ENV === "production"
        ? { rejectUnauthorized: true }
        : env.NODE_ENV === "staging"
        ? { rejectUnauthorized: false }
        : false,
  },
  pool: {
    min: 2,
    max: env.NODE_ENV === "production" ? 20 : 5,

    // called when a connection is first created
    afterCreate(conn, done) {
      // set timezone to UTC for every connection
      conn.query('SET timezone = "UTC"', (err) => done(err, conn));
    },
  },
  // log slow queries in development
  ...(env.NODE_ENV === "development" && {
    debug: false,
    log: {
      warn(msg) {
        logger.warn({ msg }, "knex warn");
      },
      deprecate(msg) {
        logger.warn({ msg }, "knex deprecate");
      },
      debug(msg) {
        logger.debug({ msg }, "knex debug");
      },
    },
  }),
});

// verify the connection is alive on startup
export async function connectDatabase() {
  try {
    await db.raw("SELECT 1");
    logger.info("PostgreSQL connected");
  } catch (err) {
    logger.error({ err }, "PostgreSQL connection failed");
    process.exit(1);
  }
}
