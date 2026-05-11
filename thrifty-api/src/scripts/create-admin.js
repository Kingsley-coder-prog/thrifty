/**
 * Create first admin script.
 *
 * Run this ONCE after deploying to production to create the
 * initial super admin account. Never expose this via a public endpoint.
 *
 * Usage:
 *   node --env-file=.env.production src/scripts/create-admin.js \
 *     --email admin@thrifty.ng \
 *     --name "Ifeanyi Nwankwo" \
 *     --role super_admin
 *
 * The script prompts for password securely (no echo).
 */

import argon2 from "argon2";
import { createInterface } from "readline";
import { db } from "../config/database.js";
import { logger } from "../lib/logger.js";

async function main() {
  // parse CLI args
  const args = process.argv.slice(2);
  const email = getArg(args, "--email");
  const name = getArg(args, "--name");
  const role = getArg(args, "--role") ?? "support";

  if (!email || !name) {
    console.error(
      'Usage: node src/scripts/create-admin.js --email <email> --name "<name>" --role <role>',
    );
    process.exit(1);
  }

  const validRoles = [
    "super_admin",
    "operations",
    "finance",
    "compliance",
    "support",
  ];
  if (!validRoles.includes(role)) {
    console.error(`Invalid role. Must be one of: ${validRoles.join(", ")}`);
    process.exit(1);
  }

  // check if admin already exists
  const existing = await db("admins").where({ email }).first();
  if (existing) {
    console.error(`Admin with email ${email} already exists.`);
    process.exit(1);
  }

  // prompt for password securely
  const password = await promptPassword(
    "Enter admin password (min 12 chars): ",
  );

  if (password.length < 12) {
    console.error("Password must be at least 12 characters.");
    process.exit(1);
  }

  const confirmPassword = await promptPassword("Confirm password: ");

  if (password !== confirmPassword) {
    console.error("Passwords do not match.");
    process.exit(1);
  }

  // hash password
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });

  // insert admin
  const [admin] = await db("admins")
    .insert({
      email,
      password_hash: passwordHash,
      full_name: name,
      role,
      is_active: true,
    })
    .returning(["id", "email", "full_name", "role"]);

  console.log("\n✅ Admin created successfully:");
  console.log(`   ID:    ${admin.id}`);
  console.log(`   Email: ${admin.email}`);
  console.log(`   Name:  ${admin.full_name}`);
  console.log(`   Role:  ${admin.role}`);
  console.log("\nYou can now log in via POST /admin/auth/login");

  await db.destroy();
  process.exit(0);
}

function getArg(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
}

function promptPassword(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    process.stdout.write(prompt);

    // disable echo for password input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    let password = "";

    process.stdin.on("data", (chunk) => {
      const char = chunk.toString();

      if (char === "\r" || char === "\n") {
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdout.write("\n");
        rl.close();
        resolve(password);
      } else if (char === "\u0003") {
        // Ctrl+C
        process.exit();
      } else if (char === "\u007f") {
        // backspace
        password = password.slice(0, -1);
      } else {
        password += char;
      }
    });
  });
}

main().catch((err) => {
  logger.error({ err }, "Failed to create admin");
  process.exit(1);
});
