<template>
  <div class="bg-card rounded-xl border border-border p-5">
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
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  Users2,
  Clock,
  CheckCircle,
  Trophy,
  Banknote,
  TrendingUp,
  Calendar,
  XCircle,
  AlertTriangle,
} from "lucide-vue-next";

const props = defineProps({
  label: String,
  value: [String, Number],
  icon: String,
  color: { type: String, default: "blue" },
});

const icons = {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  Users2,
  Clock,
  CheckCircle,
  Trophy,
  Banknote,
  TrendingUp,
  Calendar,
  XCircle,
  AlertTriangle,
};

const iconComponent = computed(() => icons[props.icon] ?? Users);

const bgColor = computed(
  () =>
    ({
      blue: "bg-blue-50",
      green: "bg-green-50",
      red: "bg-red-50",
      amber: "bg-amber-50",
      purple: "bg-purple-50",
    }[props.color])
);

const iconColor = computed(
  () =>
    ({
      blue: "text-blue-600",
      green: "text-green-600",
      red: "text-red-600",
      amber: "text-amber-600",
      purple: "text-purple-600",
    }[props.color])
);
</script>