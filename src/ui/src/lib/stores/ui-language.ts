import { create } from 'zustand'
import { updateMyProfile } from '@/lib/api/users'
import {
  getDefaultLanguageFromNationality,
  normalizeUILanguage,
  type UILanguage,
} from '@/lib/i18n/types'
import { useAuthStore } from '@/lib/stores/auth'

export type UILanguageSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const UI_LANGUAGE_STORAGE_KEY = 'ds:ui-language'

type UiLanguageState = {
  language: UILanguage
  lastSavedLanguage: UILanguage
  pendingLanguage: UILanguage | null
  saveStatus: UILanguageSaveStatus
  saveError: string | null
  requestSeq: number
  hydrated: boolean
  hydrateFromPersistence: () => void
  hydrateFromUser: (uiLanguage: unknown, nationality?: unknown) => void
  saveLanguagePreference: (value: UILanguage) => Promise<void>
  retrySaveLanguagePreference: () => Promise<void>
}

const readPersistedUiLanguage = (): UILanguage | null => {
  if (typeof window === 'undefined') return null

  try {
    const direct = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY)
    if (direct) return normalizeUILanguage(direct, 'en')
  } catch {
    // ignore
  }

  try {
    const raw = window.localStorage.getItem('ds-auth-storage')
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      state?: { user?: { ui_language?: unknown } }
      user?: { ui_language?: unknown }
    }
    const persisted = parsed?.state?.user?.ui_language ?? parsed?.user?.ui_language
    if (persisted === undefined || persisted === null) return null
    return normalizeUILanguage(persisted, 'en')
  } catch {
    return null
  }
}

const readBrowserUiLanguage = (): UILanguage => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'en'
  try {
    const candidates: Array<string> = []
    if (typeof navigator.language === 'string') candidates.push(navigator.language)
    if (Array.isArray(navigator.languages)) {
      for (const item of navigator.languages) {
        if (typeof item === 'string') candidates.push(item)
      }
    }
    for (const candidate of candidates) {
      const normalized = normalizeUILanguage(candidate, 'en')
      if (normalized) return normalized
    }
  } catch {
    // ignore
  }
  return 'en'
}

const writePersistedUiLanguage = (value: UILanguage) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, value)
  } catch {
    // ignore
  }
}

const extractErrorMessage = (error: unknown): string => {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) {
    return detail
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return 'Failed to save language preference'
}

const readAuthStoreState = () => {
  const store = useAuthStore as typeof useAuthStore & {
    getState?: () => {
      user?: { ui_language?: unknown; nationality?: unknown }
      isAuthenticated?: boolean
      accessToken?: string | null
      updateUser?: (payload: { ui_language?: UILanguage }) => void
    }
  }
  if (typeof store.getState === 'function') {
    return (
      store.getState() ?? {
        user: undefined,
        isAuthenticated: false,
        accessToken: null,
        updateUser: () => undefined,
      }
    )
  }
  return {
    user: undefined,
    isAuthenticated: false,
    accessToken: null,
    updateUser: () => undefined,
  }
}

const initialLanguage: UILanguage = 'en'

export const useUILanguageStore = create<UiLanguageState>()((set, get) => ({
  language: initialLanguage,
  lastSavedLanguage: initialLanguage,
  pendingLanguage: null,
  saveStatus: 'idle',
  saveError: null,
  requestSeq: 0,
  hydrated: false,

  hydrateFromPersistence: () => {
    const normalized =
      readPersistedUiLanguage() ??
      normalizeUILanguage(
        readAuthStoreState().user?.ui_language,
        getDefaultLanguageFromNationality(readAuthStoreState().user?.nationality)
      )

    set((state) => {
      if (state.saveStatus === 'saving' || state.saveStatus === 'error') {
        return state
      }
      if (state.hydrated && state.lastSavedLanguage === normalized && state.language === normalized) {
        return state
      }
      return {
        ...state,
        language: normalized,
        lastSavedLanguage: normalized,
        pendingLanguage: null,
        hydrated: true,
      }
    })

    writePersistedUiLanguage(normalized)
  },

  hydrateFromUser: (uiLanguage, nationality) => {
    const normalized = normalizeUILanguage(
      uiLanguage,
      getDefaultLanguageFromNationality(nationality)
    )
    set((state) => {
      if (state.saveStatus === 'saving' || state.saveStatus === 'error') {
        return state
      }
      if (state.hydrated && state.lastSavedLanguage === normalized && state.language === normalized) {
        return state
      }
      return {
        ...state,
        language: normalized,
        lastSavedLanguage: normalized,
        pendingLanguage: null,
        hydrated: true,
      }
    })

    writePersistedUiLanguage(normalized)
  },

  saveLanguagePreference: async (value) => {
    const targetLanguage = normalizeUILanguage(value, 'en')
    const seq = get().requestSeq + 1

    set((state) => ({
      ...state,
      language: targetLanguage,
      pendingLanguage: targetLanguage,
      saveStatus: 'saving',
      saveError: null,
      requestSeq: seq,
      hydrated: true,
    }))
    readAuthStoreState().updateUser?.({ ui_language: targetLanguage })
    writePersistedUiLanguage(targetLanguage)

    const authState = readAuthStoreState()
    if (!authState.isAuthenticated || !authState.accessToken) {
      // For unauthenticated pages, persist locally but skip backend update.
      if (get().requestSeq !== seq) return
      set((state) => ({
        ...state,
        lastSavedLanguage: targetLanguage,
        pendingLanguage: null,
        saveStatus: 'saved',
        saveError: null,
      }))
      return
    }

    try {
      const profile = await updateMyProfile({ ui_language: targetLanguage })
      const serverLanguage = normalizeUILanguage(profile.ui_language, targetLanguage)
      if (get().requestSeq !== seq) return

      set((state) => ({
        ...state,
        language: serverLanguage,
        lastSavedLanguage: serverLanguage,
        pendingLanguage: null,
        saveStatus: 'saved',
        saveError: null,
      }))
      readAuthStoreState().updateUser?.({ ui_language: serverLanguage })
      writePersistedUiLanguage(serverLanguage)
    } catch (error) {
      if (get().requestSeq !== seq) return

      const rollbackLanguage = get().lastSavedLanguage
      set((state) => ({
        ...state,
        language: rollbackLanguage,
        pendingLanguage: targetLanguage,
        saveStatus: 'error',
        saveError: extractErrorMessage(error),
      }))
      readAuthStoreState().updateUser?.({ ui_language: rollbackLanguage })
      writePersistedUiLanguage(rollbackLanguage)
    }
  },

  retrySaveLanguagePreference: async () => {
    const target = get().pendingLanguage
    if (!target) return
    await get().saveLanguagePreference(target)
  },
}))
