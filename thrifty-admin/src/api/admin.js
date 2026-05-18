import api from "./axios";

export const adminApi = {
  getDashboard() {
    return api.get("/admin/dashboard");
  },

  // Users
  getUsers({ page = 1, limit = 20, status, kycStatus } = {}) {
    return api.get("/admin/users", {
      params: { page, limit, status, kycStatus },
    });
  },

  getUserDetail(id) {
    return api.get(`/admin/users/${id}`);
  },

  freezeUser(id, reason) {
    return api.patch(`/admin/users/${id}/freeze`, { reason });
  },

  unfreezeUser(id, reason) {
    return api.patch(`/admin/users/${id}/unfreeze`, { reason });
  },

  // Groups
  getGroups({ page = 1, limit = 20, status, tierId } = {}) {
    return api.get("/admin/groups", {
      params: { page, limit, status, tierId },
    });
  },

  freezeGroup(id, reason) {
    return api.patch(`/admin/groups/${id}/freeze`, { reason });
  },

  unfreezeGroup(id, reason) {
    return api.patch(`/admin/groups/${id}/unfreeze`, { reason });
  },

  // Finance
  getContributions({ page = 1, limit = 20, status, cycleId } = {}) {
    return api.get("/admin/contributions", {
      params: { page, limit, status, cycleId },
    });
  },

  getPayouts({ page = 1, limit = 20, status } = {}) {
    return api.get("/admin/payouts", { params: { page, limit, status } });
  },

  // Compliance
  getFraudFlags({ page = 1, limit = 20, status = "open" } = {}) {
    return api.get("/admin/fraud-flags", { params: { page, limit, status } });
  },

  resolveFraudFlag(id, { resolution, notes }) {
    return api.patch(`/admin/fraud-flags/${id}/resolve`, { resolution, notes });
  },

  getDisputes({ page = 1, limit = 20, status = "open" } = {}) {
    return api.get("/admin/disputes", { params: { page, limit, status } });
  },

  resolveDispute(id, { resolution, notes }) {
    return api.patch(`/admin/disputes/${id}/resolve`, { resolution, notes });
  },

  // Audit
  getAuditLogs({ page = 1, limit = 50, eventType, actorId } = {}) {
    return api.get("/admin/audit-logs", {
      params: { page, limit, eventType, actorId },
    });
  },
};
