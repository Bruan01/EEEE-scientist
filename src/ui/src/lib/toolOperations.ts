import {
  Database,
  Eye,
  FileCode2,
  FilePenLine,
  GitBranch,
  Globe2,
  Search,
  TerminalSquare,
  Wrench,
} from 'lucide-react'

import type { FeedItem, WorkflowEntry, WorkflowPayload } from '@/types'

type ToolIntent = 'search' | 'web_search' | 'read' | 'write' | 'artifact' | 'memory' | 'web' | 'shell' | 'file' | 'tool'

export type FileChangeEntry = {
  path: string
  kind?: string
}

export function compactToolSubject(value?: string | null) {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  if (trimmed.length <= 84) {
    return trimmed
  }
  return `${trimmed.slice(0, 52)}…${trimmed.slice(-24)}`
}

export function parseStructuredArgs(value?: string) {
  if (!value) {
    return null
  }
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function pushFileChangeEntries(target: FileChangeEntry[], value: unknown) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const record = asRecord(entry)
      if (!record || typeof record.path !== 'string' || !record.path.trim()) continue
      target.push({
        path: record.path.trim(),
        kind: typeof record.kind === 'string' ? record.kind.trim() : undefined,
      })
    }
    return
  }
  const record = asRecord(value)
  if (!record) return
  if (Array.isArray(record.changes)) {
    pushFileChangeEntries(target, record.changes)
  }
}

export function extractFileChangeEntries(...values: Array<unknown>) {
  const entries: FileChangeEntry[] = []
  for (const value of values) {
    pushFileChangeEntries(entries, value)
  }
  return entries
}

