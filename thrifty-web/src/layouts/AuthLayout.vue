<template>
  <div
    class="min-h-screen relative overflow-hidden"
    style="
      background: linear-gradient(
        160deg,
        #f0fdf4 0%,
        #dcfce7 50%,
        #f0fdf4 100%
      );
    "
  >
    <NairaCoinsBg />

    <div
      class="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12"
    >
      <RouterLink to="/" class="flex items-center gap-3 mb-10">
        <ThriftyLogo :size="36" text-size="1.6rem" />
      </RouterLink>

      <div class="w-full max-w-md">
        <slot />
      </div>

      <p class="mt-8 text-sm text-muted-foreground">
        &copy; {{ new Date().getFullYear() }} Thrifty. All rights reserved.
      </p>
    </div>
  </div>
</template>

<script setup>
import NairaCoinsBg from "@/components/NairaCoinsBg.vue";
import ThriftyLogo from "@/components/ThriftyLogo.vue";
import { RouterLink } from "vue-router";
</script>