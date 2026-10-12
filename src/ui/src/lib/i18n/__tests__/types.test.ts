import {
  UI_LANGUAGES,
  getDefaultLanguageFromNationality,
  getIntlLocaleForUILanguage,
  normalizeUILanguage,
} from '@/lib/i18n/types'

describe('i18n language helpers', () => {
  it('includes the expanded UI language set', () => {
    expect(UI_LANGUAGES).toEqual(['en', 'zh-CN', 'fr', 'ja', 'ko', 'ru'])
  })

  it('normalizes the new locale aliases', () => {
    expect(normalizeUILanguage('fr-FR')).toBe('fr')
    expect(normalizeUILanguage('日本語')).toBe('ja')
    expect(normalizeUILanguage('ko_kr')).toBe('ko')
    expect(normalizeUILanguage('русский')).toBe('ru')
  })

  it('maps UI languages to Intl locales', () => {
    expect(getIntlLocaleForUILanguage('en')).toBe('en-US')
    expect(getIntlLocaleForUILanguage('zh-CN')).toBe('zh-CN')
    expect(getIntlLocaleForUILanguage('fr')).toBe('fr-FR')
    expect(getIntlLocaleForUILanguage('ja')).toBe('ja-JP')
    expect(getIntlLocaleForUILanguage('ko')).toBe('ko-KR')
    expect(getIntlLocaleForUILanguage('ru')).toBe('ru-RU')
  })

  it('derives the default language from nationality and falls back to English', () => {
    expect(getDefaultLanguageFromNationality('CN')).toBe('zh-CN')
    expect(getDefaultLanguageFromNationality('fr')).toBe('fr')
    expect(getDefaultLanguageFromNationality('JP')).toBe('ja')
    expect(getDefaultLanguageFromNationality('KR')).toBe('ko')
    expect(getDefaultLanguageFromNationality('RU')).toBe('ru')
    expect(getDefaultLanguageFromNationality('US')).toBe('en')
    expect(getDefaultLanguageFromNationality(undefined)).toBe('en')
  })
})
