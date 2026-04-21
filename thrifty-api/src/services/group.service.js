import { db } from "../config/database.js";
import { generateTurnOrder } from "../lib/turnOrder.js";
import { cycleService } from "./cycle.service.js";
import { AppError, ErrorCode } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const groupService = {
  // ── Get all active tiers ───────────────────────────────────────
  async getTiers() {
    return db("tiers")
      .where({ is_active: true })
      .orderBy("monthly_amount", "asc")
      .select(
        "id",
        "name",
        "description",
        "monthly_amount",
        "total_payout",
        "currency",
        "platform_fee_pct",
        "min_kyc_level",
      );
  },

  // ── Browse open groups ─────────────────────────────────────────
  async getOpenGroups({ tierId } = {}) {
    const query = db("thrift_groups")
      .join("tiers", "tiers.id", "thrift_groups.tier_id")
      .where({ "thrift_groups.status": "forming" })
      .select(
        "thrift_groups.id",
        "thrift_groups.name",
        "thrift_groups.member_count",
        "thrift_groups.max_members",
        "thrift_groups.invite_code",
        "thrift_groups.created_at",
        "tiers.id as tier_id",
        "tiers.name as tier_name",
        "tiers.monthly_amount",
        "tiers.total_payout",
        "tiers.currency",
      )
      .orderBy("thrift_groups.created_at", "asc");

    if (tierId) {
      query.where({ "thrift_groups.tier_id": tierId });
    }

    return query;
  },

  // ── Get group detail ───────────────────────────────────────────
  async getGroupById(groupId, requestingUserId = null) {
    const group = await db("thrift_groups")
      .join("tiers", "tiers.id", "thrift_groups.tier_id")
      .where({ "thrift_groups.id": groupId })
      .select(
        "thrift_groups.*",
        "tiers.name as tier_name",
        "tiers.monthly_amount",
        "tiers.total_payout",
        "tiers.currency",
        "tiers.platform_fee_pct",
      )
      .first();

    if (!group) {
      throw new AppError(ErrorCode.GROUP_NOT_FOUND, 404);
    }

    // get members with their turn positions
    const members = await db("group_members")
      .join("users", "users.id", "group_members.user_id")
      .where({ "group_members.group_id": groupId })
      .whereNot({ "group_members.status": "left" })
      .select(
        "group_members.id",
        "group_members.turn_position",
        "group_members.has_collected",
        "group_members.collected_cycle",
        "group_members.status",
        "group_members.joined_at",
        "users.id as user_id",
        "users.full_name",
      )
      .orderBy("group_members.turn_position", "asc");

    // get current cycle if group is active
    let currentCycle = null;
    if (group.status === "active") {
      currentCycle = await db("cycles")
        .where({ group_id: groupId, status: "collecting" })
        .orWhere({ group_id: groupId, status: "pending_payout" })
        .orderBy("cycle_number", "desc")
        .first();
    }

    // check if requesting user is a member
    const isMember = requestingUserId
      ? members.some((m) => m.user_id === requestingUserId)
      : false;

    return {
      id: group.id,
      name: group.name,
      status: group.status,
      currentCycle: group.current_cycle,
      memberCount: group.member_count,
      maxMembers: group.max_members,
      inviteCode: isMember ? group.invite_code : null,
      startDate: group.start_date,
      tier: {
        id: group.tier_id,
        name: group.tier_name,
        monthlyAmount: group.monthly_amount,
        totalPayout: group.total_payout,
        currency: group.currency,
        platformFeePct: group.platform_fee_pct,
      },
      members: members.map((m) => ({
        id: m.id,
        userId: m.user_id,
        turnPosition: m.turn_position,
        hasCollected: m.has_collected,
        collectedCycle: m.collected_cycle,
        status: m.status,
        joinedAt: m.joined_at,
      })),
      currentCycleDetail: currentCycle
        ? {
            id: currentCycle.id,
            cycleNumber: currentCycle.cycle_number,
            status: currentCycle.status,
            debitWindowStart: currentCycle.debit_window_start,
            debitWindowEnd: currentCycle.debit_window_end,
            expectedTotal: currentCycle.expected_total,
            collectedTotal: currentCycle.collected_total,
          }
        : null,
    };
  },

  // ── Get user's groups ──────────────────────────────────────────
  async getUserGroups(userId) {
    const memberships = await db("group_members")
      .join("thrift_groups", "thrift_groups.id", "group_members.group_id")
      .join("tiers", "tiers.id", "thrift_groups.tier_id")
      .where({ "group_members.user_id": userId })
      .whereNot({ "group_members.status": "left" })
      .select(
        "thrift_groups.id",
        "thrift_groups.name",
        "thrift_groups.status",
        "thrift_groups.current_cycle",
        "thrift_groups.member_count",
        "tiers.name as tier_name",
        "tiers.monthly_amount",
        "tiers.total_payout",
        "tiers.currency",
        "group_members.turn_position",
        "group_members.has_collected",
        "group_members.status as member_status",
        "group_members.joined_at",
      )
      .orderBy("group_members.joined_at", "desc");

    return memberships.map((m) => ({
      id: m.id,
      name: m.name,
      status: m.status,
      currentCycle: m.current_cycle,
      memberCount: m.member_count,
      tier: {
        name: m.tier_name,
        monthlyAmount: m.monthly_amount,
        totalPayout: m.total_payout,
        currency: m.currency,
      },
      myTurnPosition: m.turn_position,
      hasCollected: m.has_collected,
      memberStatus: m.member_status,
      joinedAt: m.joined_at,
    }));
  },

  // ── Join a group ───────────────────────────────────────────────
  async joinGroup({ userId, tierId }) {
    return db.transaction(async (trx) => {
      // 1. verify tier exists and is active
      const tier = await trx("tiers")
        .where({ id: tierId, is_active: true })
        .first();

      if (!tier) {
        throw new AppError("TIER_NOT_FOUND", 404, {
          message: "This tier does not exist or is no longer available.",
        });
      }

      // 2. check user KYC level meets tier requirement
      const user = await trx("users")
        .where({ id: userId })
        .select("kyc_level", "account_status")
        .first();

      if (user.kyc_level < tier.min_kyc_level) {
        throw new AppError(ErrorCode.KYC_LEVEL_INSUFFICIENT, 403, {
          required: tier.min_kyc_level,
          current: user.kyc_level,
        });
      }

      // 3. check user has at least one active bank account
      const bankAccount = await trx("bank_accounts")
        .where({ user_id: userId, is_primary: true })
        .first();

      if (!bankAccount) {
        throw new AppError("NO_BANK_ACCOUNT", 422, {
          message: "You must add a bank account before joining a group.",
        });
      }

      // 4. check user isn't already in an active/forming group for this tier
      const existing = await trx("group_members")
        .join("thrift_groups", "thrift_groups.id", "group_members.group_id")
        .where({
          "group_members.user_id": userId,
          "thrift_groups.tier_id": tierId,
          "group_members.status": "active",
        })
        .whereIn("thrift_groups.status", ["forming", "active"])
        .first();

      if (existing) {
        throw new AppError(ErrorCode.ALREADY_IN_TIER_GROUP, 409, {
          message: "You are already in a group for this tier.",
        });
      }

      // 5. find an open group for this tier — lock the row to prevent
      //    two users joining the last slot simultaneously
      let group = await trx("thrift_groups")
        .where({ tier_id: tierId, status: "forming" })
        .whereRaw("member_count < max_members")
        .orderBy("created_at", "asc")
        .forUpdate()
        .first();

      // 6. no open group exists — create one
      if (!group) {
        const inviteCode = generateInviteCode();
        [group] = await trx("thrift_groups")
          .insert({
            tier_id: tierId,
            created_by: userId,
            status: "forming",
            member_count: 0,
            max_members: 7,
            invite_code: inviteCode,
            is_private: false,
          })
          .returning("*");

        logger.info({ groupId: group.id, tierId }, "New group created");
      }

      const newMemberCount = group.member_count + 1;

      // 7. insert membership
      const [member] = await trx("group_members")
        .insert({
          group_id: group.id,
          user_id: userId,
          turn_position: null, // assigned at activation
          status: "active",
        })
        .returning("*");

      // 8. increment member count
      await trx("thrift_groups")
        .where({ id: group.id })
        .update({ member_count: newMemberCount });

      // 9. if this is the 7th member, activate the group
      if (newMemberCount === group.max_members) {
        await activateGroup(trx, group, tier);
      }

      logger.info(
        { userId, groupId: group.id, memberCount: newMemberCount },
        "User joined group",
      );

      return {
        groupId: group.id,
        memberId: member.id,
        memberCount: newMemberCount,
        isGroupActive: newMemberCount === group.max_members,
        tier: {
          name: tier.name,
          monthlyAmount: tier.monthly_amount,
          totalPayout: tier.total_payout,
        },
      };
    });
  },
};

