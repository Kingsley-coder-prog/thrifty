<template>
  <div class="space-y-6 max-w-4xl">
    <!-- Back -->
    <button
      @click="router.back()"
      class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft class="w-4 h-4" />
      Back to Users
    </button>

    <!-- Loading -->
    <template v-if="loading">
      <Skeleton class="h-48 rounded-xl" />
      <Skeleton class="h-64 rounded-xl" />
    </template>

    <template v-else-if="user">
      <!-- User header -->
      <div class="bg-card rounded-xl border border-border p-6">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-4">
            <div
              class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0"
            >
              <span class="text-2xl font-bold text-primary">{{
                initials(user.fullName)
              }}</span>
            </div>
            <div>
              <h2 class="text-xl font-bold text-foreground">
                {{ user.fullName }}
              </h2>
              <p class="text-muted-foreground text-sm">{{ user.phone }}</p>
              <div class="flex items-center gap-2 mt-2">
                <Badge :class="kycBadgeClass(user.kycStatus)">{{
                  kycLabel(user.kycStatus)
                }}</Badge>
                <Badge :class="statusBadgeClass(user.accountStatus)">{{
                  user.accountStatus
                }}</Badge>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-2 shrink-0">
            <Button
              v-if="user.accountStatus === 'active'"
              variant="outline"
              size="sm"
              class="text-destructive border-destructive/30 hover:bg-destructive/10"
              @click="openFreezeDialog"
            >
              Freeze Account
            </Button>
            <Button
              v-else-if="user.accountStatus === 'frozen'"
              variant="outline"
              size="sm"
              class="text-green-600 border-green-200 hover:bg-green-50"
              @click="openUnfreezeDialog"
            >
              Unfreeze Account
            </Button>
          </div>
        </div>

        <Separator class="my-5" />

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p class="text-xs text-muted-foreground mb-1">Email</p>
            <p class="text-sm font-medium text-foreground">
              {{ user.email ?? "Not provided" }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground mb-1">KYC Level</p>
            <p class="text-sm font-medium text-foreground">
              Level {{ user.kycLevel }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground mb-1">BVN Verified</p>
            <p class="text-sm font-medium text-foreground">
              {{ user.bvnVerifiedAt ? formatDate(user.bvnVerifiedAt) : "No" }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground mb-1">Member Since</p>
            <p class="text-sm font-medium text-foreground">
              {{ formatDate(user.createdAt) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Groups -->
      <div class="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 class="font-semibold text-foreground">Groups</h3>
        <div
          v-if="user.groups.length === 0"
          class="text-sm text-muted-foreground"
        >
          Not in any group
        </div>
        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>Tier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Turn</TableHead>
              <TableHead>Collected</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="group in user.groups" :key="group.id">
              <TableCell>
                <Badge :class="tierBadgeClass(group.tier_name)">{{
                  group.tier_name
                }}</Badge>
              </TableCell>
              <TableCell>
                <Badge :class="statusBadgeClass2(group.status)">{{
                  group.status
                }}</Badge>
              </TableCell>
              <TableCell>{{ group.turn_position ?? "—" }}</TableCell>
              <TableCell>
                <span
                  :class="
                    group.has_collected
                      ? 'text-green-600 font-medium'
                      : 'text-muted-foreground'
                  "
                >
                  {{ group.has_collected ? "Yes" : "No" }}
                </span>
              </TableCell>
              <TableCell class="text-muted-foreground">{{
                formatDate(group.joined_at)
              }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <!-- Bank accounts -->
      <div class="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 class="font-semibold text-foreground">Bank Accounts</h3>
        <div
          v-if="user.bankAccounts.length === 0"
          class="text-sm text-muted-foreground"
        >
          No bank accounts
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="account in user.bankAccounts"
            :key="account.id"
            class="flex items-center justify-between p-3 rounded-lg border border-border"
          >
            <div class="flex items-center gap-3">
              <Building2 class="w-5 h-5 text-muted-foreground" />
              <div>
                <p class="text-sm font-medium text-foreground">
                  {{ account.bank_name }}
                  <Badge
                    v-if="account.is_primary"
                    class="ml-2 bg-primary/10 text-primary text-xs"
                    >Primary</Badge
                  >
                </p>
                <p class="text-xs text-muted-foreground">
                  ****{{ account.last_4_digits }} • {{ account.mandate_status }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Fraud flags -->
      <div
        v-if="user.fraudFlags.length > 0"
        class="bg-card rounded-xl border border-red-200 p-6 space-y-4"
      >
        <h3 class="font-semibold text-destructive">Fraud Flags</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="flag in user.fraudFlags" :key="flag.id">
              <TableCell
                ><Badge class="bg-red-100 text-red-700">{{
                  flag.flag_type
                }}</Badge></TableCell
              >
              <TableCell
                ><Badge :class="flagStatusClass(flag.status)">{{
                  flag.status
                }}</Badge></TableCell
              >
              <TableCell class="text-muted-foreground">{{
                formatDate(flag.created_at)
              }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </template>

    <div v-else class="text-center py-16">
      <p class="text-muted-foreground">User not found.</p>
    </div>

    <!-- Freeze dialog -->
    <Dialog v-model:open="freezeDialogOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Freeze User Account</DialogTitle>
          <DialogDescription
            >This will prevent {{ user?.fullName }} from accessing their
            account.</DialogDescription
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
            Freeze
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Unfreeze dialog -->
    <Dialog v-model:open="unfreezeDialogOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Unfreeze User Account</DialogTitle>
          <DialogDescription
            >This will restore access for
            {{ user?.fullName }}.</DialogDescription
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
            Unfreeze
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Building2, Loader2 } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { adminApi } from "@/api/admin";

const route = useRoute();
const router = useRouter();

const user = ref(null);
const loading = ref(true);

const freezeDialogOpen = ref(false);
const unfreezeDialogOpen = ref(false);
const actionReason = ref("");
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

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function kycLabel(s) {
  return (
    { bvn_verified: "BVN Verified", pending: "Pending", rejected: "Rejected" }[
      s
    ] ?? s
  );
}

function kycBadgeClass(s) {
  return (
    {
      bvn_verified: "bg-green-100 text-green-700",
      pending: "bg-amber-100 text-amber-700",
    }[s] ?? "bg-zinc-100 text-zinc-700"
  );
}

function statusBadgeClass(s) {
  return (
    {
      active: "bg-green-100 text-green-700",
      frozen: "bg-blue-100 text-blue-700",
      suspended: "bg-red-100 text-red-700",
    }[s] ?? "bg-zinc-100 text-zinc-700"
  );
}

function statusBadgeClass2(s) {
  return (
    {
      forming: "bg-amber-100 text-amber-700",
      active: "bg-green-100 text-green-700",
      completed: "bg-blue-100 text-blue-700",
      frozen: "bg-red-100 text-red-700",
    }[s] ?? "bg-zinc-100 text-zinc-700"
  );
}

function tierBadgeClass(t) {
  return (
    {
      Bronze: "bg-amber-100 text-amber-700",
      Silver: "bg-zinc-100 text-zinc-700",
      Gold: "bg-yellow-100 text-yellow-700",
      Platinum: "bg-purple-100 text-purple-700",
    }[t] ?? "bg-zinc-100 text-zinc-700"
  );
}

function flagStatusClass(s) {
  return (
    {
      open: "bg-red-100 text-red-700",
      resolved: "bg-green-100 text-green-700",
      dismissed: "bg-zinc-100 text-zinc-700",
    }[s] ?? "bg-zinc-100 text-zinc-700"
  );
}

function openFreezeDialog() {
  actionReason.value = "";
  freezeDialogOpen.value = true;
}
function openUnfreezeDialog() {
  actionReason.value = "";
  unfreezeDialogOpen.value = true;
}

async function handleFreeze() {
  actioning.value = true;
  try {
    await adminApi.freezeUser(route.params.id, actionReason.value);
    freezeDialogOpen.value = false;
    await loadUser();
  } finally {
    actioning.value = false;
  }
}

async function handleUnfreeze() {
  actioning.value = true;
  try {
    await adminApi.unfreezeUser(route.params.id, actionReason.value);
    unfreezeDialogOpen.value = false;
    await loadUser();
  } finally {
    actioning.value = false;
  }
}

async function loadUser() {
  try {
    const { data } = await adminApi.getUserDetail(route.params.id);
    user.value = data.user;
  } catch {
    user.value = null;
  }
}

onMounted(async () => {
  await loadUser();
  loading.value = false;
});
</script>