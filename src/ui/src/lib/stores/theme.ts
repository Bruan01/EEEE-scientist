import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  initTheme: () => void;
}

const SYSTEM_THEME_MEDIA = "(prefers-color-scheme: dark)";
let systemThemeCleanup: (() => void) | null = null;

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia(SYSTEM_THEME_MEDIA).matches ? "dark" : "light";
}

/**
 * Resolves the actual theme based on user preference and system settings
 */
function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") {
    return getSystemTheme();
  }
  return theme;
}

/**
 * Applies the theme to the document
 */
function applyTheme(resolved: ResolvedTheme) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;
  }
}

function syncSystemThemeSubscription(
  theme: Theme,
  onResolvedChange?: (resolved: ResolvedTheme) => void
) {
  if (systemThemeCleanup) {
    systemThemeCleanup();
    systemThemeCleanup = null;
  }
  if (theme !== "system" || typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return;
  }

  const mediaQuery = window.matchMedia(SYSTEM_THEME_MEDIA);
  const handleChange = () => {
    const resolved = resolveTheme("system");
    applyTheme(resolved);
    onResolvedChange?.(resolved);
  };

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleChange);
    systemThemeCleanup = () => mediaQuery.removeEventListener("change", handleChange);
    return;
  }

  mediaQuery.addListener(handleChange);
  systemThemeCleanup = () => mediaQuery.removeListener(handleChange);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "light",
      resolvedTheme: "light",

      setTheme: (theme: Theme) => {
        const resolved = resolveTheme(theme);
        applyTheme(resolved);
        syncSystemThemeSubscription(theme, (nextResolved) => {
          set({ resolvedTheme: nextResolved });
        });
        set({ theme, resolvedTheme: resolved });
      },

      initTheme: () => {
        const { theme } = get();
        const resolved = resolveTheme(theme);
        applyTheme(resolved);
        syncSystemThemeSubscription(theme, (nextResolved) => {
          set({ resolvedTheme: nextResolved });
        });
        set({ resolvedTheme: resolved });
      },
    }),
    {
      name: "ds-theme",
      partialize: (state) => ({
        theme: state.theme,
      }),
      onRehydrateStorage: () => (state) => {
        // After rehydration, apply the stored theme
        if (state) {
          const resolved = resolveTheme(state.theme);
          applyTheme(resolved);
          syncSystemThemeSubscription(state.theme);
          state.resolvedTheme = resolved;
        }
      },
    }
  )
);
