'use client'

import * as React from 'react'
import {
  Decoration,
  Diff,
  Hunk,
  markEdits,
  parseDiff,
  tokenize,
  type DiffType,
  type FileData as ParsedDiffFile,
} from 'react-diff-view'

import { useI18n } from '@/lib/i18n/useI18n'
import { formatGitDiffPathLabel } from '@/lib/plugins/git-diff-viewer/viewer-meta'
import { cn } from '@/lib/utils'
import type { FileChangeDiffPayload, GitDiffPayload } from '@/types'

type DiffPayload = GitDiffPayload | FileChangeDiffPayload

function mapDiffType(status?: string | null): DiffType {
  switch (String(status || '').trim().toLowerCase()) {
    case 'added':
    case 'add':
      return 'add'
    case 'deleted':
    case 'delete':
      return 'delete'
    case 'renamed':
    case 'rename':
      return 'rename'
    case 'copied':
    case 'copy':
      return 'copy'
    default:
      return 'modify'
  }
}

function normalizeDiffStatus(status?: string | null) {
  return String(status || '')
    .trim()
    .toLowerCase()
}

function buildFallbackDiff(payload: DiffPayload): string {
  const oldPath = payload.old_path || payload.path
  const newPath = payload.path
  const status = normalizeDiffStatus(payload.status)
  const previousPathHeader = status === 'added' || status === 'add' ? '/dev/null' : `a/${oldPath}`
  const nextPathHeader = status === 'deleted' || status === 'delete' ? '/dev/null' : `b/${newPath}`
  const header = [
    `diff --git a/${oldPath} b/${newPath}`,
    `--- ${previousPathHeader}`,
    `+++ ${nextPathHeader}`,
  ]
  return [...header, ...payload.lines].join('\n')
}

function buildUnifiedDiff(payload: DiffPayload): string {
  if (!payload.lines.length) return ''
  const firstLine = String(payload.lines[0] || '')
  const oldPath = payload.old_path || payload.path
  const newPath = payload.path
  if (firstLine.startsWith('diff --git ')) {
    return payload.lines.join('\n')
  }
  if (firstLine.startsWith('--- ') || firstLine.startsWith('Binary files ')) {
    return [`diff --git a/${oldPath} b/${newPath}`, ...payload.lines].join('\n')
  }
  return buildFallbackDiff(payload)
}

function formatPathLabel(diff: DiffPayload, fallback: string) {
  const displayPath =
    'display_path' in diff && typeof diff.display_path === 'string' && diff.display_path.trim()
      ? diff.display_path.trim()
      : diff.path
  return formatGitDiffPathLabel(displayPath, diff.old_path, fallback)
}

function parseSingleFile(text: string): ParsedDiffFile | null {
  if (!text.trim()) return null
  try {
    const files = parseDiff(text, { nearbySequences: 'zip' })
    return files[0] ?? null
  } catch {
    return null
  }
}

export function GitDiffViewer({
  diff,
  className,
  pathLabel,
}: {
  diff: DiffPayload | null | undefined
  className?: string
  pathLabel?: string
}) {
  const { t } = useI18n('workspace')
  const diffText = React.useMemo(() => (diff ? buildUnifiedDiff(diff) : ''), [diff])
  const parsed = React.useMemo(() => parseSingleFile(diffText), [diffText])
  const tokens = React.useMemo(() => {
    if (!parsed?.hunks.length) return null
    try {
      return tokenize(parsed.hunks, {
        enhancers: [markEdits(parsed.hunks, { type: 'line' })],
      })
    } catch {
      return null
    }
  }, [parsed])
  const resolvedPathLabel = diff
    ? pathLabel || formatPathLabel(diff, t('git_viewer_diff', undefined, 'Diff'))
    : null

  if (!diff) {
    return (
      <div className="text-sm leading-7 text-muted-foreground">
        {t('git_diff_none_selected', undefined, 'No patch selected.')}
      </div>
    )
  }

  if (diff.binary) {
    return (
      <div data-testid="git-unified-diff-viewer" className={cn('ds-stage-diff-shell', className)}>
        <div className="ds-stage-diff-filehead">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-foreground">{resolvedPathLabel}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {t('git_diff_binary_changed', undefined, 'Binary file changed.')}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!parsed || !parsed.hunks.length) {
    return (
      <div data-testid="git-unified-diff-viewer" className={cn('ds-stage-diff-shell', className)}>
        <div className="ds-stage-diff-filehead">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-foreground">{resolvedPathLabel}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {String(diff.status || 'modified')}
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-emerald-700 dark:text-emerald-300">+{diff.added || 0}</span>
            <span className="text-rose-700 dark:text-rose-300">-{diff.removed || 0}</span>
          </div>
        </div>
        <div className="feed-scrollbar overflow-x-auto overflow-y-visible">
          <pre className="min-w-max px-4 py-3 font-mono text-[12px] leading-6 text-foreground">
            {diff.lines.join('\n') ||
              t('git_diff_no_patch_lines', undefined, 'No patch lines available.')}
          </pre>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="git-unified-diff-viewer" className={cn('ds-stage-diff-shell', className)}>
      <div className="ds-stage-diff-filehead">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-foreground">{resolvedPathLabel}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {String(diff.status || 'modified')} · {diff.base} → {diff.head}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-emerald-700 dark:text-emerald-300">+{diff.added || 0}</span>
          <span className="text-rose-700 dark:text-rose-300">-{diff.removed || 0}</span>
        </div>
      </div>

      <div className="feed-scrollbar overflow-x-auto overflow-y-visible">
        <div className="min-w-max">
          <Diff
            viewType="unified"
            diffType={parsed.type || mapDiffType(diff.status)}
            hunks={parsed.hunks}
            gutterType="default"
            tokens={tokens}
            className="ds-github-diff-table"
          >
            {(hunks) =>
              hunks.flatMap((hunk) => [
                <Decoration key={`decoration-${hunk.content}`}>
                  <div className="ds-github-diff-hunk">{hunk.content}</div>
                </Decoration>,
                <Hunk key={`hunk-${hunk.content}`} hunk={hunk} />,
              ])
            }
          </Diff>
        </div>
      </div>

      {diff.truncated ? (
        <div className="border-t border-black/[0.06] px-4 py-2 text-[11px] text-muted-foreground dark:border-white/[0.08]">
          {t('git_diff_patch_truncated', undefined, 'Patch output is truncated.')}
        </div>
      ) : null}
    </div>
  )
}

export default GitDiffViewer
