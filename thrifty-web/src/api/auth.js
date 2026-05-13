import api from "./axios";

export const authApi = {
  register(payload) {
    return api.post("/auth/register", payload);
  },

  login(payload) {
    return api.post("/auth/login", payload);
  },

  logout(payload) {
    return api.post("/auth/logout", payload);
  },

  refreshToken(refreshToken) {
    return api.post("/auth/refresh", { refreshToken });
  },

  getProfile() {
    return api.get("/users/me");
  },
};
