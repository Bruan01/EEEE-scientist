'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Sparkles } from 'lucide-react'
import type { ToolViewProps } from './types'
import { DsToolFrame, DsToolSection } from './DsToolFrame'
import { WebSearchQueryPills, WebSearchResults } from './WebSearchCards'
import { normalizeWebSearchPayload } from './web-search-view-utils'

export function SearchToolView({ toolContent, panelMode }: ToolViewProps) {
  const showHeader = panelMode == null
  const autoExpandResults = !showHeader
  const [resultsExpanded, setResultsExpanded] = useState(autoExpandResults)
  const payload = normalizeWebSearchPayload({
    args: toolContent.args,
    content: toolContent.content,
    metadataSearch:
      toolContent.metadata && typeof toolContent.metadata === 'object'
        ? (toolContent.metadata as Record<string, unknown>).search
        : undefined,
    output:
      toolContent.content && typeof toolContent.content === 'object'
        ? (toolContent.content as Record<string, unknown>).result ??
          (toolContent.content as Record<string, unknown>).output
        : undefined,
  })
  const error = payload.error
  const results = payload.results
  const query = payload.query
  const count = payload.count
  const isSearching = toolContent.status === 'calling'
  const dedupedQueries = payload.queries

  useEffect(() => {
    setResultsExpanded(autoExpandResults)
  }, [autoExpandResults, toolContent.tool_call_id])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showHeader ? (
        <div className="flex h-[36px] items-center border-b border-[var(--border-main)] bg-[var(--background-gray-main)] px-3 shadow-[inset_0px_1px_0px_0px_#FFFFFF]">
          <div className="flex-1 text-center text-xs font-medium text-[var(--text-tertiary)]">
            Search
          </div>
        </div>
      ) : null}
      <div className="relative flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[720px] flex-col gap-3 px-4 py-3">
          <DsToolFrame
            title={isSearching ? 'DeepScientist is searching the web...' : 'DeepScientist searched the web.'}
            subtitle={
              query
                ? `Primary query: ${query}`
                : 'This run records the exact search queries that Codex issued.'
            }
            accent="blue"
            meta={
              <>
                <DsToolPill>{isSearching ? 'running' : 'completed'}</DsToolPill>
                {count > 0 ? <DsToolPill tone="success">{count} results</DsToolPill> : null}
                {dedupedQueries.length > 0 ? <DsToolPill tone="muted">{dedupedQueries.length} queries</DsToolPill> : null}
              </>
            }
          >
            {error ? (
              <div className="ds-tool-error-banner" role="status">
                <AlertTriangle className="ds-tool-error-icon" />
                <span>{error}</span>
              </div>
            ) : null}

            {dedupedQueries.length > 0 ? (
              <DsToolSection title="Issued queries">
                <WebSearchQueryPills queries={dedupedQueries} activeQuery={query} />
              </DsToolSection>
            ) : null}

            {count > 0 && !autoExpandResults ? (
              <button
                type="button"
                onClick={() => setResultsExpanded((value) => !value)}
                className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border-light)] bg-[rgba(255,255,255,0.82)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] transition hover:bg-[var(--background-white-main)]"
              >
                {resultsExpanded ? 'Hide results' : `Show results (${count})`}
              </button>
            ) : null}

            {payload.summary ? (
              <DsToolSection title="Search summary">
                <div className="text-[12px] leading-6 text-[var(--text-secondary)]">
                  {payload.summary}
                </div>
              </DsToolSection>
            ) : null}

            {results.length > 0 && resultsExpanded ? (
              <DsToolSection title={`Results (${count})`}>
                <WebSearchResults payload={payload} />
              </DsToolSection>
            ) : null}

            {!error && results.length === 0 ? (
              <DsToolSection title="Search trace">
                <div className="flex items-start gap-2 text-[12px] leading-6 text-[var(--text-secondary)]">
                  <Sparkles className="mt-0.5 h-4 w-4 text-[#6382ad]" />
                  <span>
                    {isSearching
                      ? 'Codex is still issuing search queries.'
                      : dedupedQueries.length > 0
                        ? 'This run preserved the search trace, but the upstream runtime did not return result cards for this call.'
                        : 'No structured search results were returned for this call.'}
                  </span>
                </div>
                {payload.summary ? (
                  <div className="mt-3 rounded-[12px] bg-[rgba(255,255,255,0.72)] px-3 py-3 text-[12px] leading-6 text-[var(--text-secondary)]">
                    {payload.summary}
                  </div>
                ) : null}
              </DsToolSection>
            ) : null}
          </DsToolFrame>
        </div>
      </div>
    </div>
  )
}

export default SearchToolView
