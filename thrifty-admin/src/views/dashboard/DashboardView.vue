<template>
  <div class="space-y-6">
    <!-- Welcome -->
    <div>
      <h2 class="text-2xl font-bold text-foreground">Dashboard</h2>
      <p class="text-muted-foreground text-sm mt-1">
        Platform overview — {{ today }}
      </p>
    </div>

    <!-- Loading -->
    <template v-if="loading">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton v-for="i in 8" :key="i" class="h-28 rounded-xl" />
      </div>
    </template>

    <template v-else>
      <!-- User stats -->
      <div>
        <p
          class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3"
        >
          Users
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Users"
            :value="metrics.users.total"
            icon="Users"
            color="blue"
          />
          <StatCard
            label="Active"
            :value="metrics.users.active"
            icon="UserCheck"
            color="green"
          />
          <StatCard
            label="Frozen"
            :value="metrics.users.frozen"
            icon="UserX"
            color="red"
          />
          <StatCard
            label="New This Week"
            :value="metrics.users.newThisWeek"
            icon="UserPlus"
            color="purple"
          />
        </div>
      </div>

      <!-- Group stats -->
      <div>
        <p
          class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3"
        >
          Groups
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Groups"
            :value="metrics.groups.total"
            icon="Users2"
            color="blue"
          />
          <StatCard
            label="Forming"
            :value="metrics.groups.forming"
            icon="Clock"
            color="amber"
          />
          <StatCard
            label="Active"
            :value="metrics.groups.active"
            icon="CheckCircle"
            color="green"
          />
          <StatCard
            label="Completed"
            :value="metrics.groups.completed"
            icon="Trophy"
            color="purple"
          />
        </div>
      </div>

      <!-- Financial stats -->
      <div>
        <p
          class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3"
        >
          Finance
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Payouts"
            :value="metrics.financial.totalPayouts"
            icon="Banknote"
            color="blue"
          />
          <StatCard
            label="Total Disbursed"
            :value="formatNaira(metrics.financial.totalDisbursed)"
            icon="TrendingUp"
            color="green"
          />
          <StatCard
            label="Payouts Today"
            :value="metrics.financial.payoutsToday"
            icon="Calendar"
            color="amber"
          />
          <StatCard
            label="Failed Payouts"
            :value="metrics.financial.failedPayouts"
            icon="XCircle"
            color="red"
          />
        </div>
      </div>

      <!-- Alerts -->
      <div>
        <p
          class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3"
        >
          Alerts
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RouterLink to="/fraud" class="block">
            <div
              class="bg-card rounded-xl border p-5 flex items-center gap-4 hover:border-red-300 transition-colors cursor-pointer"
              :class="
                metrics.alerts.openFraudFlags > 0
                  ? 'border-red-200 bg-red-50/50'
                  : 'border-border'
              "
            >
              <div
                class="w-11 h-11 rounded-lg flex items-center justify-center"
                :class="
                  metrics.alerts.openFraudFlags > 0
                    ? 'bg-red-100'
                    : 'bg-secondary'
                "
              >
                <AlertTriangle
                  class="w-5 h-5"
                  :class="
                    metrics.alerts.openFraudFlags > 0
                      ? 'text-red-600'
                      : 'text-muted-foreground'
                  "
                />
              </div>
              <div>
                <p class="text-sm text-muted-foreground">Open Fraud Flags</p>
                <p
                  class="text-2xl font-bold"
                  :class="
                    metrics.alerts.openFraudFlags > 0
                      ? 'text-red-600'
                      : 'text-foreground'
                  "
                >
                  {{ metrics.alerts.openFraudFlags }}
                </p>
              </div>
            </div>
          </RouterLink>

          <RouterLink to="/disputes" class="block">
            <div
              class="bg-card rounded-xl border p-5 flex items-center gap-4 hover:border-amber-300 transition-colors cursor-pointer"
              :class="
                metrics.alerts.openDisputes > 0
                  ? 'border-amber-200 bg-amber-50/50'
                  : 'border-border'
              "
            >
              <div
                class="w-11 h-11 rounded-lg flex items-center justify-center"
                :class="
                  metrics.alerts.openDisputes > 0
                    ? 'bg-amber-100'
                    : 'bg-secondary'
                "
              >
                <MessageSquare
                  class="w-5 h-5"
                  :class="
                    metrics.alerts.openDisputes > 0
                      ? 'text-amber-600'
                      : 'text-muted-foreground'
                  "
                />
              </div>
              <div>
                <p class="text-sm text-muted-foreground">Open Disputes</p>
                <p
                  class="text-2xl font-bold"
                  :class="
                    metrics.alerts.openDisputes > 0
                      ? 'text-amber-600'
                      : 'text-foreground'
                  "
                >
                  {{ metrics.alerts.openDisputes }}
                </p>
              </div>
            </div>
          </RouterLink>
        </div>
      </div>

      <!-- Recent payouts -->
      <div v-if="metrics.recentPayouts.length > 0">
        <p
          class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3"
        >
          Recent Payouts
        </p>
        <div class="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="payout in metrics.recentPayouts"
                :key="payout.id"
              >
                <TableCell class="font-medium">{{
                  payout.recipientName
                }}</TableCell>
                <TableCell class="text-green-600 font-semibold">{{
                  formatNaira(payout.netAmount)
                }}</TableCell>
                <TableCell>Cycle {{ payout.cycleNumber }}</TableCell>
                <TableCell class="text-muted-foreground">{{
                  formatDate(payout.completedAt)
                }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { AlertTriangle, MessageSquare } from "lucide-vue-next";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { adminApi } from "@/api/admin";
import { useCurrency } from "@/composables/useCurrency";
import StatCard from "@/components/dashboard/StatCard.vue";

const { formatNaira } = useCurrency();

const loading = ref(true);
const metrics = ref({
  users: { total: 0, active: 0, frozen: 0, suspended: 0, newThisWeek: 0 },
  groups: { total: 0, forming: 0, active: 0, completed: 0, frozen: 0 },
  financial: {
    totalPayouts: 0,
    totalDisbursed: 0,
    payoutsToday: 0,
    disbursedToday: 0,
    failedPayouts: 0,
  },
  alerts: { openDisputes: 0, openFraudFlags: 0 },
  recentPayouts: [],
});

const today = new Date().toLocaleDateString("en-NG", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

onMounted(async () => {
  try {
    const { data } = await adminApi.getDashboard();
    metrics.value = data.metrics;
  } catch {
    // keep defaults
  } finally {
    loading.value = false;
  }
});
</script>