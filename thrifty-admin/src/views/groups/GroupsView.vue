<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-foreground">Groups</h2>
      <p class="text-muted-foreground text-sm mt-1">
        Manage all savings groups
      </p>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-3 flex-wrap">
      <Select v-model="statusFilter">
        <SelectTrigger class="w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="forming">Forming</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="frozen">Frozen</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Table -->
    <div class="bg-card rounded-xl border border-border overflow-hidden">
      <div v-if="loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 6" :key="i" class="h-12 rounded-lg" />
      </div>

      <div v-else-if="groups.length === 0" class="p-16 text-center">
        <Users2 class="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p class="font-medium text-foreground">No groups found</p>
      </div>

      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead>Group ID</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Members</TableHead>
            <TableHead>Cycle</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="group in groups" :key="group.id">
            <TableCell class="font-mono text-xs text-muted-foreground">
              {{ group.id.slice(0, 8) }}...
            </TableCell>
            <TableCell>
              <Badge :class="tierBadgeClass(group.tier_name)">{{
                group.tier_name
              }}</Badge>
            </TableCell>
            <TableCell>{{ group.member_count }}/7</TableCell>
            <TableCell>{{ group.current_cycle }}/7</TableCell>
            <TableCell>
              <Badge :class="statusBadgeClass(group.status)">{{
                group.status
              }}</Badge>
            </TableCell>
            <TableCell class="text-muted-foreground">{{
              formatDate(group.created_at)
            }}</TableCell>
            <TableCell class="text-right">
              <div class="flex items-center justify-end gap-2">
                <Button
                  v-if="group.status !== 'frozen'"
                  variant="outline"
                  size="sm"
                  class="text-destructive border-destructive/30 hover:bg-destructive/10 text-xs"
                  @click="openFreezeDialog(group)"
                >
                  Freeze
                </Button>
                <Button
                  v-else
                  variant="outline"
                  size="sm"
                  class="text-green-600 border-green-200 hover:bg-green-50 text-xs"
                  @click="openUnfreezeDialog(group)"
                >
                  Unfreeze
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- Pagination -->
      <div
        v-if="pagination.totalPages > 1"
        class="flex items-center justify-between px-4 py-3 border-t border-border"
      >
        <p class="text-sm text-muted-foreground">
          Page {{ pagination.page }} of {{ pagination.totalPages }}
        </p>
        <div class="flex items-center gap-2">
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

    <!-- Freeze dialog -->
    <Dialog v-model:open="freezeDialogOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Freeze Group</DialogTitle>
          <DialogDescription
            >This will freeze the group and prevent any debit
            processing.</DialogDescription
          >
        </DialogHeader>
        <div class="space-y-3 py-2">
          <Label>Reason</Label>
          <Input v-model="actionReason" placeholder="Reason for freezing" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="freezeDialogOpen = false"
            >Cancel</Button
          >
          <Button
            class="bg-destructive hover:bg-destructive/90 text-white"
            :disabled="!actionReason || actioning"
            @click="handleFreeze"
          >
            <Loader2 v-if="actioning" class="w-4 h-4 mr-2 animate-spin" />
            Freeze Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Unfreeze dialog -->
    <Dialog v-model:open="unfreezeDialogOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Unfreeze Group</DialogTitle>
          <DialogDescription
            >This will restore the group to active status.</DialogDescription
          >
        </DialogHeader>
        <div class="space-y-3 py-2">
          <Label>Reason</Label>
          <Input v-model="actionReason" placeholder="Reason for unfreezing" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="unfreezeDialogOpen = false"
            >Cancel</Button
          >
          <Button
            class="bg-green-600 hover:bg-green-700 text-white"
            :disabled="!actionReason || actioning"
            @click="handleUnfreeze"
          >
            <Loader2 v-if="actioning" class="w-4 h-4 mr-2 animate-spin" />
            Unfreeze Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from "vue";
import { Users2, ChevronLeft, ChevronRight, Loader2 } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { adminApi } from "@/api/admin";

const groups = ref([]);
const loading = ref(true);
const statusFilter = ref("all");
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 1 });

const freezeDialogOpen = ref(false);
const unfreezeDialogOpen = ref(false);
const selectedGroup = ref(null);
const actionReason = ref("");
const actioning = ref(false);

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function tierBadgeClass(tier) {
  return (
    {
      Bronze: "bg-amber-100 text-amber-700 hover:bg-amber-100",
      Silver: "bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
      Gold: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
      Platinum: "bg-purple-100 text-purple-700 hover:bg-purple-100",
    }[tier] ?? "bg-zinc-100 text-zinc-700"
  );
}

function statusBadgeClass(status) {
  return (
    {
      forming: "bg-amber-100 text-amber-700 hover:bg-amber-100",
      active: "bg-green-100 text-green-700 hover:bg-green-100",
      completed: "bg-blue-100 text-blue-700 hover:bg-blue-100",
      frozen: "bg-red-100 text-red-700 hover:bg-red-100",
    }[status] ?? "bg-zinc-100 text-zinc-700"
  );
}

async function loadGroups() {
  loading.value = true;
  try {
    const { data } = await adminApi.getGroups({
      page: pagination.value.page,
      limit: pagination.value.limit,
      status: statusFilter.value === "all" ? undefined : statusFilter.value,
    });
    groups.value = data.groups;
    pagination.value = { ...pagination.value, ...data.pagination };
  } catch {
    groups.value = [];
  } finally {
    loading.value = false;
  }
}

function changePage(page) {
  pagination.value.page = page;
  loadGroups();
}

function openFreezeDialog(group) {
  selectedGroup.value = group;
  actionReason.value = "";
  freezeDialogOpen.value = true;
}

function openUnfreezeDialog(group) {
  selectedGroup.value = group;
  actionReason.value = "";
  unfreezeDialogOpen.value = true;
}

async function handleFreeze() {
  actioning.value = true;
  try {
    await adminApi.freezeGroup(selectedGroup.value.id, actionReason.value);
    freezeDialogOpen.value = false;
    await loadGroups();
  } finally {
    actioning.value = false;
  }
}

async function handleUnfreeze() {
  actioning.value = true;
  try {
    await adminApi.unfreezeGroup(selectedGroup.value.id, actionReason.value);
    unfreezeDialogOpen.value = false;
    await loadGroups();
  } finally {
    actioning.value = false;
  }
}

watch(statusFilter, () => {
  pagination.value.page = 1;
  loadGroups();
});
onMounted(loadGroups);
</script>