export type McpToolKind =
  | 'read_file'
  | 'append_file'
  | 'write_task_plan'
  | 'pull_file'
  | 'list_file'
  | 'list_dir'
  | 'grep_text'
  | 'grep_files'
  | 'glob_files'
  | 'write_memory'
  | 'request_patch'
  | 'bash_exec'
  | 'status_update'
  | 'write_question'
  | 'lab_quests'
  | 'lab_pi_sleep'
  | 'lab_baseline'

const MCP_TOOL_NAMES: Record<McpToolKind, string> = {
  read_file: 'ds_system_read_file',
  append_file: 'ds_system_append_file',
  write_task_plan: 'mcp_write_task_plan',
  pull_file: 'ds_system_pull_file',
  list_file: 'ds_system_list_file',
  list_dir: 'ds_system_list_dir',
  grep_text: 'ds_system_grep_text',
  grep_files: 'ds_system_grep_files',
  glob_files: 'ds_system_glob_files',
  write_memory: 'mcp_write_memory',
  request_patch: 'ds_system_request_patch',
  bash_exec: 'bash_exec',
  status_update: 'mcp_status_update',
  write_question: 'mcp_write_question',
  lab_quests: 'lab_quests',
  lab_pi_sleep: 'lab_pi_sleep',
  lab_baseline: 'lab_baseline',
}

function normalizeMcpFunctionName(value: string): string {
  const raw = value.trim()
  if (!raw) return ''
  const lower = raw.toLowerCase()
  if (!lower.startsWith('mcp__')) return lower
  const parts = lower.split('__')
  return parts[parts.length - 1] || lower
}

export function getMcpToolKind(functionName: string): McpToolKind | null {
  const raw = functionName.trim().toLowerCase()
  const normalized = normalizeMcpFunctionName(functionName)
  const isMcpInvocation = raw.startsWith('mcp__')
  if (!normalized) return null
  if (normalized === MCP_TOOL_NAMES.read_file) return 'read_file'
  if (normalized === MCP_TOOL_NAMES.append_file) return 'append_file'
  if (normalized === MCP_TOOL_NAMES.write_task_plan) return 'write_task_plan'
  if (normalized === MCP_TOOL_NAMES.pull_file) return 'pull_file'
  if (normalized === MCP_TOOL_NAMES.list_file) return 'list_file'
  if (normalized === MCP_TOOL_NAMES.list_dir) return 'list_dir'
  if (normalized === MCP_TOOL_NAMES.grep_text) return 'grep_text'
  if (normalized === MCP_TOOL_NAMES.grep_files) return 'grep_files'
  if (normalized === MCP_TOOL_NAMES.glob_files) return 'glob_files'
  if (normalized === MCP_TOOL_NAMES.write_memory) return 'write_memory'
  if (normalized === MCP_TOOL_NAMES.request_patch) return 'request_patch'
  if (normalized === MCP_TOOL_NAMES.status_update) return 'status_update'
  if (normalized === MCP_TOOL_NAMES.write_question) return 'write_question'
  if (normalized === MCP_TOOL_NAMES.lab_quests) return 'lab_quests'
  if (normalized === MCP_TOOL_NAMES.lab_pi_sleep) return 'lab_pi_sleep'
  if (normalized === MCP_TOOL_NAMES.lab_baseline) return 'lab_baseline'
  if (normalized === MCP_TOOL_NAMES.bash_exec) {
    return isMcpInvocation ? 'bash_exec' : null
  }
  return null
}

export function getMcpToolPath(args?: Record<string, unknown> | null): string {
  if (!args) return ''
  const raw =
    args.path ??
    args.file_path ??
    args.filePath ??
    args.file ??
    args.dir_path ??
    args.target_path ??
    args.targetPath
  return typeof raw === 'string' ? raw : ''
}

export function extractMcpReadFileResult(result: unknown): { text: string; message: string } {
  if (result == null) return { text: '', message: '' }
  if (typeof result === 'string') return { text: result, message: '' }
  if (typeof result !== 'object') return { text: String(result), message: '' }

  const record = result as Record<string, unknown>
  const message = typeof record.message === 'string' ? record.message : ''
  let text = ''
  const lineNumbered = record.content_line_numbered

  if (typeof lineNumbered === 'string' && lineNumbered.trim()) {
    return { text: lineNumbered, message }
  }
  const content = record.content

  if (Array.isArray(content)) {
    for (let i = content.length - 1; i >= 0; i -= 1) {
      const entry = content[i]
      if (typeof entry === 'string' && entry.trim()) {
        text = entry
        break
      }
      if (entry && typeof entry === 'object') {
        const candidate = (entry as Record<string, unknown>).text
        if (typeof candidate === 'string' && candidate.trim()) {
          text = candidate
          break
        }
      }
    }
  } else if (typeof content === 'string') {
    text = content
  } else if (content && typeof content === 'object') {
    const contentRecord = content as Record<string, unknown>
    const numbered = contentRecord.content_line_numbered
    if (typeof numbered === 'string' && numbered.trim()) {
      text = numbered
    } else {
      const candidate = contentRecord.text
      if (typeof candidate === 'string') text = candidate
    }
  }

  if (!text && typeof record.text === 'string') {
    text = record.text
  }

  return { text, message }
}

