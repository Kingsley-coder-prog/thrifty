import api from "./axios";

export const usersApi = {
  getProfile() {
    return api.get("/users/me");
  },

  updateProfile(payload) {
    return api.patch("/users/me", payload);
  },

  getBankAccounts() {
    return api.get("/users/me/bank-accounts");
  },

  addBankAccount(payload, pin) {
    return api.post("/users/me/bank-accounts", payload, {
      headers: { "X-Transaction-Pin": pin },
    });
  },

  setPrimaryAccount(id, pin) {
    return api.patch(
      `/users/me/bank-accounts/${id}/primary`,
      {},
      {
        headers: { "X-Transaction-Pin": pin },
      },
    );
  },

  removeAccount(id, pin) {
    return api.delete(`/users/me/bank-accounts/${id}`, {
      headers: { "X-Transaction-Pin": pin },
    });
  },
};
