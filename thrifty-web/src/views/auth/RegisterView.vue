<template>
  <AuthLayout>
    <div
      class="bg-white/85 backdrop-blur-sm rounded-2xl p-8 border border-green-100 shadow-sm"
    >
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-foreground">Create your account</h1>
        <p class="text-muted-foreground mt-1 text-sm">
          Join thousands saving together with Thrifty
        </p>
      </div>

      <form @submit.prevent="handleRegister" class="space-y-5">
        <div class="space-y-2">
          <Label for="fullName">Full name</Label>
          <Input
            id="fullName"
            v-model="form.fullName"
            type="text"
            placeholder="Ifeanyi Nwankwo"
            :disabled="loading"
            autocomplete="name"
          />
        </div>

        <div class="space-y-2">
          <Label for="phone">Phone number</Label>
          <Input
            id="phone"
            v-model="form.phone"
            type="tel"
            placeholder="08012345678"
            :disabled="loading"
            autocomplete="tel"
          />
        </div>

        <div class="space-y-2">
          <Label for="bvn">BVN</Label>
          <Input
            id="bvn"
            v-model="form.bvn"
            type="text"
            placeholder="11-digit BVN"
            :disabled="loading"
            maxlength="11"
          />
          <p class="text-xs text-muted-foreground">
            Your BVN is used for identity verification only
          </p>
        </div>

        <div class="space-y-2">
          <Label for="reg-password">Password</Label>
          <div class="relative">
            <Input
              id="reg-password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Min 8 characters"
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
          <p class="text-xs text-muted-foreground">
            Min 8 characters, must include uppercase, number and special
            character
          </p>
        </div>

        <div class="space-y-2">
          <Label for="pin">Transaction PIN</Label>
          <Input
            id="pin"
            v-model="form.pin"
            type="password"
            placeholder="6-digit PIN"
            :disabled="loading"
            maxlength="6"
            inputmode="numeric"
          />
          <p class="text-xs text-muted-foreground">
            Used to authorise payments and group joins
          </p>
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
          {{ loading ? "Creating account..." : "Create account" }}
        </Button>
      </form>

      <div class="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?
        <RouterLink
          to="/auth/login"
          class="text-primary font-medium hover:underline ml-1"
        >
          Sign in
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

const form = reactive({
  fullName: "",
  phone: "",
  bvn: "",
  password: "",
  pin: "",
});
const loading = computed(() => authStore.loading);
const error = ref("");
const showPassword = ref(false);

async function handleRegister() {
  error.value = "";

  if (
    !form.fullName ||
    !form.phone ||
    !form.bvn ||
    !form.password ||
    !form.pin
  ) {
    error.value = "Please fill in all fields";
    return;
  }

  if (form.bvn.length !== 11) {
    error.value = "BVN must be exactly 11 digits";
    return;
  }

  if (form.pin.length !== 6) {
    error.value = "PIN must be exactly 6 digits";
    return;
  }

  try {
    await authStore.register({
      fullName: form.fullName,
      phone: form.phone,
      bvn: form.bvn,
      password: form.password,
      pin: form.pin,
    });
    router.push("/dashboard");
  } catch (err) {
    const code = err.response?.data?.error;
    const fields = err.response?.data?.fields;

    if (fields && fields.length > 0) {
      // show all validation errors joined together
      error.value = fields.map((f) => f.message).join(" • ");
    } else if (code === "PHONE_ALREADY_REGISTERED") {
      error.value = "This phone number is already registered. Sign in instead.";
    } else if (code === "BVN_ALREADY_REGISTERED") {
      error.value = "This BVN is already linked to an account.";
    } else if (code === "BVN_INVALID") {
      error.value = "We could not verify your BVN. Please check and try again.";
    } else if (code === "BVN_NAME_MISMATCH") {
      error.value =
        "The name you entered does not match your BVN record. Please use your name exactly as registered with your bank.";
    } else {
      error.value =
        err.response?.data?.meta?.message ??
        "Something went wrong. Please try again.";
    }
  }
}
</script>