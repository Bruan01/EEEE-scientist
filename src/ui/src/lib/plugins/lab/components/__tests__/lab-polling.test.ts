import { resolveLabListPollingInterval } from '@/lib/plugins/lab/components/lab-polling'

describe('lab-polling', () => {
  describe('resolveLabListPollingInterval', () => {
    it('returns false when live is disabled', () => {
      expect(
        resolveLabListPollingInterval({
          liveEnabled: false,
          streamStatus: 'open',
          fastMs: 5000,
          slowMs: 30000,
        })
      ).toBe(false)
    })

    it('returns slow interval when stream is open', () => {
      expect(
        resolveLabListPollingInterval({
          liveEnabled: true,
          streamStatus: 'open',
          fastMs: 5000,
          slowMs: 30000,
        })
      ).toBe(30000)
    })

    it('returns fast interval when stream is not open', () => {
      expect(
        resolveLabListPollingInterval({
          liveEnabled: true,
          streamStatus: 'reconnecting',
          fastMs: 5000,
          slowMs: 30000,
        })
      ).toBe(5000)
    })
  })
})
