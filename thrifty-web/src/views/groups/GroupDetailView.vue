<template>
  <div class="space-y-6 max-w-2xl">
    <!-- Back button -->
    <button
      @click="router.back()"
      class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft class="w-4 h-4" />
      Back
    </button>

    <!-- Loading -->
    <template v-if="loading">
      <Skeleton class="h-40 rounded-xl" />
      <Skeleton class="h-64 rounded-xl" />
    </template>

    <template v-else-if="group">
      <!-- Group header card -->
      <div class="bg-white rounded-xl border border-border p-6 space-y-5">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <Badge :class="tierBadgeClass">{{ group.tierName }}</Badge>
              <Badge :class="statusBadgeClass">{{ statusLabel }}</Badge>
            </div>
            <div class="flex items-baseline gap-1">
              <span class="text-3xl font-bold text-foreground">
                {{ formatNaira(group.monthlyAmount) }}
              </span>
              <span class="text-sm text-muted-foreground">/month</span>
            </div>
            <p class="text-sm text-muted-foreground">
              Total payout:
              <span class="font-semibold text-foreground">
                {{ formatNaira(group.totalPayout) }}
              </span>
            </p>
          </div>

          <!-- Cycle indicator -->
          <div class="text-center shrink-0">
            <div
              class="w-16 h-16 rounded-full border-4 border-primary/20 flex items-center justify-center"
            >
              <div>
                <p class="text-lg font-bold text-foreground leading-none">
                  {{ group.currentCycle }}
                </p>
                <p class="text-xs text-muted-foreground">of 7</p>
              </div>
            </div>
            <p class="text-xs text-muted-foreground mt-1">Cycle</p>
          </div>
        </div>

        <Separator />

        <!-- Invite code -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-muted-foreground mb-1">Invite Code</p>
            <p
              class="text-lg font-mono font-bold text-foreground tracking-widest"
            >
              {{ group.inviteCode }}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            class="gap-2"
            @click="copyInviteCode"
          >
            <Check v-if="copied" class="w-4 h-4 text-primary" />
            <Copy v-else class="w-4 h-4" />
            {{ copied ? "Copied!" : "Copy" }}
          </Button>
        </div>

        <!-- Progress bar -->
        <div>
          <div
            class="flex items-center justify-between text-xs text-muted-foreground mb-2"
          >
            <span>{{ group.memberCount }}/7 members</span>
            <span v-if="group.status === 'active'">
              Debit window: 25th – 5th
            </span>
            <span v-else>Waiting for {{ 7 - group.memberCount }} more</span>
          </div>
          <div class="h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              :class="
                group.status === 'forming' ? 'bg-amber-400' : 'bg-primary'
              "
              :style="{ width: `${(group.memberCount / 7) * 100}%` }"
            />
          </div>
        </div>
      </div>

      <!-- Your position card (if turn assigned) -->
      <div
        v-if="myMember?.turnPosition"
        class="bg-primary/5 border border-primary/20 rounded-xl p-5 flex items-center gap-4"
      >
        <div
          class="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0"
        >
          <span class="text-2xl font-bold text-primary">{{
            myMember.turnPosition
          }}</span>
        </div>
        <div>
          <p class="font-semibold text-foreground">Your turn position</p>
          <p class="text-sm text-muted-foreground mt-0.5">
            You collect in cycle {{ myMember.turnPosition }}
            <span v-if="estimatedCollectionDate">
              — around {{ estimatedCollectionDate }}
            </span>
          </p>
          <Badge
            v-if="myMember.hasCollected"
            class="mt-2 bg-green-100 text-green-700"
          >
            Collected ✓
          </Badge>
        </div>
      </div>

      <!-- Members list -->
      <div class="bg-white rounded-xl border border-border p-6 space-y-4">
        <h3 class="font-semibold text-foreground">Members</h3>

        <div class="space-y-3">
          <!-- Filled slots -->
          <div
            v-for="member in group.members"
            :key="member.id"
            class="flex items-center gap-3 p-3 rounded-lg"
            :class="
              member.isCurrentUser
                ? 'bg-primary/5 border border-primary/20'
                : 'bg-zinc-50'
            "
          >
            <!-- Avatar -->
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold"
              :class="
                member.isCurrentUser
                  ? 'bg-primary/20 text-primary'
                  : 'bg-zinc-200 text-zinc-600'
              "
            >
              {{ member.initials }}
            </div>

            <!-- Name -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-foreground truncate">
                {{ member.isCurrentUser ? "You" : member.maskedName }}
              </p>
              <p class="text-xs text-muted-foreground">
                Joined {{ member.joinedAt }}
              </p>
            </div>

            <!-- Turn position -->
            <div class="text-right shrink-0">
              <div
                v-if="member.turnPosition"
                class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                :class="
                  member.hasCollected
                    ? 'bg-green-100 text-green-700'
                    : 'bg-zinc-100 text-zinc-600'
                "
              >
                {{ member.turnPosition }}
              </div>
              <div
                v-else
                class="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center"
              >
                <span class="text-xs text-zinc-400">—</span>
              </div>
              <p class="text-xs text-muted-foreground mt-0.5">
                {{ member.hasCollected ? "Collected" : "Turn" }}
              </p>
            </div>
          </div>

          <!-- Empty slots -->
          <div
            v-for="i in emptySlots"
            :key="`empty-${i}`"
            class="flex items-center gap-3 p-3 rounded-lg border border-dashed border-border"
          >
            <div
              class="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center shrink-0"
            >
              <UserPlus class="w-4 h-4 text-zinc-400" />
            </div>
            <p class="text-sm text-muted-foreground">Waiting for member...</p>
          </div>
        </div>
      </div>

      <!-- Leave group (only if forming) -->
      <div v-if="group.status === 'forming'" class="flex justify-end">
        <Button
          variant="outline"
          class="border-destructive/30 text-destructive hover:bg-destructive/10"
          @click="handleLeave"
        >
          Leave Group
        </Button>
      </div>
    </template>

    <!-- Error state -->
    <div v-else class="text-center py-16">
      <p class="text-muted-foreground">Group not found.</p>
      <Button variant="link" @click="router.push('/groups')">
        Back to Groups
      </Button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Copy, Check, UserPlus } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { groupsApi } from "@/api/groups";
