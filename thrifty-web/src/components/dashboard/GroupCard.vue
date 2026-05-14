<template>
  <div
    class="bg-white rounded-xl border border-border p-5 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
    @click="$emit('click')"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0">
        <!-- Tier badge -->
        <div class="flex items-center gap-2 mb-3">
          <Badge :class="tierBadgeClass">{{ group.tier?.name }}</Badge>
          <Badge :class="statusBadgeClass">{{ statusLabel }}</Badge>
        </div>

        <!-- Amount info -->
        <div class="flex items-baseline gap-1 mb-1">
          <span class="text-2xl font-bold text-foreground">
            {{ formatNaira(group.tier?.monthlyAmount) }}
          </span>
          <span class="text-sm text-muted-foreground">/month</span>
        </div>
        <p class="text-sm text-muted-foreground">
          Payout:
          <span class="font-medium text-foreground">{{
            formatNaira(group.tier?.totalPayout)
          }}</span>
        </p>
      </div>

      <!-- Turn position -->
      <div class="text-right shrink-0">
        <div v-if="group.myTurnPosition" class="text-center">
          <div
            class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto"
          >
            <span class="text-lg font-bold text-primary">{{
              group.myTurnPosition
            }}</span>
          </div>
          <p class="text-xs text-muted-foreground mt-1">Your turn</p>
        </div>
        <div v-else class="text-center">
          <div
            class="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto"
          >
            <Users class="w-5 h-5 text-zinc-400" />
          </div>
          <p class="text-xs text-muted-foreground mt-1">Forming</p>
        </div>
      </div>
    </div>

    <!-- Progress bar for active groups -->
    <div v-if="group.status === 'active'" class="mt-4">
      <div
        class="flex items-center justify-between text-xs text-muted-foreground mb-1.5"
      >
        <span>Cycle {{ group.currentCycle }} of 7</span>
        <span>{{ group.memberCount }}/7 members</span>
      </div>
      <div class="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
        <div
          class="h-full bg-primary rounded-full transition-all"
          :style="{ width: `${(group.currentCycle / 7) * 100}%` }"
        />
      </div>
    </div>

    <!-- Forming state -->
    <div v-else-if="group.status === 'forming'" class="mt-4">
      <div
        class="flex items-center justify-between text-xs text-muted-foreground mb-1.5"
      >
        <span>Waiting for members</span>
        <span>{{ group.memberCount }}/7</span>
      </div>
      <div class="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
        <div
          class="h-full bg-amber-400 rounded-full transition-all"
          :style="{ width: `${(group.memberCount / 7) * 100}%` }"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { Users } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/composables/useCurrency";
const { formatNaira } = useCurrency();

defineEmits(["click"]);

const props = defineProps({
  group: {
    type: Object,
    required: true,
  },
});

const statusLabel = computed(
  () =>
    ({
      forming: "Forming",
      active: "Active",
      completed: "Completed",
      frozen: "Frozen",
    }[props.group.status] ?? props.group.status)
);

const tierBadgeClass = computed(
  () =>
    ({
      Bronze: "bg-amber-100 text-amber-700 hover:bg-amber-100",
      Silver: "bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
      Gold: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
      Platinum: "bg-purple-100 text-purple-700 hover:bg-purple-100",
    }[props.group.tier?.name] ?? "bg-zinc-100 text-zinc-700")
);

const statusBadgeClass = computed(
  () =>
    ({
      forming: "bg-amber-100 text-amber-700 hover:bg-amber-100",
      active: "bg-green-100 text-green-700 hover:bg-green-100",
      completed: "bg-blue-100 text-blue-700 hover:bg-blue-100",
      frozen: "bg-red-100 text-red-700 hover:bg-red-100",
    }[props.group.status] ?? "bg-zinc-100 text-zinc-700")
);
</script>