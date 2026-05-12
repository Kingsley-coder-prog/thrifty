<template>
  <div class="flex items-center gap-3">
    <!-- Interlocking rings icon -->
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- Top ring -->
      <circle
        cx="24"
        cy="16"
        r="10"
        stroke="#166534"
        stroke-width="3.5"
        fill="none"
      />
      <!-- Bottom left ring -->
      <circle
        cx="16"
        cy="30"
        r="10"
        stroke="#16a34a"
        stroke-width="3.5"
        fill="none"
      />
      <!-- Bottom right ring -->
      <circle
        cx="32"
        cy="30"
        r="10"
        stroke="#15803d"
        stroke-width="3.5"
        fill="none"
      />
    </svg>

    <!-- Wordmark -->
    <span
      v-if="showText"
      class="font-bold text-foreground tracking-tight"
      :style="{ fontSize: textSize }"
    >
      Thrifty
    </span>
  </div>
</template>

<script setup>
defineProps({
  size: {
    type: Number,
    default: 40,
  },
  showText: {
    type: Boolean,
    default: true,
  },
  textSize: {
    type: String,
    default: "1.5rem",
  },
});
</script>