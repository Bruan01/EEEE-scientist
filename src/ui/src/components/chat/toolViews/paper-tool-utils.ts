'use client'

export type UnknownRecord = Record<string, unknown>

export function asRecord(value: unknown): UnknownRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as UnknownRecord
  }
  return {}
}

export function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return ''
}

export function toInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value))
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed))
  }
  return 0
}

export function normalizeArxivId(value: string): string {
  const raw = value.trim().replace(/^arxiv:/i, '')
  if (!raw) return ''
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) return raw

  try {
    const url = new URL(raw)
    if (!url.hostname.includes('arxiv.org')) return ''
    const parts = url.pathname.split('/').filter(Boolean)
    const markerIndex = parts.findIndex((part) => part === 'abs' || part === 'pdf')
    const id = markerIndex >= 0 ? parts[markerIndex + 1] : ''
    return id ? id.replace(/\.pdf$/i, '') : ''
  } catch {
    return ''
  }
}

function parseJsonish(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!text || (text[0] !== '{' && text[0] !== '[')) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function hasPaperPayloadShape(record: UnknownRecord): boolean {
  return (
    Array.isArray(record.papers) ||
    Array.isArray(record.question_results) ||
    Array.isArray(record.questionResults) ||
    Array.isArray(record.results) ||
    (Array.isArray(record.result) && (record.query != null || record.question != null)) ||
    record.answer != null ||
    record.success_count != null ||
    record.failed_count != null
  )
}

function unwrapContentBlocks(value: unknown, depth: number): unknown {
  if (!Array.isArray(value)) return null

  const texts: string[] = []
  for (const block of value) {
    if (typeof block === 'string') {
      texts.push(block.trim())
      continue
    }
    const blockRecord = asRecord(block)
    const nestedText = pickString(blockRecord.text, blockRecord.content, blockRecord.output)
    if (!nestedText) continue
    const candidate = unwrapToolPayload(nestedText, depth + 1)
    if (candidate != null) return candidate
    texts.push(nestedText)
  }

  const joined = texts.filter(Boolean).join('\n\n')
  return joined ? { text: joined } : null
}

export function unwrapToolPayload(value: unknown, depth = 0): unknown {
  if (depth > 8) return value

  const parsed = parseJsonish(value)
  if (parsed == null) return null

  if (Array.isArray(parsed)) {
    const contentCandidate = unwrapContentBlocks(parsed, depth)
    return contentCandidate ?? parsed
  }

  const record = asRecord(parsed)
  if (Object.keys(record).length === 0) return parsed
  if (hasPaperPayloadShape(record)) return record

  const structuredKeys = [
    'structuredContent',
    'structured_content',
    'structuredResult',
    'structured_result',
    'payload',
    'data',
    'result',
    'output',
  ]
  for (const key of structuredKeys) {
    const nested = record[key]
    if (nested == null || nested === parsed) continue
    const candidate = unwrapToolPayload(nested, depth + 1)
    if (candidate != null) return candidate
  }

  const contentCandidate = unwrapContentBlocks(record.content, depth)
  if (contentCandidate != null) return contentCandidate

  return record
}

export function unwrapToolContent(toolContent: { content?: unknown }): unknown {
  const unwrapped = unwrapToolPayload(toolContent.content)
  return unwrapped ?? toolContent.content
}

export function resolvePaperProviderServer(toolContent: UnknownRecord): string {
  const metadata = asRecord(toolContent.metadata)
  const fromMetadata = pickString(
    metadata.mcp_server,
    metadata.server,
    metadata.provider,
    metadata.source
  )
  if (fromMetadata) return fromMetadata.toLowerCase()

  const functionName = pickString(toolContent.function, toolContent.name).toLowerCase()
  const parts = functionName.split('__').filter(Boolean)
  if (parts[0] === 'mcp' && parts[1]) return parts[1]
  return ''
}

export function formatPaperProviderLabel(server: string): string {
  const normalized = server.trim().toLowerCase()
  if (!normalized) return ''
  if (normalized.includes('deepxiv')) return 'DeepXiv'
  if (normalized === 'pasa' || normalized.includes('pasa')) return 'PASA'
  return normalized
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

export function resolvePaperProviderSource(server: string): string {
  const normalized = server.trim().toLowerCase()
  if (!normalized) return 'arxiv'
  if (normalized.includes('deepxiv')) return 'deepxiv'
  if (normalized.includes('pasa')) return 'pasa'
  return normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'arxiv'
}
