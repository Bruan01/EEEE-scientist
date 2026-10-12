import {
  detectWorkspaceContentKindByExtension,
  getWorkspaceBadgeClassName,
  getWorkspaceBadgeLabel,
  getWorkspaceBadgeTokens,
  getWorkspaceContentKind,
  getWorkspaceContentKindBadge,
  getWorkspaceContentTone,
  inferWorkspaceContentKindFromMetadata,
} from '../content-meta'

const t = (key: string) => {
  const messages: Record<string, string> = {
    tab_badge_rendered: 'Rendered',
    tab_badge_source: 'Source',
    tab_badge_snapshot: 'Snapshot',
    tab_badge_diff: 'Diff',
    tab_badge_quote: 'Quote',
    tab_badge_read_only: 'Read only',
    tab_badge_compiling: 'Compiling',
    tab_badge_error: 'Error',
    tab_badge_warning: 'Warning',
    copilot_badge_pdf: 'PDF',
    copilot_badge_markdown: 'Markdown',
    copilot_badge_mdx: 'MDX',
    copilot_badge_html: 'HTML',
    copilot_badge_latex: 'LaTeX',
    copilot_badge_notebook: 'Notebook',
    copilot_badge_lab: 'Lab',
    copilot_badge_cli: 'CLI',
  }
  return messages[key] ?? key
}

describe('workspace content meta helpers', () => {
  it('detects content kinds from plugin, mime type, and extension', () => {
    expect(
      getWorkspaceContentKind({
        pluginId: '@ds/plugin-pdf-viewer',
        context: {},
      } as any)
    ).toBe('pdf')

    expect(
      getWorkspaceContentKind({
        pluginId: '@ds/plugin-code-editor',
        context: { mimeType: 'text/html', resourceName: 'index.html' },
      } as any)
    ).toBe('html')

    expect(
      getWorkspaceContentKind({
        pluginId: '@ds/plugin-code-editor',
        context: { resourceName: 'paper.mdx' },
      } as any)
    ).toBe('mdx')

    expect(
      getWorkspaceContentKind({
        pluginId: '@ds/plugin-code-editor',
        context: { resourcePath: '/latex/main.tex' },
      } as any)
    ).toBe('latex')

    expect(
      getWorkspaceContentKind({
        pluginId: '@ds/plugin-code-editor',
        context: { resourceName: 'analysis.ipynb' },
      } as any)
    ).toBe('notebook')
  })

  it('builds badge tokens from current workspace state', () => {
    const tokens = getWorkspaceBadgeTokens(
      {
        pluginId: '@ds/plugin-code-editor',
        context: { resourceName: 'paper.mdx' },
      } as any,
      {
        documentMode: 'rendered',
        selectionCount: 2,
        diagnostics: { warnings: 1 },
      }
    )

    expect(tokens).toEqual(['mdx', 'rendered', 'quote', 'warning'])
  })

  it('maps badge labels and styles consistently', () => {
    expect(getWorkspaceBadgeLabel('rendered', t)).toBe('Rendered')
    expect(getWorkspaceBadgeLabel('snapshot', t)).toBe('Snapshot')
    expect(getWorkspaceBadgeLabel('diff', t)).toBe('Diff')
    expect(getWorkspaceBadgeLabel('quote', t)).toBe('Quote')
    expect(getWorkspaceBadgeLabel('tex', t)).toBe('TeX')
    expect(getWorkspaceBadgeClassName('pdf')).toContain('#8FA3B8')
    expect(getWorkspaceBadgeClassName('warning')).toContain('text-muted-foreground')
  })

  it('returns shared tone and copilot badge meta for content kinds', () => {
    expect(getWorkspaceContentTone('mdx')).toBe('markdown')
    expect(getWorkspaceContentTone('latex')).toBe('latex')
    expect(getWorkspaceContentKindBadge('latex', t)).toEqual({
      label: 'LaTeX',
      tone: 'latex',
    })
    expect(getWorkspaceContentKindBadge('html', t)).toEqual({
      label: 'HTML',
      tone: 'html',
    })
  })

  it('infers content kind from metadata for snapshot-like documents', () => {
    expect(
      inferWorkspaceContentKindFromMetadata({
        mimeType: 'application/x-ipynb+json',
        resourcePath: 'analysis.ipynb',
      })
    ).toBe('notebook')

    expect(
      inferWorkspaceContentKindFromMetadata({
        mimeType: 'text/markdown',
        resourcePath: 'notes.md',
      })
    ).toBe('markdown')

    expect(detectWorkspaceContentKindByExtension('dsnb')).toBe('notebook')
  })
})
