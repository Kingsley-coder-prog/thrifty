<template>
  <div class="space-y-6 max-w-2xl">
    <!-- Page header -->
    <div>
      <h2 class="text-2xl font-bold text-foreground">Profile & Settings</h2>
      <p class="text-muted-foreground text-sm mt-1">
        Manage your account details and preferences
      </p>
    </div>

    <!-- Personal info card -->
    <div class="bg-white rounded-xl border border-border p-6 space-y-5">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-foreground">Personal Information</h3>
        <Badge :class="kycBadgeClass" class="text-xs">
          {{ kycLabel }}
        </Badge>
      </div>

      <!-- Avatar -->
      <div class="flex items-center gap-4">
        <div
          class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"
        >
          <span class="text-2xl font-bold text-primary">{{
            userInitials
          }}</span>
        </div>
        <div>
          <p class="font-semibold text-foreground text-lg">
            {{ user?.fullName ?? "—" }}
          </p>
          <p class="text-sm text-muted-foreground">{{ user?.phone ?? "—" }}</p>
        </div>
      </div>

      <Separator />

      <!-- Info fields -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p class="text-xs text-muted-foreground mb-1">Full Name</p>
          <p class="text-sm font-medium text-foreground">
            {{ user?.fullName ?? "—" }}
          </p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground mb-1">Phone Number</p>
          <p class="text-sm font-medium text-foreground">
            {{ user?.phone ?? "—" }}
          </p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground mb-1">Email</p>
          <p class="text-sm font-medium text-foreground">
            {{ user?.email ?? "Not provided" }}
          </p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground mb-1">Member Since</p>
          <p class="text-sm font-medium text-foreground">{{ memberSince }}</p>
        </div>
      </div>
    </div>

    <!-- Bank accounts card -->
    <div class="bg-white rounded-xl border border-border p-6 space-y-5">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-foreground">Bank Accounts</h3>
        <Button
          size="sm"
          class="bg-primary hover:bg-primary/90"
          @click="openAddBankDialog"
        >
          <Plus class="w-4 h-4 mr-1" />
          Add Account
        </Button>
      </div>

      <!-- Loading -->
      <div v-if="accountsLoading" class="space-y-3">
        <Skeleton v-for="i in 2" :key="i" class="h-16 rounded-lg" />
      </div>

      <!-- Empty state -->
      <div
        v-else-if="bankAccounts.length === 0"
        class="text-center py-8 border border-dashed border-border rounded-lg"
      >
        <CreditCard class="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p class="text-sm text-muted-foreground">No bank accounts yet</p>
        <p class="text-xs text-muted-foreground mt-1">
          Add a bank account to join savings groups
        </p>
      </div>

      <!-- Bank account list -->
      <div v-else class="space-y-3">
        <div
          v-for="account in bankAccounts"
          :key="account.id"
          class="flex items-center justify-between p-4 rounded-lg border border-border"
          :class="account.isPrimary ? 'border-primary/30 bg-primary/5' : ''"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center"
            >
              <Building2 class="w-5 h-5 text-zinc-500" />
            </div>
            <div>
              <p class="text-sm font-medium text-foreground">
                {{ account.bankName }}
                <Badge
                  v-if="account.isPrimary"
                  class="ml-2 bg-primary/10 text-primary text-xs"
                >
                  Primary
                </Badge>
              </p>
              <p class="text-xs text-muted-foreground">
                {{ account.accountName }} • ****{{ account.last4Digits }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <Button
              v-if="!account.isPrimary"
              variant="ghost"
              size="sm"
              class="text-xs text-muted-foreground"
              @click="handleSetPrimary(account.id)"
            >
              Set primary
            </Button>
            <Button
              v-if="!account.isPrimary"
              variant="ghost"
              size="sm"
              class="text-destructive hover:text-destructive"
              @click="handleRemoveAccount(account.id)"
            >
              <Trash2 class="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Security card -->
    <div class="bg-white rounded-xl border border-border p-6 space-y-4">
      <h3 class="font-semibold text-foreground">Security</h3>

      <div class="space-y-3">
        <div
          class="flex items-center justify-between py-3 border-b border-border last:border-0"
        >
          <div>
            <p class="text-sm font-medium text-foreground">Password</p>
            <p class="text-xs text-muted-foreground">
              Change your login password
            </p>
          </div>
          <Button variant="outline" size="sm">Change</Button>
        </div>
        <div class="flex items-center justify-between py-3">
          <div>
            <p class="text-sm font-medium text-foreground">Transaction PIN</p>
            <p class="text-xs text-muted-foreground">
              Change your 6-digit transaction PIN
            </p>
          </div>
          <Button variant="outline" size="sm">Change</Button>
        </div>
        <!-- App Preferences card -->
        <div class="bg-white rounded-xl border border-border p-6 space-y-4">
          <h3 class="font-semibold text-foreground">Preferences</h3>

          <div class="flex items-center justify-between py-3">
            <div>
              <p class="text-sm font-medium text-foreground">Dark Mode</p>
              <p class="text-xs text-muted-foreground">
                Switch between light and dark theme
              </p>
            </div>
            <button
              @click="toggleTheme"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              :class="isDark ? 'bg-primary' : 'bg-zinc-200'"
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                :class="isDark ? 'translate-x-6' : 'translate-x-1'"
              />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Danger zone -->
    <div class="bg-white rounded-xl border border-destructive/20 p-6 space-y-4">
      <h3 class="font-semibold text-destructive">Danger Zone</h3>
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-foreground">Sign out</p>
          <p class="text-xs text-muted-foreground">
            Sign out of your account on this device
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          class="border-destructive/30 text-destructive hover:bg-destructive/10"
          @click="handleLogout"
        >
          <LogOut class="w-4 h-4 mr-1" />
          Sign out
        </Button>
      </div>
    </div>
  </div>

  <!-- Add bank account dialog -->
  <Dialog v-model:open="addBankDialogOpen">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Add Bank Account</DialogTitle>
        <DialogDescription>
          Enter your bank account details to link it to your profile.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-2">
        <div class="space-y-2">
          <Label for="bank-name">Bank Name</Label>
          <Input
            id="bank-name"
            v-model="bankForm.bankName"
            placeholder="e.g. GTBank"
            :disabled="addingBank"
          />
        </div>
        <div class="space-y-2">
          <Label for="bank-code">Bank Code</Label>
          <Input
            id="bank-code"
            v-model="bankForm.bankCode"
            placeholder="e.g. 058"
            maxlength="10"
            :disabled="addingBank"
          />
        </div>
        <div class="space-y-2">
          <Label for="account-number">Account Number</Label>
          <Input
            id="account-number"
            v-model="bankForm.accountNumber"
            placeholder="10-digit account number"
            maxlength="10"
            inputmode="numeric"
            autocomplete="new-password"
            :disabled="addingBank"
          />
        </div>
        <div class="space-y-2">
          <Label for="bank-pin">Transaction PIN</Label>
          <Input
            id="bank-pin"
            v-model="bankForm.pin"
            type="password"
            placeholder="6-digit PIN"
            maxlength="6"
            inputmode="numeric"
            autocomplete="new-password"
            :disabled="addingBank"
          />
        </div>

        <div
          v-if="bankError"
          class="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg"
        >
          {{ bankError }}
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          @click="addBankDialogOpen = false"
          :disabled="addingBank"
        >
          Cancel
        </Button>
        <Button
          class="bg-primary hover:bg-primary/90"
          :disabled="addingBank || !bankFormValid"
          @click="handleAddBank"
        >
          <Loader2 v-if="addingBank" class="w-4 h-4 mr-2 animate-spin" />
          {{ addingBank ? "Adding..." : "Add Account" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- PIN dialog -->
  <Dialog v-model:open="pinDialogOpen">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>Enter Transaction PIN</DialogTitle>
        <DialogDescription>
          Enter your 6-digit PIN to confirm this action.
        </DialogDescription>
      </DialogHeader>
      <div class="space-y-4 py-2">
        <div class="space-y-2">
          <Label for="confirm-pin">Transaction PIN</Label>
          <Input
            id="confirm-pin"
            v-model="pin"
            type="password"
            placeholder="6-digit PIN"
            maxlength="6"
            inputmode="numeric"
            autofocus
          />
        </div>
        <div
          v-if="pinError"
          class="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg"
        >
          {{ pinError }}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="cancelPin">Cancel</Button>
        <Button
          class="bg-primary hover:bg-primary/90"
          :disabled="pin.length !== 6"
          @click="confirmPin"
        >
          Confirm
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  Plus,
  CreditCard,
  Building2,
  Trash2,
  LogOut,
  Loader2,
} from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/auth";
import { usersApi } from "@/api/users";
import { usePinDialog } from "@/composables/usePinDialog";
import { useTheme } from "@/composables/useTheme";
const { isDark, toggleTheme } = useTheme();

const router = useRouter();
const authStore = useAuthStore();

const user = computed(() => authStore.user);

const bankAccounts = ref([]);
const accountsLoading = ref(true);
const addBankDialogOpen = ref(false);
const addingBank = ref(false);
const bankError = ref("");

const bankForm = ref({
  bankName: "",
  bankCode: "",
  accountNumber: "",
  pin: "",
});

const { pinDialogOpen, pin, pinError, requestPin, confirmPin, cancelPin } =
  usePinDialog();

const bankFormValid = computed(
  () =>
    bankForm.value.bankName &&
    bankForm.value.bankCode &&
    bankForm.value.accountNumber.length === 10 &&
    bankForm.value.pin.length === 6
);

const userInitials = computed(() => {
  const name = user.value?.fullName ?? "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
});

const memberSince = computed(() => {
  if (!user.value?.createdAt) return "—";
  return new Date(user.value.createdAt).toLocaleDateString("en-NG", {
    month: "long",
    year: "numeric",
  });
});

const kycLabel = computed(
  () =>
    ({
      bvn_verified: "BVN Verified",
      pending: "Pending",
      rejected: "Rejected",
    }[user.value?.kycStatus] ?? user.value?.kycStatus)
);

const kycBadgeClass = computed(
  () =>
    ({
      bvn_verified: "bg-green-100 text-green-700",
      pending: "bg-amber-100 text-amber-700",
      rejected: "bg-red-100 text-red-700",
    }[user.value?.kycStatus] ?? "bg-zinc-100 text-zinc-700")
);

function openAddBankDialog() {
  bankForm.value = { bankName: "", bankCode: "", accountNumber: "", pin: "" };
  bankError.value = "";
  addBankDialogOpen.value = true;
}

async function handleAddBank() {
  bankError.value = "";
  addingBank.value = true;
  try {
    await usersApi.addBankAccount(
      {
        bankName: bankForm.value.bankName,
        bankCode: bankForm.value.bankCode,
        accountNumber: bankForm.value.accountNumber,
      },
      bankForm.value.pin
    );
    addBankDialogOpen.value = false;
    await loadBankAccounts();
  } catch (err) {
    const code = err.response?.data?.error;
    if (code === "PIN_INVALID") {
      bankError.value = "Incorrect PIN.";
    } else if (code === "BANK_ACCOUNT_ALREADY_LINKED") {
      bankError.value = "This account is already linked to your profile.";
    } else {
      bankError.value =
        err.response?.data?.meta?.message ?? "Something went wrong.";
    }
  } finally {
    addingBank.value = false;
  }
}

async function handleSetPrimary(accountId) {
  try {
    const enteredPin = await requestPin();
    await usersApi.setPrimaryAccount(accountId, enteredPin);
    await loadBankAccounts();
  } catch (err) {
    if (err.message === "PIN_CANCELLED") return;
    alert(
      err.response?.data?.meta?.message ?? "Failed to update primary account"
    );
  }
}

async function handleRemoveAccount(accountId) {
  if (!confirm("Remove this bank account?")) return;
  try {
    const enteredPin = await requestPin();
    await usersApi.removeAccount(accountId, enteredPin);
    await loadBankAccounts();
  } catch (err) {
    if (err.message === "PIN_CANCELLED") return;
    alert(err.response?.data?.meta?.message ?? "Failed to remove account");
  }
}

async function loadBankAccounts() {
  try {
    const { data } = await usersApi.getBankAccounts();
    bankAccounts.value = data.bankAccounts;
  } catch {
    bankAccounts.value = [];
  }
}

async function handleLogout() {
  await authStore.logout();
  router.push("/auth/login");
}

onMounted(async () => {
  await loadBankAccounts();
  accountsLoading.value = false;
});
</script>