import { ref, watchEffect } from "vue";

const isDark = ref(localStorage.getItem("thrifty-theme") === "dark");

watchEffect(() => {
  if (isDark.value) {
    document.documentElement.classList.add("dark");
    localStorage.setItem("thrifty-theme", "dark");
  } else {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("thrifty-theme", "light");
  }
});

export function useTheme() {
  return {
    isDark,
    toggleTheme: () => (isDark.value = !isDark.value),
  };
}
