<template>
  <div class="min-h-screen bg-background flex">
    <!-- Sidebar -->
    <aside
      class="hidden lg:flex flex-col w-64 bg-card border-r border-border fixed inset-y-0 left-0 z-30"
    >
      <!-- Logo -->
      <div class="h-16 flex items-center px-6 border-b border-border gap-3">
        <div
          class="w-8 h-8 bg-primary dark:bg-secondary rounded-lg flex items-center justify-center shrink-0"
        >
          <Shield class="w-4 h-4 text-primary-foreground" />
        </div>
        <div>
          <p class="font-bold text-foreground text-sm leading-none">
            Thrifty Admin
          </p>
          <p class="text-xs text-muted-foreground mt-0.5">{{ adminRole }}</p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        <p
          class="text-xs font-medium text-muted-foreground px-3 mb-3 uppercase tracking-wider"
        >
          Overview
        </p>
        <NavItem v-for="item in overviewNav" :key="item.name" :item="item" />

        <p
          class="text-xs font-medium text-muted-foreground px-3 mb-3 mt-6 uppercase tracking-wider"
        >
          Management
        </p>
        <NavItem v-for="item in managementNav" :key="item.name" :item="item" />

        <p
          class="text-xs font-medium text-muted-foreground px-3 mb-3 mt-6 uppercase tracking-wider"
        >
          Finance
        </p>
        <NavItem v-for="item in financeNav" :key="item.name" :item="item" />

        <p
          class="text-xs font-medium text-muted-foreground px-3 mb-3 mt-6 uppercase tracking-wider"
        >
          Compliance
        </p>
        <NavItem v-for="item in complianceNav" :key="item.name" :item="item" />
      </nav>

      <!-- Admin profile -->
      <div class="p-4 border-t border-border">
        <div class="flex items-center gap-3">
          <div
            class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center"
          >
            <span class="text-sm font-semibold text-primary">{{
              adminInitials
            }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-foreground truncate">
              {{ adminName }}
            </p>
            <p class="text-xs text-muted-foreground truncate">
              {{ adminEmail }}
            </p>
          </div>
          <!-- Dark mode toggle -->
          <button
            @click="toggleTheme"
            class="text-muted-foreground hover:text-foreground transition-colors"
            :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <Sun v-if="isDark" class="w-4 h-4 text-amber-400" />
            <Moon v-else class="w-4 h-4" />
          </button>
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

    <!-- Main content -->
    <div class="flex-1 lg:ml-64 flex flex-col min-h-screen">
      <!-- Header -->
      <header
        class="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20"
      >
        <div class="hidden lg:block">
          <h1 class="text-lg font-semibold text-foreground">
            {{ currentPageTitle }}
          </h1>
        </div>
        <div class="lg:hidden font-bold text-foreground">Thrifty Admin</div>

        <!-- Right side -->
        <div class="flex items-center gap-3">
          <!-- Mobile dark mode toggle -->
          <button
            @click="toggleTheme"
            class="lg:hidden text-muted-foreground hover:text-foreground transition-colors p-1"
            :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <Sun v-if="isDark" class="w-4 h-4 text-amber-400" />
            <Moon v-else class="w-4 h-4" />
          </button>
          <Badge
            class="bg-primary/10 text-primary border border-primary/20 text-xs hover:bg-primary hover:text-white transition-colors cursor-default"
          >
            {{ adminRole }}
          </Badge>
        </div>
      </header>

      <!-- Page content -->
      <main class="flex-1 p-4 lg:p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import {
  LayoutDashboard,
  Users,
  Users2,
  CreditCard,
  Banknote,
  AlertTriangle,
  MessageSquare,
  ScrollText,
  Shield,
  LogOut,
  Sun,
  Moon,
} from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import NavItem from "@/components/NavItem.vue";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/composables/useTheme";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { isDark, toggleTheme } = useTheme();

const overviewNav = [
  { name: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
];

const managementNav = [
  { name: "Users", to: "/users", icon: Users },
  { name: "Groups", to: "/groups", icon: Users2 },
];

const financeNav = [
  { name: "Contributions", to: "/contributions", icon: CreditCard },
  { name: "Payouts", to: "/payouts", icon: Banknote },
];

const complianceNav = [
  { name: "Fraud Flags", to: "/fraud", icon: AlertTriangle },
  { name: "Disputes", to: "/disputes", icon: MessageSquare },
  { name: "Audit Logs", to: "/audit", icon: ScrollText },
];

const pageTitles = {
  "/dashboard": "Dashboard",
  "/users": "Users",
  "/groups": "Groups",
  "/contributions": "Contributions",
  "/payouts": "Payouts",
  "/fraud": "Fraud Flags",
  "/disputes": "Disputes",
  "/audit": "Audit Logs",
};

const currentPageTitle = computed(() => {
  if (route.path.startsWith("/users/") && route.params.id) return "User Detail";
  return pageTitles[route.path] ?? "Thrifty Admin";
});

const adminName = computed(() => authStore.admin?.fullName ?? "Admin");
const adminEmail = computed(() => authStore.admin?.email ?? "");
const adminRole = computed(() => {
  const roles = {
    super_admin: "Super Admin",
    operations: "Operations",
    finance: "Finance",
    compliance: "Compliance",
    support: "Support",
  };
  return roles[authStore.admin?.role] ?? authStore.admin?.role ?? "Admin";
});
const adminInitials = computed(() => {
  const name = authStore.admin?.fullName ?? "A";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
});

async function handleLogout() {
  await authStore.logout();
  router.push("/auth/login");
}
</script>