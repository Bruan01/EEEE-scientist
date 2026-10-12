import { formatProgressLabel, formatProgressMeta, getProgressPercent } from '../bash-progress'

describe('bash-progress helpers', () => {
  it('computes percent and label', () => {
    const progress = { current: 5, total: 10, unit: 'steps', desc: 'train', phase: 'exec' }
    expect(getProgressPercent(progress)).toBeCloseTo(50)
    expect(formatProgressLabel(progress)).toBe('5/10 steps')
    expect(formatProgressMeta(progress)).toContain('train')
  })

  it('handles percent-only payload', () => {
    const progress = { current: 7, percent: 70, unit: 'samples' }
    expect(getProgressPercent(progress)).toBe(70)
    expect(formatProgressLabel(progress)).toBe('7 samples')
  })

  it('prefers next update countdown metadata', () => {
    const progress = { current: 3, total: 10, next_reply_in: 90, eta: 300 }
    expect(formatProgressMeta(progress)).toContain('next update in 1m 30s')
    expect(formatProgressMeta(progress)).not.toContain('eta 5m')
  })
})
