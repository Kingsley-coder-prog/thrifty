<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h2 class="text-2xl font-bold text-foreground">Payments</h2>
      <p class="text-muted-foreground text-sm mt-1">
        Your contribution and payout history
      </p>
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="bg-white rounded-xl border border-border p-5">
        <div class="flex items-center justify-between mb-4">
          <p class="text-sm font-medium text-muted-foreground">
            Total Contributed
          </p>
          <div
            class="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center"
          >
            <ArrowUpRight class="w-4 h-4 text-primary" />
          </div>
        </div>
        <p class="text-2xl font-bold text-foreground">
          {{ formatNaira(totalContributed) }}
        </p>
        <p class="text-xs text-muted-foreground mt-1">
          {{ paidContributions }} payment{{
            paidContributions !== 1 ? "s" : ""
          }}
          made
        </p>
      </div>

      <div class="bg-white rounded-xl border border-border p-5">
        <div class="flex items-center justify-between mb-4">
          <p class="text-sm font-medium text-muted-foreground">
            Total Received
          </p>
          <div
            class="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center"
          >
            <ArrowDownLeft class="w-4 h-4 text-green-600" />
          </div>
        </div>
        <p class="text-2xl font-bold text-foreground">
          {{ formatNaira(totalReceived) }}
        </p>
        <p class="text-xs text-muted-foreground mt-1">
          {{ completedPayouts }} payout{{
            completedPayouts !== 1 ? "s" : ""
          }}
          received
        </p>
      </div>
    </div>

    <!-- Tabs -->
    <Tabs v-model="activeTab" class="w-full">
      <TabsList class="grid w-full grid-cols-2 max-w-xs">
        <TabsTrigger value="contributions">Contributions</TabsTrigger>
        <TabsTrigger value="payouts">Payouts</TabsTrigger>
      </TabsList>

      <!-- Contributions tab -->
      <TabsContent value="contributions" class="mt-6">
        <div v-if="contributionsLoading" class="space-y-3">
          <Skeleton v-for="i in 5" :key="i" class="h-20 rounded-xl" />
        </div>

        <div
          v-else-if="contributions.length === 0"
          class="text-center py-16 bg-white rounded-xl border border-border"
        >
          <div
            class="w-14 h-14 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <Receipt class="w-6 h-6 text-zinc-400" />
          </div>
          <p class="font-medium text-foreground mb-1">No contributions yet</p>
          <p class="text-sm text-muted-foreground">
            Your monthly contributions will appear here once your group is
            active
          </p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="contribution in contributions"
            :key="contribution.id"
            class="bg-white rounded-xl border border-border p-4 flex items-center gap-4"
          >
            <!-- Status icon -->
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              :class="contributionIconBg(contribution.status)"
            >
              <CheckCircle2
                v-if="contribution.status === 'paid'"
                class="w-5 h-5 text-green-600"
              />
              <Clock
                v-else-if="contribution.status === 'pending'"
                class="w-5 h-5 text-amber-600"
              />
              <XCircle v-else class="w-5 h-5 text-destructive" />
            </div>

            <!-- Details -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-foreground">
                Cycle {{ contribution.cycleNumber }} Contribution
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                {{ contribution.date }}
                <span class="mx-1">•</span>
                {{ contribution.tierName }}
              </p>
            </div>

            <!-- Amount + status -->
            <div class="text-right shrink-0">
              <p class="text-sm font-semibold text-foreground">
                {{ formatNaira(contribution.amount) }}
              </p>
              <Badge
                :class="contributionBadgeClass(contribution.status)"
                class="text-xs mt-1"
              >
                {{ contribution.status }}
              </Badge>
            </div>
          </div>
        </div>
      </TabsContent>

      <!-- Payouts tab -->
      <TabsContent value="payouts" class="mt-6">
        <div v-if="payoutsLoading" class="space-y-3">
          <Skeleton v-for="i in 3" :key="i" class="h-20 rounded-xl" />
        </div>

        <div
          v-else-if="payouts.length === 0"
          class="text-center py-16 bg-white rounded-xl border border-border"
        >
          <div
            class="w-14 h-14 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <Banknote class="w-6 h-6 text-zinc-400" />
          </div>
          <p class="font-medium text-foreground mb-1">No payouts yet</p>
          <p class="text-sm text-muted-foreground">
            When it's your turn to collect, your payout will appear here
          </p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="payout in payouts"
            :key="payout.id"
            class="bg-white rounded-xl border border-border p-4 flex items-center gap-4"
          >
            <!-- Icon -->
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              :class="
                payout.status === 'completed' ? 'bg-green-50' : 'bg-amber-50'
              "
            >
              <Banknote
                class="w-5 h-5"
                :class="
                  payout.status === 'completed'
                    ? 'text-green-600'
                    : 'text-amber-600'
                "
              />
            </div>

            <!-- Details -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-foreground">
                Cycle {{ payout.cycleNumber }} Payout
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                {{ payout.date }}
                <span class="mx-1">•</span>
                {{ payout.tierName }}
              </p>
            </div>

            <!-- Amount + status -->
            <div class="text-right shrink-0">
              <p class="text-sm font-semibold text-green-600">
                +{{ formatNaira(payout.netAmount) }}
              </p>
              <Badge
                :class="
                  payout.status === 'completed'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                "
                class="text-xs mt-1"
              >
                {{ payout.status }}
              </Badge>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import {
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  XCircle,
  Receipt,
  Banknote,
} from "lucide-vue-next";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { paymentsApi } from "@/api/payments";
import { useCurrency } from "@/composables/useCurrency";