type ParsedJsonRecord = Record<string, unknown>

const parseJsonRecord = (text: string): ParsedJsonRecord | null => {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as ParsedJsonRecord
    }
  } catch {
    return null
  }
  return null
}

const extractTextEntries = (value: unknown): string[] => {
  if (value == null) return []
  if (typeof value === 'string') {
    return value.trim() ? [value] : []
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractTextEntries(entry))
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const text = record.text
    if (typeof text === 'string' && text.trim()) return [text]
    const content = record.content
    if (content != null) return extractTextEntries(content)
  }
  return []
}

const extractListFromTextEntries = (entries: string[]) => {
  let items: unknown[] = []
  let content = ''
  let truncated: boolean | undefined
  let nonJsonText = ''

  for (const entry of entries) {
    const parsed = parseJsonRecord(entry)
    if (parsed) {
      if (!items.length && Array.isArray(parsed.items)) {
        items = parsed.items as unknown[]
      }
      if (!content && typeof parsed.content === 'string') {
        content = parsed.content
      }
      if (truncated == null && typeof parsed.truncated === 'boolean') {
        truncated = parsed.truncated
      }
      continue
    }
    if (!nonJsonText && entry.trim()) {
      nonJsonText = entry
    }
  }

  if (!content && nonJsonText) {
    content = nonJsonText
  }

  return { items, content, truncated }
}

export function extractMcpListResult(
  result: unknown
): { items: unknown[]; content: string; truncated: boolean } {
  if (result == null) return { items: [], content: '', truncated: false }
  if (typeof result === 'string') {
    const parsed = parseJsonRecord(result)
    if (parsed) {
      return {
        items: Array.isArray(parsed.items) ? (parsed.items as unknown[]) : [],
        content: typeof parsed.content === 'string' ? parsed.content : '',
        truncated: typeof parsed.truncated === 'boolean' ? parsed.truncated : false,
      }
    }
    return { items: [], content: result, truncated: false }
  }
  if (typeof result !== 'object') {
    return { items: [], content: String(result), truncated: false }
  }

  const record = result as Record<string, unknown>
  let items = Array.isArray(record.items) ? (record.items as unknown[]) : []
  let content = ''
  let truncated = Boolean(record.truncated)

  const structured = record.structured_content
  if (structured && typeof structured === 'object' && !Array.isArray(structured)) {
    const structuredRecord = structured as Record<string, unknown>
    if (!items.length && Array.isArray(structuredRecord.items)) {
      items = structuredRecord.items as unknown[]
    }
    if (!content && typeof structuredRecord.content === 'string') {
      content = structuredRecord.content
    }
    if (!truncated && typeof structuredRecord.truncated === 'boolean') {
      truncated = structuredRecord.truncated
    }
  }

  const textEntries = extractTextEntries(record.content)
  if (textEntries.length > 0) {
    const extracted = extractListFromTextEntries(textEntries)
    if (!items.length && extracted.items.length > 0) {
      items = extracted.items
    }
    if (!content && extracted.content) {
      content = extracted.content
    }
    if (!truncated && typeof extracted.truncated === 'boolean') {
      truncated = extracted.truncated
    }
  }

  if (!items.length && !content) {
    const nestedResult = record.result
    if (nestedResult && nestedResult !== result) {
      const extracted = extractMcpListResult(nestedResult)
      if (extracted.items.length > 0 || extracted.content) {
        return extracted
      }
    }
    const nestedContent = record.content
    if (
      nestedContent &&
      nestedContent !== result &&
      typeof nestedContent === 'object' &&
      !Array.isArray(nestedContent)
    ) {
      const extracted = extractMcpListResult(nestedContent)
      if (extracted.items.length > 0 || extracted.content) {
        return extracted
      }
    }
  }

  return { items, content, truncated }
}

export function extractMcpErrorMessage(result: unknown): string {
  if (result == null || typeof result !== 'object') return ''
  const record = result as Record<string, unknown>
  if (typeof record.message === 'string' && record.message.trim()) return record.message
  if (typeof record.error === 'string' && record.error.trim()) return record.error
  const errors = record.errors
  if (Array.isArray(errors)) {
    const texts = errors.map((item) => String(item).trim()).filter(Boolean)
    if (texts.length > 0) return texts.join(', ')
  }
  return ''
}
