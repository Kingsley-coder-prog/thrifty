<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-foreground">Audit Logs</h2>
      <p class="text-muted-foreground text-sm mt-1">
        Complete audit trail of all admin actions
      </p>
    </div>

    <div class="bg-card rounded-xl border border-border overflow-hidden">
      <div v-if="loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 10" :key="i" class="h-12 rounded-lg" />
      </div>

      <div v-else-if="logs.length === 0" class="p-16 text-center">
        <ScrollText class="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p class="font-medium text-foreground">No audit logs yet</p>
      </div>

      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>IP Address</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="log in logs" :key="log.id">
            <TableCell>
              <Badge
                class="bg-blue-100 text-blue-700 hover:bg-blue-100 font-mono text-xs"
              >
                {{ log.event_type }}
              </Badge>
            </TableCell>
            <TableCell class="text-muted-foreground font-mono text-xs">
              {{ log.actor_id?.slice(0, 8) }}...
            </TableCell>
            <TableCell class="text-muted-foreground font-mono text-xs">
              {{ log.target_id ? log.target_id.slice(0, 8) + "..." : "—" }}
            </TableCell>
            <TableCell class="text-muted-foreground text-xs">{{
              log.ip_address ?? "—"
            }}</TableCell>
            <TableCell class="text-muted-foreground text-xs">{{
              formatDate(log.created_at)
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
import { ref, onMounted } from "vue";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-vue-next";
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
import { adminApi } from "@/api/admin";

const logs = ref([]);
const loading = ref(true);
const pagination = ref({ page: 1, limit: 50, totalPages: 1 });

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function load() {
  loading.value = true;
  try {
    const { data } = await adminApi.getAuditLogs({
      page: pagination.value.page,
    });
    logs.value = data.logs;
    pagination.value = { ...pagination.value, ...data.pagination };
  } catch {
    logs.value = [];
  } finally {
    loading.value = false;
  }
}

function changePage(page) {
  pagination.value.page = page;
  load();
}
onMounted(load);
</script>