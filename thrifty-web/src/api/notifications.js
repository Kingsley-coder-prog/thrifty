import api from "./axios";

export const notificationsApi = {
  getMyNotifications({ page = 1, limit = 20 } = {}) {
    return api.get("/notifications/my", { params: { page, limit } });
  },

  markAsRead(id) {
    return api.patch(`/notifications/my/${id}/read`);
  },

  markAllAsRead() {
    return api.patch("/notifications/my/read-all");
  },
};
