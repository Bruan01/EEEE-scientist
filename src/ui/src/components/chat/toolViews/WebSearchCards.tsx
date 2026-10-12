'use client'

import { BookOpen, ExternalLink, FileText, Globe2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  buildFaviconUrl,
  type NormalizedWebSearchPayload,
  type NormalizedWebSearchResult,
} from './web-search-view-utils'

export function WebSearchQueryPills({
  queries,
  activeQuery,
  compact = false,
}: {
  queries: string[]
  activeQuery?: string
  compact?: boolean
}) {
  if (queries.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {queries.map((query) => (
        <span
          key={query}
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium tracking-[0.02em]',
            query === activeQuery
              ? 'bg-[rgba(99,130,173,0.12)] text-[#5d79a0]'
              : 'bg-black/[0.04] text-muted-foreground dark:bg-white/[0.06]',
            compact && 'px-2 py-[3px] text-[10px]'
          )}
        >
          {query}
        </span>
      ))}
    </div>
  )
}

function ResultMeta({
  result,
  compact = false,
}: {
  result: NormalizedWebSearchResult
  compact?: boolean
}) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
      {result.arxivId ? (
        <span className="rounded-full bg-[rgba(99,130,173,0.10)] px-2 py-0.5 font-mono text-[#5d79a0]">
          arXiv:{result.arxivId}
        </span>
      ) : null}
      {result.source ? (
        <span className="rounded-full bg-black/[0.04] px-2 py-0.5 uppercase tracking-[0.06em] dark:bg-white/[0.06]">
          {result.source}
        </span>
      ) : null}
      {result.absUrl ? (
        <a
          href={result.absUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[#6382ad] hover:underline"
        >
          <BookOpen className="h-3 w-3" />
          arXiv
        </a>
      ) : null}
      {result.pdfUrl ? (
        <a
          href={result.pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[#6382ad] hover:underline"
        >
          <FileText className="h-3 w-3" />
          PDF
        </a>
      ) : null}
      {compact && !result.absUrl && !result.pdfUrl && result.url ? (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          open
        </span>
      ) : null}
    </div>
  )
}

export function WebSearchResultCard({
  result,
  compact = false,
}: {
  result: NormalizedWebSearchResult
  compact?: boolean
}) {
  const primaryUrl = result.absUrl || result.url || result.pdfUrl
  const faviconUrl = buildFaviconUrl(primaryUrl)
  return (
    <div
      className={cn(
        'rounded-[16px] border border-[rgba(121,145,182,0.16)] bg-[rgba(255,255,255,0.78)] px-3.5 py-3 shadow-[0_18px_30px_-28px_rgba(15,23,42,0.20)] dark:bg-white/[0.04]',
        compact && 'rounded-[14px] px-3 py-2.5'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-[2px] flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(121,145,182,0.10)]">
          {faviconUrl ? (
            <img
              src={faviconUrl}
              alt=""
              className="h-4 w-4 rounded-[4px]"
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
          ) : result.kind === 'paper' ? (
            <BookOpen className="h-4 w-4 text-[#6382ad]" />
          ) : (
            <Globe2 className="h-4 w-4 text-[#6382ad]" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {primaryUrl ? (
            <a
              href={primaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-2 text-[12px] font-semibold leading-5 text-foreground hover:text-[#6382ad]"
            >
              <span className="flex-1 break-words [overflow-wrap:anywhere]">{result.title}</span>
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-40 transition group-hover:opacity-100" />
            </a>
          ) : (
            <div className="text-[12px] font-semibold leading-5 text-foreground">{result.title}</div>
          )}

          <ResultMeta result={result} compact={compact} />

          {result.snippet ? (
            <div
              className={cn(
                'mt-2 text-[12px] leading-6 text-muted-foreground',
                compact && 'line-clamp-2 leading-5'
              )}
            >
              {result.snippet}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function WebSearchResults({
  payload,
  compact = false,
  emptyMessage,
  maxItems,
}: {
  payload: Pick<NormalizedWebSearchPayload, 'results'>
  compact?: boolean
  emptyMessage?: string
  maxItems?: number
}) {
  const results = typeof maxItems === 'number' ? payload.results.slice(0, maxItems) : payload.results
  if (results.length === 0) {
    if (!emptyMessage) return null
    return (
      <div className="rounded-[14px] border border-dashed border-black/[0.08] px-3 py-2.5 text-[11px] text-muted-foreground dark:border-white/[0.10]">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {results.map((result, index) => (
        <WebSearchResultCard
          key={`${result.url || result.title}-${index}`}
          result={result}
          compact={compact}
        />
      ))}
    </div>
  )
}

