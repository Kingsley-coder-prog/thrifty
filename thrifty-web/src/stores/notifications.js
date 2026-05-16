import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { notificationsApi } from "@/api/notifications";

export const useNotificationsStore = defineStore("notifications", () => {
  const notifications = ref([]);
  const loading = ref(false);

  const unreadCount = computed(
    () => notifications.value.filter((n) => !n.isRead).length,
  );

  async function fetchNotifications() {
    loading.value = true;
    try {
      const { data } = await notificationsApi.getMyNotifications();
      notifications.value = data.notifications ?? [];
    } catch {
      notifications.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function markAsRead(id) {
    await notificationsApi.markAsRead(id);
    const n = notifications.value.find((n) => n.id === id);
    if (n) n.isRead = true;
  }

  async function markAllAsRead() {
    await notificationsApi.markAllAsRead();
    notifications.value.forEach((n) => {
      n.isRead = true;
    });
  }

  return {
    notifications,
    loading,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
});
