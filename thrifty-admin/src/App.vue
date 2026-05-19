<template>
  <AppLayout v-if="isAppRoute">
    <RouterView />
  </AppLayout>
  <RouterView v-else />
</template>

<script setup>
import { computed, onMounted } from "vue";
import { useRoute, RouterView } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/composables/useTheme";
useTheme();

const route = useRoute();
const authStore = useAuthStore();

const isAppRoute = computed(() => route.meta.requiresAuth);

onMounted(() => {
  authStore.init();
});
</script>