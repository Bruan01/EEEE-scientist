export type UILanguage = 'en' | 'zh-CN' | 'fr' | 'ja' | 'ko' | 'ru'

export const UI_LANGUAGES: UILanguage[] = ['en', 'zh-CN', 'fr', 'ja', 'ko', 'ru']

export const UI_LANGUAGE_INTL_LOCALES: Record<UILanguage, string> = {
  en: 'en-US',
  'zh-CN': 'zh-CN',
  fr: 'fr-FR',
  ja: 'ja-JP',
  ko: 'ko-KR',
  ru: 'ru-RU',
}

export const UI_LANGUAGE_LABEL_KEYS: Record<UILanguage, string> = {
  en: 'language_english',
  'zh-CN': 'language_chinese',
  fr: 'language_french',
  ja: 'language_japanese',
  ko: 'language_korean',
  ru: 'language_russian',
}

export const UI_LANGUAGE_NATIVE_LABELS: Record<UILanguage, string> = {
  en: 'English',
  'zh-CN': '中文',
  fr: 'Français',
  ja: '日本語',
  ko: '한국어',
  ru: 'Русский',
}

export const NATIONALITY_DEFAULT_LANGUAGE_MAP: Record<string, UILanguage> = {
  CN: 'zh-CN',
  FR: 'fr',
  JP: 'ja',
  KR: 'ko',
  RU: 'ru',
}

const LANGUAGE_ALIAS_MAP: Record<string, UILanguage> = {
  en: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  english: 'en',
  fr: 'fr',
  'fr-fr': 'fr',
  french: 'fr',
  francais: 'fr',
  'français': 'fr',
  ja: 'ja',
  'ja-jp': 'ja',
  japanese: 'ja',
  日本語: 'ja',
  ko: 'ko',
  'ko-kr': 'ko',
  korean: 'ko',
  한국어: 'ko',
  ru: 'ru',
  'ru-ru': 'ru',
  russian: 'ru',
  русский: 'ru',
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-hans': 'zh-CN',
  chinese: 'zh-CN',
  'chinese-simplified': 'zh-CN',
  'simplified-chinese': 'zh-CN',
  中文: 'zh-CN',
}

export function normalizeUILanguage(value: unknown, fallback: UILanguage = 'en'): UILanguage {
  if (typeof value !== 'string') return fallback
  const token = value.trim()
  if (!token) return fallback

  const normalized = token.toLowerCase().replace(/_/g, '-')
  return LANGUAGE_ALIAS_MAP[normalized] || fallback
}

export function getIntlLocaleForUILanguage(language: UILanguage): string {
  return UI_LANGUAGE_INTL_LOCALES[language] || UI_LANGUAGE_INTL_LOCALES.en
}

export function getDefaultLanguageFromNationality(value: unknown): UILanguage {
  if (typeof value !== 'string') return 'en'
  const normalized = value.trim().toUpperCase()
  if (!normalized) return 'en'
  return NATIONALITY_DEFAULT_LANGUAGE_MAP[normalized] || 'en'
}
