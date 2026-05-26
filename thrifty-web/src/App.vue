<template>
  <AppLayout v-if="isAppRoute">
    <RouterView />
  </AppLayout>
  <RouterView v-else />
</template>

<script setup>
// import necessary modules and components
import { computed, onMounted } from "vue";
import { useRoute, RouterView } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
import { useAuthStore } from "./stores/auth";
import { useTheme } from "./composables/useTheme";

const route = useRoute();
const authStore = useAuthStore();
const { initTheme } = useTheme();
const isAppRoute = computed(() => route.meta.requiresAuth);

// initialize authentication and theme settings when the component is mounted
onMounted(() => {
  authStore.init();
  initTheme();
});
</script>