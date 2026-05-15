<template>
  <div class="min-h-screen bg-zinc-50 flex">
    <!-- Sidebar — desktop only -->
    <aside
      class="hidden lg:flex flex-col w-64 bg-white border-r border-border fixed inset-y-0 left-0 z-30"
    >
      <!-- Logo -->
      <div class="h-16 flex items-center px-6 border-b border-border">
        <ThriftyLogo :size="32" text-size="1.3rem" />
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        <NavItem v-for="item in navItems" :key="item.name" :item="item" />
      </nav>

      <!-- User profile at bottom -->
      <div class="p-4 border-t border-border">
        <div class="flex items-center gap-3">
          <div
            class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center"
          >
            <span class="text-sm font-semibold text-primary">
              {{ userInitials }}
            </span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-foreground truncate">
              {{ userName }}
            </p>
            <p class="text-xs text-muted-foreground">{{ userPhone }}</p>
          </div>
          <button
            @click="handleLogout"
            class="text-muted-foreground hover:text-destructive transition-colors"
            title="Sign out"
          >
            <LogOut class="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Main content area -->
    <div class="flex-1 lg:ml-64 flex flex-col min-h-screen">
      <!-- Top header -->
      <header
        class="h-16 bg-white border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20"
      >
        <!-- Mobile: logo -->
        <div class="lg:hidden">
          <ThriftyLogo :size="28" text-size="1.1rem" />
        </div>

        <!-- Desktop: page title -->
        <div class="hidden lg:block">
          <h1 class="text-lg font-semibold text-foreground">
            {{ currentPageTitle }}
          </h1>
        </div>

        <!-- Right side -->
        <div class="flex items-center gap-3">
          <!-- Notification bell -->
          <button
            class="relative text-muted-foreground hover:text-foreground transition-colors"
          >
            <Bell class="w-5 h-5" />
            <span
              class="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full"
            ></span>
          </button>

          <!-- Avatar — mobile only -->
          <div
            class="lg:hidden w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"
          >
            <span class="text-xs font-semibold text-primary">{{
              userInitials
            }}</span>
          </div>
        </div>
      </header>

      <!-- Page content -->
      <main class="flex-1 p-4 lg:p-6 pb-24 lg:pb-6">
        <RouterView />
      </main>
    </div>

    <!-- Bottom tab bar — mobile only -->
    <nav
      class="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-border z-30 flex"
    >
      <RouterLink
        v-for="item in mobileNavItems"
        :key="item.name"
        :to="item.to"
        class="flex-1 flex flex-col items-center justify-center py-3 gap-1 text-xs transition-colors"
        :class="
          isActive(item.to)
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground'
        "
      >
        <component :is="item.icon" class="w-5 h-5" />
        <span>{{ item.name }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { RouterView, RouterLink, useRoute, useRouter } from "vue-router";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  User,
  LogOut,
  Bell,
} from "lucide-vue-next";
import ThriftyLogo from "@/components/ThriftyLogo.vue";
import NavItem from "@/components/NavItem.vue";
import { useAuthStore } from "@/stores/auth";

const route = useRouter();
const router = useRouter();
const authStore = useAuthStore();
const currentRoute = useRoute();

const navItems = [
  { name: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { name: "My Groups", to: "/groups", icon: Users },
  { name: "Payments", to: "/payments", icon: CreditCard },
  { name: "Profile", to: "/profile", icon: User },
];

const mobileNavItems = navItems;

const pageTitles = {
  "/dashboard": "Dashboard",
  "/groups": "My Groups",
  "/payments": "Payments",
  "/profile": "Profile",
};

const currentPageTitle = computed(() => {
  if (currentRoute.path.startsWith("/groups/") && currentRoute.params.id) {
    return "Group Detail";
  }
  return pageTitles[currentRoute.path] ?? "Thrifty";
});

const userName = computed(() => authStore.user?.fullName ?? "User");

const userPhone = computed(() => authStore.user?.phone ?? "");

const userInitials = computed(() => {
  const name = authStore.user?.fullName ?? "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
});

function isActive(path) {
  return currentRoute.path === path;
}

async function handleLogout() {
  await authStore.logout();
  router.push("/auth/login");
}
</script>