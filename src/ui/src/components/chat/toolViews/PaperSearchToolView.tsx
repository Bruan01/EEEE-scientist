'use client'

import { AlertTriangle, BookOpen, ExternalLink, FileText } from 'lucide-react'
import type { ToolViewProps } from './types'
import {
  asRecord,
  formatPaperProviderLabel,
  normalizeArxivId,
  pickString,
  resolvePaperProviderServer,
  resolvePaperProviderSource,
  unwrapToolContent,
} from './paper-tool-utils'

interface NormalizedPaper {
  title: string
  abstract: string
  url: string
  absUrl: string
  arxivId: string
  pdfUrl: string
  source: string
}

interface NormalizedQuestionResult {
  question: string
  count: number
  papers: NormalizedPaper[]
  error?: string
}

function normalizePaper(value: unknown, fallbackSource: string): NormalizedPaper | null {
  const paper = asRecord(value)
  const arxivId = normalizeArxivId(pickString(paper.arxiv_id, paper.paper_id, paper.arxivId, paper.id))
  const absUrl = pickString(
    paper.abs_url,
    paper.absUrl,
    paper.arxiv_url,
    arxivId ? `https://arxiv.org/abs/${arxivId}` : ''
  )
  const pdfUrl = pickString(
    paper.pdf_url,
    paper.pdfUrl,
    arxivId ? `https://arxiv.org/pdf/${arxivId}.pdf` : ''
  )
  const url = pickString(paper.url, paper.link, absUrl, pdfUrl)
  const normalized: NormalizedPaper = {
    title: pickString(paper.title, paper.name, 'Untitled'),
    abstract: pickString(paper.abstract, paper.snippet, paper.summary, paper.description),
    url,
    absUrl,
    arxivId,
    pdfUrl,
    source: pickString(paper.source, fallbackSource),
  }
  if (!normalized.title && !normalized.url && !normalized.abstract) return null
  return normalized
}

function normalizeQuestionResult(
  value: unknown,
  fallbackSource: string
): NormalizedQuestionResult | null {
  const row = asRecord(value)
  const question = pickString(row.question, row.query)
  if (!question) return null

  const papersRaw = Array.isArray(row.papers) ? row.papers : []
  const papers = papersRaw
    .map((paper) => normalizePaper(paper, fallbackSource))
    .filter((paper): paper is NormalizedPaper => paper != null)
  const countFromField = typeof row.count === 'number' ? row.count : papers.length
  const error = pickString(row.error) || undefined

  return {
    question,
    count: countFromField,
    papers,
    error,
  }
}

function buildFaviconUrl(value?: string) {
  if (!value) return ''
  try {
    const url =
      value.startsWith('http://') || value.startsWith('https://')
        ? new URL(value)
        : new URL(`https://${value}`)
    return `${url.origin}/favicon.ico`
  } catch {
    return ''
  }
}

