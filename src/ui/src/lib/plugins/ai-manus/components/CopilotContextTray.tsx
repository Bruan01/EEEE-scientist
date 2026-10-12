'use client'

import * as React from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Layers3, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/useI18n'
import type {
  WorkspaceContentKind,
  WorkspaceDocumentMode,
  WorkspaceIssueFocus,
  WorkspaceSelectionReference,
} from '@/lib/stores/workspace-surface'
import type { WorkspaceBadgeTone } from '@/lib/workspace/content-meta'
import { getWorkspaceContentTone } from '@/lib/workspace/content-meta'

type CopilotContextTrayProps = {
  contentKind?: WorkspaceContentKind
  documentMode?: WorkspaceDocumentMode
  openTabCount: number
  references: WorkspaceSelectionReference[]
  activeReferenceId?: string | null
  focusedIssue?: WorkspaceIssueFocus | null
  onRemoveReference: (referenceId: string) => void
}

type ContextCard = {
  id: string
  testId: string
  typeLabel: string
  resourceLabel?: string
  resourcePath?: string
  locationLabel?: string
  body: string
  detail?: string
  helper: string
  tone: WorkspaceBadgeTone
  isActive?: boolean
  onRemove?: () => void
}

function getToneClassName(tone: WorkspaceBadgeTone, active?: boolean) {
  switch (tone) {
    case 'pdf':
      return active
        ? 'border-[#8FA3B8]/45 bg-[#8FA3B8]/18 text-[#495f75]'
        : 'border-[#8FA3B8]/32 bg-[#8FA3B8]/12 text-[#55697d]'
    case 'latex':
      return active
        ? 'border-[#A99EBE]/45 bg-[#A99EBE]/18 text-[#5a5170]'
        : 'border-[#A99EBE]/32 bg-[#A99EBE]/12 text-[#665d7b]'
    case 'markdown':
      return active
        ? 'border-[#9CB0A7]/45 bg-[#9CB0A7]/18 text-[#4e625b]'
        : 'border-[#9CB0A7]/32 bg-[#9CB0A7]/12 text-[#5b6f68]'
    case 'html':
      return active
        ? 'border-[#B49B88]/45 bg-[#B49B88]/18 text-[#725d50]'
        : 'border-[#B49B88]/32 bg-[#B49B88]/12 text-[#7d695d]'
    case 'attention':
      return active
        ? 'border-[#C1A2A0]/48 bg-[#C1A2A0]/18 text-[#7a5957]'
        : 'border-[#C1A2A0]/34 bg-[#C1A2A0]/12 text-[#8b6766]'
    default:
      return active
        ? 'border-black/12 bg-black/[0.06] text-[var(--text-secondary)] dark:border-white/14 dark:bg-white/[0.08]'
        : 'border-black/10 bg-black/[0.04] text-[var(--text-secondary)] dark:border-white/10 dark:bg-white/[0.05]'
  }
}

function getContentKindLabel(
  kind: WorkspaceContentKind | undefined,
  t: (key: string, variables?: Record<string, string | number>, fallback?: string) => string
) {
  switch (kind) {
    case 'pdf':
      return t('context_kind_pdf')
    case 'markdown':
      return t('context_kind_markdown')
    case 'mdx':
      return t('context_kind_mdx')
    case 'html':
      return t('context_kind_html')
    case 'latex':
      return t('context_kind_latex')
    case 'notebook':
      return t('context_kind_notebook')
    case 'lab':
      return t('context_kind_lab')
    case 'cli':
      return t('context_kind_cli')
    default:
      return t('context_kind_file')
  }
}

function getDocumentModeLabel(
  mode: WorkspaceDocumentMode | undefined,
  t: (key: string, variables?: Record<string, string | number>, fallback?: string) => string
) {
  switch (mode) {
    case 'rendered':
      return t('context_mode_rendered')
    case 'source':
      return t('context_mode_source')
    case 'preview':
      return t('context_mode_preview')
    case 'snapshot':
      return t('context_mode_snapshot', undefined, 'Snapshot')
    case 'diff':
      return t('context_mode_diff', undefined, 'Diff')
    default:
      return null
  }
}

