'use client'

import * as React from 'react'

import { useI18n } from '@/lib/i18n/useI18n'
import { cn } from '@/lib/utils'
import type { OpenDocumentPayload } from '@/types'

function resolveSnapshotRevision(document: OpenDocumentPayload | null | undefined) {
  const gitRevision = document?.meta?.git_revision
  if (typeof gitRevision === 'string' && gitRevision.trim()) {
    return gitRevision.trim()
  }
  const revision = String(document?.revision || '').trim()
  return revision || null
}

export function GitSnapshotViewer({
  document,
  className,
}: {
  document: OpenDocumentPayload | null | undefined
  className?: string
}) {
  const { t } = useI18n('workspace')
  const lines = React.useMemo(() => String(document?.content || '').split('\n'), [document?.content])
  const revision = resolveSnapshotRevision(document)
  const isBinaryLike = !document?.content && !document?.encoding && Number(document?.size_bytes || 0) > 0

  if (!document) {
    return (
      <div className="text-sm leading-7 text-muted-foreground">
        {t('git_snapshot_none_selected', undefined, 'No snapshot selected.')}
      </div>
    )
  }

  return (
    <div data-testid="git-snapshot-viewer" className={cn('ds-stage-diff-shell', className)}>
      <div className="ds-stage-diff-filehead">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-foreground">
            {document.path || document.title || t('git_viewer_snapshot', undefined, 'Snapshot')}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>{t('git_snapshot_meta_label', undefined, 'Snapshot')}</span>
            {revision ? <span>· {revision}</span> : null}
            {document.mime_type ? <span>· {document.mime_type}</span> : null}
            {typeof document.size_bytes === 'number' ? <span>· {document.size_bytes} bytes</span> : null}
          </div>
        </div>
      </div>

      {isBinaryLike ? (
        <div className="px-4 py-8 text-sm text-muted-foreground">
          {t(
            'git_snapshot_binary_unavailable',
            undefined,
            'Snapshot preview is unavailable for binary files.'
          )}
        </div>
      ) : (
        <div className="feed-scrollbar overflow-x-auto overflow-y-visible">
          <div className="min-w-max">
            {lines.length === 1 && lines[0] === '' ? (
              <div className="px-4 py-6 font-mono text-[12px] leading-6 text-muted-foreground">
                {t('git_snapshot_empty_file', undefined, 'File is empty.')}
              </div>
            ) : (
              lines.map((line, index) => (
                <div
                  key={`snapshot-line-${index + 1}`}
                  className="grid grid-cols-[64px_minmax(0,1fr)] border-b border-black/[0.05] font-mono text-[12px] leading-6 text-foreground last:border-b-0 dark:border-white/[0.06]"
                >
                  <div className="select-none border-r border-black/[0.06] bg-black/[0.02] px-3 py-0.5 text-right text-[11px] text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.03]">
                    {index + 1}
                  </div>
                  <div className="whitespace-pre px-4 py-0.5">{line || ' '}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default GitSnapshotViewer
