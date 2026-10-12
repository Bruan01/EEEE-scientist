'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type PatchPreviewPanelProps = {
  patch: string
  title?: string
  subtitle?: string
  compact?: boolean
  showHeader?: boolean
  className?: string
}

function getPatchLineMeta(line: string) {
  const isHunk =
    line.startsWith('@@') ||
    line.startsWith('***') ||
    line.startsWith('+++') ||
    line.startsWith('---')
  const isAdd = line.startsWith('+') && !line.startsWith('+++')
  const isDel = line.startsWith('-') && !line.startsWith('---')
  const isContext = !isHunk && !isAdd && !isDel
  return { isHunk, isAdd, isDel, isContext }
}

function countPatchLines(lines: string[]) {
  let added = 0
  let removed = 0
  lines.forEach((line) => {
    if (line.startsWith('+') && !line.startsWith('+++')) added += 1
    if (line.startsWith('-') && !line.startsWith('---')) removed += 1
  })
  return { added, removed }
}

export function PatchPreviewPanel({
  patch,
  title = 'Patch preview',
  subtitle,
  compact,
  showHeader = true,
  className,
}: PatchPreviewPanelProps) {
  const lines = React.useMemo(() => (patch ? patch.split(/\r?\n/) : ['']), [patch])
  const counts = React.useMemo(() => countPatchLines(lines), [lines])
  const lineWidth = Math.max(String(lines.length).length, 2)

  return (
    <div className={cn('ds-patch-preview', compact && 'is-compact', className)}>
      {showHeader ? (
        <div className="ds-patch-preview-header">
          <div className="ds-patch-preview-header-text">
            <div className="ds-patch-preview-title">{title}</div>
            <div className="ds-patch-preview-subtitle">
              <span className="ds-patch-preview-meta">+{counts.added}</span>
              <span className="ds-patch-preview-meta">-{counts.removed}</span>
              {subtitle ? <span className="ds-patch-preview-muted">{subtitle}</span> : null}
            </div>
          </div>
        </div>
      ) : null}
      <div className="ds-patch-preview-body">
        {lines.map((line, index) => {
          const { isHunk, isAdd, isDel, isContext } = getPatchLineMeta(line)
          return (
            <div
              key={`${index}-${line}`}
              className={cn(
                'ds-patch-preview-line',
                isHunk && 'is-hunk',
                isAdd && 'is-add',
                isDel && 'is-del',
                isContext && 'is-context'
              )}
            >
              <span className="ds-patch-preview-gutter">
                {String(index + 1).padStart(lineWidth, ' ')}
              </span>
              <span className="ds-patch-preview-text">{line || ' '}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default PatchPreviewPanel
