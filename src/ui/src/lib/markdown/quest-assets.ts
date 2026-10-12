import { resolveRelativePosixPath } from '@/lib/docs/markdown'
import type { OpenDocumentPayload } from '@/types'

const QUEST_FILE_PREFIX = 'quest-file::'

export type QuestMarkdownContext = {
  questId: string
  baseDocumentId: string
  baseRelativePath: string
  baseRevision?: string | null
}

function decodePart(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function parseSharedMemoryDocumentId(documentId?: string | null): { questId: string; relative: string } | null {
  const raw = String(documentId || '').trim()
  if (!raw.startsWith('sharedmemory::')) return null
  const [, questId = '', relative = ''] = raw.split('::', 3)
  const normalizedQuestId = questId.trim()
  const normalizedRelative = relative.replace(/^\/+/, '')
  if (!normalizedQuestId || !normalizedRelative) return null
  return { questId: normalizedQuestId, relative: normalizedRelative }
}

function basePathFromDocumentId(documentId?: string | null): { path: string; revision?: string | null } | null {
  const raw = String(documentId || '').trim()
  if (!raw) return null
  if (raw.startsWith('git::')) {
    const [, revision = '', relative = ''] = raw.split('::', 3)
    if (!revision || !relative) return null
    return { path: relative.replace(/^\/+/, ''), revision }
  }
  if (raw.startsWith('path::')) {
    const relative = raw.slice('path::'.length).replace(/^\/+/, '')
    return relative ? { path: relative } : null
  }
  if (raw.startsWith('questpath::')) {
    const relative = raw.slice('questpath::'.length).replace(/^\/+/, '')
    return relative ? { path: relative } : null
  }
  if (raw.startsWith('memory::')) {
    const relative = raw.slice('memory::'.length).replace(/^\/+/, '')
    return relative ? { path: `memory/${relative}` } : null
  }
  const sharedMemory = parseSharedMemoryDocumentId(raw)
  if (sharedMemory) {
    return { path: `memory/${sharedMemory.relative}` }
  }
  if (raw.startsWith('skill::')) {
    return null
  }
  if (raw.includes('/') || raw.startsWith('.')) {
    return null
  }
  return { path: raw }
}

function parseQuestFileContext(fileId?: string | null): QuestMarkdownContext | null {
  const raw = String(fileId || '')
  if (!raw.startsWith(QUEST_FILE_PREFIX)) return null
  const body = raw.slice(QUEST_FILE_PREFIX.length)
  const [questId, encodedDocumentId = '', encodedPath = ''] = body.split('::')
  if (!questId || !encodedDocumentId) return null
  const documentId = decodePart(encodedDocumentId)
  const decodedPath = decodePart(encodedPath || encodedDocumentId)
  const fromDocument = basePathFromDocumentId(documentId)
  return {
    questId,
    baseDocumentId: documentId,
    baseRelativePath: fromDocument?.path || decodedPath,
    baseRevision: fromDocument?.revision || null,
  }
}

export function getQuestMarkdownContextFromDocument(
  document: Pick<OpenDocumentPayload, 'quest_id' | 'document_id'> | null | undefined
): QuestMarkdownContext | null {
  const questId = String(document?.quest_id || '').trim()
  const documentId = String(document?.document_id || '').trim()
  const base = basePathFromDocumentId(documentId)
  if (!questId || !documentId || !base?.path) return null
  return {
    questId,
    baseDocumentId: documentId,
    baseRelativePath: base.path,
    baseRevision: base.revision || null,
  }
}

export function getQuestMarkdownContextFromFileId(fileId?: string | null): QuestMarkdownContext | null {
  return parseQuestFileContext(fileId)
}

export function buildQuestDocumentAssetUrl(questId: string, documentId: string) {
  return `/api/quests/${encodeURIComponent(questId)}/documents/asset?document_id=${encodeURIComponent(documentId)}`
}

function isAbsoluteUrl(value: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')
}

function parseQuestAssetUrl(rawValue: string): { questId: string; documentId: string } | null {
  const raw = rawValue.trim()
  if (!raw) return null
  try {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://127.0.0.1'
    const parsed = new URL(raw, origin)
    const match = /^\/api\/quests\/([^/]+)\/documents\/asset$/.exec(parsed.pathname)
    if (!match) return null
    const documentId = parsed.searchParams.get('document_id')
    if (!documentId) return null
    return {
      questId: decodeURIComponent(match[1]),
      documentId,
    }
  } catch {
    return null
  }
}

function relativePathFromDocumentId(documentId: string): string | null {
  return basePathFromDocumentId(documentId)?.path || null
}

function relativePosixPath(fromFilePath: string, targetPath: string) {
  const fromDirParts = fromFilePath.includes('/')
    ? fromFilePath.split('/').slice(0, -1).filter(Boolean)
    : []
  const targetParts = targetPath.split('/').filter(Boolean)
  let common = 0
  const maxCommon = Math.min(fromDirParts.length, targetParts.length)
  while (common < maxCommon && fromDirParts[common] === targetParts[common]) {
    common += 1
  }
  const up = new Array(fromDirParts.length - common).fill('..')
  const down = targetParts.slice(common)
  const result = [...up, ...down].join('/')
  return result || targetParts[targetParts.length - 1] || ''
}

type UrlRewriteFn = (value: string) => string

function splitMarkdownDestination(rawValue: string): { url: string; suffix: string; wrapped: boolean } {
  const trimmed = rawValue.trim()
  if (!trimmed) return { url: '', suffix: '', wrapped: false }
  if (trimmed.startsWith('<')) {
    const end = trimmed.indexOf('>')
    if (end > 0) {
      return {
        url: trimmed.slice(1, end),
        suffix: trimmed.slice(end + 1),
        wrapped: true,
      }
    }
  }
  const match = /^(\S+)([\s\S]*)$/.exec(trimmed)
  return {
    url: match?.[1] || trimmed,
    suffix: match?.[2] || '',
    wrapped: false,
  }
}

function rewriteMarkdownImageDestinations(markdown: string, rewriter: UrlRewriteFn) {
  const markdownImages = /!\[([^\]]*)\]\(([^)\n]+)\)/g
  const htmlImages = /(<img\b[^>]*?\ssrc=(['"]))(.*?)(\2[^>]*>)/gi

  return markdown
    .replace(markdownImages, (_match, alt: string, rawDestination: string) => {
      const { url, suffix, wrapped } = splitMarkdownDestination(rawDestination)
      const nextUrl = rewriter(url)
      const renderedUrl = wrapped ? `<${nextUrl}>` : nextUrl
      return `![${alt}](${renderedUrl}${suffix})`
    })
    .replace(htmlImages, (_match, prefix: string, quote: string, rawUrl: string, suffix: string) => {
      const nextUrl = rewriter(rawUrl)
      return `${prefix}${nextUrl}${suffix}`
    })
}

export function resolveQuestMarkdownAssetUrl(
  rawValue: string | null | undefined,
  context: QuestMarkdownContext | null | undefined
): string | null {
  const trimmed = String(rawValue || '').trim()
  if (!trimmed) return null
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed
  const parsedAsset = parseQuestAssetUrl(trimmed)
  if (parsedAsset) {
    return buildQuestDocumentAssetUrl(parsedAsset.questId, parsedAsset.documentId)
  }
  if (!context) return trimmed
  if (trimmed.startsWith('/api/') || trimmed.startsWith('/assets/') || isAbsoluteUrl(trimmed) || trimmed.startsWith('#')) {
    return trimmed
  }
  const resolvedPath = resolveRelativePosixPath(context.baseRelativePath, trimmed)
  const sharedMemoryContext = parseSharedMemoryDocumentId(context.baseDocumentId)
  const targetDocumentId = context.baseRevision
    ? `git::${context.baseRevision}::${resolvedPath}`
    : sharedMemoryContext
      ? `sharedmemory::${sharedMemoryContext.questId}::${resolvedPath.replace(/^memory\/+/, '')}`
    : context.baseDocumentId.startsWith('questpath::')
      ? `questpath::${resolvedPath}`
      : `path::${resolvedPath}`
  return buildQuestDocumentAssetUrl(context.questId, targetDocumentId)
}

export function rewriteQuestMarkdownForDisplay(
  markdown: string,
  context: QuestMarkdownContext | null | undefined
) {
  if (!context || !markdown) return markdown
  return rewriteMarkdownImageDestinations(markdown, (value) => {
    return resolveQuestMarkdownAssetUrl(value, context) || value
  })
}

export function rewriteQuestMarkdownForSave(
  markdown: string,
  context: QuestMarkdownContext | null | undefined
) {
  if (!context || !markdown) return markdown
  return rewriteMarkdownImageDestinations(markdown, (value) => {
    const parsedAsset = parseQuestAssetUrl(value)
    if (!parsedAsset || parsedAsset.questId !== context.questId) return value
    const targetPath = relativePathFromDocumentId(parsedAsset.documentId)
    if (!targetPath) return value
    return relativePosixPath(context.baseRelativePath, targetPath)
  })
}
