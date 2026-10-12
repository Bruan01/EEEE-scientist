import { describe, expect, it } from 'vitest'

import { lingzhuAuthAkNeedsRotation, resolveLingzhuAuthAk } from '../connectorSettingsHelpers'

describe('lingzhu auth ak helpers', () => {
  it('treats the bundled example token as needing rotation', () => {
    expect(lingzhuAuthAkNeedsRotation('abcd1234-abcd-abcd-abcd-abcdefghijkl')).toBe(true)
    expect(resolveLingzhuAuthAk('abcd1234-abcd-abcd-abcd-abcdefghijkl')).toBe('')
  })

  it('keeps real-looking auth ak values intact', () => {
    const authAk = 'm4r9x2qp-1k8s-0n7d-6v5c-3b2a1z9y8x7w'
    expect(lingzhuAuthAkNeedsRotation(authAk)).toBe(false)
    expect(resolveLingzhuAuthAk(authAk)).toBe(authAk)
  })
})
