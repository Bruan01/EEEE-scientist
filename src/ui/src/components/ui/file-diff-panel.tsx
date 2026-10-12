'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FileDiffPayload } from '@/lib/types/ui-effects'

type FileDiffPanelProps = {
  diff: FileDiffPayload
  changeType?: 'create' | 'update' | 'delete'
  title?: string
  subtitle?: string
  compact?: boolean
  showHeader?: boolean
  onClose?: () => void
  className?: string
}

const CHANGE_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
}

function getDiffLineMeta(line: string) {
  const isHunk = line.startsWith('@@')
  const isAdd = line.startsWith('+') && !line.startsWith('+++')
  const isDel = line.startsWith('-') && !line.startsWith('---')
  const isContext = !isHunk && !isAdd && !isDel
  const prefix = isHunk ? '@@' : isAdd ? '+' : isDel ? '-' : ' '
  const text = isHunk ? line.slice(2).trimStart() : line.slice(1)
  return { isHunk, isAdd, isDel, isContext, prefix, text }
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

export function FileDiffPanel({
  diff,
  changeType,
  title,
  subtitle,
  compact,
  showHeader = true,
  onClose,
  className,
}: FileDiffPanelProps) {
  const counts = React.useMemo(() => countDiffLines(diff.lines), [diff.lines])
  const added = diff.added ?? counts.added
  const removed = diff.removed ?? counts.removed
  const label = changeType ? CHANGE_LABELS[changeType] ?? 'Updated' : 'Updated'

  return (
    <div className={cn('ds-file-diff-panel', compact && 'is-compact', className)}>
      {showHeader ? (
        <div className="ds-file-diff-header">
          <div className="ds-file-diff-header-text">
            <div className="ds-file-diff-title">{title ?? 'AI Change'}</div>
            <div className="ds-file-diff-subtitle">
              <span className="ds-file-diff-tag">{label}</span>
              <span className="ds-file-diff-meta">+{added}</span>
              <span className="ds-file-diff-meta">-{removed}</span>
              {subtitle ? <span className="ds-file-diff-muted">{subtitle}</span> : null}
            </div>
          </div>
          {onClose ? (
            <button
              type="button"
              className="ds-file-diff-close"
              onClick={onClose}
              aria-label="Dismiss diff"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="ds-file-diff-body">
        {diff.lines.map((line, index) => {
          const { isHunk, isAdd, isDel, isContext, prefix, text } = getDiffLineMeta(line)
          return (
            <div
              key={`${prefix}-${index}`}
              className={cn(
                'ds-file-diff-line',
                isHunk && 'is-hunk',
                isAdd && 'is-add',
                isDel && 'is-del',
                isContext && 'is-context'
              )}
            >
              <span className="ds-file-diff-prefix">{prefix}</span>
              <span className="ds-file-diff-text">{text}</span>
            </div>
          )
        })}
      </div>
      {diff.truncated ? (
        <div className="ds-file-diff-footer">Diff truncated. Open file for full details.</div>
      ) : null}
    </div>
  )
}

export default FileDiffPanel
