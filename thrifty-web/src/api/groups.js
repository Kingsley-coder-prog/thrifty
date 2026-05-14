import api from "./axios";

export const groupsApi = {
  getTiers() {
    return api.get("/groups/tiers");
  },

  getMyGroups() {
    return api.get("/groups/my");
  },

  getOpenGroups(tierId) {
    return api.get("/groups", { params: { tierId } });
  },

  getGroupById(id) {
    return api.get(`/groups/${id}`);
  },

  joinGroup(tierId, pin) {
    return api.post(
      "/groups/join",
      { tierId },
      {
        headers: { "X-Transaction-Pin": pin },
      },
    );
  },
};
