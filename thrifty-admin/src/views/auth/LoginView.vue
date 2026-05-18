<template>
  <div class="min-h-screen bg-slate-950 flex items-center justify-center px-4">
    <!-- Background grid pattern -->
    <div
      class="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-40"
    />

    <div class="relative w-full max-w-md space-y-8">
      <!-- Logo -->
      <div class="text-center">
        <div class="flex items-center justify-center gap-3 mb-2">
          <div
            class="w-10 h-10 bg-primary rounded-xl flex items-center justify-center"
          >
            <Shield class="w-5 h-5 text-white" />
          </div>
          <span class="text-2xl font-bold text-white">Thrifty Admin</span>
        </div>
        <p class="text-slate-400 text-sm">Internal management console</p>
      </div>

      <!-- Login card -->
      <div
        class="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl"
      >
        <div class="mb-6">
          <h1 class="text-xl font-bold text-white">Sign in</h1>
          <p class="text-slate-400 text-sm mt-1">Access the admin dashboard</p>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-5">
          <div class="space-y-2">
            <Label for="email" class="text-slate-300">Email address</Label>
            <Input
              id="email"
              v-model="form.email"
              type="email"
              placeholder="admin@thrifty.ng"
              :disabled="loading"
              autocomplete="email"
              class="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-primary"
            />
          </div>

          <div class="space-y-2">
            <Label for="password" class="text-slate-300">Password</Label>
            <div class="relative">
              <Input
                id="password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Enter your password"
                :disabled="loading"
                autocomplete="current-password"
                class="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-primary pr-10"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                @click="showPassword = !showPassword"
              >
                <Eye v-if="!showPassword" class="w-4 h-4" />
                <EyeOff v-else class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            v-if="error"
            class="text-sm text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-lg"
          >
            {{ error }}
          </div>

          <Button
            type="submit"
            class="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold"
            :disabled="loading"
          >
            <Loader2 v-if="loading" class="w-4 h-4 mr-2 animate-spin" />
            {{ loading ? "Signing in..." : "Sign in" }}
          </Button>
        </form>
      </div>

      <p class="text-center text-xs text-slate-500">
        Thrifty Admin Console — Restricted Access
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from "vue";
import { useRouter } from "vue-router";
import { Shield, Eye, EyeOff, Loader2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const authStore = useAuthStore();

const form = reactive({ email: "", password: "" });
const showPassword = ref(false);
const error = ref("");
const loading = computed(() => authStore.loading);

async function handleLogin() {
  error.value = "";

  if (!form.email || !form.password) {
    error.value = "Please fill in all fields";
    return;
  }

  try {
    await authStore.login({
      email: form.email,
      password: form.password,
    });
    router.push("/dashboard");
  } catch (err) {
    const code = err.response?.data?.error;
    if (code === "ADMIN_INVALID_CREDENTIALS") {
      error.value = "Invalid email or password.";
    } else if (code === "ADMIN_ACCOUNT_LOCKED") {
      error.value =
        "Account locked due to too many failed attempts. Try again later.";
    } else {
      error.value =
        err.response?.data?.meta?.message ?? "Something went wrong.";
    }
  }
}
</script>