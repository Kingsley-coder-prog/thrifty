<template>
  <div class="bg-white rounded-xl border border-border p-5">
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm font-medium text-muted-foreground">{{ label }}</p>
      <div
        class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        :class="bgColor"
      >
        <component :is="iconComponent" class="w-4 h-4" :class="iconColor" />
      </div>
    </div>
    <p class="text-2xl font-bold text-foreground">{{ value }}</p>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { Users, Calendar, TrendingUp } from "lucide-vue-next";

const props = defineProps({
  label: String,
  value: [String, Number],
  icon: String,
  color: {
    type: String,
    default: "primary",
  },
});

const icons = { Users, Calendar, TrendingUp };
const iconComponent = computed(() => icons[props.icon] ?? Users);

const bgColor = computed(
  () =>
    ({
      primary: "bg-primary/10",
      amber: "bg-amber-50",
      green: "bg-green-50",
    }[props.color])
);

const iconColor = computed(
  () =>
    ({
      primary: "text-primary",
      amber: "text-amber-600",
      green: "text-green-600",
    }[props.color])
);
</script>