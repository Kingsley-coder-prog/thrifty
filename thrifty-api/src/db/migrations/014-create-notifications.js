/**
 * Migration 014 — notifications table
 *
 * Records every notification sent to a user.
 * Used for delivery tracking, retry logic, and the in-app notification centre.
 *
 * channel determines where it was sent:
 *   'sms'   — Termii
 *   'push'  — Firebase Cloud Messaging
 *   'email' — (future)
 *
 * related_entity_id + related_entity_type link the notification back to
 * whatever triggered it (a contribution, payout, group activation etc.)
 */

export async function up(knex) {
  await knex.schema.createTable("notifications", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));

    t.uuid("user_id").notNullable().references("id").inTable("users");

    t.enu("channel", ["sms", "push", "email"]).notNullable();

    t.string("type", 60).notNullable(); // e.g. DEBIT_INITIATED, PAYOUT_COMPLETED
    t.text("content").notNullable(); // the actual message sent

    t.enu("status", ["pending", "sent", "delivered", "failed"])
      .notNullable()
      .defaultTo("pending");

    t.string("provider_ref", 100); // reference from Termii / FCM
    t.text("failure_reason");
    t.smallint("attempt_count").notNullable().defaultTo(0);

    // what triggered this notification
    t.uuid("related_entity_id");
    t.string("related_entity_type", 40);

    t.timestamp("sent_at", { useTz: true });
    t.timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    t.index("user_id");
    t.index("status");
    t.index("created_at");
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("notifications");
}
