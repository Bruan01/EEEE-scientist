import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UILanguage } from "@/lib/i18n/types";

export function syncBrowserAccessToken(persistedToken?: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  const existingToken = localStorage.getItem("ds_access_token");
  if (persistedToken) {
    if (existingToken !== persistedToken) {
      localStorage.setItem("ds_access_token", persistedToken);
    }
    return;
  }

  if (!existingToken) {
    localStorage.removeItem("ds_access_token");
  }
}

interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  user_type: string;
  ui_language?: UILanguage | null;
  nationality?: string | null;
  google_picture?: string | null;
  avatar_url?: string | null;
  upgrade_interest_status?: string | null;
  upgrade_interest_marked_at?: string | null;
  upgrade_interest_source?: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setAuth: (user: User, token?: string | null) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,

      setAuth: (user, token) => {
        if (token) {
          localStorage.setItem("ds_access_token", token);
        } else {
          localStorage.removeItem("ds_access_token");
        }
        set({
          user,
          accessToken: token ?? null,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      updateUser: (updates) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : state.user,
        }));
      },

      logout: () => {
        localStorage.removeItem("ds_access_token");
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: "ds-auth-storage",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Mark hydration complete so route guards can render/redirect.
        state?.setLoading(false);

        // Keep apiClient's token source in sync with persisted state without
        // erasing a freshly-issued token that has not been mirrored into the
        // zustand snapshot yet. Route guards can validate that token via
        // /auth/me and then fully restore store state.
        syncBrowserAccessToken(state?.accessToken);
      },
    }
  )
);
