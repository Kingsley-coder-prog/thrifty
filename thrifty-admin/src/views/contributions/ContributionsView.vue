<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-foreground">Contributions</h2>
      <p class="text-muted-foreground text-sm mt-1">All member contributions</p>
    </div>

    <div class="flex items-center gap-3">
      <Select v-model="statusFilter">
        <SelectTrigger class="w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="bg-card rounded-xl border border-border overflow-hidden">
      <div v-if="loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 8" :key="i" class="h-12 rounded-lg" />
      </div>

      <div v-else-if="contributions.length === 0" class="p-16 text-center">
        <CreditCard class="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p class="font-medium text-foreground">No contributions found</p>
      </div>

      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Cycle</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="c in contributions" :key="c.id">
            <TableCell class="font-medium">{{ c.memberName }}</TableCell>
            <TableCell>{{ formatNaira(c.amount) }}</TableCell>
            <TableCell>Cycle {{ c.cycleNumber }}</TableCell>
            <TableCell>
              <Badge :class="statusBadgeClass(c.status)">{{ c.status }}</Badge>
            </TableCell>
            <TableCell class="text-muted-foreground">{{
              formatDate(c.created_at)
            }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div
        v-if="pagination.totalPages > 1"
        class="flex items-center justify-between px-4 py-3 border-t border-border"
      >
        <p class="text-sm text-muted-foreground">
          Page {{ pagination.page }} of {{ pagination.totalPages }}
        </p>
        <div class="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="pagination.page <= 1"
            @click="changePage(pagination.page - 1)"
          >
            <ChevronLeft class="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="pagination.page >= pagination.totalPages"
            @click="changePage(pagination.page + 1)"
          >
            <ChevronRight class="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from "vue";
import { CreditCard, ChevronLeft, ChevronRight } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { adminApi } from "@/api/admin";
import { useCurrency } from "@/composables/useCurrency";

const { formatNaira } = useCurrency();
const contributions = ref([]);
const loading = ref(true);
const statusFilter = ref("all");
const pagination = ref({ page: 1, limit: 20, totalPages: 1 });

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusBadgeClass(status) {
  return (
    {
      paid: "bg-green-100 text-green-700 hover:bg-green-100",
      pending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
      failed: "bg-red-100 text-red-700 hover:bg-red-100",
    }[status] ?? "bg-zinc-100 text-zinc-700"
  );
}

async function load() {
  loading.value = true;
  try {
    const { data } = await adminApi.getContributions({
      page: pagination.value.page,
      status: statusFilter.value === "all" ? undefined : statusFilter.value,
    });
    contributions.value = data.contributions;
    pagination.value = { ...pagination.value, ...data.pagination };
  } catch {
    contributions.value = [];
  } finally {
    loading.value = false;
  }
}

function changePage(page) {
  pagination.value.page = page;
  load();
}
watch(statusFilter, () => {
  pagination.value.page = 1;
  load();
});
onMounted(load);
</script>