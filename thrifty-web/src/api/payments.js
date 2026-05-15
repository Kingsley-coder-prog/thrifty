import api from "./axios";

export const paymentsApi = {
  getMyContributions({ page = 1, limit = 20 } = {}) {
    return api.get("/contributions/my", { params: { page, limit } });
  },

  getMyPayouts({ page = 1, limit = 20 } = {}) {
    return api.get("/payouts/my", { params: { page, limit } });
  },
};
