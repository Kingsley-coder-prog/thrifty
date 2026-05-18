import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { authApi } from "@/api/auth";

export const useAuthStore = defineStore("auth", () => {
  const admin = ref(null);
  const token = ref(localStorage.getItem("adminToken") ?? null);
  const loading = ref(false);

  const isLoggedIn = computed(() => !!token.value);

  function saveToken(t) {
    token.value = t;
    localStorage.setItem("adminToken", t);
  }

  function clearToken() {
    token.value = null;
    admin.value = null;
    localStorage.removeItem("adminToken");
  }

  async function login(payload) {
    loading.value = true;
    try {
      const { data } = await authApi.login(payload);
      saveToken(data.token);
      admin.value = data.admin;
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    loading.value = true;
    try {
      await authApi.logout();
    } catch {
    } finally {
      clearToken();
      loading.value = false;
    }
  }

  async function fetchProfile() {
    const { data } = await authApi.getProfile();
    admin.value = data.admin;
    return data.admin;
  }

  async function init() {
    if (token.value) {
      try {
        await fetchProfile();
      } catch {
        clearToken();
      }
    }
  }

  return {
    admin,
    token,
    loading,
    isLoggedIn,
    login,
    logout,
    fetchProfile,
    init,
  };
});