export function PaperSearchToolView({ toolContent, panelMode }: ToolViewProps) {
  const showHeader = panelMode == null
  const toolRecord = asRecord(toolContent)
  const providerServer = resolvePaperProviderServer(toolRecord)
  const providerLabel = formatPaperProviderLabel(providerServer)
  const providerSource = resolvePaperProviderSource(providerServer)
  const rawContent = asRecord(toolContent.content)
  const unwrappedContent = unwrapToolContent(toolContent)
  const content = Array.isArray(unwrappedContent) ? { papers: unwrappedContent } : asRecord(unwrappedContent)
  const error = pickString(content.error, rawContent.error, toolRecord.error) || undefined
  const rawPapers =
    Array.isArray(content.papers)
      ? content.papers
      : Array.isArray(content.results)
        ? content.results
        : Array.isArray(content.result)
          ? content.result
          : Array.isArray(content.items)
            ? content.items
            : []
  const papers = rawPapers
    .map((paper) => normalizePaper(paper, providerSource))
    .filter((paper): paper is NormalizedPaper => paper != null)
  const questionResultsRaw = Array.isArray(content.question_results)
    ? content.question_results
    : Array.isArray(content.questionResults)
      ? content.questionResults
      : []
  const questionResults = questionResultsRaw
    .map((item) => normalizeQuestionResult(item, providerSource))
    .filter((item): item is NormalizedQuestionResult => item != null)
  const hasGroupedResults = questionResults.length > 0
  const queryFromContent = pickString(
    content.query,
    content.question,
    rawContent.query,
    rawContent.question
  )
  const countFromContent = typeof content.count === 'number' ? content.count : undefined
  const args = asRecord(toolContent.args)
  const query =
    queryFromContent ||
    (hasGroupedResults ? questionResults[0]?.question || '' : '') ||
    pickString(args.query, args.question, args.q, args.text)
  const count =
    countFromContent ??
    (hasGroupedResults
      ? questionResults.reduce((total, group) => total + group.papers.length, 0)
      : papers.length)
  const usage = asRecord(content.paper_search_usage)
  const totalSearchCalls =
    typeof usage.total_calls === 'number' && Number.isFinite(usage.total_calls)
      ? usage.total_calls
      : undefined
  const requiredCallsForAnnotate =
    typeof content.required_paper_search_calls_for_pdf_annotate === 'number' &&
    Number.isFinite(content.required_paper_search_calls_for_pdf_annotate)
      ? content.required_paper_search_calls_for_pdf_annotate
      : undefined
  const annotationGateHint = pickString(content.annotation_gate_hint, content.message)
  const isSearching = toolContent.status === 'calling'
  const isSearchCompleted = !isSearching && !error
  const hasAnyGroupedPaper = hasGroupedResults && questionResults.some((group) => group.papers.length > 0)
  const shouldShowNoResults = isSearchCompleted && (hasGroupedResults ? !hasAnyGroupedPaper : count <= 0)
  const searchSourceLabel = providerLabel || 'papers'
  const noResultMessage = isSearching
    ? providerLabel
      ? `Searching ${searchSourceLabel} papers...`
      : 'Searching papers...'
    : shouldShowNoResults
      ? 'Search completed, but no papers were returned. Try a narrower question.'
      : 'No papers found.'

  const renderPaperCard = (paper: NormalizedPaper, index: number, keyPrefix = 'global') => {
    const primaryUrl = paper.absUrl || paper.url || paper.pdfUrl
    const faviconUrl = buildFaviconUrl(primaryUrl)
    return (
      <div
        key={`${keyPrefix}-${paper.arxivId || index}`}
        className="rounded-lg border border-[var(--border-light)] bg-[var(--background-main)] p-4 transition-colors hover:border-[var(--border-main)]"
      >
        <div className="flex items-start gap-2">
          <div className="mt-[2px] flex h-4 w-4 items-center justify-center rounded-[4px] bg-[var(--background-gray-subtle)]">
            {faviconUrl ? (
              <img
                src={faviconUrl}
                alt=""
                className="h-4 w-4 rounded-[4px]"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            {primaryUrl ? (
              <a
                href={primaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-2 text-xs font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
              >
                <span className="flex-1">{paper.title || 'Untitled'}</span>
                <ExternalLink className="h-4 w-4 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
              </a>
            ) : (
              <div className="text-xs font-medium text-[var(--text-primary)]">
                {paper.title || 'Untitled'}
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--text-tertiary)]">
              {paper.arxivId && (
                <span className="rounded bg-[var(--background-gray-subtle)] px-1.5 py-0.5 font-mono">
                  arXiv:{paper.arxivId}
                </span>
              )}
              {paper.source && (
                <span className="rounded bg-[var(--background-gray-subtle)] px-1.5 py-0.5 uppercase">
                  {paper.source}
                </span>
              )}
              {paper.absUrl && (
                <a
                  href={paper.absUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[var(--accent-primary)] hover:underline"
                >
                  <BookOpen className="h-3 w-3" />
                  arXiv
                </a>
              )}
              {paper.pdfUrl && (
                <a
                  href={paper.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[var(--accent-primary)] hover:underline"
                >
                  <FileText className="h-3 w-3" />
                  PDF
                </a>
              )}
            </div>

            {paper.abstract && (
              <p className="mt-2 line-clamp-3 text-xs text-[var(--text-secondary)]">
                {paper.abstract}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showHeader ? (
        <div className="flex h-[36px] items-center border-b border-[var(--border-main)] bg-[var(--background-gray-main)] px-3 shadow-[inset_0px_1px_0px_0px_#FFFFFF]">
          <BookOpen className="mr-2 h-4 w-4 text-[var(--text-tertiary)]" />
          <div className="flex-1 text-center text-xs font-medium text-[var(--text-tertiary)]">
            {providerLabel ? `${providerLabel} Paper Search` : 'Paper Search'}
          </div>
        </div>
      ) : null}

      <div className="relative flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[720px] flex-col gap-4 px-4 py-3">
          {/* Query and count summary */}
          {!hasGroupedResults && query && (
            <div className="text-xs text-[var(--text-tertiary)]">
              Question: &quot;{query}&quot;{' '}
              {count !== undefined && `• ${count} papers found`}
              {providerLabel ? ` • ${providerLabel}` : ''}
            </div>
          )}
          {hasGroupedResults && (
            <div className="text-xs text-[var(--text-tertiary)]">
              Parallel questions: {questionResults.length}
              {count !== undefined && ` • ${count} merged papers found`}
              {providerLabel ? ` • ${providerLabel}` : ''}
            </div>
          )}
          {totalSearchCalls !== undefined || annotationGateHint ? (
            <div className="rounded-lg border border-[var(--border-light)] bg-[var(--background-gray-main)]/40 px-3 py-2 text-xs text-[var(--text-secondary)]">
              {totalSearchCalls !== undefined ? (
                <div>
                  paper_search calls: {totalSearchCalls}
                  {requiredCallsForAnnotate !== undefined
                    ? ` (>=${requiredCallsForAnnotate} to start PDF annotations)`
                    : null}
                </div>
              ) : null}
              {annotationGateHint ? (
                <div className={totalSearchCalls !== undefined ? 'mt-1' : ''}>{annotationGateHint}</div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="ds-tool-error-banner" role="status">
              <AlertTriangle className="ds-tool-error-icon" />
              <span>{error}</span>
            </div>
          ) : (!hasGroupedResults && papers.length === 0) || (hasGroupedResults && !hasAnyGroupedPaper) ? (
            <div className="text-xs text-[var(--text-tertiary)]">
              {noResultMessage}
            </div>
          ) : hasGroupedResults ? (
            <div className="space-y-4">
              {questionResults.map((group, groupIndex) => (
                <section
                  key={`question-group-${groupIndex}`}
                  className="rounded-lg border border-[var(--border-light)] bg-[var(--background-gray-main)]/50 p-3"
                >
                  <div className="mb-3 text-xs font-medium text-[var(--text-secondary)]">
                    Q{groupIndex + 1}: &quot;{group.question}&quot; • {group.papers.length} papers found
                  </div>
                  {group.error ? (
                    <div className="mb-3 text-xs text-[var(--status-error)]">{group.error}</div>
                  ) : null}
                  {group.papers.length === 0 ? (
                    <div className="text-xs text-[var(--text-tertiary)]">
                      No papers returned for this question.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {group.papers.map((paper, index) =>
                        renderPaperCard(paper, index, `q${groupIndex}`)
                      )}
                    </div>
                  )}
                </section>
              ))}
            </div>
          ) : (
            papers.map((paper, index) => renderPaperCard(paper, index))
          )}
        </div>
      </div>
    </div>
  )
}

export default PaperSearchToolView
