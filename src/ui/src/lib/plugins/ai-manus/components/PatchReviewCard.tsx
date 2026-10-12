'use client'

import * as React from 'react'
import { Check, X, AlertTriangle } from 'lucide-react'
import type { PatchReviewContent, PatchReviewFile } from '../types'
import { FileDiffPanel } from '@/components/ui/file-diff-panel'
import { LoadingIndicator } from './LoadingIndicator'
import { cn } from '@/lib/utils'

type PatchReviewCardProps = {
  content: PatchReviewContent
  compact?: boolean
  readOnly?: boolean
  onAccept?: () => void
  onReject?: () => void
}

const STATUS_LABELS: Record<PatchReviewContent['status'], string> = {
  pending: 'Pending review',
  applying: 'Applying patch',
  accepted: 'Applied',
  rejected: 'Rejected',
  failed: 'Failed',
}

const STATUS_TONES: Record<PatchReviewContent['status'], string> = {
  pending: 'text-[var(--text-tertiary)]',
  applying: 'text-[var(--text-secondary)]',
  accepted: 'text-[var(--soft-success)]',
  rejected: 'text-[var(--soft-danger)]',
  failed: 'text-[var(--soft-danger)]',
}

const CHANGE_LABELS: Record<PatchReviewFile['changeType'], string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  move: 'Moved',
}

function countDiffLines(lines: string[]) {
  let added = 0
  let removed = 0
  lines.forEach((line) => {
    if (line.startsWith('+') && !line.startsWith('+++')) added += 1
    if (line.startsWith('-') && !line.startsWith('---')) removed += 1
  })
  return { added, removed }
}

export function PatchReviewCard({
  content,
  compact,
  readOnly,
  onAccept,
  onReject,
}: PatchReviewCardProps) {
  const isCompact = Boolean(compact)
  const isApplying = content.status === 'applying'
  const isAccepted = content.status === 'accepted'
  const isRejected = content.status === 'rejected'
  const isFailed = content.status === 'failed'
  const canAccept = !readOnly && (content.status === 'pending' || isFailed) && !isApplying
  const canReject = !readOnly && content.status === 'pending' && !isApplying

  const summary = React.useMemo(() => {
    const totals = { added: 0, removed: 0 }
    content.files.forEach((file) => {
      const counts = countDiffLines(file.diffLines)
      totals.added += counts.added
      totals.removed += counts.removed
    })
    return totals
  }, [content.files])

  return (
    <div
      className={cn(
        'ai-manus-fade-in flex w-full flex-col gap-3 rounded-[12px] border border-[var(--border-light)]',
        'bg-[var(--fill-tsp-white-light)] px-3 py-3 shadow-[0px_0px_1px_0px_var(--shadow-XS)]'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className={cn('text-[12px] font-semibold text-[var(--text-primary)]', isCompact && 'text-[11px]')}>
            Patch Review
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
            <span>{content.files.length} files</span>
            <span>+{summary.added}</span>
            <span>-{summary.removed}</span>
            <span className={STATUS_TONES[content.status]}>{STATUS_LABELS[content.status]}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isAccepted && !isRejected ? (
            <>
              <button
                type="button"
                onClick={onReject}
                disabled={!canReject}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-semibold',
                  'border-[var(--border-light)] text-[var(--text-tertiary)] transition hover:text-[var(--text-primary)]',
                  'disabled:cursor-not-allowed disabled:opacity-50'
                )}
              >
                <X size={12} />
                Reject
              </button>
              <button
                type="button"
                onClick={onAccept}
                disabled={!canAccept}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-semibold',
                  'border-[var(--border-light)] bg-[var(--fill-tsp-gray-dark)] text-[var(--text-primary)]',
                  'transition hover:bg-[var(--fill-tsp-gray-mid)] disabled:cursor-not-allowed disabled:opacity-50'
                )}
              >
                {isApplying ? <LoadingIndicator compact text="Applying" /> : <Check size={12} />}
                {isFailed ? 'Retry' : 'Accept'}
              </button>
            </>
          ) : (
            <div className={cn('text-[10px] font-semibold', STATUS_TONES[content.status])}>
              {STATUS_LABELS[content.status]}
            </div>
          )}
        </div>
      </div>

      {content.rationale ? (
        <div className={cn('text-[11px] text-[var(--text-secondary)]', isCompact && 'text-[10px]')}>
          {content.rationale}
        </div>
      ) : null}

      {content.error ? (
        <div className="flex items-center gap-2 rounded-[10px] border border-[var(--border-light)] bg-[var(--fill-tsp-white)] px-2 py-1 text-[10px] text-[var(--soft-danger)]">
          <AlertTriangle size={12} />
          <span className="truncate">{content.error}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {content.files.map((file) => (
          <div key={`${file.path}-${file.changeType}`} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[var(--text-tertiary)]">
              <span className="font-medium text-[var(--text-secondary)]">{file.path}</span>
              <span>
                {CHANGE_LABELS[file.changeType]}
                {file.moveTo ? ` → ${file.moveTo}` : ''}
              </span>
            </div>
            {file.diffLines.length > 0 ? (
              <FileDiffPanel
                diff={{ lines: file.diffLines }}
                changeType={file.changeType === 'move' ? 'update' : file.changeType}
                showHeader={false}
                compact
              />
            ) : (
              <div className="rounded-[10px] border border-dashed border-[var(--border-light)] px-3 py-2 text-[10px] text-[var(--text-tertiary)]">
                No diff available.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default PatchReviewCard

