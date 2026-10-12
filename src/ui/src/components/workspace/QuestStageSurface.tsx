'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, ExternalLink, FileCode2, FileText, FolderOpen, RefreshCw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Button } from '@/components/ui/button'
import type { QuestStageSelection } from '@/components/workspace/workspace-events'
import { useOpenFile } from '@/hooks/useOpenFile'
import { client } from '@/lib/api'
import { downloadFileById } from '@/lib/api/files'
import { getLatexSourcesArchiveBlob } from '@/lib/api/latex'
import { buildQuestDirectoryId, openQuestDocumentAsFileNode } from '@/lib/api/quest-files'
import { safeJsonStringify, safeStableStringify } from '@/lib/safe-json'
import { useTabsStore } from '@/lib/stores/tabs'
import { BUILTIN_PLUGINS } from '@/lib/types/plugin'
import { cn } from '@/lib/utils'
import { toFilesResourcePath } from '@/lib/utils/resource-paths'
import type {
  EvaluationSummaryPayload,
  QuestStageField,
  QuestStageFileEntry,
  QuestStageHistoryEntry,
  QuestStageViewPayload,
} from '@/types'

function compactText(value: unknown, limit = 320) {
  if (value == null) return '—'
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return '—'
    return trimmed.length <= limit ? trimmed : `${trimmed.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
  }
  try {
    const text = safeJsonStringify(value, 2)
    return text.length <= limit ? text : `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
  } catch {
    return String(value)
  }
}

function stringifyValue(value: unknown) {
  if (value == null) return '—'
  if (typeof value === 'string') return value.trim() || '—'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    if (!value.length) return '—'
    if (value.every((item) => ['string', 'number', 'boolean'].includes(typeof item))) {
      return value.map((item) => String(item)).join('\n')
    }
  }
  try {
    return safeJsonStringify(value, 2)
  } catch {
    return String(value)
  }
}

function looksLikeMarkdown(text: string) {
  return /(^#{1,6}\s)|(^[-*]\s)|(^\d+\.\s)|(```)|(\|.+\|)|(\[[^\]]+\]\([^)]+\))|(^>\s)/m.test(text)
}

function formatTimestamp(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function asRecordList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : []
}

function asStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : []
}

function countArray(value: unknown) {
  return Array.isArray(value) ? value.length : 0
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

function StagePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-black/[0.08] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground dark:border-white/[0.1]">
      {children}
    </span>
  )
}

function StageSection({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string | null
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[32px] border border-black/[0.06] bg-white/[0.92] px-6 py-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/[0.08] dark:bg-[rgba(18,18,20,0.82)]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-black/[0.06] pb-3 dark:border-white/[0.08]">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h3>
          {hint ? <div className="mt-1 text-sm leading-6 text-muted-foreground">{hint}</div> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

function StageRichText({
  value,
  className,
}: {
  value: unknown
  className?: string
}) {
  const text = stringifyValue(value)
  if (text === '—') {
    return <div className="text-sm leading-7 text-muted-foreground">—</div>
  }
  if (looksLikeMarkdown(text)) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        className={cn(
          'prose prose-sm max-w-none break-words [overflow-wrap:anywhere] leading-7 text-foreground dark:prose-invert',
          className
        )}
      >
        {text}
      </ReactMarkdown>
    )
  }
  return <div className={cn('whitespace-pre-wrap break-words text-sm leading-7 text-foreground', className)}>{text}</div>
}

function StageFactRows({ items }: { items: QuestStageField[] }) {
  if (!items.length) {
    return <div className="text-sm leading-7 text-muted-foreground">No structured facts yet.</div>
  }

  return (
    <div className="border-t border-black/[0.06] dark:border-white/[0.08]">
      {items.map((item) => (
        <div
          key={item.id}
          className="grid gap-2 border-b border-black/[0.06] py-3 md:grid-cols-[180px_minmax(0,1fr)] dark:border-white/[0.08]"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {item.label}
          </div>
          <StageRichText value={item.value ?? item.display_value} />
        </div>
      ))}
    </div>
  )
}

type StageSummaryCard = {
  label: string
  value: string
  hint?: string | null
}

function normalizeEvaluationSummary(value: unknown): EvaluationSummaryPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const summary: EvaluationSummaryPayload = {
    takeaway: asString(raw.takeaway),
    claim_update: asString(raw.claim_update),
    baseline_relation: asString(raw.baseline_relation),
    comparability: asString(raw.comparability),
    failure_mode: asString(raw.failure_mode),
    next_action: asString(raw.next_action),
  }
  return Object.values(summary).some(Boolean) ? summary : null
}

function evaluationSummaryCards(value: unknown): StageSummaryCard[] {
  const summary = normalizeEvaluationSummary(value)
  if (!summary) return []
  const items: Array<[keyof EvaluationSummaryPayload, string, string | null]> = [
    ['takeaway', 'Takeaway', 'One-sentence reusable conclusion.'],
    ['claim_update', 'Claim Update', 'How this result changes the current claim.'],
    ['baseline_relation', 'Baseline Relation', 'Overall relation to the accepted baseline.'],
    ['comparability', 'Comparability', 'How fair or stable the comparison is.'],
    ['failure_mode', 'Failure Mode', 'Primary failure class, if any.'],
    ['next_action', 'Next Action', 'Immediate recommended route from this evidence.'],
  ]
  return items
    .filter(([key]) => Boolean(summary[key]))
    .map(([key, label, hint]) => ({
      label,
      value: summary[key] || '—',
      hint,
    }))
}

