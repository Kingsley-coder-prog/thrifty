<template>
  <div
    class="bg-card rounded-xl border border-border p-6 flex flex-col gap-4 hover:border-primary/30 hover:shadow-sm transition-all"
  >
    <!-- Tier header -->
    <div class="flex items-center justify-between">
      <Badge :class="tierBadgeClass">{{ tier.name }}</Badge>
      <span class="text-xs text-muted-foreground">7 members</span>
    </div>

    <!-- Amount -->
    <div>
      <p class="text-3xl font-bold text-foreground">
        {{ formatNaira(tier.monthly_amount) }}
      </p>
      <p class="text-sm text-muted-foreground mt-0.5">per month</p>
    </div>

    <!-- Payout -->
    <div class="bg-green-50 rounded-lg px-4 py-3">
      <p class="text-xs text-muted-foreground">You collect</p>
      <p class="text-xl font-bold text-primary">
        {{ formatNaira(tier.total_payout) }}
      </p>
    </div>

    <!-- Features -->
    <ul class="space-y-2">
      <li class="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 class="w-4 h-4 text-primary shrink-0" />
        7 members per group
      </li>
      <li class="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 class="w-4 h-4 text-primary shrink-0" />
        Monthly contributions
      </li>
      <li class="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 class="w-4 h-4 text-primary shrink-0" />
        {{ platformFee }} platform fee
      </li>
    </ul>

    <!-- Join button -->
    <Button
      class="w-full mt-auto"
      :class="canJoin ? 'bg-primary hover:bg-primary/90' : ''"
      :variant="canJoin ? 'default' : 'outline'"
      @click="$emit('join', tier)"
    >
      {{ canJoin ? "Join Group" : "Add Bank Account First" }}
    </Button>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { CheckCircle2 } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/composables/useCurrency";

defineEmits(["join"]);

const props = defineProps({
  tier: {
    type: Object,
    required: true,
  },
  hasBankAccount: {
    type: Boolean,
    default: false,
  },
});

const { formatNaira } = useCurrency();

const canJoin = computed(() => props.hasBankAccount);

const platformFee = computed(
  () => `${parseFloat(props.tier.platform_fee_pct)}%`
);

const tierBadgeClass = computed(
  () =>
    ({
      Bronze: "bg-amber-100 text-amber-700 hover:bg-amber-100",
      Silver: "bg-secondary text-zinc-700 hover:bg-secondary",
      Gold: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
      Platinum: "bg-purple-100 text-purple-700 hover:bg-purple-100",
    }[props.tier.name] ?? "bg-secondary text-zinc-700")
);
</script>