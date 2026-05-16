<template>
  <div class="space-y-6">
    <!-- Welcome header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-foreground">
          Good {{ timeOfDay }}, {{ firstName }} 👋
        </h2>
        <p class="text-muted-foreground text-sm mt-1">
          Here's what's happening with your savings
        </p>
      </div>
    </div>

    <!-- Loading skeleton -->
    <template v-if="loading">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton v-for="i in 3" :key="i" class="h-28 rounded-xl" />
      </div>
      <Skeleton class="h-64 rounded-xl" />
    </template>

    <template v-else>
      <!-- Quick stats -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Active Groups"
          :value="activeGroups.length"
          icon="Users"
          color="primary"
        />
        <StatCard
          label="Next Debit"
          :value="nextDebitDate"
          icon="Calendar"
          color="amber"
        />
        <StatCard
          label="Total Saved"
          :value="formatNaira(totalSaved)"
          icon="TrendingUp"
          color="green"
        />
      </div>

      <!-- No groups state -->
      <div
        v-if="myGroups.length === 0"
        class="bg-card rounded-xl border border-border p-10 text-center"
      >
        <div
          class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <Users class="w-8 h-8 text-primary" />
        </div>
        <h3 class="text-lg font-semibold text-foreground mb-2">
          You're not in any group yet
        </h3>
        <p class="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
          Join a savings group to start your cooperative savings journey. Groups
          of 7 save together and take turns collecting.
        </p>
        <Button
          @click="router.push('/groups')"
          class="bg-primary hover:bg-primary/90"
        >
          Browse Groups
        </Button>
      </div>

      <!-- Active groups -->
      <template v-else>
        <div class="space-y-4">
          <h3 class="text-base font-semibold text-foreground">Your Groups</h3>
          <GroupCard
            v-for="group in myGroups"
            :key="group.id"
            :group="group"
            @click="router.push(`/groups/${group.id}`)"
          />
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { Users } from "lucide-vue-next";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";
import { useGroupsStore } from "@/stores/groups";
import StatCard from "@/components/dashboard/StatCard.vue";
import GroupCard from "@/components/dashboard/GroupCard.vue";
import { useCurrency } from "@/composables/useCurrency";
const { formatNaira } = useCurrency();

const router = useRouter();
const authStore = useAuthStore();
const groupsStore = useGroupsStore();

const loading = ref(true);
const myGroups = computed(() => groupsStore.myGroups);

const firstName = computed(() => {
  const name = authStore.user?.fullName ?? "there";
  return name.split(" ")[0];
});

const timeOfDay = computed(() => {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
});

const activeGroups = computed(() =>
  myGroups.value.filter((g) => g.status === "active" || g.status === "forming")
);

const nextDebitDate = computed(() => {
  const active = myGroups.value.find((g) => g.status === "active");
  if (!active) return "—";
  const date = new Date();
  date.setDate(25);
  if (date < new Date()) date.setMonth(date.getMonth() + 1);
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
});

const totalSaved = computed(() => {
  return myGroups.value.reduce((sum, g) => {
    if (g.status === "completed" || g.hasCollected) {
      return sum + parseFloat(g.tier?.totalPayout ?? 0);
    }
    return sum;
  }, 0);
});

onMounted(async () => {
  try {
    await groupsStore.fetchMyGroups();
  } finally {
    loading.value = false;
  }
});
</script>