export type StudioFileLinkTarget =
  | {
      kind: 'file_id'
      fileId: string
    }
  | {
      kind: 'file_path'
      filePath: string
    }

const INTERNAL_FILE_PREFIXES = ['dsfile://', 'ds://file/']
const FILE_API_PATH_RE = /(?:^|\/)api\/v1\/files\/([^/?#]+)(?:\/content)?\/?$/i
const QUEST_DOCUMENT_ASSET_RE = /^\/api\/quests\/([^/]+)\/documents\/asset$/i
const ABSOLUTE_URL_RE = /^[a-zA-Z][a-zA-Z\d+.-]*:/
const RELATIVE_FILE_REFERENCE_RE =
  /^(?:\.\/)?(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.(?:md|markdown|json|yaml|yml|txt|py|ts|tsx|js|jsx|sh|bib|tex)$/i

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function stripQueryAndHash(value: string): string {
  return value.split('#', 1)[0]?.split('?', 1)[0] ?? ''
}

function normalizeProjectRelativePath(value: string): string {
  const segments = safeDecode(value)
    .replace(/\\/g, '/')
    .split('/')
  const normalized: string[] = []

  for (const segment of segments) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (normalized.length > 0) {
        normalized.pop()
      }
      continue
    }
    normalized.push(segment)
  }

  return normalized.join('/')
}

function extractFileIdFromApiPath(pathname: string): string | null {
  const match = pathname.match(FILE_API_PATH_RE)
  if (!match) return null
  return safeDecode(match[1] || '').trim() || null
}

function filePathFromDocumentId(documentId: string): string | null {
  const raw = safeDecode(String(documentId || '')).trim()
  if (!raw) return null
  if (raw.startsWith('path::')) {
    return normalizeProjectRelativePath(raw.slice('path::'.length))
  }
  if (raw.startsWith('questpath::')) {
    return normalizeProjectRelativePath(raw.slice('questpath::'.length))
  }
  if (raw.startsWith('memory::')) {
    return normalizeProjectRelativePath(`memory/${raw.slice('memory::'.length)}`)
  }
  if (raw.startsWith('sharedmemory::')) {
    const [, sourceQuestId = '', relative = ''] = raw.split('::', 3)
    const normalizedRelative = relative.replace(/^\/+/, '')
    return normalizeProjectRelativePath(`${sourceQuestId || 'shared'}/memory/${normalizedRelative}`)
  }
  if (raw.startsWith('git::')) {
    const [, , relative = ''] = raw.split('::', 3)
    return normalizeProjectRelativePath(relative)
  }
  return null
}

function resolveQuestDocumentAssetTarget(
  pathname: string,
  searchParams: URLSearchParams
): StudioFileLinkTarget | null {
  if (!QUEST_DOCUMENT_ASSET_RE.test(pathname)) return null
  const documentId = searchParams.get('document_id')
  if (!documentId) return null
  const filePath = filePathFromDocumentId(documentId)
  return filePath ? { kind: 'file_path', filePath } : null
}

export function resolveStudioFileLinkTarget(
  href: string,
  options?: { currentOrigin?: string | null; questId?: string | null }
): StudioFileLinkTarget | null {
  const rawHref = String(href || '').trim()
  if (!rawHref || rawHref.startsWith('#')) {
    return null
  }

  const documentFilePath = filePathFromDocumentId(rawHref)
  if (documentFilePath) {
    return { kind: 'file_path', filePath: documentFilePath }
  }

  const loweredHref = rawHref.toLowerCase()
  for (const prefix of INTERNAL_FILE_PREFIXES) {
    if (!loweredHref.startsWith(prefix)) continue
    const fileId = safeDecode(rawHref.slice(prefix.length)).trim()
    if (!fileId) return null
    return { kind: 'file_id', fileId }
  }

  if (rawHref.startsWith('/')) {
    const pathname = stripQueryAndHash(rawHref)
    const questRelativePath = extractQuestRelativePath(pathname, options?.questId)
    if (questRelativePath) {
      return { kind: 'file_path', filePath: questRelativePath }
    }
    const fileId = extractFileIdFromApiPath(pathname)
    if (fileId) {
      return { kind: 'file_id', fileId }
    }
    try {
      const parsed = new URL(rawHref, options?.currentOrigin || 'http://127.0.0.1')
      const assetTarget = resolveQuestDocumentAssetTarget(parsed.pathname, parsed.searchParams)
      if (assetTarget) {
        return assetTarget
      }
    } catch {
      return null
    }
    if (!pathname.startsWith('/FILES')) {
      return null
    }
    const normalized = normalizeProjectRelativePath(pathname.slice('/FILES'.length))
    return normalized ? { kind: 'file_path', filePath: normalized } : null
  }

  if (ABSOLUTE_URL_RE.test(rawHref) || rawHref.startsWith('//')) {
    let parsed: URL
    try {
      parsed = options?.currentOrigin ? new URL(rawHref, options.currentOrigin) : new URL(rawHref)
    } catch {
      return null
    }

    const questRelativePath = extractQuestRelativePath(parsed.pathname, options?.questId)
    if (questRelativePath) {
      return { kind: 'file_path', filePath: questRelativePath }
    }

    const protocol = parsed.protocol.toLowerCase()
    if (protocol !== 'http:' && protocol !== 'https:') {
      return null
    }

    if (options?.currentOrigin) {
      try {
        if (parsed.origin !== new URL(options.currentOrigin).origin) {
          return null
        }
      } catch {
        return null
      }
    }

    const fileId = extractFileIdFromApiPath(parsed.pathname)
    if (fileId) {
      return { kind: 'file_id', fileId }
    }
    const assetTarget = resolveQuestDocumentAssetTarget(parsed.pathname, parsed.searchParams)
    if (assetTarget) {
      return assetTarget
    }
    if (!parsed.pathname.startsWith('/FILES')) {
      return null
    }
    const normalized = normalizeProjectRelativePath(parsed.pathname.slice('/FILES'.length))
    return normalized ? { kind: 'file_path', filePath: normalized } : null
  }

  const normalized = normalizeProjectRelativePath(stripQueryAndHash(rawHref))
  return normalized ? { kind: 'file_path', filePath: normalized } : null
}

function extractQuestRelativePath(pathname: string, questId?: string | null): string | null {
  const normalizedPath = safeDecode(String(pathname || '').trim()).replace(/\\/g, '/')
  if (!normalizedPath) return null

  const targetQuestId = String(questId || '').trim()
  if (targetQuestId) {
    const questMarker = `/quests/${targetQuestId}/`
    const markerIndex = normalizedPath.toLowerCase().lastIndexOf(questMarker.toLowerCase())
    if (markerIndex >= 0) {
      const relativePath = normalizeProjectRelativePath(normalizedPath.slice(markerIndex + questMarker.length))
      return relativePath || null
    }
  }

  return null
}

export function isLikelyWorkspaceFileReference(
  href: string,
  options?: { currentOrigin?: string | null; questId?: string | null }
): boolean {
  if (resolveStudioFileLinkTarget(href, options)) {
    return true
  }

  const rawHref = String(href || '').trim()
  if (!rawHref || rawHref.startsWith('#')) return false
  if (rawHref.startsWith('path::') || rawHref.startsWith('questpath::') || rawHref.startsWith('memory::') || rawHref.startsWith('git::')) {
    return true
  }

  const targetQuestId = String(options?.questId || '').trim()
  if (targetQuestId && rawHref.includes(`/quests/${targetQuestId}/`)) {
    return true
  }

  if (RELATIVE_FILE_REFERENCE_RE.test(stripQueryAndHash(rawHref))) {
    return true
  }

  return false
}

export function getWorkspaceFileReferenceLabel(
  href: string,
  options?: { currentOrigin?: string | null; questId?: string | null }
): string | null {
  const target = resolveStudioFileLinkTarget(href, options)
  if (target?.kind === 'file_path') {
    return target.filePath
  }
  if (target?.kind === 'file_id') {
    return null
  }

  const rawHref = String(href || '').trim()
  if (!rawHref) return null

  const documentPath = filePathFromDocumentId(rawHref)
  if (documentPath) return documentPath

  const targetQuestId = String(options?.questId || '').trim()
  if (targetQuestId) {
    const questRelative = extractQuestRelativePath(rawHref, targetQuestId)
    if (questRelative) return questRelative
  }

  const normalized = normalizeProjectRelativePath(stripQueryAndHash(rawHref))
  return RELATIVE_FILE_REFERENCE_RE.test(normalized) ? normalized : null
}
