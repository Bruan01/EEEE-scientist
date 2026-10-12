import { I18N_MESSAGES } from '@/lib/i18n/messages'
import { UI_LANGUAGES } from '@/lib/i18n/types'

describe('i18n message completeness', () => {
  for (const [namespace, messages] of Object.entries(I18N_MESSAGES)) {
    it(`${namespace} exposes every supported locale with matching keys`, () => {
      const unionKeys = new Set<string>()

      for (const locale of UI_LANGUAGES) {
        const localeMessages = messages[locale]
        expect(localeMessages).toBeDefined()
        expect(typeof localeMessages).toBe('object')
        for (const key of Object.keys(localeMessages ?? {})) {
          unionKeys.add(key)
        }
      }

      expect(unionKeys.size).toBeGreaterThan(0)

      for (const locale of UI_LANGUAGES) {
        const localeMessages = messages[locale] ?? {}
        for (const key of unionKeys) {
          expect(typeof localeMessages[key]).toBe('string')
          expect(localeMessages[key].length).toBeGreaterThan(0)
        }
      }
    })
  }
})
