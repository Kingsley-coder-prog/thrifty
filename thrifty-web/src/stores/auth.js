import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { authApi } from "@/api/auth";

export const useAuthStore = defineStore("auth", () => {
  const user = ref(null);
  const accessToken = ref(localStorage.getItem("accessToken") ?? null);
  const refreshToken = ref(localStorage.getItem("refreshToken") ?? null);
  const loading = ref(false);

  const isLoggedIn = computed(() => !!accessToken.value);

  function saveTokens(tokens) {
    accessToken.value = tokens.accessToken;
    refreshToken.value = tokens.refreshToken;
    localStorage.setItem("accessToken", tokens.accessToken);
    localStorage.setItem("refreshToken", tokens.refreshToken);
  }

  function clearTokens() {
    accessToken.value = null;
    refreshToken.value = null;
    user.value = null;
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  }

  async function register(payload) {
    loading.value = true;
    try {
      const { data } = await authApi.register(payload);
      saveTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      user.value = data.user;
      try {
        await fetchProfile();
      } catch {}
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function login(payload) {
    loading.value = true;
    try {
      const { data } = await authApi.login(payload);
      saveTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      user.value = data.user;
      try {
        await fetchProfile();
      } catch {}
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    loading.value = true;
    try {
      if (refreshToken.value) {
        await authApi.logout({ refreshToken: refreshToken.value });
      }
    } catch {
      // logout silently even if API call fails
    } finally {
      clearTokens();
      loading.value = false;
    }
  }

  async function fetchProfile() {
    const { data } = await authApi.getProfile();
    user.value = data.user;
    return data.user;
  }

  async function init() {
    if (accessToken.value) {
      try {
        await fetchProfile();
      } catch {
        clearTokens();
      }
    }
  }

  return {
    user,
    accessToken,
    refreshToken,
    loading,
    isLoggedIn,
    register,
    login,
    logout,
    fetchProfile,
    init,
  };
});
