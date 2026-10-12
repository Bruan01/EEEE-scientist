import { describe, expect, it } from 'vitest'

import { extractFileChangeEntries, extractToolSubject } from '@/lib/toolOperations'

describe('toolOperations file change helpers', () => {
  it('extracts file change entries from arrays and change envelopes', () => {
    const entries = extractFileChangeEntries(
      [{ path: '/tmp/alpha.py', kind: 'update' }],
      { changes: [{ path: '/tmp/beta.py', kind: 'add' }] }
    )

    expect(entries).toEqual([
      { path: '/tmp/alpha.py', kind: 'update' },
      { path: '/tmp/beta.py', kind: 'add' },
    ])
  })

  it('uses nested file change payloads to derive a tool subject', () => {
    const subject = extractToolSubject(
      'file_change',
      undefined,
      JSON.stringify({
        result: [{ path: 'src/deepscientist/daemon/api/handlers.py', kind: 'update' }],
      })
    )

    expect(subject).toBe('src/deepscientist/daemon/api/handlers.py')
  })
})
