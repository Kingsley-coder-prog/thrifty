import { ref } from "vue";

export function usePinDialog() {
  const pinDialogOpen = ref(false);
  const pin = ref("");
  const pinError = ref("");
  const pinLoading = ref(false);
  let resolveFn = null;

  function requestPin() {
    pin.value = "";
    pinError.value = "";
    pinDialogOpen.value = true;

    return new Promise((resolve, reject) => {
      resolveFn = { resolve, reject };
    });
  }

  function confirmPin() {
    if (pin.value.length !== 6) {
      pinError.value = "PIN must be exactly 6 digits";
      return;
    }
    pinDialogOpen.value = false;
    resolveFn?.resolve(pin.value);
  }

  function cancelPin() {
    pinDialogOpen.value = false;
    resolveFn?.reject(new Error("PIN_CANCELLED"));
  }

  return {
    pinDialogOpen,
    pin,
    pinError,
    pinLoading,
    requestPin,
    confirmPin,
    cancelPin,
  };
}
