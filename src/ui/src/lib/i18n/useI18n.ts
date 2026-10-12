import { useCallback, useEffect } from 'react'
import { I18N_MESSAGES, type I18nNamespace } from '@/lib/i18n/messages'
import { normalizeUILanguage } from '@/lib/i18n/types'
import { useAuthStore } from '@/lib/stores/auth'
import { useUILanguageStore } from '@/lib/stores/ui-language'

const interpolate = (template: string, variables?: Record<string, string | number>): string => {
  if (!variables) return template
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const value = variables[key]
    if (value === undefined || value === null) return ''
    return String(value)
  })
}

const humanizeMissingKey = (key: string): string => {
  const normalized = key.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!normalized) return key
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function useUILanguage() {
  const authLanguage = useAuthStore((state) => state.user?.ui_language)
  const authNationality = useAuthStore((state) => state.user?.nationality)
  const language = useUILanguageStore((state) => state.language)
  const hydrated = useUILanguageStore((state) => state.hydrated)
  const saveStatus = useUILanguageStore((state) => state.saveStatus)
  const saveError = useUILanguageStore((state) => state.saveError)
  const hydrateFromPersistence = useUILanguageStore((state) => state.hydrateFromPersistence)
  const hydrateFromUser = useUILanguageStore((state) => state.hydrateFromUser)
  const saveLanguagePreference = useUILanguageStore((state) => state.saveLanguagePreference)
  const retrySaveLanguagePreference = useUILanguageStore((state) => state.retrySaveLanguagePreference)

  useEffect(() => {
    if (hydrated) return
    hydrateFromPersistence()
  }, [hydrateFromPersistence, hydrated])

  useEffect(() => {
    // Avoid clobbering persisted language on first paint when auth store has not
    // loaded the user yet (authLanguage can be undefined).
    if (authLanguage === undefined || authLanguage === null) return
    hydrateFromUser(authLanguage, authNationality)
  }, [authLanguage, authNationality, hydrateFromUser])

  const setLanguage = useCallback(
    async (value: string) => {
      await saveLanguagePreference(normalizeUILanguage(value, language))
    },
    [language, saveLanguagePreference]
  )

  return {
    language,
    hydrated,
    saveStatus,
    saveError,
    setLanguage,
    retrySaveLanguagePreference,
  }
}

export function useI18n(namespace: I18nNamespace) {
  const { language } = useUILanguage()

  const t = useCallback(
    (key: string, variables?: Record<string, string | number>, fallback?: string) => {
      const source = I18N_MESSAGES[namespace][language]?.[key]
      if (typeof source === 'string') return interpolate(source, variables)

      const fallbackSource = I18N_MESSAGES[namespace].en?.[key]
      if (typeof fallbackSource === 'string') return interpolate(fallbackSource, variables)

      if (fallback && fallback.trim()) return interpolate(fallback, variables)
      return interpolate(humanizeMissingKey(key), variables)
    },
    [language, namespace]
  )

  return { language, t }
}
