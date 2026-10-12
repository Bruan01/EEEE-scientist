function compactToolSubject(value?: string | null) {
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

function parseStructuredArgs(value?: string) {
  if (!value) {
    return null
  }
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return null
  }
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

  if (parsed) {
    for (const key of ['path', 'file', 'filename', 'document_id', 'ref_id', 'q', 'query', 'url']) {
      const value = parsed[key]
      if (typeof value === 'string' && value.trim()) {
        candidates.push(value.trim())
      }
    }
    const payload = parsed.payload
    if (payload && typeof payload === 'object' && typeof (payload as Record<string, unknown>).kind === 'string') {
      candidates.push(String((payload as Record<string, unknown>).kind).trim())
    }
  }

  for (const payload of [parsed, parsedOutput]) {
    const changes = payload?.changes
    if (Array.isArray(changes)) {
      for (const change of changes) {
        if (change && typeof change === 'object' && typeof (change as Record<string, unknown>).path === 'string') {
          candidates.push(String((change as Record<string, unknown>).path).trim())
        }
      }
    }
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

  return compactToolSubject(candidates.find(Boolean))
}

function classifyShellCommand(args?: string, output?: string) {
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

function resolveToolIntent(toolName?: string, args?: string, output?: string) {
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
    name.startsWith('artifact.') ||
    ['record', 'checkpoint', 'prepare_branch', 'publish_baseline', 'attach_baseline', 'refresh_summary', 'render_git_graph', 'interact'].includes(
      name
    )
  ) {
    return 'artifact'
  }
  if (name.startsWith('memory.') || ['memory.write', 'memory.read', 'memory.search', 'memory.list_recent', 'memory.promote_to_global'].includes(name)) {
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
        return subject ? `DeepScientist is Searching the Web for ${subject}...` : 'DeepScientist is Searching the Web...'
      case 'search':
        return subject ? `DeepScientist is Searching ${subject}...` : 'DeepScientist is Searching...'
      case 'read':
        return subject ? `DeepScientist is Reading ${subject}...` : 'DeepScientist is Reading...'
      case 'write':
        return subject ? `DeepScientist is Writing ${subject}...` : 'DeepScientist is Writing...'
      case 'artifact':
        return subject ? `DeepScientist is Recording ${subject}...` : 'DeepScientist is Recording Progress...'
      case 'memory':
        return subject ? `DeepScientist is Updating Memory ${subject}...` : 'DeepScientist is Updating Memory...'
      case 'web':
        return subject ? `DeepScientist is Browsing ${subject}...` : 'DeepScientist is Browsing...'
      case 'shell':
        return 'DeepScientist is Running a Shell Command...'
      case 'file':
        return subject ? `DeepScientist is Inspecting ${subject}...` : 'DeepScientist is Inspecting Files...'
      default:
        return `DeepScientist is Using ${toolName || 'a tool'}...`
    }
  }

  switch (intent) {
    case 'web_search':
      return subject ? `DeepScientist Finished Searching the Web for ${subject}.` : 'DeepScientist Finished Searching the Web.'
    case 'search':
      return subject ? `DeepScientist Finished Searching ${subject}.` : 'DeepScientist Finished Searching.'
    case 'read':
      return subject ? `DeepScientist Finished Reading ${subject}.` : 'DeepScientist Finished Reading.'
    case 'write':
      return subject ? `DeepScientist Updated ${subject}.` : 'DeepScientist Updated Files.'
    case 'artifact':
      return subject ? `DeepScientist Recorded Progress for ${subject}.` : 'DeepScientist Recorded Progress.'
    case 'memory':
      return subject ? `DeepScientist Updated Memory ${subject}.` : 'DeepScientist Updated Memory.'
    case 'web':
      return subject ? `DeepScientist Finished Browsing ${subject}.` : 'DeepScientist Finished Browsing.'
    case 'shell':
      return 'DeepScientist Finished Running a Shell Command.'
    case 'file':
      return subject ? `DeepScientist Inspected ${subject}.` : 'DeepScientist Inspected Files.'
    default:
      return `DeepScientist Finished Using ${toolName || 'a tool'}.`
  }
}
