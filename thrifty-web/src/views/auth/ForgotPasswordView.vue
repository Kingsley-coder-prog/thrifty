<template>
  <AuthLayout>
    <div
      class="bg-white/85 backdrop-blur-sm rounded-2xl p-8 border border-green-100 shadow-sm"
    >
      <div class="mb-8">
        <RouterLink
          to="/auth/login"
          class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft class="w-4 h-4" />
          Back to sign in
        </RouterLink>
        <h1 class="text-2xl font-bold text-foreground">Reset your password</h1>
        <p class="text-muted-foreground mt-1 text-sm">
          Enter your phone number and we'll send you a reset code
        </p>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-5">
        <div class="space-y-2">
          <Label for="phone">Phone number</Label>
          <Input
            id="phone"
            v-model="phone"
            type="tel"
            placeholder="08012345678"
            :disabled="loading"
          />
        </div>

        <div
          v-if="error"
          class="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg"
        >
          {{ error }}
        </div>

        <div
          v-if="success"
          class="text-sm text-primary bg-primary/10 px-3 py-2 rounded-lg"
        >
          Reset code sent. Check your phone.
        </div>

        <Button
          type="submit"
          class="w-full bg-primary hover:bg-primary/90"
          :disabled="loading || success"
        >
          <Loader2 v-if="loading" class="w-4 h-4 mr-2 animate-spin" />
          {{ loading ? "Sending..." : "Send reset code" }}
        </Button>
      </form>
    </div>
  </AuthLayout>
</template>

<script setup>
import { ref } from "vue";
import { RouterLink } from "vue-router";
import { ArrowLeft, Loader2 } from "lucide-vue-next";
import AuthLayout from "@/layouts/AuthLayout.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const phone = ref("");
const loading = ref(false);
const error = ref("");
const success = ref(false);

async function handleSubmit() {
  error.value = "";
  loading.value = true;
  try {
    await new Promise((r) => setTimeout(r, 1000));
    success.value = true;
  } catch (err) {
    error.value = err.message ?? "Something went wrong. Please try again.";
  } finally {
    loading.value = false;
  }
}
</script>