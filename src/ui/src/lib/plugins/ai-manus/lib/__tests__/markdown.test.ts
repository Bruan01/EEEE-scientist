import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('dompurify', () => ({
  default: {
    sanitize: (value: string) => value,
  },
}))

import { renderMarkdown, renderMarkdownWithCitations } from '@/lib/plugins/ai-manus/lib/markdown'

describe('ai-manus markdown', () => {
  beforeAll(() => {
    ;(globalThis as { window?: Window }).window = globalThis.window || ({} as Window)
  })

  it('renders workspace file links as inline buttons when requested', () => {
    const html = renderMarkdown(
      'Open [plan.md](http://deepscientist.cc:20999/ssdwork/DeepScientist/quests/104/plan.md).',
      {
        resolveWorkspaceFileLink: (href) => href.includes('/quests/104/plan.md'),
      }
    )

    expect(html).toContain('button')
    expect(html).toContain('ai-manus-inline-link')
    expect(html).toContain('data-file-href="http://deepscientist.cc:20999/ssdwork/DeepScientist/quests/104/plan.md"')
    expect(html).not.toContain('target="_blank"')
  })

  it('keeps external links as anchors', () => {
    const html = renderMarkdown('See [example](https://example.com).', {
      resolveWorkspaceFileLink: () => false,
    })

    expect(html).toContain('<a href="https://example.com"')
    expect(html).toContain('target="_blank"')
  })

  it('preserves citation rendering alongside workspace file links', () => {
    const rendered = renderMarkdownWithCitations(
      'Review [plan.md](http://deepscientist.cc:20999/ssdwork/DeepScientist/quests/104/plan.md) [1].',
      [{ index: 1, file_path: 'paper.md', line_start: 4, line_end: 6 }],
      {
        resolveWorkspaceFileLink: (href) => href.includes('/quests/104/plan.md'),
      }
    )

    expect(rendered.html).toContain('data-file-href="http://deepscientist.cc:20999/ssdwork/DeepScientist/quests/104/plan.md"')
    expect(rendered.html).toContain('data-cite-key="c1"')
  })
})
