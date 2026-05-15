import { ref, watch, onMounted } from "vue";

const isDark = ref(false);

export function useTheme() {
  function applyTheme(dark) {
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  function toggleTheme() {
    isDark.value = !isDark.value;
    applyTheme(isDark.value);
  }

  function initTheme() {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    isDark.value = saved ? saved === "dark" : prefersDark;
    applyTheme(isDark.value);
  }

  return { isDark, toggleTheme, initTheme };
}
