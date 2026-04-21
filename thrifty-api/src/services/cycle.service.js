import { db } from "../config/database.js";
import { logger } from "../lib/logger.js";

export const cycleService = {
  /**
   * Create cycle N for a group.
   *
   * Called when:
   *   - A group activates (creates cycle 1)
   *   - A payout completes and it wasn't the last cycle (creates next cycle)
   *
   * Debit window: 25th of current month → 5th of following month.
   * If today is past the 25th we start the window this month,
   * otherwise we schedule it for next month's 25th.
   *
   * @param {object} trx      — knex transaction object
   * @param {string} groupId
   * @param {number} cycleNumber — 1 through 7
   * @param {string} recipientMemberId — group_members.id of the recipient
   * @param {number} expectedTotal — tier.monthly_amount * 7
   */
  async createCycle(
    trx,
    groupId,
    cycleNumber,
    recipientMemberId,
    expectedTotal,
  ) {
    const { windowStart, windowEnd } = getDebitWindow(cycleNumber);

    const [cycle] = await trx("cycles")
      .insert({
        group_id: groupId,
        cycle_number: cycleNumber,
        recipient_member_id: recipientMemberId,
        status: "collecting",
        debit_window_start: windowStart,
        debit_window_end: windowEnd,
        expected_total: expectedTotal,
        collected_total: 0,
      })
      .returning("*");

    logger.info(
      { groupId, cycleNumber, windowStart, windowEnd },
      "Cycle created",
    );

    return cycle;
  },

  /**
   * Create contribution stubs for every member in a cycle.
   * One row per member — these get updated as debits are processed.
   */
  async createContributionStubs(trx, cycleId, memberIds, amount) {
    const stubs = memberIds.map((memberId) => ({
      cycle_id: cycleId,
      member_id: memberId,
      amount,
      status: "pending",
    }));

    await trx("contributions").insert(stubs);

    logger.info(
      { cycleId, count: memberIds.length },
      "Contribution stubs created",
    );
  },

  /**
   * Update cycle status.
   */
  async setCycleStatus(cycleId, status) {
    await db("cycles").where({ id: cycleId }).update({
      status,
      updated_at: new Date(),
    });
  },

  /**
   * After a payout completes, advance the group to the next cycle.
   * If cycle 7 just completed, mark the group as completed.
   */
  async advanceCycle(completedCycleId) {
    const cycle = await db("cycles").where({ id: completedCycleId }).first();
    const group = await db("thrift_groups")
      .where({ id: cycle.group_id })
      .first();

    if (cycle.cycle_number === 7) {
      // all 7 cycles done — group is complete
      await db("thrift_groups")
        .where({ id: cycle.group_id })
        .update({ status: "completed", current_cycle: 7 });

      logger.info({ groupId: cycle.group_id }, "Group completed all 7 cycles");
      return null;
    }

    // find the recipient for the next cycle based on turn_position
    const nextCycleNumber = cycle.cycle_number + 1;
    const nextRecipient = await db("group_members")
      .where({
        group_id: cycle.group_id,
        turn_position: nextCycleNumber,
        status: "active",
      })
      .first();

    if (!nextRecipient) {
      logger.error(
        { groupId: cycle.group_id, nextCycleNumber },
        "No recipient found for next cycle",
      );
      return null;
    }

    // get all active member IDs for contribution stubs
    const members = await db("group_members")
      .where({ group_id: cycle.group_id, status: "active" })
      .select("id");

    const tier = await db("thrift_groups")
      .join("tiers", "tiers.id", "thrift_groups.tier_id")
      .where({ "thrift_groups.id": cycle.group_id })
      .select("tiers.monthly_amount", "tiers.total_payout")
      .first();

    const nextCycle = await db.transaction(async (trx) => {
      const newCycle = await cycleService.createCycle(
        trx,
        cycle.group_id,
        nextCycleNumber,
        nextRecipient.id,
        tier.total_payout,
      );

      await cycleService.createContributionStubs(
        trx,
        newCycle.id,
        members.map((m) => m.id),
        tier.monthly_amount,
      );

      await trx("thrift_groups")
        .where({ id: cycle.group_id })
        .update({ current_cycle: nextCycleNumber });

      return newCycle;
    });

    logger.info({ groupId: cycle.group_id, nextCycleNumber }, "Cycle advanced");

    return nextCycle;
  },
};

// ── Private helpers ───────────────────────────────────────────────

/**
 * Calculate the debit window for a cycle.
 *
 * Window opens:  25th of the month the cycle starts
 * Window closes: 5th of the following month
 *
 * For cycle 1 (first cycle after group activation):
 *   - If today is before the 25th → window starts this month's 25th
 *   - If today is on/after the 25th → window starts next month's 25th
 *
 * For subsequent cycles: each window starts one month after the previous.
 *
 * @param {number} cycleNumber — 1-indexed
 * @returns {{ windowStart: Date, windowEnd: Date }}
 */
function getDebitWindow(cycleNumber) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed

  // for cycle 1, determine which month to start in
  let startMonth = month;
  if (today.getDate() >= 25) {
    startMonth = month + 1; // already past the 25th, start next month
  }

  // add cycleNumber - 1 months offset for subsequent cycles
  const windowMonth = startMonth + (cycleNumber - 1);

  // handle year rollover
  const windowYear = year + Math.floor(windowMonth / 12);
  const adjustedMonth = windowMonth % 12;

  const windowStart = new Date(windowYear, adjustedMonth, 25);

  // end is the 5th of the following month
  const endMonth = adjustedMonth + 1;
  const endYear = endMonth > 11 ? windowYear + 1 : windowYear;
  const windowEnd = new Date(endYear, endMonth % 12, 5);

  return { windowStart, windowEnd };
}