const { formatNaira } = useCurrency();

const activeTab = ref("contributions");
const contributionsLoading = ref(true);
const payoutsLoading = ref(true);
const contributions = ref([]);
const payouts = ref([]);

const totalContributed = computed(() =>
  contributions.value
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + parseFloat(c.amount ?? 0), 0)
);

const paidContributions = computed(
  () => contributions.value.filter((c) => c.status === "paid").length
);

const totalReceived = computed(() =>
  payouts.value
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + parseFloat(p.netAmount ?? 0), 0)
);

const completedPayouts = computed(
  () => payouts.value.filter((p) => p.status === "completed").length
);

function contributionIconBg(status) {
  return (
    {
      paid: "bg-green-50",
      pending: "bg-amber-50",
      failed: "bg-red-50",
    }[status] ?? "bg-zinc-100"
  );
}

function contributionBadgeClass(status) {
  return (
    {
      paid: "bg-green-100 text-green-700 hover:bg-green-100",
      pending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
      failed: "bg-red-100 text-red-700 hover:bg-red-100",
    }[status] ?? "bg-zinc-100 text-zinc-700"
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

onMounted(async () => {
  const [contribResult, payoutResult] = await Promise.allSettled([
    paymentsApi.getMyContributions(),
    paymentsApi.getMyPayouts(),
  ]);

  if (contribResult.status === "fulfilled") {
    contributions.value = (contribResult.value.data.contributions ?? []).map(
      (c) => ({
        id: c.id,
        status: c.status,
        amount: c.amount,
        cycleNumber: c.cycleNumber ?? c.cycle_number,
        tierName: c.tierName ?? c.tier_name ?? "Bronze",
        date: formatDate(
          c.dueDate ?? c.due_date ?? c.createdAt ?? c.created_at
        ),
      })
    );
  }
  contributionsLoading.value = false;

  if (payoutResult.status === "fulfilled") {
    payouts.value = (payoutResult.value.data.payouts ?? []).map((p) => ({
      id: p.id,
      status: p.status,
      netAmount: p.netAmount ?? p.net_amount,
      cycleNumber: p.cycleNumber ?? p.cycle_number,
      tierName: p.tierName ?? p.tier_name ?? "Bronze",
      date: formatDate(p.completedAt ?? p.completed_at ?? p.initiatedAt),
    }));
  }
  payoutsLoading.value = false;
});
</script>