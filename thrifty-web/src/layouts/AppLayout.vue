<template>
  <div class="min-h-screen bg-background flex">
    <!-- Sidebar — desktop only -->
    <aside
      class="hidden lg:flex flex-col w-64 bg-card border-r border-border fixed inset-y-0 left-0 z-30"
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
            <span class="text-sm font-semibold text-primary">{{
              userInitials
            }}</span>
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
        class="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20"
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
          <div class="relative">
            <button
              @click="toggleNotifications"
              class="relative text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <Bell class="w-5 h-5" />
              <span
                v-if="notificationsStore.unreadCount > 0"
                class="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center"
              >
                <span class="text-[10px] font-bold text-white">
                  {{
                    notificationsStore.unreadCount > 9
                      ? "9+"
                      : notificationsStore.unreadCount
                  }}
                </span>
              </span>
            </button>

            <!-- Notifications dropdown -->
            <div
              v-if="notificationsOpen"
              class="absolute right-0 top-10 w-80 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden"
            >
              <!-- Header -->
              <div
                class="flex items-center justify-between px-4 py-3 border-b border-border"
              >
                <p class="font-semibold text-sm text-foreground">
                  Notifications
                </p>
                <button
                  v-if="notificationsStore.unreadCount > 0"
                  @click="notificationsStore.markAllAsRead()"
                  class="text-xs text-primary hover:underline"
                >
                  Mark all read
                </button>
              </div>

              <!-- List -->
              <div class="max-h-96 overflow-y-auto">
                <div v-if="notificationsStore.loading" class="p-4 space-y-3">
                  <Skeleton v-for="i in 3" :key="i" class="h-14 rounded-lg" />
                </div>

                <div
                  v-else-if="notificationsStore.notifications.length === 0"
                  class="p-8 text-center"
                >
                  <Bell class="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p class="text-sm text-muted-foreground">
                    No notifications yet
                  </p>
                </div>

                <div v-else>
                  <button
                    v-for="notification in notificationsStore.notifications"
                    :key="notification.id"
                    class="w-full text-left px-4 py-3 hover:bg-secondary transition-colors border-b border-border last:border-0"
                    :class="!notification.isRead ? 'bg-primary/5' : ''"
                    @click="handleNotificationClick(notification)"
                  >
                    <div class="flex items-start gap-3">
                      <div
                        class="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        :class="
                          !notification.isRead ? 'bg-primary' : 'bg-transparent'
                        "
                      />
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-foreground">
                          {{ notification.title }}
                        </p>
                        <p
                          class="text-xs text-muted-foreground mt-0.5 line-clamp-2"
                        >
                          {{ notification.message }}
                        </p>
                        <p class="text-xs text-muted-foreground mt-1">
                          {{ formatNotificationDate(notification.createdAt) }}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

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
      class="lg:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border z-30 flex"
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

    <!-- Click outside to close notifications -->
    <div
      v-if="notificationsOpen"
      class="fixed inset-0 z-40"
      @click="notificationsOpen = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { RouterView, RouterLink, useRoute, useRouter } from "vue-router";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  User,
  LogOut,
  Bell,
} from "lucide-vue-next";
import { Skeleton } from "@/components/ui/skeleton";
import ThriftyLogo from "@/components/ThriftyLogo.vue";
import NavItem from "@/components/NavItem.vue";
import { useAuthStore } from "@/stores/auth";
import { useNotificationsStore } from "@/stores/notifications";

const router = useRouter();
const authStore = useAuthStore();
const currentRoute = useRoute();
const notificationsStore = useNotificationsStore();

const notificationsOpen = ref(false);

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

function toggleNotifications() {
  notificationsOpen.value = !notificationsOpen.value;
  if (notificationsOpen.value) {
    notificationsStore.fetchNotifications();
  }
}

async function handleNotificationClick(notification) {
  if (!notification.isRead) {
    await notificationsStore.markAsRead(notification.id);
  }
  notificationsOpen.value = false;
}

function formatNotificationDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

async function handleLogout() {
  await authStore.logout();
  router.push("/auth/login");
}

onMounted(() => {
  notificationsStore.fetchNotifications();
});
</script>