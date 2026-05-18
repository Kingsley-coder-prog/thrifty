<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-foreground">Users</h2>
        <p class="text-muted-foreground text-sm mt-1">
          Manage all registered users
        </p>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-3 flex-wrap">
      <div class="relative flex-1 min-w-48">
        <Search
          class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
        />
        <Input
          v-model="search"
          placeholder="Search by name or phone..."
          class="pl-9"
        />
      </div>
      <Select v-model="statusFilter">
        <SelectTrigger class="w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="frozen">Frozen</SelectItem>
          <SelectItem value="suspended">Suspended</SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="kycFilter">
        <SelectTrigger class="w-40">
          <SelectValue placeholder="KYC Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All KYC</SelectItem>
          <SelectItem value="bvn_verified">BVN Verified</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Table -->
    <div class="bg-card rounded-xl border border-border overflow-hidden">
      <div v-if="loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 8" :key="i" class="h-12 rounded-lg" />
      </div>

      <div v-else-if="users.length === 0" class="p-16 text-center">
        <Users class="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p class="font-medium text-foreground">No users found</p>
        <p class="text-sm text-muted-foreground mt-1">
          Try adjusting your filters
        </p>
      </div>

      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>KYC</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="user in users"
            :key="user.id"
            class="cursor-pointer hover:bg-secondary/50"
            @click="router.push(`/users/${user.id}`)"
          >
            <TableCell>
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0"
                >
                  <span class="text-xs font-semibold text-primary">{{
                    initials(user.fullName)
                  }}</span>
                </div>
                <span class="font-medium text-foreground">{{
                  user.fullName
                }}</span>
              </div>
            </TableCell>
            <TableCell class="text-muted-foreground">{{
              user.phone
            }}</TableCell>
            <TableCell>
              <Badge :class="kycBadgeClass(user.kycStatus)">{{
                kycLabel(user.kycStatus)
              }}</Badge>
            </TableCell>
            <TableCell>
              <Badge :class="statusBadgeClass(user.accountStatus)">{{
                user.accountStatus
              }}</Badge>
            </TableCell>
            <TableCell class="text-muted-foreground">{{
              formatDate(user.createdAt)
            }}</TableCell>
            <TableCell class="text-right" @click.stop>
              <div class="flex items-center justify-end gap-2">
                <Button
                  v-if="user.accountStatus === 'active'"
                  variant="outline"
                  size="sm"
                  class="text-destructive border-destructive/30 hover:bg-destructive/10 text-xs"
                  @click="openFreezeDialog(user)"
                >
                  Freeze
                </Button>
                <Button
                  v-else-if="user.accountStatus === 'frozen'"
                  variant="outline"
                  size="sm"
                  class="text-green-600 border-green-200 hover:bg-green-50 text-xs"
                  @click="openUnfreezeDialog(user)"
                >
                  Unfreeze
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  @click="router.push(`/users/${user.id}`)"
                >
                  <ChevronRight class="w-4 h-4" />
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
          Page {{ pagination.page }} of {{ pagination.totalPages }} —
          {{ pagination.total }} users
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
          <DialogTitle>Freeze User Account</DialogTitle>
          <DialogDescription>
            This will prevent <strong>{{ selectedUser?.fullName }}</strong> from
            accessing their account.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3 py-2">
          <Label>Reason</Label>
          <Input
            v-model="actionReason"
            placeholder="Reason for freezing account"
          />
          <div
            v-if="actionError"
            class="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg"
          >
            {{ actionError }}
          </div>
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
            Freeze Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Unfreeze dialog -->
    <Dialog v-model:open="unfreezeDialogOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Unfreeze User Account</DialogTitle>
          <DialogDescription>
            This will restore access for
            <strong>{{ selectedUser?.fullName }}</strong
            >.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3 py-2">
          <Label>Reason</Label>
          <Input
            v-model="actionReason"
            placeholder="Reason for unfreezing account"
          />
          <div
            v-if="actionError"
            class="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg"
          >
            {{ actionError }}
          </div>
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
            Unfreeze Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  Search,
  Users,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from "lucide-vue-next";
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

const router = useRouter();

const users = ref([]);
const loading = ref(true);
const search = ref("");
const statusFilter = ref("all");
const kycFilter = ref("all");
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 1 });

const freezeDialogOpen = ref(false);
const unfreezeDialogOpen = ref(false);
const selectedUser = ref(null);
const actionReason = ref("");
const actionError = ref("");
const actioning = ref(false);

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function kycLabel(status) {
  return (
    { bvn_verified: "BVN Verified", pending: "Pending", rejected: "Rejected" }[
      status
    ] ?? status
  );
}

function kycBadgeClass(status) {
  return (
    {
      bvn_verified: "bg-green-100 text-green-700 hover:bg-green-100",
      pending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
      rejected: "bg-red-100 text-red-700 hover:bg-red-100",
    }[status] ?? "bg-zinc-100 text-zinc-700"
  );
}

function statusBadgeClass(status) {
  return (
    {
      active: "bg-green-100 text-green-700 hover:bg-green-100",
      frozen: "bg-blue-100 text-blue-700 hover:bg-blue-100",
      suspended: "bg-red-100 text-red-700 hover:bg-red-100",
    }[status] ?? "bg-zinc-100 text-zinc-700"
  );
}

async function loadUsers() {
  loading.value = true;
  try {
    const { data } = await adminApi.getUsers({
      page: pagination.value.page,
      limit: pagination.value.limit,
      status: statusFilter.value === "all" ? undefined : statusFilter.value,
      kycStatus: kycFilter.value === "all" ? undefined : kycFilter.value,
    });
    users.value = data.users;
    pagination.value = { ...pagination.value, ...data.pagination };
  } catch {
    users.value = [];
  } finally {
    loading.value = false;
  }
}

function changePage(page) {
  pagination.value.page = page;
  loadUsers();
}

function openFreezeDialog(user) {
  selectedUser.value = user;
  actionReason.value = "";
  actionError.value = "";
  freezeDialogOpen.value = true;
}

function openUnfreezeDialog(user) {
  selectedUser.value = user;
  actionReason.value = "";
  actionError.value = "";
  unfreezeDialogOpen.value = true;
}

async function handleFreeze() {
  actionError.value = "";
  actioning.value = true;
  try {
    await adminApi.freezeUser(selectedUser.value.id, actionReason.value);
    freezeDialogOpen.value = false;
    await loadUsers();
  } catch (err) {
    actionError.value =
      err.response?.data?.meta?.message ?? "Failed to freeze user";
  } finally {
    actioning.value = false;
  }
}

async function handleUnfreeze() {
  actionError.value = "";
  actioning.value = true;
  try {
    await adminApi.unfreezeUser(selectedUser.value.id, actionReason.value);
    unfreezeDialogOpen.value = false;
    await loadUsers();
  } catch (err) {
    actionError.value =
      err.response?.data?.meta?.message ?? "Failed to unfreeze user";
  } finally {
    actioning.value = false;
  }
}

// Reload when filters change
watch([statusFilter, kycFilter], () => {
  pagination.value.page = 1;
  loadUsers();
});

onMounted(loadUsers);
</script>