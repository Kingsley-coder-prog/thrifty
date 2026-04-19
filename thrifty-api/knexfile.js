import { createRequire } from "module";

const require = createRequire(import.meta.url);

/** @type {import('knex').Knex.Config} */
const base = {
  client: "pg",
  migrations: {
    directory: "./src/db/migrations",
    extension: "js",
    loadExtensions: [".js"],
  },
  seeds: {
    directory: "./src/db/seeds",
    loadExtensions: [".js"],
  },
};

export default {
  development: {
    ...base,
    connection: process.env.DATABASE_URL,
  },
  staging: {
    ...base,
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    },
    pool: { min: 2, max: 10 },
  },
  production: {
    ...base,
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: true },
    },
    pool: { min: 2, max: 20 },
  },
};
