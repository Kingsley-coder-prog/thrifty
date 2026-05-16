<template>
  <AuthLayout>
    <div
      class="bg-card/85 backdrop-blur-sm rounded-2xl p-8 border border-green-100 shadow-sm"
    >
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-foreground">Welcome back</h1>
        <p class="text-muted-foreground mt-1 text-sm">
          Sign in to continue saving with your group
        </p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-5">
        <div class="space-y-2">
          <Label for="phone">Phone number</Label>
          <Input
            id="phone"
            v-model="form.phone"
            type="tel"
            placeholder="08012345678"
            :disabled="loading"
            autocomplete="new-tel"
          />
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label for="password">Password</Label>
            <RouterLink
              to="/auth/forgot-password"
              class="text-xs text-primary hover:underline"
            >
              Forgot password?
            </RouterLink>
          </div>
          <div class="relative">
            <Input
              id="password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Enter your password"
              :disabled="loading"
              autocomplete="new-password"
              class="pr-10"
            />
            <button
              type="button"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              @click="showPassword = !showPassword"
            >
              <Eye v-if="!showPassword" class="w-4 h-4" />
              <EyeOff v-else class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          v-if="error"
          class="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg"
        >
          {{ error }}
        </div>

        <Button
          type="submit"
          class="w-full bg-primary hover:bg-primary/90"
          :disabled="loading"
        >
          <Loader2 v-if="loading" class="w-4 h-4 mr-2 animate-spin" />
          {{ loading ? "Signing in..." : "Sign in" }}
        </Button>
      </form>

      <div class="mt-6 text-center text-sm text-muted-foreground">
        Don't have an account?
        <RouterLink
          to="/auth/register"
          class="text-primary font-medium hover:underline ml-1"
        >
          Create one
        </RouterLink>
      </div>
    </div>
  </AuthLayout>
</template>

<script setup>
import { ref, reactive, computed } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { Eye, EyeOff, Loader2 } from "lucide-vue-next";
import AuthLayout from "@/layouts/AuthLayout.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const authStore = useAuthStore();

const form = reactive({ phone: "", password: "" });
const loading = computed(() => authStore.loading);
const error = ref("");
const showPassword = ref(false);

async function handleLogin() {
  error.value = "";

  if (!form.phone || !form.password) {
    error.value = "Please fill in all fields";
    return;
  }

  try {
    await authStore.login({
      phone: form.phone,
      password: form.password,
    });
    router.push("/dashboard");
  } catch (err) {
    error.value =
      err.response?.data?.error === "INVALID_CREDENTIALS"
        ? "Incorrect phone number or password"
        : err.response?.data?.meta?.message ??
          "Something went wrong. Please try again.";
  }
}
</script>