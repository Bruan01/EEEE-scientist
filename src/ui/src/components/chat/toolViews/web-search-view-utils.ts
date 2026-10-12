'use client'

type UnknownRecord = Record<string, unknown>

export type NormalizedWebSearchResult = {
  title: string
  snippet: string
  url: string
  source: string
  kind: 'paper' | 'web'
  arxivId: string
  absUrl: string
  pdfUrl: string
}

export type NormalizedWebSearchPayload = {
  query: string
  queries: string[]
  results: NormalizedWebSearchResult[]
  count: number
  summary: string
  actionType?: string
  error?: string
}

function asRecord(value: unknown): UnknownRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as UnknownRecord
  }
  return {}
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed || !['{', '['].includes(trimmed[0] || '')) return null
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return null
  }
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return ''
}

function dedupeStrings(values: unknown[]): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    ordered.push(trimmed)
  }
  return ordered
}

function unwrapStructuredValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return value

  const parsed = parseJsonValue(value)
  if (Array.isArray(parsed)) {
    if (parsed.length === 1 && parsed[0] && typeof parsed[0] === 'object' && !Array.isArray(parsed[0])) {
      const block = parsed[0] as UnknownRecord
      for (const key of ['text', 'content', 'output']) {
        if (block[key] == null || block[key] === value) continue
        const nested = unwrapStructuredValue(block[key], depth + 1)
        if (nested != null) return nested
      }
    }
    return parsed
  }

  if (!parsed || typeof parsed !== 'object') {
    return parsed
  }

  const record = parsed as UnknownRecord
  for (const key of [
    'structured_content',
    'structuredContent',
    'structured_result',
    'structuredResult',
    'result',
    'data',
    'payload',
  ]) {
    if (record[key] == null || record[key] === parsed) continue
    const nested = unwrapStructuredValue(record[key], depth + 1)
    if (nested != null) return nested
  }

  const content = record.content
  if (Array.isArray(content)) {
    const textBlocks: string[] = []
    for (const block of content) {
      if (!block || typeof block !== 'object' || Array.isArray(block)) continue
      const blockRecord = block as UnknownRecord
      const nestedText = pickString(blockRecord.text, blockRecord.content)
      if (!nestedText) continue
      const nested = unwrapStructuredValue(nestedText, depth + 1)
      if (nested != null) return nested
      textBlocks.push(nestedText)
    }
    if (textBlocks.length > 0) {
      return { text: textBlocks.join('\n\n') }
    }
  }

  return record
}

function hostnameFromUrl(value?: string): string {
  if (!value) return ''
  try {
    const url =
      value.startsWith('http://') || value.startsWith('https://')
        ? new URL(value)
        : new URL(`https://${value}`)
    return url.hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function normalizeResult(value: unknown): NormalizedWebSearchResult | null {
  const parsed = unwrapStructuredValue(value)
  const record = asRecord(parsed)
  if (Object.keys(record).length === 0) {
    const text = pickString(parsed)
    if (!text) return null
    return {
      title: text,
      snippet: '',
      url: '',
      source: '',
      kind: 'web',
      arxivId: '',
      absUrl: '',
      pdfUrl: '',
    }
  }

  const arxivId = pickString(record.arxiv_id, record.paper_id, record.id)
  const absUrl = pickString(
    record.abs_url,
    arxivId ? `https://arxiv.org/abs/${arxivId}` : ''
  )
  const pdfUrl = pickString(
    record.pdf_url,
    arxivId ? `https://arxiv.org/pdf/${arxivId}.pdf` : ''
  )
  const url = pickString(record.link, record.url, record.href, absUrl, pdfUrl)
  const snippet = pickString(
    record.snippet,
    record.abstract,
    record.summary,
    record.description,
    record.text,
    record.content,
    record.message
  )
  const source = pickString(
    record.source,
    record.display_link,
    record.domain,
    record.host,
    record.provider,
    hostnameFromUrl(url)
  )
  const title = pickString(record.title, record.name, record.headline, record.label, url)
  if (!title && !snippet && !url) return null

  const isPaperLike =
    Boolean(arxivId || absUrl || pdfUrl) ||
    /(?:^|\/)(?:abs|pdf)\//.test(url) ||
    /(?:^|\.)(?:arxiv\.org|alphaxiv\.org)$/.test(hostnameFromUrl(url))

  return {
    title: title || 'Untitled result',
    snippet,
    url,
    source,
    kind: isPaperLike ? 'paper' : 'web',
    arxivId,
    absUrl,
    pdfUrl,
  }
}

function extractResults(value: unknown): NormalizedWebSearchResult[] {
  const parsed = unwrapStructuredValue(value)
  let rawItems: unknown[] = []

  if (Array.isArray(parsed)) {
    rawItems = parsed
  } else {
    const record = asRecord(parsed)
    for (const key of ['results', 'items', 'entries', 'documents', 'hits', 'sources']) {
      if (Array.isArray(record[key])) {
        rawItems = record[key] as unknown[]
        break
      }
    }
  }

  return rawItems
    .map((entry) => normalizeResult(entry))
    .filter((entry): entry is NormalizedWebSearchResult => entry != null)
}

function numericValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

export function buildFaviconUrl(value?: string) {
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

export function normalizeWebSearchPayload(input: {
  args?: unknown
  content?: unknown
  metadataSearch?: unknown
  output?: unknown
  fallbackQuery?: string
}): NormalizedWebSearchPayload {
  const args = asRecord(unwrapStructuredValue(input.args))
  const content = unwrapStructuredValue(input.content)
  const output = unwrapStructuredValue(input.output)
  const metadataSearch = unwrapStructuredValue(input.metadataSearch)

  const candidateValues = [
    metadataSearch,
    content,
    asRecord(content).result,
    output,
    asRecord(output).result,
  ].filter((value) => value != null)

  const candidateRecords = candidateValues
    .map((value) => asRecord(value))
    .filter((record) => Object.keys(record).length > 0)

  let results: NormalizedWebSearchResult[] = []
  for (const value of candidateValues) {
    const extracted = extractResults(value)
    if (extracted.length > 0) {
      results = extracted
      break
    }
  }

  const query = pickString(
    ...candidateRecords.map((record) => record.query),
    ...candidateRecords.map((record) => record.question),
    args.query,
    args.q,
    args.text,
    input.fallbackQuery
  )

  const queries = dedupeStrings([
    query,
    ...candidateRecords.flatMap((record) =>
      Array.isArray(record.queries) ? record.queries : []
    ),
    ...candidateRecords.map((record) => record.query),
    ...candidateRecords.map((record) => record.question),
    args.query,
    args.q,
    args.text,
    input.fallbackQuery,
  ])

  const count =
    candidateRecords.map((record) => numericValue(record.count)).find((value) => value != null) ??
    results.length

  const summary = pickString(
    ...candidateRecords.map((record) => record.summary),
    ...candidateRecords.map((record) => record.text),
    ...candidateRecords.map((record) => record.message),
    typeof input.output === 'string' ? input.output : ''
  )

  const actionType = pickString(...candidateRecords.map((record) => record.action_type))
  const error = pickString(...candidateRecords.map((record) => record.error))

  return {
    query,
    queries,
    results,
    count,
    summary,
    ...(actionType ? { actionType } : {}),
    ...(error ? { error } : {}),
  }
}

