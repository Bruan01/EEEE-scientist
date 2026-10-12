'use client'

import * as React from 'react'
import { BookOpen, ExternalLink, FileText, RefreshCw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { client } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { MemoryCard, OpenDocumentPayload } from '@/types'

type QuestMemorySurfaceProps = {
  questId: string
  memory: MemoryCard[]
  loading: boolean
  onRefresh: () => Promise<void>
  onOpenDocument: (documentId: string) => void
}

type MemoryCategory = 'all' | 'decisions' | 'ideas' | 'knowledge' | 'papers' | 'episodes'

const MEMORY_CATEGORY_META: Array<{
  key: MemoryCategory
  label: string
  matcher: (item: MemoryCard) => boolean
}> = [
  { key: 'all', label: 'All', matcher: () => true },
  { key: 'decisions', label: 'Decisions', matcher: (item) => classifyMemoryCategory(item) === 'decisions' },
  { key: 'ideas', label: 'Ideas', matcher: (item) => classifyMemoryCategory(item) === 'ideas' },
  { key: 'knowledge', label: 'Knowledge', matcher: (item) => classifyMemoryCategory(item) === 'knowledge' },
  { key: 'papers', label: 'Papers', matcher: (item) => classifyMemoryCategory(item) === 'papers' },
  { key: 'episodes', label: 'Episodes', matcher: (item) => classifyMemoryCategory(item) === 'episodes' },
]

function classifyMemoryCategory(item: MemoryCard): Exclude<MemoryCategory, 'all'> {
  const path = String(item.path || '').toLowerCase()
  if (path.includes('memory/decisions/')) return 'decisions'
  if (path.includes('memory/ideas/')) return 'ideas'
  if (path.includes('memory/knowledge/')) return 'knowledge'
  if (path.includes('memory/papers/')) return 'papers'
  return 'episodes'
}

function formatRelativeTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function summarizeMemory(item: MemoryCard) {
  const raw = String(item.excerpt || item.path || '').trim()
  if (!raw) return 'No summary yet.'
  return raw.length <= 180 ? raw : `${raw.slice(0, 177).trimEnd()}...`
}

function isSharedMemory(item: MemoryCard, activeQuestId: string) {
  const sourceQuestId = String(item.source_quest_id || '').trim()
  return Boolean(item.shared || (sourceQuestId && sourceQuestId !== activeQuestId))
}

function sourceQuestLabel(item: MemoryCard, activeQuestId: string) {
  const sourceQuestId = String(item.source_quest_id || '').trim()
  if (!sourceQuestId) return null
  if (sourceQuestId === activeQuestId) return `Local · ${sourceQuestId}`
  return `Shared from ${sourceQuestId}`
}

export function QuestMemorySurface({
  questId,
  memory,
  loading,
  onRefresh,
  onOpenDocument,
}: QuestMemorySurfaceProps) {
  const [activeCategory, setActiveCategory] = React.useState<MemoryCategory>('all')
  const [selectedDocumentId, setSelectedDocumentId] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<OpenDocumentPayload | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [detailError, setDetailError] = React.useState<string | null>(null)

  const categoryCounts = React.useMemo(() => {
    const counts = new Map<MemoryCategory, number>()
    MEMORY_CATEGORY_META.forEach((item) => {
      counts.set(item.key, item.key === 'all' ? memory.length : memory.filter(item.matcher).length)
    })
    return counts
  }, [memory])

  const filteredMemory = React.useMemo(() => {
    const category = MEMORY_CATEGORY_META.find((item) => item.key === activeCategory)
    return category ? memory.filter(category.matcher) : memory
  }, [activeCategory, memory])

  const selectedEntry = React.useMemo(
    () =>
      filteredMemory.find((item) => item.document_id === selectedDocumentId) ??
      filteredMemory[0] ??
      null,
    [filteredMemory, selectedDocumentId]
  )

  React.useEffect(() => {
    if (!selectedEntry?.document_id) {
      setSelectedDocumentId(filteredMemory[0]?.document_id || null)
      return
    }
    if (selectedEntry.document_id !== selectedDocumentId) {
      setSelectedDocumentId(selectedEntry.document_id)
    }
  }, [filteredMemory, selectedDocumentId, selectedEntry])

  React.useEffect(() => {
    if (!selectedEntry?.document_id) {
      setDetail(null)
      setDetailLoading(false)
      setDetailError(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    setDetailError(null)
    void client
      .openDocument(questId, selectedEntry.document_id)
      .then((payload) => {
        if (cancelled) return
        setDetail(payload)
      })
      .catch((error) => {
        if (cancelled) return
        setDetail(null)
        setDetailError(error instanceof Error ? error.message : 'Failed to load memory note.')
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [questId, selectedEntry?.document_id])

  return (
    <div
      className="feed-scrollbar h-full overflow-y-auto overflow-x-hidden"
      data-onboarding-id="quest-memory-surface"
    >
      <div className="mx-auto flex min-h-full max-w-[1380px] flex-col px-5 pb-10 pt-5 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Quest Memory</span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">Quest memory workspace</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
              Review durable memory cards, inspect their markdown body, and jump back to the source note when needed.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-full border-black/[0.08] bg-white/[0.84] px-4 shadow-sm dark:border-white/[0.10] dark:bg-[rgba(18,18,18,0.72)]"
            onClick={() => {
              void onRefresh()
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid min-h-[720px] gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="min-w-0 border-r border-black/[0.06] pr-4 dark:border-white/[0.08]">
            <div className="flex flex-col gap-6">
              <div>
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Categories
                </div>
                <div className="space-y-1">
                  {MEMORY_CATEGORY_META.map((category) => {
                    const active = activeCategory === category.key
                    return (
                      <button
                        key={category.key}
                        type="button"
                        onClick={() => setActiveCategory(category.key)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm transition',
                          active
                            ? 'bg-black/[0.05] text-foreground dark:bg-white/[0.08]'
                            : 'text-muted-foreground hover:bg-black/[0.03] hover:text-foreground dark:hover:bg-white/[0.04]'
                        )}
                      >
                        <span>{category.label}</span>
                        <span className="text-[11px]">{categoryCounts.get(category.key) || 0}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="min-w-0">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Entries
                  </div>
                  <div className="text-[11px] text-muted-foreground">{filteredMemory.length} visible</div>
                </div>
                {loading && memory.length === 0 ? (
                  <div className="py-4 text-sm leading-7 text-muted-foreground">Loading memory cards…</div>
                ) : filteredMemory.length === 0 ? (
                  <div className="py-4 text-sm leading-7 text-muted-foreground">
                    No memory cards in this category yet.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredMemory.map((item, index) => {
                      const isActive = item.document_id === selectedEntry?.document_id
                      return (
                        <button
                          key={`${item.document_id || item.path || 'memory'}:${index}`}
                          type="button"
                          onClick={() => setSelectedDocumentId(item.document_id || null)}
                          className={cn(
                            'w-full rounded-[22px] px-3 py-3 text-left transition',
                            isActive
                              ? 'bg-black/[0.05] dark:bg-white/[0.08]'
                              : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium leading-6 text-foreground [overflow-wrap:anywhere]">
                                {item.title || item.path || 'Memory'}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="uppercase tracking-[0.12em]">
                                  {item.type || classifyMemoryCategory(item)}
                                </span>
                                {sourceQuestLabel(item, questId) ? (
                                  <span>{sourceQuestLabel(item, questId)}</span>
                                ) : null}
                              </div>
                            </div>
                            <div className="shrink-0 text-[11px] text-muted-foreground">
                              {formatRelativeTime(item.updated_at)}
                            </div>
                          </div>
                          <div className="mt-2 whitespace-normal text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                            {summarizeMemory(item)}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Detail
                </div>
                <h3 className="mt-2 break-words text-xl font-semibold tracking-tight text-foreground">
                  {selectedEntry?.title || selectedEntry?.path || 'Select a memory card'}
                </h3>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{selectedEntry?.type || 'memory'}</span>
                  {selectedEntry ? (
                    <span>{sourceQuestLabel(selectedEntry, questId) || 'Local memory'}</span>
                  ) : null}
                  {selectedEntry && isSharedMemory(selectedEntry, questId) ? (
                    <Badge variant="secondary" className="rounded-full">
                      Read-only shared card
                    </Badge>
                  ) : null}
                  {selectedEntry?.updated_at ? <span>{formatRelativeTime(selectedEntry.updated_at)}</span> : null}
                  {selectedEntry?.path ? <span className="break-all">{selectedEntry.path}</span> : null}
                </div>
              </div>
              {selectedEntry?.document_id ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-full border-black/[0.08] bg-white/[0.84] px-3 text-[12px] shadow-sm dark:border-white/[0.10] dark:bg-[rgba(18,18,18,0.72)]"
                  onClick={() => onOpenDocument(selectedEntry.document_id!)}
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open file
                </Button>
              ) : null}
            </div>

            {!selectedEntry ? (
              <div className="flex min-h-[460px] items-center justify-center text-sm text-muted-foreground">
                Select a memory card to inspect its content.
              </div>
            ) : detailLoading ? (
              <div className="py-6 text-sm leading-7 text-muted-foreground">Loading memory content…</div>
            ) : detailError ? (
              <div className="py-6 text-sm leading-7 text-muted-foreground">{detailError}</div>
            ) : (
              <article className="min-w-0">
                <div className="prose prose-neutral max-w-none text-[15px] leading-7 dark:prose-invert prose-headings:tracking-tight prose-p:my-4 prose-pre:rounded-2xl prose-pre:bg-black/[0.04] dark:prose-pre:bg-white/[0.05]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {detail?.content || selectedEntry.excerpt || ''}
                  </ReactMarkdown>
                </div>
                {!detail?.content ? (
                  <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>No markdown body stored yet.</span>
                  </div>
                ) : null}
              </article>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default QuestMemorySurface