function getResourceLabel(
  resourceName: string | undefined,
  resourcePath: string | undefined,
  fallback: string
) {
  if (resourceName?.trim()) return resourceName.trim()
  if (resourcePath?.trim()) {
    const parts = resourcePath.split('/').filter(Boolean)
    return parts[parts.length - 1] || resourcePath
  }
  return fallback
}

function CopilotContextCard({ card }: { card: ContextCard }) {
  const { t } = useI18n('ai_manus')

  return (
    <div
      data-testid={card.testId}
      className={cn(
        'rounded-[20px] border px-3.5 py-3',
        'bg-[linear-gradient(180deg,rgba(252,251,249,0.96),rgba(246,243,240,0.92))]',
        'shadow-[0_16px_36px_-30px_rgba(45,42,38,0.34)] backdrop-blur-[6px]',
        getToneClassName(card.tone, card.isActive)
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex h-6 items-center rounded-full border px-2.5 text-[10px] font-semibold tracking-[0.01em]',
                getToneClassName(card.tone, card.isActive)
              )}
            >
              {card.typeLabel}
            </span>
            {card.resourceLabel ? (
              <span className="truncate text-[12px] font-semibold text-[var(--text-primary)]">
                {card.resourceLabel}
              </span>
            ) : null}
            {card.locationLabel ? (
              <span className="inline-flex h-6 items-center rounded-full border border-black/10 bg-black/[0.04] px-2.5 text-[10px] font-medium text-[var(--text-tertiary)] dark:border-white/10 dark:bg-white/[0.05]">
                {card.locationLabel}
              </span>
            ) : null}
          </div>
          {card.resourcePath ? (
            <div className="mt-1 truncate font-mono text-[10px] text-[var(--text-quaternary)]">
              {card.resourcePath}
            </div>
          ) : null}
        </div>
        {card.onRemove ? (
          <button
            type="button"
            onClick={card.onRemove}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors hover:bg-black/5 hover:text-[var(--text-primary)] dark:hover:bg-white/[0.06]"
            aria-label={t('reference_remove')}
            title={t('reference_remove')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <div className="mt-2.5 line-clamp-4 text-[12px] leading-5 text-[var(--text-primary)]">
        {card.body}
      </div>
      {card.detail ? (
        <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">
          {card.detail}
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-secondary)]">
        <span className="h-1.5 w-1.5 rounded-full bg-current/60" />
        <span>{card.helper}</span>
      </div>
    </div>
  )
}

export function CopilotContextTray({
  contentKind,
  documentMode,
  openTabCount,
  references,
  activeReferenceId,
  focusedIssue,
  onRemoveReference,
}: CopilotContextTrayProps) {
  const { t } = useI18n('ai_manus')
  const prefersReducedMotion = useReducedMotion()

  const orderedReferences = React.useMemo(() => {
    const list = [...references]
    list.sort((left, right) => {
      if (left.id === activeReferenceId) return -1
      if (right.id === activeReferenceId) return 1
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    })
    return list
  }, [activeReferenceId, references])

  const visibleReferences = React.useMemo(
    () => orderedReferences.slice(0, focusedIssue ? 2 : 3),
    [focusedIssue, orderedReferences]
  )

  const cards = React.useMemo<ContextCard[]>(() => {
    const items: ContextCard[] = []

    if (focusedIssue) {
      items.push({
        id: `issue-${focusedIssue.tabId}-${focusedIssue.line || focusedIssue.createdAt}`,
        testId: 'copilot-context-card-latex-error',
        typeLabel: t('context_card_latex_error'),
        resourceLabel: getResourceLabel(
          focusedIssue.resourceName,
          focusedIssue.resourcePath,
          t('context_kind_file')
        ),
        resourcePath: focusedIssue.resourcePath,
        locationLabel:
          typeof focusedIssue.line === 'number' && focusedIssue.line > 0
            ? t('context_card_line', { line: focusedIssue.line })
            : undefined,
        body: focusedIssue.message,
        detail: focusedIssue.excerpt?.trim() || t('context_issue_helper'),
        helper: t('context_included_next_message'),
        tone: 'attention',
        isActive: true,
      })
    }

    visibleReferences.forEach((reference) => {
      const excerpt = reference.markdownExcerpt?.trim() || reference.selectedText?.trim() || ''
      items.push({
        id: reference.id,
        testId: 'copilot-context-card-pdf',
        typeLabel: t('context_card_pdf_quote'),
        resourceLabel: getResourceLabel(
          reference.resourceName,
          reference.resourcePath,
          t('context_kind_pdf')
        ),
        resourcePath: reference.resourcePath,
        locationLabel:
          typeof reference.pageNumber === 'number' && reference.pageNumber > 0
            ? t('reference_page', { page: reference.pageNumber })
            : undefined,
        body: excerpt,
        detail:
          reference.excerptStatus === 'loading'
            ? t('reference_loading_excerpt')
            : reference.markdownExcerpt && reference.markdownExcerpt !== reference.selectedText
              ? t('reference_markdown_excerpt')
              : t('context_quote_helper'),
        helper: t('context_included_next_message'),
        tone: 'pdf',
        isActive: reference.id === activeReferenceId,
        onRemove: () => onRemoveReference(reference.id),
      })
    })

    return items
  }, [activeReferenceId, focusedIssue, onRemoveReference, t, visibleReferences])

  if (!cards.length) return null

  const hiddenReferenceCount = Math.max(0, references.length - visibleReferences.length)

  const summaryPills = [
    {
      id: 'kind',
      label: getContentKindLabel(contentKind, t),
      tone: getWorkspaceContentTone(contentKind),
    },
    ...(getDocumentModeLabel(documentMode, t)
      ? [
          {
            id: 'mode',
            label: getDocumentModeLabel(documentMode, t) as string,
            tone: 'neutral' as WorkspaceBadgeTone,
          },
        ]
      : []),
    {
      id: 'tabs',
      label: t('context_open_tabs', { count: openTabCount }),
      tone: 'neutral' as WorkspaceBadgeTone,
    },
    {
      id: 'quotes',
      label: t('context_quotes', { count: references.length }),
      tone: 'neutral' as WorkspaceBadgeTone,
    },
    ...(focusedIssue
      ? [
          {
            id: 'focused-issue',
            label: t('context_focused_issue'),
            tone: 'attention' as WorkspaceBadgeTone,
          },
        ]
      : []),
  ]

  const trayMotion = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const },
      }

  const cardMotion = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8, scale: 0.99 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -6, scale: 0.99 },
        transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
      }

  return (
    <motion.section data-testid="copilot-context-tray" className="mb-3 space-y-2.5" {...trayMotion}>
      <div data-testid="copilot-context-summary" className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 pr-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          <Layers3 className="h-3.5 w-3.5" />
          {t('context_tray_title')}
        </span>
        {summaryPills.map((pill) => (
          <span
            key={pill.id}
            className={cn(
              'inline-flex h-6 items-center rounded-full border px-2.5 text-[10px] font-medium',
              getToneClassName(pill.tone)
            )}
          >
            {pill.label}
          </span>
        ))}
        {hiddenReferenceCount > 0 ? (
          <span className="inline-flex h-6 items-center rounded-full border border-black/8 bg-black/[0.03] px-2.5 text-[10px] font-medium text-[var(--text-tertiary)] dark:border-white/10 dark:bg-white/[0.04]">
            {t('context_more_items', { count: hiddenReferenceCount })}
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {cards.map((card) => (
            <motion.div key={card.id} layout {...cardMotion}>
              <CopilotContextCard card={card} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.section>
  )
}
