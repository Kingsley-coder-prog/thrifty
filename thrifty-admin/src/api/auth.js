import api from "./axios";

export const authApi = {
  login(payload) {
    return api.post("/admin/auth/login", payload);
  },
  logout() {
    return api.post("/admin/auth/logout");
  },
  getProfile() {
    return api.get("/admin/auth/me");
  },
};
