'use client'

import { AlertTriangle, ArrowUpRight, BookOpenText, Clock3, Database, Search } from 'lucide-react'
import type { ToolViewProps } from './types'
import { DsToolFrame, DsToolPill, DsToolSection } from './DsToolFrame'
import {
  asRecord,
  asString,
  asStringArray,
  extractPathEntries,
  getToolArgsRecord,
  getToolResultRecord,
  getToolResultValue,
  resolveMcpIdentity,
  truncateText,
} from './mcp-view-utils'

function formatDate(value?: string) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function renderPathList(paths: Array<{ label: string; path: string }>) {
  if (paths.length === 0) return null
  return (
    <DsToolSection title="Paths" compact>
      <div className="space-y-2">
        {paths.map((entry) => (
          <div key={`${entry.label}:${entry.path}`} className="rounded-[10px] bg-[rgba(255,255,255,0.72)] px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              {entry.label}
            </div>
            <div className="mt-1 break-all font-mono text-[11px] text-[var(--text-primary)]">{entry.path}</div>
          </div>
        ))}
      </div>
    </DsToolSection>
  )
}

function renderMemoryItems(items: unknown[]) {
  const normalized = items
    .map((entry) => asRecord(entry))
    .filter((entry): entry is NonNullable<ReturnType<typeof asRecord>> => Boolean(entry))
  if (normalized.length === 0) {
    return (
      <DsToolSection title="Results">
        <div className="text-[12px] text-[var(--text-secondary)]">No memory cards matched this request.</div>
      </DsToolSection>
    )
  }
  return (
    <DsToolSection title={`Results (${normalized.length})`}>
      <div className="space-y-2.5">
        {normalized.map((item, index) => {
          const title = asString(item.title) || asString(item.id) || `Memory ${index + 1}`
          const kind = asString(item.type) || asString(item.kind)
          const scope = asString(item.scope)
          const sourceQuestId = asString(item.source_quest_id)
          const updatedAt = asString(item.updated_at)
          const excerpt = asString(item.excerpt)
          const path = asString(item.path)
          return (
            <div
              key={`${title}:${path ?? index}`}
              className="rounded-[12px] border border-[var(--border-light)] bg-[rgba(255,255,255,0.78)] px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-semibold text-[var(--text-primary)]">{title}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {kind ? <DsToolPill tone="muted">{kind}</DsToolPill> : null}
                    {scope ? <DsToolPill tone="muted">{scope}</DsToolPill> : null}
                    {sourceQuestId ? <DsToolPill tone="muted">{sourceQuestId}</DsToolPill> : null}
                  </div>
                </div>
                {updatedAt ? <div className="text-[10px] text-[var(--text-tertiary)]">{formatDate(updatedAt)}</div> : null}
              </div>
              {excerpt ? <div className="mt-2 text-[12px] leading-6 text-[var(--text-secondary)]">{truncateText(excerpt, 220)}</div> : null}
              {path ? (
                <div className="mt-2 break-all font-mono text-[10px] text-[var(--text-tertiary)]">{path}</div>
              ) : null}
            </div>
          )
        })}
      </div>
    </DsToolSection>
  )
}

function renderRawDetails(value: unknown) {
  if (value == null) return null
  let raw = ''
  if (typeof value === 'string') {
    raw = value
  } else {
    try {
      raw = JSON.stringify(value, null, 2)
    } catch {
      raw = String(value)
    }
  }
  if (!raw.trim()) return null
  return (
    <details className="rounded-[12px] border border-[var(--border-light)] bg-[rgba(255,255,255,0.62)] px-3 py-2">
      <summary className="cursor-pointer text-[11px] font-medium text-[var(--text-secondary)]">Raw payload</summary>
      <pre className="mt-3 overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-6 text-[var(--text-primary)]">
        {raw}
      </pre>
    </details>
  )
}