function unwrapShellCommand(value?: string) {
  const text = String(value || '').trim()
  if (!text) {
    return ''
  }
  const match = text.match(/(?:^|\s)-lc\s+(['"])([\s\S]*)\1$/)
  if (match?.[2]) {
    return match[2].replace(/\\"/g, '"').trim()
  }
  const quoted = text.match(/^(['"])([\s\S]*)\1$/)
  if (quoted?.[2]) {
    return quoted[2].trim()
  }
  return text
}

function captureShellSubject(command: string) {
  const patterns = [
    /\bsed -n\s+(?:"[^"]+"|'[^']+'|\S+)\s+([^\s|;&]+)/,
    /\b(?:cat|head|tail|ls)\s+([^\s|;&]+)/,
    /\brg --files\s+([^\s|;&]+)/,
    /\brg\s+(?:-[^\s]+\s+)*(?:"([^"]+)"|'([^']+)'|([^\s|;&]+))/,
    /\bgrep\s+(?:-[^\s]+\s+)*(?:"([^"]+)"|'([^']+)'|([^\s|;&]+))/,
    /\bfind\s+([^\s|;&]+)/,
    /\b(?:mkdir|touch|rm)\s+([^\s|;&]+)/,
    /\b(?:cp|mv)\s+([^\s|;&]+)\s+([^\s|;&]+)/,
  ]

  for (const pattern of patterns) {
    const match = command.match(pattern)
    if (match) {
      const subject = [...match].slice(1).find((value) => value && value.trim())
      if (subject) {
        return subject.trim()
      }
    }
  }
  return ''
}

export function extractToolSubject(toolName?: string, args?: string, output?: string) {
  const name = String(toolName || '').toLowerCase()
  const parsed = parseStructuredArgs(args)
  const parsedOutput = parseStructuredArgs(output)
  const candidates: string[] = []

  const parsedRecord = asRecord(parsed)
  const parsedOutputRecord = asRecord(parsedOutput)

  if (parsedRecord) {
    for (const key of ['path', 'file', 'filename', 'document_id', 'ref_id', 'q', 'query', 'url']) {
      const value = parsedRecord[key]
      if (typeof value === 'string' && value.trim()) {
        candidates.push(value.trim())
      }
    }
  }

  for (const change of extractFileChangeEntries(parsed, parsedOutputRecord?.result, parsedOutput)) {
    candidates.push(change.path)
  }

  if (name.includes('apply_patch') || name.includes('patch')) {
    const match = args?.match(/\*\*\* (?:Add|Update|Delete) File: ([^\n]+)/)
    if (match?.[1]) {
      candidates.push(match[1].trim())
    }
  }

  if (name.includes('shell') || name.includes('bash')) {
    const shellSubject = captureShellSubject(unwrapShellCommand(args))
    if (shellSubject) {
      candidates.push(shellSubject)
    }
  }

  const fallback = args || output || ''
  if (name.includes('search') || name.includes('query') || name.includes('find')) {
    const match = fallback.match(/"q"\s*:\s*"([^"]+)"/) || fallback.match(/q:\s*([^\n]+)/)
    if (match?.[1]) {
      candidates.push(match[1].trim())
    }
  }

  const resolved = candidates.find(Boolean)
  return compactToolSubject(resolved)
}

function classifyShellCommand(args?: string, output?: string): Extract<ToolIntent, 'search' | 'read' | 'write' | 'shell'> {
  const text = `${unwrapShellCommand(args)}\n${output || ''}`.toLowerCase()
  if (/(^|\s)(rg|grep|find)(\s|$)|search/.test(text)) {
    return 'search'
  }
  if (/(^|\s)(cat|sed -n|tail|head|ls)(\s|$)|read/.test(text)) {
    return 'read'
  }
  if (/(^|\s)(tee|mv|cp|mkdir|touch|rm)(\s|$)|>>|(^|\s)echo\s.+>|write|update|append/.test(text)) {
    return 'write'
  }
  return 'shell'
}

function resolveToolIntent(toolName?: string, args?: string, output?: string): ToolIntent {
  const name = String(toolName || '').toLowerCase()
  const shellKind = name.includes('shell') || name.includes('bash') || name.includes('command') ? classifyShellCommand(args, output) : null
  if (name === 'web_search') {
    return 'web_search'
  }
  if (['search', 'search_query', 'image_query', 'find'].includes(name) || name.includes('search_query') || name.includes('image_query')) {
    return 'search'
  }
  if (shellKind === 'search') {
    return 'search'
  }
  if (
    shellKind === 'read' ||
    ['open', 'read', 'view', 'cat', 'list_recent'].includes(name) ||
    name.includes('open') ||
    name.includes('read')
  ) {
    return 'read'
  }
  if (
    shellKind === 'write' ||
    ['write', 'create', 'save_document'].includes(name) ||
    name.includes('file_change') ||
    name.includes('patch') ||
    name.includes('edit') ||
    name.includes('write')
  ) {
    return 'write'
  }
  if (
    ['record', 'checkpoint', 'prepare_branch', 'publish_baseline', 'attach_baseline', 'refresh_summary', 'render_git_graph', 'interact'].includes(
      name
    )
  ) {
    return 'artifact'
  }
  if (['memory.write', 'memory.read', 'memory.search', 'memory.list_recent', 'memory.promote_to_global'].includes(name)) {
    return 'memory'
  }
  if (name.includes('web') || name.includes('browser') || name.includes('click')) {
    return 'web'
  }
  if (shellKind === 'shell' || name.includes('bash') || name.includes('shell') || name.includes('command')) {
    return 'shell'
  }
  if (name.includes('file')) {
    return 'file'
  }
  return 'tool'
}

function toolMeta(intent: ToolIntent) {
  switch (intent) {
    case 'web_search':
      return {
        icon: Globe2,
        label: 'web search',
        tone: 'bg-[rgba(140,156,196,0.16)]',
        verb: 'Searching',
      }
    case 'search':
      return {
        icon: Search,
        label: 'search',
        tone: 'bg-[rgba(123,159,182,0.16)]',
        verb: 'Searching',
      }
    case 'read':
      return {
        icon: Eye,
        label: 'read',
        tone: 'bg-[rgba(142,167,168,0.14)]',
        verb: 'Reading',
      }
    case 'write':
      return {
        icon: FilePenLine,
        label: 'write',
        tone: 'bg-[rgba(151,164,179,0.18)]',
        verb: 'Writing',
      }
    case 'artifact':
      return {
        icon: GitBranch,
        label: 'artifact',
        tone: 'bg-[rgba(186,160,140,0.16)]',
        verb: 'Recording',
      }
    case 'memory':
      return {
        icon: Database,
        label: 'memory',
        tone: 'bg-[rgba(142,167,168,0.14)]',
        verb: 'Updating',
      }
    case 'web':
      return {
        icon: Globe2,
        label: 'web',
        tone: 'bg-[rgba(140,156,196,0.16)]',
        verb: 'Browsing',
      }
    case 'shell':
      return {
        icon: TerminalSquare,
        label: 'shell',
        tone: 'bg-[rgba(151,164,179,0.18)]',
        verb: 'Running',
      }
    case 'file':
      return {
        icon: FileCode2,
        label: 'file',
        tone: 'bg-[rgba(151,164,179,0.18)]',
        verb: 'Inspecting',
      }
    default:
      return {
        icon: Wrench,
        label: 'tool',
        tone: 'bg-[rgba(143,163,184,0.16)]',
        verb: 'Using',
      }
  }
}

export function buildToolOperationContent(
  label: 'tool_call' | 'tool_result',
  toolName?: string,
  args?: string,
  output?: string
) {
  const intent = resolveToolIntent(toolName, args, output)
  const subject = extractToolSubject(toolName, args, output)

  if (label === 'tool_call') {
    switch (intent) {
      case 'web_search':
        return subject ? `DeepScientist is searching the web for ${subject}...` : 'DeepScientist is searching the web...'
      case 'search':
        return subject ? `DeepScientist is searching ${subject}...` : 'DeepScientist is searching...'
      case 'read':
        return subject ? `DeepScientist is reading ${subject}...` : 'DeepScientist is reading...'
      case 'write':
        return subject ? `DeepScientist is writing ${subject}...` : 'DeepScientist is writing...'
      case 'artifact':
        return subject ? `DeepScientist is recording ${subject}...` : 'DeepScientist is recording progress...'
      case 'memory':
        return subject ? `DeepScientist is updating memory ${subject}...` : 'DeepScientist is updating memory...'
      case 'web':
        return subject ? `DeepScientist is browsing ${subject}...` : 'DeepScientist is browsing...'
      case 'shell':
        return 'DeepScientist is running a shell command...'
      case 'file':
        return subject ? `DeepScientist is inspecting ${subject}...` : 'DeepScientist is inspecting files...'
      default:
        return `DeepScientist is using ${toolName || 'a tool'}...`
    }
  }

  switch (intent) {
    case 'web_search':
      return subject ? `DeepScientist finished searching the web for ${subject}.` : 'DeepScientist finished searching the web.'
    case 'search':
      return subject ? `DeepScientist finished searching ${subject}.` : 'DeepScientist finished searching.'
    case 'read':
      return subject ? `DeepScientist finished reading ${subject}.` : 'DeepScientist finished reading.'
    case 'write':
      return subject ? `DeepScientist updated ${subject}.` : 'DeepScientist updated files.'
    case 'artifact':
      return subject ? `DeepScientist recorded progress for ${subject}.` : 'DeepScientist recorded progress.'
    case 'memory':
      return subject ? `DeepScientist updated memory ${subject}.` : 'DeepScientist updated memory.'
    case 'web':
      return subject ? `DeepScientist finished browsing ${subject}.` : 'DeepScientist finished browsing.'
    case 'shell':
      return 'DeepScientist finished running a shell command.'
    case 'file':
      return subject ? `DeepScientist inspected ${subject}.` : 'DeepScientist inspected files.'
    default:
      return `DeepScientist finished using ${toolName || 'a tool'}.`
  }
}

export function toolTheme(toolName?: string, args?: string, output?: string) {
  return toolMeta(resolveToolIntent(toolName, args, output))
}

export type ToolEffectPreview = {
  id: string
  label: string
  verb: string
  subject: string | null
  isResult: boolean
  tone: string
  title: string
  createdAt?: string
  status?: string
  icon: ReturnType<typeof toolTheme>['icon']
  source: 'feed' | 'workflow'
}

export function compactToolPath(path?: string | null, questRoot?: string) {
  if (!path) {
    return null
  }
  const trimmed = path.trim()
  if (!trimmed) {
    return null
  }
  if (questRoot) {
    const normalizedRoot = questRoot.replace(/\\/g, '/').replace(/\/+$/, '')
    const normalizedPath = trimmed.replace(/\\/g, '/')
    if (normalizedPath === normalizedRoot) {
      return '.'
    }
    if (normalizedPath.startsWith(`${normalizedRoot}/`)) {
      return normalizedPath.slice(normalizedRoot.length + 1) || '.'
    }
  }
  if (trimmed.length <= 72) {
    return trimmed
  }
  return `${trimmed.slice(0, 40)}…${trimmed.slice(-22)}`
}

function normalizeToolPath(path?: string | null, questRoot?: string) {
  const compact = compactToolPath(path, questRoot)
  if (!compact) {
    return null
  }
  return compact
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .toLowerCase()
}

function isLikelyPath(subject?: string | null) {
  if (!subject) {
    return false
  }
  return /[\\/]/.test(subject) || /\.[a-z0-9]{1,8}$/i.test(subject) || subject.startsWith('.')
}

export function matchToolEffectPath(
  path: string | null | undefined,
  subject: string | null | undefined,
  questRoot?: string
): 'direct' | 'parent' | null {
  const normalizedPath = normalizeToolPath(path, questRoot)
  const normalizedSubject = normalizeToolPath(subject, questRoot)
  if (!normalizedPath || !normalizedSubject || !isLikelyPath(subject)) {
    return null
  }
  if (normalizedPath === normalizedSubject) {
    return 'direct'
  }
  if (normalizedPath.endsWith(`/${normalizedSubject}`)) {
    return 'direct'
  }
  const pathBase = normalizedPath.split('/').pop()
  const subjectBase = normalizedSubject.split('/').pop()
  if (pathBase && subjectBase && pathBase === subjectBase) {
    return 'direct'
  }
  if (normalizedSubject.startsWith(`${normalizedPath}/`)) {
    return 'parent'
  }
  return null
}

export function describeToolEffect(entry: WorkflowEntry) {
  if (entry.kind !== 'tool_call' && entry.kind !== 'tool_result') {
    return null
  }
  const theme = toolTheme(entry.tool_name || entry.title, entry.args, entry.output)
  return {
    id: entry.id,
    icon: theme.icon,
    label: theme.label,
    verb: theme.verb,
    subject: extractToolSubject(entry.tool_name || entry.title, entry.args, entry.output),
    isResult: entry.kind === 'tool_result',
    tone: theme.tone,
    title: entry.tool_name || entry.title,
    createdAt: entry.created_at,
    status: entry.status,
    source: 'workflow' as const,
  } satisfies ToolEffectPreview
}

export function describeOperationEffect(item: Extract<FeedItem, { type: 'operation' }>) {
  const theme = toolTheme(item.toolName, item.args, item.output)
  return {
    id: item.id,
    icon: theme.icon,
    label: theme.label,
    verb: theme.verb,
    subject: item.subject || extractToolSubject(item.toolName, item.args, item.output),
    isResult: item.label === 'tool_result',
    tone: theme.tone,
    title: item.toolName || 'tool',
    createdAt: item.createdAt,
    status: item.status,
    source: 'feed' as const,
  } satisfies ToolEffectPreview
}

export function buildToolEffectPreviews(feed: FeedItem[], workflow: WorkflowPayload | null) {
  const fromFeed = feed
    .filter((item) => item.type === 'operation')
    .map((item) => describeOperationEffect(item))

  if (fromFeed.length > 0) {
    return fromFeed.slice(-6)
  }

  return (workflow?.entries || [])
    .map((entry) => describeToolEffect(entry))
    .filter((item): item is ToolEffectPreview => Boolean(item))
    .slice(-6)
}
