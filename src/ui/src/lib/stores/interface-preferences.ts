import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const STORAGE_KEY = 'ds-interface-preferences'

export interface InterfacePreferencesState {
  compactMode: boolean
  setCompactMode: (enabled: boolean) => void
  initInterfacePreferences: () => void
}

function readStoredCompactMode() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return false
    }
    const parsed = JSON.parse(raw) as { state?: { compactMode?: unknown }; compactMode?: unknown }
    return parsed.state?.compactMode === true || parsed.compactMode === true
  } catch {
    return false
  }
}

function applyCompactMode(enabled: boolean) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.classList.toggle('ds-compact-mode', enabled)
  document.documentElement.dataset.motionMode = enabled ? 'compact' : 'full'
}

export const useInterfacePreferencesStore = create<InterfacePreferencesState>()(
  persist(
    (set, get) => ({
      compactMode: readStoredCompactMode(),

      setCompactMode: (enabled) => {
        applyCompactMode(enabled)
        set({ compactMode: enabled })
      },

      initInterfacePreferences: () => {
        const compactMode = get().compactMode
        applyCompactMode(compactMode)
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ compactMode: state.compactMode }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyCompactMode(state.compactMode)
        }
      },
    }
  )
)