// ── Private helpers ───────────────────────────────────────────────

/**
 * Activate a group when the 7th member joins.
 *
 * 1. Fetch all 7 members
 * 2. Shuffle their IDs cryptographically to determine turn order
 * 3. Write turn_position (1–7) to each group_member row
 * 4. Update group status to 'active'
 * 5. Create cycle 1 with the first recipient
 * 6. Create contribution stubs for all 7 members
 */
async function activateGroup(trx, group, tier) {
  // get all members in join order
  const members = await trx("group_members")
    .where({ group_id: group.id, status: "active" })
    .orderBy("joined_at", "asc")
    .select("id");

  const memberIds = members.map((m) => m.id);

  // cryptographic shuffle determines payout order
  const shuffled = generateTurnOrder(memberIds);

  // write immutable turn positions
  for (let i = 0; i < shuffled.length; i++) {
    await trx("group_members")
      .where({ id: shuffled[i] })
      .update({ turn_position: i + 1 });
  }

  // activate the group
  await trx("thrift_groups").where({ id: group.id }).update({
    status: "active",
    current_cycle: 1,
    start_date: new Date(),
  });

  // first recipient is the member with turn_position = 1
  const firstRecipientId = shuffled[0];

  // create cycle 1
  const cycle = await cycleService.createCycle(
    trx,
    group.id,
    1,
    firstRecipientId,
    tier.total_payout,
  );

  // create contribution stubs for all members
  await cycleService.createContributionStubs(
    trx,
    cycle.id,
    memberIds,
    tier.monthly_amount,
  );

  logger.info(
    {
      groupId: group.id,
      cycleId: cycle.id,
      firstRecipientId,
    },
    "Group activated — cycle 1 started",
  );
}

function generateInviteCode() {
  // 8-character alphanumeric code
  return (
    Math.random().toString(36).substring(2, 6).toUpperCase() +
    Math.random().toString(36).substring(2, 6).toUpperCase()
  );
}
