<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-foreground">Disputes</h2>
      <p class="text-muted-foreground text-sm mt-1">
        Review and resolve member disputes
      </p>
    </div>

    <div class="flex items-center gap-3">
      <Select v-model="statusFilter">
        <SelectTrigger class="w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
          <SelectItem value="dismissed">Dismissed</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="bg-card rounded-xl border border-border overflow-hidden">
      <div v-if="loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 5" :key="i" class="h-16 rounded-lg" />
      </div>

      <div v-else-if="disputes.length === 0" class="p-16 text-center">
        <MessageSquare class="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p class="font-medium text-foreground">No disputes</p>
        <p class="text-sm text-muted-foreground mt-1">
          {{
            statusFilter === "open"
              ? "No open disputes — all clear"
              : "No disputes found"
          }}
        </p>
      </div>

      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead>Raised By</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="dispute in disputes" :key="dispute.id">
            <TableCell class="font-medium">{{
              dispute.raisedByName
            }}</TableCell>
            <TableCell>
              <Badge class="bg-amber-100 text-amber-700 hover:bg-amber-100">{{
                dispute.dispute_type
              }}</Badge>
            </TableCell>
            <TableCell class="max-w-xs truncate text-muted-foreground">{{
              dispute.description
            }}</TableCell>
            <TableCell>
              <Badge :class="statusBadgeClass(dispute.status)">{{
                dispute.status
              }}</Badge>
            </TableCell>
            <TableCell class="text-muted-foreground">{{
              formatDate(dispute.created_at)
            }}</TableCell>
            <TableCell class="text-right">
              <Button
                v-if="dispute.status === 'open'"
                variant="outline"
                size="sm"
                class="text-xs"
                @click="openResolveDialog(dispute)"
              >
                Resolve
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Resolve dialog -->
    <Dialog v-model:open="resolveDialogOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Resolve Dispute</DialogTitle>
          <DialogDescription
            >Choose a resolution for this dispute.</DialogDescription
          >
        </DialogHeader>
        <div class="space-y-4 py-2">
          <div class="space-y-2">
            <Label>Resolution</Label>
            <Select v-model="resolution">
              <SelectTrigger>
                <SelectValue placeholder="Select resolution" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resolved"
                  >Resolved — dispute upheld</SelectItem
                >
                <SelectItem value="dismissed"
                  >Dismissed — dispute rejected</SelectItem
                >
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label>Notes</Label>
            <Input v-model="notes" placeholder="Add resolution notes..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="resolveDialogOpen = false"
            >Cancel</Button
          >
          <Button
            class="bg-primary hover:bg-primary/90 text-white"
            :disabled="!resolution || !notes || actioning"
            @click="handleResolve"
          >
            <Loader2 v-if="actioning" class="w-4 h-4 mr-2 animate-spin" />
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from "vue";
import { MessageSquare, Loader2 } from "lucide-vue-next";
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

const disputes = ref([]);
const loading = ref(true);
const statusFilter = ref("open");

const resolveDialogOpen = ref(false);
const selectedDispute = ref(null);
const resolution = ref("");
const notes = ref("");
const actioning = ref(false);

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
      open: "bg-amber-100 text-amber-700 hover:bg-amber-100",
      resolved: "bg-green-100 text-green-700 hover:bg-green-100",
      dismissed: "bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
    }[status] ?? "bg-zinc-100 text-zinc-700"
  );
}

async function load() {
  loading.value = true;
  try {
    const { data } = await adminApi.getDisputes({ status: statusFilter.value });
    disputes.value = data.disputes;
  } catch {
    disputes.value = [];
  } finally {
    loading.value = false;
  }
}

function openResolveDialog(dispute) {
  selectedDispute.value = dispute;
  resolution.value = "";
  notes.value = "";
  resolveDialogOpen.value = true;
}

async function handleResolve() {
  actioning.value = true;
  try {
    await adminApi.resolveDispute(selectedDispute.value.id, {
      resolution: resolution.value,
      notes: notes.value,
    });
    resolveDialogOpen.value = false;
    await load();
  } finally {
    actioning.value = false;
  }
}

watch(statusFilter, load);
onMounted(load);
</script>