export function McpMemoryToolView({ toolContent }: ToolViewProps) {
  const { tool } = resolveMcpIdentity(toolContent)
  const args = getToolArgsRecord(toolContent)
  const resultRecord = getToolResultRecord(toolContent)
  const resultValue = getToolResultValue(toolContent)
  const error =
    asString((toolContent.content as Record<string, unknown> | undefined)?.error) || asString(resultRecord?.error)

  const active = toolContent.status === 'calling'
  const titleMap: Record<string, string> = {
    write: active ? 'DeepScientist is saving memory...' : 'DeepScientist saved memory.',
    read: active ? 'DeepScientist is reading memory...' : 'DeepScientist loaded memory.',
    search: active ? 'DeepScientist is searching memory...' : 'DeepScientist searched memory.',
    list_recent: active ? 'DeepScientist is loading recent memory...' : 'DeepScientist loaded recent memory.',
    promote_to_global: active ? 'DeepScientist is promoting memory...' : 'DeepScientist promoted memory.',
  }
  const title = titleMap[tool ?? ''] || (active ? 'DeepScientist is updating memory...' : 'DeepScientist updated memory.')

  const resultCard = asRecord(resultValue)
  const memoryCard = asRecord(resultCard?.record) ?? resultCard
  const itemTitle = asString(memoryCard?.title) || asString(args.title)
  const memoryKind = asString(memoryCard?.type) || asString(memoryCard?.kind) || asString(args.kind)
  const scope = asString(memoryCard?.scope) || asString(args.scope)
  const sourceQuestId = asString(memoryCard?.source_quest_id)
  const tags = asStringArray((memoryCard?.metadata as Record<string, unknown> | undefined)?.tags ?? args.tags)
  const excerpt = asString(memoryCard?.excerpt) || asString(memoryCard?.body) || asString(args.body)
  const updatedAt = asString(memoryCard?.updated_at)
  const cardId = asString(memoryCard?.id)
  const query = asString(args.query) || asString(resultRecord?.query)
  const items = Array.isArray(resultRecord?.items) ? resultRecord?.items : []
  const count = typeof resultRecord?.count === 'number' ? resultRecord.count : items.length
  const paths = extractPathEntries(resultRecord ?? memoryCard ?? args)
  const promotedFrom = asRecord((memoryCard?.metadata as Record<string, unknown> | undefined)?.promoted_from)

  return (
    <div className="flex flex-col gap-3">
      <DsToolFrame
        title={title}
        subtitle={
          tool === 'search'
            ? query
              ? `Query: ${query}`
              : 'Searching quest-scoped or global memory cards.'
            : tool === 'list_recent'
              ? 'Showing the most recently touched memory cards.'
              : itemTitle
                ? `Card: ${itemTitle}`
                : 'Memory operations are stored as durable Markdown cards.'
        }
        accent="sage"
        meta={
          <>
            {tool ? <DsToolPill>{tool}</DsToolPill> : null}
            {memoryKind ? <DsToolPill tone="muted">{memoryKind}</DsToolPill> : null}
            {scope ? <DsToolPill tone="muted">{scope}</DsToolPill> : null}
            {typeof count === 'number' && (tool === 'search' || tool === 'list_recent') ? (
              <DsToolPill tone="success">{count} results</DsToolPill>
            ) : null}
          </>
        }
      >
        {error ? (
          <div className="ds-tool-error-banner" role="status">
            <AlertTriangle className="ds-tool-error-icon" />
            <span>{error}</span>
          </div>
        ) : null}

        {tool === 'search' || tool === 'list_recent' ? renderMemoryItems(items) : null}

        {tool === 'write' || tool === 'read' || tool === 'promote_to_global' ? (
          <DsToolSection title="Card">
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text-primary)]">
                    <BookOpenText className="h-4 w-4 text-[#6e8a79]" />
                    <span className="truncate">{itemTitle || 'Untitled memory card'}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {memoryKind ? <DsToolPill tone="muted">{memoryKind}</DsToolPill> : null}
                    {scope ? <DsToolPill tone="muted">{scope}</DsToolPill> : null}
                    {sourceQuestId ? <DsToolPill tone="muted">{sourceQuestId}</DsToolPill> : null}
                    {cardId ? <DsToolPill tone="muted">{cardId}</DsToolPill> : null}
                  </div>
                </div>
                {updatedAt ? (
                  <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
                    <Clock3 className="h-3 w-3" />
                    <span>{formatDate(updatedAt)}</span>
                  </div>
                ) : null}
              </div>
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <DsToolPill key={tag} tone="default">
                      #{tag}
                    </DsToolPill>
                  ))}
                </div>
              ) : null}
              {excerpt ? (
                <div className="rounded-[12px] bg-[rgba(255,255,255,0.68)] px-3 py-3 text-[12px] leading-6 text-[var(--text-secondary)]">
                  {truncateText(excerpt, 560)}
                </div>
              ) : null}
              {promotedFrom ? (
                <div className="flex items-start gap-2 rounded-[12px] border border-[var(--border-light)] bg-[rgba(255,255,255,0.68)] px-3 py-3 text-[12px] text-[var(--text-secondary)]">
                  <ArrowUpRight className="mt-0.5 h-4 w-4 text-[#6e8a79]" />
                  <div className="space-y-1">
                    <div className="font-medium text-[var(--text-primary)]">Promoted from quest memory</div>
                    {asString(promotedFrom.path) ? <div className="break-all font-mono text-[11px]">{asString(promotedFrom.path)}</div> : null}
                    {asString(promotedFrom.quest_root) ? <div className="break-all font-mono text-[11px]">{asString(promotedFrom.quest_root)}</div> : null}
                  </div>
                </div>
              ) : null}
            </div>
          </DsToolSection>
        ) : null}

        {tool === 'search' && query ? (
          <DsToolSection title="Search context" compact>
            <div className="flex items-center gap-2 text-[12px] text-[var(--text-primary)]">
              <Search className="h-4 w-4 text-[#6e8a79]" />
              <span>{query}</span>
            </div>
          </DsToolSection>
        ) : null}

        {tool === 'list_recent' ? (
          <DsToolSection title="What this means" compact>
            <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
              <Database className="h-4 w-4 text-[#6e8a79]" />
              <span>These are the latest durable notes available to reuse without re-searching.</span>
            </div>
          </DsToolSection>
        ) : null}

        {renderPathList(paths)}
        {renderRawDetails(resultValue)}
      </DsToolFrame>
    </div>
  )
}

export default McpMemoryToolView
