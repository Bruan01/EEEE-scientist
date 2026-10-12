import { marked, type Tokens } from 'marked'
import DOMPurify from 'dompurify'
import type { CitationPayload, NormalizedCitation } from '@/lib/types/citations'

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'code',
  'pre',
  'ul',
  'ol',
  'li',
  'a',
  'h1',
  'h2',
  'h3',
  'span',
  'div',
  'button',
]

const ALLOWED_ATTR = [
  'href',
  'class',
  'target',
  'rel',
  'title',
  'data-cite-key',
  'data-cite-index',
  'data-cite-resolved',
  'data-code-lines',
  'type',
  'aria-label',
  'data-file-href',
]

const NAMED_ENTITY_MAP: Record<string, string> = {
  '&quot;': '"',
  '&apos;': "'",
  '&amp;': '&',
  '&nbsp;': ' ',
}

const NUMERIC_ENTITY_RE = /&#(x?[0-9a-fA-F]+);/g
const INLINE_CITATION_RE = /\((cite:\s*[^)]+)\)/gi
const NUMERIC_CITATION_RE = /\[(\d+)\]/g
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type CitationLookup = Record<string, NormalizedCitation>

type CitationRenderState = {
  lookup: CitationLookup
  byIndex: Map<number, NormalizedCitation>
  inlineCounter: number
}

type MarkdownRenderOptions = {
  resolveWorkspaceFileLink?: (href: string) => boolean
  isWorkspaceFileLink?: (href: string) => boolean
}

