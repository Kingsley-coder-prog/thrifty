<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h2 class="text-2xl font-bold text-foreground">Savings Groups</h2>
      <p class="text-muted-foreground text-sm mt-1">
        Join a group and save together with 6 others
      </p>
    </div>

    <!-- Tabs -->
    <Tabs v-model="activeTab" class="w-full">
      <TabsList class="grid w-full grid-cols-2 max-w-xs">
        <TabsTrigger value="browse">Browse</TabsTrigger>
        <TabsTrigger value="my-groups">
          My Groups
          <Badge
            v-if="myGroups.length > 0"
            class="ml-2 bg-primary text-white text-xs px-1.5 py-0"
          >
            {{ myGroups.length }}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <!-- Browse tab -->
      <TabsContent value="browse" class="mt-6">
        <div v-if="tiersLoading" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton v-for="i in 4" :key="i" class="h-52 rounded-xl" />
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TierCard
            v-for="tier in tiers"
            :key="tier.id"
            :tier="tier"
            :has-bank-account="hasBankAccount"
            @join="openJoinDialog(tier)"
          />
        </div>
      </TabsContent>

      <!-- My Groups tab -->
      <TabsContent value="my-groups" class="mt-6">
        <div v-if="groupsLoading" class="space-y-4">
          <Skeleton v-for="i in 2" :key="i" class="h-40 rounded-xl" />
        </div>

        <div v-else-if="myGroups.length === 0" class="text-center py-16">
          <div
            class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <Users class="w-8 h-8 text-primary" />
          </div>
          <h3 class="font-semibold text-foreground mb-2">No groups yet</h3>
          <p class="text-sm text-muted-foreground mb-4">
            Browse the tiers and join a group to get started
          </p>
          <Button variant="outline" @click="activeTab = 'browse'">
            Browse Groups
          </Button>
        </div>

        <div v-else class="space-y-4">
          <GroupCard
            v-for="group in myGroups"
            :key="group.id"
            :group="group"
            @click="router.push(`/groups/${group.id}`)"
          />
        </div>
      </TabsContent>
    </Tabs>

    <!-- Join dialog -->
    <Dialog v-model:open="joinDialogOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Join {{ selectedTier?.name }} Group</DialogTitle>
          <DialogDescription>
            You'll contribute
            <span class="font-semibold text-foreground">
              {{ formatNaira(selectedTier?.monthly_amount) }}
            </span>
            monthly and collect
            <span class="font-semibold text-foreground">
              {{ formatNaira(selectedTier?.total_payout) }}
            </span>
            when it's your turn.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-2">
          <!-- No bank account warning -->
          <div
            v-if="!hasBankAccount"
            class="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800"
          >
            <p class="font-medium mb-1">Bank account required</p>
            <p>You need to add a bank account before joining a group.</p>
            <Button
              variant="link"
              class="text-amber-800 p-0 h-auto mt-1"
              @click="
                router.push('/profile');
                joinDialogOpen = false;
              "
            >
              Add bank account →
            </Button>
          </div>

          <!-- PIN input -->
          <div v-else class="space-y-2">
            <Label for="join-pin">Enter your transaction PIN</Label>
            <Input
              id="join-pin"
              v-model="pin"
              type="password"
              placeholder="6-digit PIN"
              maxlength="6"
              inputmode="numeric"
              :disabled="joining"
            />
          </div>

          <div
            v-if="joinError"
            class="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg"
          >
            {{ joinError }}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            @click="joinDialogOpen = false"
            :disabled="joining"
          >
            Cancel
          </Button>
          <Button
            v-if="hasBankAccount"
            class="bg-primary hover:bg-primary/90"
            :disabled="pin.length !== 6 || joining"
            @click="handleJoin"
          >
            <Loader2 v-if="joining" class="w-4 h-4 mr-2 animate-spin" />
            {{ joining ? "Joining..." : "Confirm Join" }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { Users, Loader2 } from "lucide-vue-next";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGroupsStore } from "@/stores/groups";
import { usersApi } from "@/api/users";
import { useCurrency } from "@/composables/useCurrency";
import GroupCard from "@/components/dashboard/GroupCard.vue";
import TierCard from "@/components/groups/TierCard.vue";

const router = useRouter();
const groupsStore = useGroupsStore();
const { formatNaira } = useCurrency();

const activeTab = ref("browse");
const tiersLoading = ref(true);
const groupsLoading = ref(true);
const joinDialogOpen = ref(false);
const selectedTier = ref(null);
const pin = ref("");
const joining = ref(false);
const joinError = ref("");
const hasBankAccount = ref(false);

const tiers = computed(() => groupsStore.tiers);
const myGroups = computed(() => groupsStore.myGroups);

function openJoinDialog(tier) {
  selectedTier.value = tier;
  pin.value = "";
  joinError.value = "";
  joinDialogOpen.value = true;
}

async function handleJoin() {
  joinError.value = "";
  joining.value = true;
  try {
    await groupsStore.joinGroup(selectedTier.value.id, pin.value);
    joinDialogOpen.value = false;
    activeTab.value = "my-groups";
    await groupsStore.fetchMyGroups();
  } catch (err) {
    const code = err.response?.data?.error;
    if (code === "PIN_INVALID") {
      joinError.value = "Incorrect PIN. Please try again.";
    } else if (code === "ALREADY_IN_TIER_GROUP") {
      joinError.value = "You are already in a group for this tier.";
    } else {
      joinError.value =
        err.response?.data?.meta?.message ?? "Something went wrong.";
    }
  } finally {
    joining.value = false;
  }
}

onMounted(async () => {
  const [accounts] = await Promise.allSettled([
    usersApi.getBankAccounts(),
    groupsStore.fetchTiers(),
    groupsStore.fetchMyGroups(),
  ]);

  if (accounts.status === "fulfilled") {
    hasBankAccount.value = accounts.value.data.bankAccounts.length > 0;
  }

  tiersLoading.value = false;
  groupsLoading.value = false;
});
</script>