function StageSummaryGrid({ items }: { items: StageSummaryCard[] }) {
  if (!items.length) {
    return <div className="text-sm leading-7 text-muted-foreground">No summary details yet.</div>
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[22px] border border-black/[0.06] bg-black/[0.02] px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.03]"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {item.label}
          </div>
          <div className="mt-2 break-words text-sm font-medium leading-6 text-foreground">
            {item.value}
          </div>
          {item.hint ? (
            <div className="mt-2 break-words text-xs leading-5 text-muted-foreground">{item.hint}</div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function StageActionButton({
  children,
  disabled,
  onClick,
  icon,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
  icon?: React.ReactNode
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className="h-10 rounded-full border-black/[0.08] bg-transparent px-4 text-[12px] shadow-none hover:bg-black/[0.03] dark:border-white/[0.1] dark:hover:bg-white/[0.05]"
    >
      {icon}
      {children}
    </Button>
  )
}

type StageSurfaceTabKey = 'overview' | 'details' | 'draft'

function StageFileList({
  items,
  latexRootPath,
  onOpenDocument,
  onDownloadDocument,
  onOpenLatex,
}: {
  items: QuestStageFileEntry[]
  latexRootPath?: string | null
  onOpenDocument: (documentId: string) => void
  onDownloadDocument: (documentId: string, fallbackName: string) => void
  onOpenLatex: () => void
}) {
  if (!items.length) {
    return <div className="text-sm leading-7 text-muted-foreground">No linked files yet.</div>
  }

  return (
    <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
      {items.map((item) => {
        const canOpenDocument = typeof item.document_id === 'string' && item.document_id.trim().length > 0
        const isLatexRoot = item.kind === 'directory' && latexRootPath && item.path === latexRootPath
        return (
          <div key={`${item.kind}:${item.id}`} className="flex flex-wrap items-start justify-between gap-4 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold text-foreground">{item.label}</div>
                {item.kind === 'directory' ? <StagePill>directory</StagePill> : null}
                {!item.exists ? <StagePill>missing</StagePill> : null}
              </div>
              {item.description ? (
                <div className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</div>
              ) : null}
              <div className="mt-2 break-all font-mono text-[11px] text-muted-foreground">{item.path}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isLatexRoot ? (
                <StageActionButton onClick={onOpenLatex} icon={<FolderOpen className="mr-1.5 h-3.5 w-3.5" />}>
                  Open LaTeX
                </StageActionButton>
              ) : null}
              {canOpenDocument ? (
                <StageActionButton
                  onClick={() => onOpenDocument(item.document_id!)}
                  icon={<ExternalLink className="mr-1.5 h-3.5 w-3.5" />}
                >
                  Open
                </StageActionButton>
              ) : null}
              {canOpenDocument && item.kind !== 'directory' ? (
                <StageActionButton
                  onClick={() => onDownloadDocument(item.document_id!, item.path)}
                  icon={<Download className="mr-1.5 h-3.5 w-3.5" />}
                >
                  Download
                </StageActionButton>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StageHistoryList({
  items,
  onOpenDocument,
}: {
  items: QuestStageHistoryEntry[]
  onOpenDocument: (documentId: string) => void
}) {
  if (!items.length) {
    return <div className="text-sm leading-7 text-muted-foreground">No durable history yet.</div>
  }

  return (
    <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
      {items.map((item) => (
        <div key={item.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-foreground">{item.title}</div>
              {item.status ? <StagePill>{item.status}</StagePill> : null}
              {item.artifact_kind ? <StagePill>{item.artifact_kind}</StagePill> : null}
            </div>
            {item.summary ? (
              <div className="mt-1">
                <StageRichText value={item.summary} className="text-muted-foreground" />
              </div>
            ) : null}
            <div className="mt-2 text-[11px] text-muted-foreground">
              {formatTimestamp(item.created_at)}
              {item.path ? ` · ${item.path}` : ''}
            </div>
          </div>
          {item.document_id ? (
            <StageActionButton
              onClick={() => onOpenDocument(item.document_id!)}
              icon={<ExternalLink className="mr-1.5 h-3.5 w-3.5" />}
            >
              Open
            </StageActionButton>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function StageKeyValueList({
  items,
}: {
  items: Array<{ label: string; value: unknown }>
}) {
  const visibleItems = items.filter((item) => item.value != null && stringifyValue(item.value) !== '—')
  if (!visibleItems.length) {
    return <div className="text-sm leading-7 text-muted-foreground">No structured details yet.</div>
  }
  return (
    <div className="border-t border-black/[0.06] dark:border-white/[0.08]">
      {visibleItems.map((item) => (
        <div
          key={item.label}
          className="grid gap-2 border-b border-black/[0.06] py-3 md:grid-cols-[180px_minmax(0,1fr)] dark:border-white/[0.08]"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {item.label}
          </div>
          <StageRichText value={item.value} />
        </div>
      ))}
    </div>
  )
}

function StagePathActions({
  paths,
  resolveDocumentId,
  onOpenDocument,
}: {
  paths: Array<{ label: string; path?: string | null }>
  resolveDocumentId: (path?: string | null) => string | null
  onOpenDocument: (documentId: string) => void
}) {
  const visiblePaths = paths.filter((item) => item.path)
  if (!visiblePaths.length) return null
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {visiblePaths.map((item) => {
        const documentId = resolveDocumentId(item.path)
        if (!documentId) return null
        return (
          <StageActionButton
            key={`${item.label}:${item.path}`}
            onClick={() => onOpenDocument(documentId)}
            icon={<ExternalLink className="mr-1.5 h-3.5 w-3.5" />}
          >
            Open {item.label}
          </StageActionButton>
        )
      })}
    </div>
  )
}

function StageInlineContent({
  title,
  value,
  tone = 'default',
}: {
  title: string
  value: unknown
  tone?: 'default' | 'muted'
}) {
  if (value == null || stringifyValue(value) === '—') return null
  return (
    <div
      className={cn(
        'rounded-[22px] border px-4 py-4',
        tone === 'muted'
          ? 'border-black/[0.05] bg-black/[0.02] dark:border-white/[0.08] dark:bg-white/[0.03]'
          : 'border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-[rgba(255,255,255,0.02)]'
      )}
    >
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </div>
      <StageRichText value={value} />
    </div>
  )
}

function StageTraceActions({
  items,
}: {
  items: Array<Record<string, unknown>>
}) {
  if (!items.length) return null
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={String(item.action_id || item.created_at || index)}
          className="rounded-[18px] border border-black/[0.06] bg-black/[0.02] px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.03]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-foreground">
              {asString(item.title) || `Trace ${index + 1}`}
            </div>
            {asString(item.status) ? <StagePill>{asString(item.status)}</StagePill> : null}
            {asString(item.tool_name) ? <StagePill>{asString(item.tool_name)}</StagePill> : null}
            {asString(item.artifact_kind) ? <StagePill>{asString(item.artifact_kind)}</StagePill> : null}
          </div>
          {asString(item.created_at) ? (
            <div className="mt-1 text-[11px] text-muted-foreground">{formatTimestamp(asString(item.created_at))}</div>
          ) : null}
          {item.summary != null && stringifyValue(item.summary) !== '—' ? (
            <div className="mt-3">
              <StageRichText value={item.summary} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function AnalysisTodoList({
  items,
}: {
  items: Array<Record<string, unknown>>
}) {
  if (!items.length) {
    return <div className="text-sm leading-7 text-muted-foreground">No analysis todo items yet.</div>
  }
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div
          key={String(item.todo_id || item.slice_id || index)}
          className="rounded-[22px] border border-black/[0.06] bg-black/[0.02] px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.03]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-foreground">
              {asString(item.title) || asString(item.slice_id) || `Todo ${index + 1}`}
            </div>
            {asString(item.status) ? <StagePill>{asString(item.status)}</StagePill> : null}
            {asString(item.todo_id) ? <StagePill>{asString(item.todo_id)}</StagePill> : null}
          </div>
          <div className="mt-3">
            <StageKeyValueList
              items={[
                { label: 'Slice', value: item.slice_id },
                { label: 'Research Question', value: item.research_question },
                { label: 'Experimental Design', value: item.experimental_design },
                { label: 'Why Now', value: item.why_now },
                { label: 'Success Criteria', value: item.success_criteria },
                { label: 'Abandonment Criteria', value: item.abandonment_criteria },
                { label: 'Completion Condition', value: item.completion_condition },
                { label: 'Reviewer Items', value: item.reviewer_item_ids },
                { label: 'Manuscript Targets', value: item.manuscript_targets },
              ]}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function AnalysisSliceList({
  items,
  resolveDocumentId,
  onOpenDocument,
}: {
  items: Array<Record<string, unknown>>
  resolveDocumentId: (path?: string | null) => string | null
  onOpenDocument: (documentId: string) => void
}) {
  if (!items.length) {
    return <div className="text-sm leading-7 text-muted-foreground">No analysis slices yet.</div>
  }
  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const summaryCards = evaluationSummaryCards(item.evaluation_summary)
        return (
          <div
            key={String(item.slice_id || index)}
            className="rounded-[22px] border border-black/[0.06] bg-black/[0.02] px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.03]"
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-foreground">
                {asString(item.title) || asString(item.slice_id) || `Slice ${index + 1}`}
              </div>
              {asString(item.status) ? <StagePill>{asString(item.status)}</StagePill> : null}
              {asString(item.run_kind) ? <StagePill>{asString(item.run_kind)}</StagePill> : null}
            </div>
            <div className="mt-3">
              <StageKeyValueList
                items={[
                  { label: 'Slice ID', value: item.slice_id },
                  { label: 'Question', value: item.question },
                  { label: 'Hypothesis', value: item.hypothesis },
                  { label: 'Why Now', value: item.why_now },
                  { label: 'Success Criteria', value: item.success_criteria },
                  { label: 'Abandonment Criteria', value: item.abandonment_criteria },
                  { label: 'Reviewer Items', value: item.reviewer_item_ids },
                  { label: 'Manuscript Targets', value: item.manuscript_targets },
                  { label: 'Metric Summary', value: item.metric_summary },
                  { label: 'Claim Impact', value: item.claim_impact },
                  { label: 'Reviewer Resolution', value: item.reviewer_resolution },
                  { label: 'Manuscript Update Hint', value: item.manuscript_update_hint },
                  { label: 'Next Recommendation', value: item.next_recommendation },
                  { label: 'Deviations', value: item.deviations },
                  { label: 'Evidence Paths', value: item.evidence_paths },
                ]}
              />
            </div>
            {summaryCards.length ? (
              <div className="mt-3">
                <StageSummaryGrid items={summaryCards} />
              </div>
            ) : null}
            {asString(item.plan_markdown) || asString(item.result_markdown) || asString(item.mirror_markdown) ? (
              <div className="mt-3 grid gap-3">
                <StageInlineContent title="Plan" value={item.plan_markdown} tone="muted" />
                <StageInlineContent title="Result" value={item.result_markdown} tone="muted" />
                <StageInlineContent title="Mirror" value={item.mirror_markdown} tone="muted" />
              </div>
            ) : null}
            <StagePathActions
              paths={[
                { label: 'Plan', path: asString(item.plan_path) },
                { label: 'Result', path: asString(item.result_path) },
                { label: 'Mirror', path: asString(item.mirror_path) },
              ]}
              resolveDocumentId={resolveDocumentId}
              onOpenDocument={onOpenDocument}
            />
          </div>
        )
      })}
    </div>
  )
}

export function QuestStageSurface({
  questId,
  stageSelection,
  onRefresh,
}: {
  questId: string
  stageSelection: QuestStageSelection | null
  onRefresh: () => Promise<void>
}) {
  const [refreshing, setRefreshing] = React.useState(false)
  const [archivePending, setArchivePending] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<StageSurfaceTabKey>('overview')
  const openTab = useTabsStore((state) => state.openTab)
  const { openFileInTab } = useOpenFile()

  const stageQuery = useQuery({
    queryKey: ['quest-stage-view', questId, safeStableStringify(stageSelection || {})],
    queryFn: () =>
      client.stageView(questId, {
        selection_ref: stageSelection?.selection_ref ?? null,
        selection_type: stageSelection?.selection_type ?? null,
        branch_name: stageSelection?.branch_name ?? null,
        stage_key: stageSelection?.stage_key ?? null,
        worktree_rel_path: stageSelection?.worktree_rel_path ?? null,
        scope_paths: stageSelection?.scope_paths ?? null,
        compare_base: stageSelection?.compare_base ?? null,
        compare_head: stageSelection?.compare_head ?? null,
        branch_no: stageSelection?.branch_no ?? null,
        parent_branch: stageSelection?.parent_branch ?? null,
        foundation_ref: stageSelection?.foundation_ref ?? null,
        foundation_reason: stageSelection?.foundation_reason ?? null,
        foundation_label: stageSelection?.foundation_label ?? null,
        idea_title: stageSelection?.idea_title ?? null,
        label: stageSelection?.label ?? null,
        summary: stageSelection?.summary ?? null,
        baseline_gate: stageSelection?.baseline_gate ?? null,
      }),
    enabled: Boolean(stageSelection?.stage_key || stageSelection?.selection_ref),
  })

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.allSettled([onRefresh(), stageQuery.refetch()])
    } finally {
      setRefreshing(false)
    }
  }, [onRefresh, stageQuery])

  const openDocument = React.useCallback(
    async (documentId: string) => {
      const node = await openQuestDocumentAsFileNode(questId, documentId)
      await openFileInTab(node, {
        customData: {
          projectId: questId,
          quest_stage_selection: stageSelection || null,
        },
      })
    },
    [openFileInTab, questId, stageSelection]
  )

  const downloadDocument = React.useCallback(
    async (documentId: string, fallbackName: string) => {
      const node = await openQuestDocumentAsFileNode(questId, documentId)
      await downloadFileById(node.id, node.name || fallbackName || 'download')
    },
    [questId]
  )

  const stage = (stageQuery.data as QuestStageViewPayload | undefined) ?? null
  const stageDetails = asRecord(stage?.details)
  const latestArtifact = asRecord(stageDetails.latest_artifact)
  const latestArtifactPayload = latestArtifact.payload
  const stagePaper = asRecord(stageDetails.paper)
  const stagePaperBuild = asRecord(stagePaper.build)
  const keyFiles = stage?.sections?.key_files || []
  const pdfPaths = asStringList(stagePaperBuild.pdf_paths)
  const pdfPath = asString(stagePaperBuild.pdf_path) || pdfPaths[0] || null
  const latexRootPath = asString(stagePaperBuild.latex_root_path)

  const documentIdByPath = React.useMemo(() => {
    const next = new Map<string, string>()
    keyFiles.forEach((item) => {
      if (item.path && item.document_id) {
        next.set(item.path, item.document_id)
      }
    })
    return next
  }, [keyFiles])

  const resolveDocumentId = React.useCallback(
    (path?: string | null) => {
      const normalized = asString(path)
      if (!normalized) return null
      return documentIdByPath.get(normalized) || `questpath::${normalized}`
    },
    [documentIdByPath]
  )

  const openLatex = React.useCallback(() => {
    if (!latexRootPath) return
    const folderId = buildQuestDirectoryId(questId, latexRootPath)
    const folderName = latexRootPath.split('/').filter(Boolean).pop() || 'latex'
    openTab({
      pluginId: BUILTIN_PLUGINS.LATEX,
      context: {
        type: 'custom',
        resourceId: folderId,
        resourceName: folderName,
        resourcePath: toFilesResourcePath(latexRootPath),
        customData: {
          projectId: questId,
          latexFolderId: folderId,
          mainFileId: null,
          quest_stage_selection: stageSelection || null,
        },
      },
      title: folderName,
    })
  }, [latexRootPath, openTab, questId, stageSelection])

  const downloadLatexArchive = React.useCallback(async () => {
    if (!latexRootPath) return
    setArchivePending(true)
    try {
      const folderId = buildQuestDirectoryId(questId, latexRootPath)
      const blob = await getLatexSourcesArchiveBlob(questId, folderId)
      const fileName = `${latexRootPath.split('/').filter(Boolean).pop() || 'latex-sources'}.zip`
      triggerBlobDownload(blob, fileName)
    } finally {
      setArchivePending(false)
    }
  }, [latexRootPath, questId])

  if (!stageSelection?.stage_key && !stageSelection?.selection_ref) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a durable stage node from Canvas to open its page.
      </div>
    )
  }

  if (stageQuery.isLoading || !stageQuery.data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading stage view…
      </div>
    )
  }

  const details = stageDetails
  const analysis = asRecord(details.analysis)
  const paper = stagePaper
  const idea = asRecord(details.idea)
  const branch = asRecord(details.branch)
  const experiment = asRecord(details.experiment)
  const ideaMethodBrief = asString(idea.method_brief) || asString(branch.method_brief)
  const ideaSelectionScores = asRecord(idea.selection_scores) || asRecord(branch.selection_scores)
  const ideaMechanismFamily = asString(idea.mechanism_family) || asString(branch.mechanism_family)
  const ideaChangeLayer = asString(idea.change_layer) || asString(branch.change_layer)
  const ideaSourceLens = asString(idea.source_lens) || asString(branch.source_lens)
  const paperDrafting = asRecord(paper.drafting)
  const paperBuild = stagePaperBuild
  const bundleManifest = asRecord(paperBuild.bundle_manifest)
  const compileReport = asRecord(paperBuild.compile_report)
  const historyItems = stage.sections.history || []
  const latestHistory = historyItems[0] || null
  const mainTexPath = asString(paperBuild.main_tex_path)
  const compileStatus =
    asString(compileReport.status) ||
    asString(bundleManifest.status) ||
    (pdfPath ? 'ready' : 'missing')

  const topFacts = [
    stage.branch_no ? { label: 'Branch', value: `#${stage.branch_no}` } : null,
    stage.branch_name ? { label: 'Ref', value: stage.branch_name } : null,
    stage.lineage_intent ? { label: 'Lineage', value: stage.lineage_intent } : null,
    stage.parent_branch ? { label: 'Parent', value: stage.parent_branch } : null,
    stage.foundation_label ? { label: 'Foundation', value: stage.foundation_label } : null,
    stage.foundation_reason ? { label: 'Why', value: stage.foundation_reason } : null,
    branch.idea_title ? { label: 'Idea', value: branch.idea_title } : null,
  ].filter(Boolean) as Array<{ label: string; value: unknown }>

  const contextCards = [
    stage.compare_base && stage.compare_head
      ? {
          label: 'Compare',
          value: `${stage.compare_base} -> ${stage.compare_head}`,
          hint: 'Diff-highlighted files are available from Explorer.',
        }
      : null,
    stage.scope_paths?.length
      ? {
          label: 'Scope',
          value: stage.scope_paths.join(', '),
          hint: 'Explorer is scoped to these paths for this node.',
        }
      : null,
    stage.sections.key_files?.length
      ? {
          label: 'Key Files',
          value: `${stage.sections.key_files.length} linked file${stage.sections.key_files.length === 1 ? '' : 's'}`,
          hint: 'Use the linked files below for durable source-of-truth state.',
        }
      : null,
    historyItems.length
      ? {
          label: 'History',
          value: `${historyItems.length} durable record${historyItems.length === 1 ? '' : 's'}`,
          hint: latestHistory ? `Latest update: ${formatTimestamp(latestHistory.created_at)}` : null,
        }
      : null,
    countArray(idea.literature_files)
      ? {
          label: 'Literature',
          value: `${countArray(idea.literature_files)} linked record${countArray(idea.literature_files) === 1 ? '' : 's'}`,
          hint: 'Paper references stay summarized here and open through the linked files.',
        }
      : null,
    countArray(paper.outline_candidates)
      ? {
          label: 'Outline Candidates',
          value: `${countArray(paper.outline_candidates)} candidate${countArray(paper.outline_candidates) === 1 ? '' : 's'}`,
        }
      : null,
    paper.selected_outline
      ? {
          label: 'Selected Outline',
          value: asString(asRecord(paper.selected_outline).title) || 'Ready',
        }
      : null,
  ].filter(Boolean) as StageSummaryCard[]

  const branchContextFacts = [
    branch.idea_problem
      ? {
          id: 'idea-problem',
          label: 'Problem',
          value: branch.idea_problem,
          display_value: compactText(branch.idea_problem, 1200),
        }
      : null,
    branch.next_target
      ? {
          id: 'next-target',
          label: 'Next Target',
          value: branch.next_target,
        }
      : null,
    branch.decision_reason
      ? {
          id: 'decision-reason',
          label: 'Decision',
          value: branch.decision_reason,
          display_value: compactText(branch.decision_reason, 1200),
        }
      : null,
    latestHistory?.title
      ? {
          id: 'latest-record',
          label: 'Latest Durable Record',
          value: latestHistory.title,
          display_value: compactText(latestHistory.summary || latestHistory.title, 600),
        }
      : null,
  ].filter(Boolean) as QuestStageField[]

  const experimentEvaluationSummaryCards = evaluationSummaryCards(experiment.evaluation_summary)
  const branchEvaluationSummaryCards = evaluationSummaryCards(
    branch.latest_main_experiment ? asRecord(branch.latest_main_experiment).evaluation_summary : null
  )
  const stageEvaluationSummaryCards = experimentEvaluationSummaryCards.length
    ? experimentEvaluationSummaryCards
    : branchEvaluationSummaryCards
  const ideaMarkdown = asString(idea.idea_markdown)
  const experimentRunMarkdown = asString(experiment.run_markdown)
  const experimentTraceMarkdown = asString(experiment.trace_markdown)
  const experimentTraceActions = asRecordList(experiment.trace_actions)
  const experimentResultPayload = experiment.result_payload
  const analysisCharterMarkdown = asString(analysis.charter_markdown)
  const analysisTodoManifestMarkdown = asString(analysis.todo_manifest_markdown)
  const analysisSummaryMarkdown = asString(analysis.summary_markdown)
  const analysisTraceMarkdown = asString(analysis.trace_markdown)
  const analysisTraceActions = asRecordList(analysis.trace_actions)

  const paperSummaryCards = [
    {
      label: 'Bundle',
      value: asString(bundleManifest.title) || (pdfPath ? 'ready' : 'missing'),
      hint: asString(bundleManifest.summary) || null,
    },
    {
      label: 'Draft',
      value: asString(paperDrafting.draft_path) || 'paper/draft.md',
      hint: 'Open the durable Markdown draft directly from this page.',
    },
    {
      label: 'LaTeX',
      value: latexRootPath || 'Not recorded',
      hint: latexRootPath
        ? 'Open the LaTeX workspace to edit sources, compile, inspect warnings, and preview PDF.'
        : 'No LaTeX source root has been recorded yet.',
    },
    {
      label: 'Main TeX',
      value: mainTexPath || 'Not recorded',
    },
    {
      label: 'PDF',
      value: pdfPath || 'Not recorded',
      hint: pdfPath ? 'Open or download the current compiled PDF.' : null,
    },
    {
      label: 'Compile',
      value: compileStatus || 'unknown',
      hint: 'Web compile uses the local machine LaTeX toolchain when available.',
    },
    {
      label: 'References',
      value: String(paperDrafting.references_count ?? 0),
      hint: asString(paperDrafting.references_path) || 'paper/references.bib',
    },
  ]

  const pdfDocumentId = pdfPath ? documentIdByPath.get(pdfPath) || `questpath::${pdfPath}` : null
  const draftPath =
    asString(stage.idea_draft_path) ||
    asString(idea.draft_path) ||
    asString(branch.idea_draft_path) ||
    asString(paperDrafting.draft_path) ||
    'paper/draft.md'
  const draftDocumentId = draftPath ? documentIdByPath.get(draftPath) || `questpath::${draftPath}` : null
  const draftMarkdown =
    asString(idea.draft_markdown) ||
    asString(branch.idea_draft_markdown) ||
    null
  const declaredTabs = (
    Array.isArray(stage.subviews)
      ? stage.subviews.filter(
          (item): item is StageSurfaceTabKey =>
            item === 'overview' || item === 'details' || item === 'draft'
        )
      : []
  ) || []
  const availableTabs = declaredTabs.length
    ? declaredTabs
    : draftMarkdown
      ? (['overview', 'details', 'draft'] as StageSurfaceTabKey[])
      : ([] as StageSurfaceTabKey[])
  const selectedTab =
    availableTabs.length && !availableTabs.includes(activeTab) ? availableTabs[0] : activeTab

  return (
    <div className="h-full min-h-0 overflow-y-auto" data-onboarding-id="quest-stage-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 lg:px-10">
        <section className="rounded-[32px] border border-black/[0.06] bg-white/[0.92] px-6 py-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/[0.08] dark:bg-[rgba(18,18,20,0.82)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="break-words text-[24px] font-semibold tracking-tight text-foreground">
                  {stage.title}
                </h2>
                {(stage.tags || []).map((tag) => (tag ? <StagePill key={tag}>{tag}</StagePill> : null))}
              </div>

              {stage.note ? (
                <div className="mt-3 max-w-4xl">
                  <StageRichText value={stage.note} className="text-muted-foreground" />
                </div>
              ) : null}

              {topFacts.length ? (
                <dl className="mt-5 grid gap-x-8 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
                  {topFacts.map((item) => (
                    <div key={item.label} className="min-w-0">
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {item.label}
                      </dt>
                      <dd className="mt-1 break-words text-sm leading-6 text-foreground">
                        {stringifyValue(item.value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void handleRefresh()
              }}
              className="h-9 rounded-md border-black/[0.08] bg-transparent px-3 text-[12px] shadow-none hover:bg-black/[0.03] dark:border-white/[0.1] dark:hover:bg-white/[0.05]"
            >
              <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          {availableTabs.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {availableTabs.map((tabKey) => {
                const isActive = selectedTab === tabKey
                const label =
                  tabKey === 'overview' ? 'Overview' : tabKey === 'details' ? 'Details' : 'Draft'
                return (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => setActiveTab(tabKey)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-[11px] font-medium transition-colors',
                      isActive
                        ? 'border-black/[0.12] bg-black/[0.06] text-foreground dark:border-white/[0.14] dark:bg-white/[0.08]'
                        : 'border-black/[0.08] text-muted-foreground hover:bg-black/[0.03] dark:border-white/[0.1] dark:hover:bg-white/[0.05]'
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          ) : null}
        </section>

        {(!availableTabs.length || selectedTab === 'overview') && (
          <>
            <StageSection title="Overview">
              <StageFactRows items={stage.sections.overview || []} />
            </StageSection>

            {(contextCards.length || branchContextFacts.length) && (
              <StageSection
                title="Context Snapshot"
                hint="This page keeps only overall context. Open concrete files and full patches from the linked files."
              >
                {contextCards.length ? <StageSummaryGrid items={contextCards} /> : null}
                {branchContextFacts.length ? (
                  <div className={cn(contextCards.length ? 'mt-5' : null)}>
                    <StageFactRows items={branchContextFacts} />
                  </div>
                ) : null}
              </StageSection>
            )}
          </>
        )}

        {(!availableTabs.length || selectedTab === 'details') && (
          <>
            <StageSection title="Key Facts">
              <StageFactRows items={stage.sections.key_facts || []} />
            </StageSection>

            {stageEvaluationSummaryCards.length ? (
              <StageSection
                title="Evaluation Summary"
                hint="This is the compact structured judgment attached to the latest recorded result."
              >
                <StageSummaryGrid items={stageEvaluationSummaryCards} />
              </StageSection>
            ) : null}

            {(latexRootPath || pdfPath || paper.selected_outline || countArray(paper.outline_candidates)) && (
          <StageSection
            title="Paper Workspace"
            hint="This page stays minimal: use these controls to open the real PDF, LaTeX workspace, and durable paper files."
          >
            <StageSummaryGrid items={paperSummaryCards} />
            <div className="mt-5 flex flex-wrap gap-2">
              {pdfPath ? (
                <>
                  <StageActionButton
                    onClick={() => {
                      if (pdfDocumentId) {
                        void openDocument(pdfDocumentId)
                      }
                    }}
                    icon={<FileText className="mr-1.5 h-3.5 w-3.5" />}
                  >
                    Open PDF
                  </StageActionButton>
                  <StageActionButton
                    onClick={() => {
                      if (pdfDocumentId) {
                        void downloadDocument(pdfDocumentId, pdfPath)
                      }
                    }}
                    icon={<Download className="mr-1.5 h-3.5 w-3.5" />}
                  >
                    Download PDF
                  </StageActionButton>
                </>
              ) : null}
              {draftDocumentId ? (
                <StageActionButton
                  onClick={() => {
                    void openDocument(draftDocumentId)
                  }}
                  icon={<FileText className="mr-1.5 h-3.5 w-3.5" />}
                >
                  Open Draft
                </StageActionButton>
              ) : null}
              {latexRootPath ? (
                <>
                  <StageActionButton onClick={openLatex} icon={<FolderOpen className="mr-1.5 h-3.5 w-3.5" />}>
                    Open LaTeX
                  </StageActionButton>
                  <StageActionButton
                    onClick={() => {
                      void downloadLatexArchive()
                    }}
                    disabled={archivePending}
                    icon={<Download className="mr-1.5 h-3.5 w-3.5" />}
                  >
                    {archivePending ? 'Preparing…' : 'Download Sources'}
                  </StageActionButton>
                </>
              ) : null}
            </div>
            {mainTexPath || asString(compileReport.error_message) ? (
              <div className="mt-5 border-t border-black/[0.06] pt-4 dark:border-white/[0.08]">
                <div className="grid gap-4 md:grid-cols-2">
                  {mainTexPath ? (
                    <div className="rounded-[22px] border border-black/[0.06] bg-black/[0.02] px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Main Source
                      </div>
                      <div className="mt-2 flex items-start gap-2 text-sm leading-6 text-foreground">
                        <FileCode2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <div className="min-w-0 break-all">{mainTexPath}</div>
                      </div>
                    </div>
                  ) : null}
                  {asString(compileReport.error_message) ? (
                    <div className="rounded-[22px] border border-[#C4A7A0]/40 bg-[#C4A7A0]/10 px-4 py-4 dark:border-[#C4A7A0]/30 dark:bg-[#C4A7A0]/10">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Latest Compile Error
                      </div>
                      <div className="mt-2 text-sm leading-6 text-foreground">
                        {asString(compileReport.error_message)}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </StageSection>
            )}

            {paper.selected_outline ? (
          <StageSection title="Selected Outline">
            <StageFactRows
              items={[
                {
                  id: 'story',
                  label: 'Story',
                  value: asRecord(paper.selected_outline).story,
                  display_value: compactText(asRecord(paper.selected_outline).story, 1200),
                },
                {
                  id: 'ten-questions',
                  label: 'Ten Questions',
                  value: asRecord(paper.selected_outline).ten_questions,
                  display_value: compactText(asRecord(paper.selected_outline).ten_questions, 1200),
                },
                {
                  id: 'research-questions',
                  label: 'Research Questions',
                  value: asRecord(asRecord(paper.selected_outline).detailed_outline).research_questions,
                  display_value: compactText(
                    asRecord(asRecord(paper.selected_outline).detailed_outline).research_questions,
                    1200
                  ),
                },
                {
                  id: 'experimental-designs',
                  label: 'Experimental Designs',
                  value: asRecord(asRecord(paper.selected_outline).detailed_outline).experimental_designs,
                  display_value: compactText(
                    asRecord(asRecord(paper.selected_outline).detailed_outline).experimental_designs,
                    1200
                  ),
                },
                {
                  id: 'contributions',
                  label: 'Contributions',
                  value: asRecord(asRecord(paper.selected_outline).detailed_outline).contributions,
                  display_value: compactText(
                    asRecord(asRecord(paper.selected_outline).detailed_outline).contributions,
                    1200
                  ),
                },
              ]}
            />
          </StageSection>
            ) : null}

            {countArray(paper.outline_candidates) ? (
          <StageSection title="Outline Candidates">
            <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
              {asRecordList(paper.outline_candidates).map((entry) => (
                <div key={String(entry.candidate_id || entry.title || Math.random())} className="py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-foreground">
                      {asString(entry.title) || 'Outline candidate'}
                    </div>
                    {asString(entry.status) ? <StagePill>{asString(entry.status)}</StagePill> : null}
                  </div>
                  {asString(entry.note) ? (
                    <div className="mt-1 text-sm leading-6 text-muted-foreground">{asString(entry.note)}</div>
                  ) : null}
                  {asString(entry.path) ? (
                    <div className="mt-2 font-mono text-[11px] text-muted-foreground">{asString(entry.path)}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </StageSection>
            ) : null}

            {(ideaMethodBrief || Object.keys(ideaSelectionScores).length || ideaMechanismFamily || ideaChangeLayer || ideaSourceLens) ? (
          <StageSection title="Method Layer" hint="This is the optimization-facing method object attached to the idea or branch.">
            <div className="grid gap-4">
              <StageKeyValueList
                items={[
                  { label: 'Mechanism Family', value: ideaMechanismFamily },
                  { label: 'Change Layer', value: ideaChangeLayer },
                  { label: 'Source Lens', value: ideaSourceLens },
                ]}
              />
              <StageInlineContent title="Method Brief" value={ideaMethodBrief} />
              <StageInlineContent title="Selection Scores" value={ideaSelectionScores} tone="muted" />
            </div>
          </StageSection>
            ) : null}

            {ideaMarkdown ? (
          <StageSection title="Idea Document" hint="This is the durable idea document submitted through artifact tools.">
            <StageInlineContent title="Idea Markdown" value={ideaMarkdown} />
          </StageSection>
            ) : null}

            {(experimentRunMarkdown ||
              experimentResultPayload != null ||
              experimentTraceMarkdown ||
              experimentTraceActions.length) ? (
          <StageSection
            title="Main Experiment Record"
            hint="This section renders the durable experiment narrative and result payload directly in the tab."
          >
            <div className="grid gap-4">
              <StageInlineContent title="Run Narrative" value={experimentRunMarkdown} />
              <StageInlineContent title="Structured Result" value={experimentResultPayload} />
              <StageInlineContent title="Trace Summary" value={experimentTraceMarkdown} tone="muted" />
              {experimentTraceActions.length ? <StageTraceActions items={experimentTraceActions} /> : null}
            </div>
          </StageSection>
            ) : null}

            {latestArtifactPayload != null ? (
          <StageSection
            title="Latest Artifact Payload"
            hint="This shows the raw recorded artifact payload so the stage page can be checked directly against the durable JSON keys and values."
          >
            <StageKeyValueList
              items={[
                { label: 'Artifact ID', value: latestArtifact.artifact_id },
                { label: 'Artifact Kind', value: latestArtifact.artifact_kind },
                { label: 'Artifact Path', value: latestArtifact.artifact_path },
              ]}
            />
            <div className="mt-4">
              <StageInlineContent title="Payload JSON" value={latestArtifactPayload} tone="muted" />
            </div>
          </StageSection>
            ) : null}

            <StageSection title="Files">
          <StageFileList
            items={keyFiles}
            latexRootPath={latexRootPath}
            onOpenDocument={(documentId) => {
              void openDocument(documentId)
            }}
            onDownloadDocument={(documentId, fallbackName) => {
              void downloadDocument(documentId, fallbackName)
            }}
            onOpenLatex={openLatex}
          />
          </StageSection>

            {(Object.keys(asRecord(analysis.campaign_origin)).length ||
              countArray(analysis.todo_items) ||
              countArray(analysis.slices)) && (
              <StageSection
                title="Supplementary Experiment Protocol"
                hint="This tab contains the full supplementary experiment contract and inline durable markdown for the campaign and slices."
              >
                {analysisCharterMarkdown || analysisTodoManifestMarkdown || analysisSummaryMarkdown || analysisTraceMarkdown ? (
                  <div className="mb-6 grid gap-3">
                    <StageInlineContent title="Campaign Charter" value={analysisCharterMarkdown} />
                    <StageInlineContent title="Todo Manifest" value={analysisTodoManifestMarkdown} />
                    <StageInlineContent title="Campaign Summary" value={analysisSummaryMarkdown} />
                    <StageInlineContent title="Trace Summary" value={analysisTraceMarkdown} tone="muted" />
                  </div>
                ) : null}

                {Object.keys(asRecord(analysis.campaign_origin)).length ? (
                  <div>
                    <div className="mb-3 text-sm font-semibold text-foreground">Campaign Origin</div>
                    <StageKeyValueList
                      items={[
                        { label: 'Kind', value: asRecord(analysis.campaign_origin).kind },
                        { label: 'Reason', value: asRecord(analysis.campaign_origin).reason },
                        { label: 'Source Artifact', value: asRecord(analysis.campaign_origin).source_artifact_id },
                        { label: 'Source Outline', value: asRecord(analysis.campaign_origin).source_outline_ref },
                        { label: 'Source Review Round', value: asRecord(analysis.campaign_origin).source_review_round },
                        { label: 'Reviewer Items', value: asRecord(analysis.campaign_origin).reviewer_item_ids },
                      ]}
                    />
                  </div>
                ) : null}

                {countArray(analysis.todo_items) ? (
                  <div className={cn(Object.keys(asRecord(analysis.campaign_origin)).length ? 'mt-6' : null)}>
                    <div className="mb-3 text-sm font-semibold text-foreground">Todo Items</div>
                    <AnalysisTodoList items={asRecordList(analysis.todo_items)} />
                  </div>
                ) : null}

                {countArray(analysis.slices) ? (
                  <div
                    className={cn(
                      Object.keys(asRecord(analysis.campaign_origin)).length || countArray(analysis.todo_items)
                        ? 'mt-6'
                        : null
                    )}
                  >
                    <div className="mb-3 text-sm font-semibold text-foreground">Slices</div>
                    <AnalysisSliceList
                      items={asRecordList(analysis.slices)}
                      resolveDocumentId={resolveDocumentId}
                      onOpenDocument={(documentId) => {
                        void openDocument(documentId)
                      }}
                    />
                  </div>
                ) : null}

                <StagePathActions
                  paths={[
                    { label: 'Campaign Manifest', path: asString(analysis.manifest_path) },
                    { label: 'Campaign Charter', path: asString(analysis.charter_path) },
                    { label: 'Todo Manifest', path: asString(analysis.todo_manifest_path) },
                  ]}
                  resolveDocumentId={resolveDocumentId}
                  onOpenDocument={(documentId) => {
                    void openDocument(documentId)
                  }}
                />
                {analysisTraceActions.length ? (
                  <div className="mt-6">
                    <div className="mb-3 text-sm font-semibold text-foreground">Recent Trace</div>
                    <StageTraceActions items={analysisTraceActions} />
                  </div>
                ) : null}
              </StageSection>
            )}

            <StageSection title="History">
          <StageHistoryList
            items={stage.sections.history || []}
            onOpenDocument={(documentId) => {
              void openDocument(documentId)
            }}
          />
            </StageSection>
          </>
        )}

        {availableTabs.includes('draft') && selectedTab === 'draft' ? (
          <StageSection
            title="Draft"
            hint="This is the longer idea draft used to stabilize the route before execution."
          >
            <div className="flex flex-wrap gap-2 border-b border-black/[0.06] pb-4 dark:border-white/[0.08]">
              {draftDocumentId ? (
                <StageActionButton
                  onClick={() => {
                    void openDocument(draftDocumentId)
                  }}
                  icon={<ExternalLink className="mr-1.5 h-3.5 w-3.5" />}
                >
                  Open Draft
                </StageActionButton>
              ) : null}
              {draftDocumentId ? (
                <StageActionButton
                  onClick={() => {
                    void downloadDocument(draftDocumentId, draftPath)
                  }}
                  icon={<Download className="mr-1.5 h-3.5 w-3.5" />}
                >
                  Download
                </StageActionButton>
              ) : null}
            </div>
            <div className="pt-5">
              <StageRichText value={draftMarkdown || 'No draft content has been recorded yet.'} />
            </div>
          </StageSection>
        ) : null}
      </div>
    </div>
  )
}

export default QuestStageSurface
