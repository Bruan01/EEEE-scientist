import { extractMcpListResult } from '@/lib/plugins/ai-manus/lib/mcp-tools'

describe('extractMcpListResult', () => {
  it('uses list content text when provided', () => {
    const result = {
      path: '/tmp',
      items: [{ name: 'notes.txt', path: '/tmp/notes.txt', type: 'file', size: 12 }],
      content: 'Absolute path: /tmp\nnotes.txt',
    }

    const extracted = extractMcpListResult(result)

    expect(extracted.items).toHaveLength(1)
    expect(extracted.content).toBe('Absolute path: /tmp\nnotes.txt')
    expect(extracted.truncated).toBe(false)
  })

  it('extracts items from JSON content blocks and prefers non-JSON text', () => {
    const jsonPayload = JSON.stringify({
      path: '/tmp',
      items: [{ name: 'data', path: '/tmp/data', type: 'directory' }],
    })
    const result = {
      content: [
        { type: 'text', text: jsonPayload },
        { type: 'text', text: 'Absolute path: /tmp\ndata/' },
      ],
    }

    const extracted = extractMcpListResult(result)

    expect(extracted.items).toHaveLength(1)
    expect(extracted.content).toBe('Absolute path: /tmp\ndata/')
  })

  it('handles nested result wrappers', () => {
    const jsonPayload = JSON.stringify({
      path: '/tmp',
      items: [{ name: 'logs', path: '/tmp/logs', type: 'directory' }],
    })
    const result = {
      result: {
        content: [
          { type: 'text', text: jsonPayload },
          { type: 'text', text: 'Absolute path: /tmp\nlogs/' },
        ],
      },
    }

    const extracted = extractMcpListResult(result)

    expect(extracted.items).toHaveLength(1)
    expect(extracted.content).toBe('Absolute path: /tmp\nlogs/')
  })

  it('falls back to items when content is JSON-only', () => {
    const jsonPayload = JSON.stringify({
      path: '/tmp',
      items: [{ name: 'file.txt', path: '/tmp/file.txt', type: 'file', size: 10 }],
    })

    const extracted = extractMcpListResult({ content: jsonPayload })

    expect(extracted.items).toHaveLength(1)
    expect(extracted.content).toBe('')
  })
})
