import type { ToolEventData } from '@/lib/types/chat-events'

export type UnknownRecord = Record<string, unknown>

export function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as UnknownRecord
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

export function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return value
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return value
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return value
  }
}

function extractTextEntryJson(content: unknown): unknown {
  if (!Array.isArray(content)) return null
  for (const entry of content) {
    const record = asRecord(entry)
    if (!record || record.type !== 'text' || typeof record.text !== 'string') continue
    const parsed = parseMaybeJson(record.text)
    if (parsed !== record.text) {
      return parsed
    }
  }
  return null
}

function unwrapResultCandidate(value: unknown, depth = 0): unknown {
  if (depth > 4) return value
  const parsed = parseMaybeJson(value)
  const record = asRecord(parsed)
  if (!record) return parsed

  const nestedCandidates = [
    record.structured_result,
    record.structured_content,
    record.result,
    record.data,
    record.payload,
    extractTextEntryJson(record.content),
  ]
  for (const candidate of nestedCandidates) {
    if (candidate == null || candidate === value || candidate === parsed) continue
    const unwrapped = unwrapResultCandidate(candidate, depth + 1)
    if (unwrapped != null) {
      return unwrapped
    }
  }
  return parsed
}

export function getToolArgsRecord(toolContent: ToolEventData): UnknownRecord {
  return asRecord(toolContent.args) ?? {}
}

export function getToolContentRecord(toolContent: ToolEventData): UnknownRecord {
  return asRecord(toolContent.content) ?? {}
}

export function getToolResultValue(toolContent: ToolEventData): unknown {
  const content = getToolContentRecord(toolContent)
  const candidates: unknown[] = [
    content.structured_result,
    content.result,
    content.structured_content,
    content.data,
    content.payload,
  ]
  for (const candidate of candidates) {
    const parsed = unwrapResultCandidate(candidate)
    if (parsed != null) return parsed
  }
  return content
}

export function getToolResultRecord(toolContent: ToolEventData): UnknownRecord | null {
  const value = getToolResultValue(toolContent)
  const parsed = parseMaybeJson(value)
  return asRecord(parsed)
}

export function resolveMcpIdentity(toolContent: ToolEventData): {
  server?: string
  tool?: string
} {
  const metadata = asRecord(toolContent.metadata)
  const serverFromMetadata = asString(metadata?.mcp_server)
  const toolFromMetadata = asString(metadata?.mcp_tool)
  if (serverFromMetadata || toolFromMetadata) {
    return {
      ...(serverFromMetadata ? { server: serverFromMetadata } : {}),
      ...(toolFromMetadata ? { tool: toolFromMetadata } : {}),
    }
  }
  const raw = (toolContent.function || '').trim().toLowerCase()
  if (!raw.startsWith('mcp__')) return {}
  const parts = raw.split('__').filter(Boolean)
  if (parts.length < 3) return {}
  return {
    server: parts[1] || undefined,
    tool: parts[2] || undefined,
  }
}

export function extractPathEntries(value: unknown): Array<{ label: string; path: string }> {
  const record = asRecord(parseMaybeJson(value))
  if (!record) return []
  const entries: Array<{ label: string; path: string }> = []
  const paths = asRecord(record.paths)
  if (paths) {
    Object.entries(paths).forEach(([label, path]) => {
      if (typeof path === 'string' && path.trim()) {
        entries.push({ label, path })
      }
    })
  }
  const directPath = asString(record.path)
  if (directPath && !entries.some((entry) => entry.path === directPath)) {
    entries.unshift({ label: 'path', path: directPath })
  }
  return entries
}

export function truncateText(value: string, limit = 360): string {
  const normalized = value.trim()
  if (!normalized) return ''
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
}