import { useAuthStore } from "@/stores/auth";
import { useCurrency } from "@/composables/useCurrency";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { formatNaira } = useCurrency();

const loading = ref(true);
const group = ref(null);
const copied = ref(false);

const myMember = computed(() =>
  group.value?.members?.find((m) => m.isCurrentUser)
);

const emptySlots = computed(() => {
  if (!group.value) return 0;
  return 7 - (group.value.memberCount ?? 0);
});

const statusLabel = computed(
  () =>
    ({
      forming: "Forming",
      active: "Active",
      completed: "Completed",
      frozen: "Frozen",
    }[group.value?.status] ?? "")
);

const tierBadgeClass = computed(
  () =>
    ({
      Bronze: "bg-amber-100 text-amber-700 hover:bg-amber-100",
      Silver: "bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
      Gold: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
      Platinum: "bg-purple-100 text-purple-700 hover:bg-purple-100",
    }[group.value?.tierName] ?? "bg-zinc-100 text-zinc-700")
);

const statusBadgeClass = computed(
  () =>
    ({
      forming: "bg-amber-100 text-amber-700 hover:bg-amber-100",
      active: "bg-green-100 text-green-700 hover:bg-green-100",
      completed: "bg-blue-100 text-blue-700 hover:bg-blue-100",
      frozen: "bg-red-100 text-red-700 hover:bg-red-100",
    }[group.value?.status] ?? "bg-zinc-100 text-zinc-700")
);

const estimatedCollectionDate = computed(() => {
  if (!group.value || !myMember.value?.turnPosition) return null;
  const cyclesLeft = myMember.value.turnPosition - group.value.currentCycle;
  if (cyclesLeft <= 0) return null;
  const date = new Date();
  date.setMonth(date.getMonth() + cyclesLeft);
  return date.toLocaleDateString("en-NG", { month: "long", year: "numeric" });
});

async function copyInviteCode() {
  await navigator.clipboard.writeText(group.value.inviteCode);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}

async function handleLeave() {
  if (!confirm("Are you sure you want to leave this group?")) return;
  try {
    await groupsApi.leaveGroup(route.params.id);
    router.push("/groups");
  } catch (err) {
    alert(err.response?.data?.meta?.message ?? "Failed to leave group");
  }
}

function maskName(fullName) {
  if (!fullName) return "Member";
  const parts = fullName.split(" ");
  return parts
    .map((p, i) => (i === 0 ? p : p[0] + "*".repeat(p.length - 1)))
    .join(" ");
}

function getInitials(fullName) {
  if (!fullName) return "?";
  return fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

onMounted(async () => {
  try {
    const { data } = await groupsApi.getGroupById(route.params.id);
    const g = data.group;
    const currentUserId = authStore.user?.id;

    group.value = {
      id: g.id,
      tierName: g.tier?.name,
      monthlyAmount: g.tier?.monthlyAmount,
      totalPayout: g.tier?.totalPayout,
      status: g.status,
      currentCycle: g.currentCycle,
      memberCount: g.memberCount,
      inviteCode: g.inviteCode,
      members: (g.members ?? []).map((m) => ({
        ...m,
        isCurrentUser: m.userId === currentUserId,
        maskedName: "Member",
        initials:
          m.userId === currentUserId
            ? (authStore.user?.fullName ?? "U")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)
            : "M",
        joinedAt: new Date(m.joinedAt).toLocaleDateString("en-NG", {
          day: "numeric",
          month: "short",
        }),
      })),
    };
  } catch {
    group.value = null;
  } finally {
    loading.value = false;
  }
});
</script>