export function decodeHtmlEntities(text: string | null | undefined): string {
  if (typeof text !== 'string') {
    if (text == null) return ''
    return String(text)
  }
  if (!text || !text.includes('&')) return text

  const decodeNumeric = (value: string) =>
    value.replace(NUMERIC_ENTITY_RE, (match, raw) => {
      const normalized = String(raw).toLowerCase()
      const isHex = normalized.startsWith('x')
      const numeric = Number.parseInt(isHex ? normalized.slice(1) : normalized, isHex ? 16 : 10)
      if (!Number.isFinite(numeric)) return match
      if (numeric === 10 || numeric === 13) return '\n'
      if (numeric === 9) return '\t'
      if (numeric === 34) return '"'
      if (numeric === 39) return "'"
      if (numeric === 38) return '&'
      if (numeric === 160) return ' '
      return match
    })

  const decodeNamed = (value: string) =>
    value.replace(/&(quot|apos|amp|nbsp);/g, (match) => NAMED_ENTITY_MAP[match] ?? match)

  let output = decodeNumeric(decodeNamed(text))
  output = decodeNumeric(decodeNamed(output))
  return output
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;')

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

const isUuid = (value?: string | null) => Boolean(value && UUID_RE.test(value))

function parseRange(value: string): { start?: number; end?: number } {
  const match = value.match(/(\d+)(?:\s*(?:-|–|~|:|\.\.)\s*(\d+))?/)
  if (!match) return {}
  const start = toNumber(match[1])
  const end = toNumber(match[2])
  if (!start) return {}
  return { start, end: end ?? start }
}

const normalizeCitationEntry = (
  entry: CitationPayload,
  fallbackIndex: number
): NormalizedCitation | null => {
  if (!entry || typeof entry !== 'object') return null
  const indexCandidate =
    toNumber(entry.index) ??
    (typeof entry.id === 'string' ? toNumber(entry.id) : undefined) ??
    fallbackIndex
  const index = typeof indexCandidate === 'number' ? indexCandidate : fallbackIndex
  const rawLineStart = toNumber(entry.line_start ?? entry.line)
  const rawLineEnd = toNumber(entry.line_end ?? entry.line)
  const rangeValue = typeof entry.range === 'string' ? entry.range : undefined
  const parsedRange = rangeValue ? parseRange(rangeValue) : {}
  const lineStart = rawLineStart ?? parsedRange.start
  const lineEnd = rawLineEnd ?? parsedRange.end ?? (lineStart ? lineStart : undefined)
  const filePath = entry.file_path
  let fileName = entry.file_name
  if (!fileName && typeof filePath === 'string') {
    const parts = filePath.split('/')
    fileName = parts[parts.length - 1] || undefined
  }
  const normalized: NormalizedCitation = {
    key: `c${index}`,
    index,
    source: entry.source,
    fileId: entry.file_id,
    filePath,
    fileName,
    page: toNumber(entry.page),
    lineStart,
    lineEnd,
    range: rangeValue ?? entry.range,
    quote: entry.quote,
    bbox: entry.bbox,
  }
  normalized.label = formatCitationLabel(normalized)
  return normalized
}

const formatCitationLabel = (citation: NormalizedCitation): string => {
  const parts: string[] = []
  const fileLabel = citation.fileName || citation.filePath || citation.fileId
  if (fileLabel) parts.push(fileLabel)
  if (citation.page) parts.push(`p.${citation.page}`)
  if (citation.lineStart) {
    const end = citation.lineEnd && citation.lineEnd !== citation.lineStart ? `-${citation.lineEnd}` : ''
    parts.push(`L${citation.lineStart}${end}`)
  } else if (citation.range) {
    parts.push(String(citation.range))
  }
  return parts.join(' · ')
}

const parseInlineCitation = (raw: string): Omit<NormalizedCitation, 'key'> | null => {
  if (!raw) return null
  const text = decodeHtmlEntities(raw)
  const cleaned = text.replace(/^cite:\s*/i, '').trim()
  if (!cleaned) return null

  let fileRef: string | undefined
  let page: number | undefined
  let lineStart: number | undefined
  let lineEnd: number | undefined
  let range: string | undefined

  const parts = cleaned.split(',').map((part) => part.trim()).filter(Boolean)
  for (const part of parts) {
    const kvMatch = part.match(/^([a-zA-Z_]+)\s*[:=]\s*(.+)$/)
    if (kvMatch) {
      const key = kvMatch[1].toLowerCase()
      const value = kvMatch[2].trim()
      if (key === 'file' || key === 'file_id' || key === 'fileid' || key === 'id') {
        fileRef = value
      } else if (key === 'path' || key === 'file_path' || key === 'filepath') {
        fileRef = value
      } else if (key === 'page' || key === 'p') {
        page = toNumber(value)
      } else if (key === 'line' || key === 'lines' || key === 'range') {
        const parsed = parseRange(value)
        lineStart = parsed.start
        lineEnd = parsed.end
        range = value
      } else if (key === 'line_start' || key === 'start_line') {
        lineStart = toNumber(value)
      } else if (key === 'line_end' || key === 'end_line') {
        lineEnd = toNumber(value)
      }
      continue
    }
    if (!fileRef) {
      fileRef = part
      continue
    }
    const pageCandidate = toNumber(part.replace(/^p/i, ''))
    if (pageCandidate && page === undefined) {
      page = pageCandidate
      continue
    }
    if (!lineStart) {
      const parsed = parseRange(part)
      if (parsed.start) {
        lineStart = parsed.start
        lineEnd = parsed.end
        range = part
      }
    }
  }

  if (!fileRef) return null
  const normalized: Omit<NormalizedCitation, 'key'> = {
    source: 'inline',
    fileId: isUuid(fileRef) ? fileRef : undefined,
    filePath: isUuid(fileRef) ? undefined : fileRef,
    fileName: undefined,
    page,
    lineStart,
    lineEnd,
    range,
    quote: undefined,
    bbox: undefined,
    label: undefined,
    index: undefined,
  }
  if (normalized.filePath && normalized.filePath.includes('/')) {
    const parts = normalized.filePath.split('/')
    normalized.fileName = parts[parts.length - 1] || undefined
  }
  normalized.label = formatCitationLabel({ ...normalized, key: 'inline' })
  return normalized
}

const buildCitationSpan = (
  displayText: string,
  key: string,
  title?: string,
  index?: number,
  resolved: boolean = true
) => {
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
  const indexAttr = index ? ` data-cite-index="${index}"` : ''
  const resolvedAttr = ` data-cite-resolved="${resolved ? 'true' : 'false'}"`
  return `<span class="ds-citation" data-cite-key="${key}"${indexAttr}${resolvedAttr}${titleAttr}>${displayText}</span>`
}

const replaceCitations = (escaped: string, state: CitationRenderState): string => {
  let output = escaped.replace(NUMERIC_CITATION_RE, (match, rawIndex) => {
    const index = toNumber(rawIndex)
    if (!index) return match
    const citation = state.byIndex.get(index)
    if (!citation) {
      return buildCitationSpan(match, `c${index}`, undefined, index, false)
    }
    return buildCitationSpan(match, citation.key, citation.label, citation.index ?? index, true)
  })

  output = output.replace(INLINE_CITATION_RE, (match, raw) => {
    const parsed = parseInlineCitation(raw)
    if (!parsed) return match
    state.inlineCounter += 1
    const key = `i${state.inlineCounter}`
    const normalized: NormalizedCitation = {
      key,
      index: parsed.index,
      source: parsed.source,
      fileId: parsed.fileId,
      filePath: parsed.filePath,
      fileName: parsed.fileName,
      page: parsed.page,
      lineStart: parsed.lineStart,
      lineEnd: parsed.lineEnd,
      range: parsed.range,
      quote: parsed.quote,
      bbox: parsed.bbox,
      label: parsed.label ?? formatCitationLabel({ ...parsed, key }),
    }
    state.lookup[key] = normalized
    return buildCitationSpan(match, key, normalized.label, normalized.index, true)
  })

  return output
}

const wrapMentions = (value: string) =>
  value.replace(/(^|[\s({])(@[A-Za-z0-9_-]+)/g, '$1<span class="ai-manus-mention">$2</span>')

const createRenderer = (state: CitationRenderState | null, options?: MarkdownRenderOptions) => {
  const renderer = new marked.Renderer()
  renderer.code = ({ text, lang }: Tokens.Code) => {
    const raw = typeof text === 'string' ? text : ''
    const language =
      typeof lang === 'string' && lang.trim().length > 0 ? lang.trim().split(/\s+/)[0] : ''
    const safeLanguage = language ? escapeHtml(language) : ''
    const escaped = escapeHtml(raw)
    const lines = raw ? raw.split(/\r?\n/).length : 0
    const langLabel = safeLanguage || 'Code'
    const langClass = safeLanguage ? ` class="language-${safeLanguage}"` : ''
    return `
      <div class="ai-manus-codeblock" data-code-lines="${lines}">
        <div class="ai-manus-codeblock-bar">
          <span class="ai-manus-code-lang">${langLabel}</span>
          <div class="ai-manus-code-actions">
            <button type="button" class="ai-manus-code-copy" aria-label="Copy code block">Copy</button>
          </div>
        </div>
        <pre><code${langClass}>${escaped}</code></pre>
      </div>
    `
  }
  renderer.link = ({ href, title, text }: Tokens.Link) => {
    const safeHref = href ?? ''
    const titleAttr = title ? ` title="${title}"` : ''
    if (options?.resolveWorkspaceFileLink?.(safeHref) || options?.isWorkspaceFileLink?.(safeHref)) {
      return `<button type="button" class="ai-manus-inline-link" data-file-href="${escapeHtml(safeHref)}"${titleAttr}>${text}</button>`
    }
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`
  }
  renderer.text = (token: any) => {
    const raw =
      typeof token === 'string'
        ? token
        : typeof token.text === 'string'
          ? token.text
          : typeof token.raw === 'string'
            ? token.raw
            : ''
    if (!raw) return ''
    const tokenEscaped =
      typeof token !== 'string' ? (token as Tokens.Text & { escaped?: boolean }).escaped : false
    const escaped = typeof token === 'string' ? escapeHtml(raw) : tokenEscaped ? raw : escapeHtml(raw)
    const withCitations = state ? replaceCitations(escaped, state) : escaped
    return wrapMentions(withCitations)
  }
  return renderer
}

const renderMarkdownInternal = (
  text: string,
  citations?: CitationPayload[],
  enableCitations: boolean = false,
  inline: boolean = false,
  options?: MarkdownRenderOptions
): { html: string; citationLookup: CitationLookup } => {
  if (!text) return { html: '', citationLookup: {} }
  const normalized = decodeHtmlEntities(text)

  let lookup: CitationLookup = {}
  let citationState: CitationRenderState | null = null

  if (enableCitations) {
    lookup = {}
    const byIndex = new Map<number, NormalizedCitation>()
    citationState = { lookup, byIndex, inlineCounter: 0 }
    if (Array.isArray(citations)) {
      citations.forEach((entry, idx) => {
        const normalizedEntry = normalizeCitationEntry(entry, idx + 1)
        if (!normalizedEntry) return
        lookup[normalizedEntry.key] = normalizedEntry
        if (normalizedEntry.index) {
          byIndex.set(normalizedEntry.index, normalizedEntry)
        }
      })
    }
  }

  const html = inline
    ? (marked.parseInline(normalized, { renderer: createRenderer(citationState, options) }) as string)
    : (marked.parse(normalized, { renderer: createRenderer(citationState, options) }) as string)
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,
  })
  return { html: sanitized, citationLookup: lookup }
}

export function renderMarkdown(text: string, options?: MarkdownRenderOptions): string {
  return renderMarkdownInternal(text, undefined, false, false, options).html
}

export function renderMarkdownInline(text: string, options?: MarkdownRenderOptions): string {
  return renderMarkdownInternal(text, undefined, false, true, options).html
}

export function renderMarkdownWithCitations(
  text: string,
  citations?: CitationPayload[],
  options?: MarkdownRenderOptions
): { html: string; citationLookup: CitationLookup } {
  return renderMarkdownInternal(text, citations, true, false, options)
}
