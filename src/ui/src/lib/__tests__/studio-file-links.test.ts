import { describe, expect, it } from 'vitest'

import { resolveStudioFileLinkTarget } from '@/components/workspace/studio-file-links'

describe('resolveStudioFileLinkTarget', () => {
  it('resolves plain markdown relative file links to workspace paths', () => {
    expect(resolveStudioFileLinkTarget('notes/plan.md')).toEqual({
      kind: 'file_path',
      filePath: 'notes/plan.md',
    })
  })

  it('resolves quest document asset urls back to workspace file paths', () => {
    expect(
      resolveStudioFileLinkTarget(
        '/api/quests/101/documents/asset?document_id=path%3A%3Anotes%2Fplan.md'
      )
    ).toEqual({
      kind: 'file_path',
      filePath: 'notes/plan.md',
    })

    expect(
      resolveStudioFileLinkTarget(
        'http://127.0.0.1:20999/api/quests/101/documents/asset?document_id=questpath%3A%3Apaper%2Fdraft.md',
        { currentOrigin: 'http://127.0.0.1:20999' }
      )
    ).toEqual({
      kind: 'file_path',
      filePath: 'paper/draft.md',
    })
  })

  it('resolves raw document ids to explorer paths', () => {
    expect(resolveStudioFileLinkTarget('path::artifacts/report.md')).toEqual({
      kind: 'file_path',
      filePath: 'artifacts/report.md',
    })
    expect(resolveStudioFileLinkTarget('memory::ops/notes.md')).toEqual({
      kind: 'file_path',
      filePath: 'memory/ops/notes.md',
    })
  })

  it('resolves quest-root absolute paths and full urls back to workspace paths', () => {
    expect(
      resolveStudioFileLinkTarget(
        '/ssdwork/DeepScientist/quests/104/baselines/local/citeeval-repaired-local-vllm/STATUS.md',
        { questId: '104' }
      )
    ).toEqual({
      kind: 'file_path',
      filePath: 'baselines/local/citeeval-repaired-local-vllm/STATUS.md',
    })

    expect(
      resolveStudioFileLinkTarget(
        'http://deepscientist.cc:20999/ssdwork/DeepScientist/quests/104/baselines/local/citeeval-repaired-local-vllm/STATUS.md',
        {
          currentOrigin: 'http://127.0.0.1:20999',
          questId: '104',
        }
      )
    ).toEqual({
      kind: 'file_path',
      filePath: 'baselines/local/citeeval-repaired-local-vllm/STATUS.md',
    })
  })
})
