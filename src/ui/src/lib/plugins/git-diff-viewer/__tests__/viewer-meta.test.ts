import {
  formatGitDiffPathLabel,
  inferSnapshotContentKind,
  inferSnapshotPreviewKind,
} from '../viewer-meta'

describe('git diff viewer metadata helpers', () => {
  it('formats rename labels without losing the old path', () => {
    expect(formatGitDiffPathLabel('src/new-name.ts', 'src/old-name.ts')).toBe(
      'src/old-name.ts → src/new-name.ts'
    )
    expect(formatGitDiffPathLabel('src/file.ts', 'src/file.ts')).toBe('src/file.ts')
  })

  it('routes snapshot previews to specialized viewers when appropriate', () => {
    expect(
      inferSnapshotPreviewKind({
        path: 'docs/notes.md',
        mime_type: 'text/markdown',
      } as any)
    ).toBe('markdown')

    expect(
      inferSnapshotPreviewKind({
        path: 'paper/report.pdf',
        mime_type: 'application/pdf',
      } as any)
    ).toBe('pdf')

    expect(
      inferSnapshotPreviewKind({
        path: 'figures/chart.png',
        mime_type: 'image/png',
      } as any)
    ).toBe('image')

    expect(
      inferSnapshotPreviewKind({
        path: 'analysis/run.ipynb',
        mime_type: 'application/x-ipynb+json',
      } as any)
    ).toBe('notebook')

    expect(
      inferSnapshotPreviewKind({
        path: 'src/train.py',
        mime_type: 'text/x-python',
      } as any)
    ).toBe('plain')
  })

  it('preserves workspace content semantics for snapshot tabs', () => {
    expect(
      inferSnapshotContentKind({
        path: 'docs/notes.md',
        mime_type: 'text/markdown',
      } as any)
    ).toBe('markdown')

    expect(
      inferSnapshotContentKind({
        path: 'analysis/run.ipynb',
        mime_type: 'application/x-ipynb+json',
      } as any)
    ).toBe('notebook')

    expect(
      inferSnapshotContentKind({
        path: 'paper/report.pdf',
        mime_type: 'application/pdf',
      } as any)
    ).toBe('pdf')
  })
})
