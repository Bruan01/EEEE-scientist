import { BUILTIN_PLUGINS, getPluginIdFromExtension, getPluginIdFromMimeType } from '@/lib/types/plugin'
import type { WorkspaceContentKind } from '@/lib/stores/workspace-surface'
import { inferWorkspaceContentKindFromMetadata } from '@/lib/workspace/content-meta'
import type { OpenDocumentPayload } from '@/types'

export type SnapshotPreviewKind = 'plain' | 'markdown' | 'notebook' | 'pdf' | 'image'

function basename(path?: string | null) {
  const raw = String(path || '').trim()
  if (!raw) return ''
  const parts = raw.split('/').filter(Boolean)
  return parts[parts.length - 1] || raw
}

function detectSnapshotPluginId(document: Pick<OpenDocumentPayload, 'path' | 'mime_type'> | null | undefined) {
  const fileName = basename(document?.path)
  const mimeType = String(document?.mime_type || '').trim()
  return (
    (mimeType ? getPluginIdFromMimeType(mimeType) : undefined) ||
    (fileName ? getPluginIdFromExtension(fileName) : undefined) ||
    null
  )
}

export function inferSnapshotPreviewKind(
  document: Pick<OpenDocumentPayload, 'path' | 'mime_type'> | null | undefined
): SnapshotPreviewKind {
  const pluginId = detectSnapshotPluginId(document)
  const fileName = basename(document?.path).toLowerCase()

  if (fileName.endsWith('.md') || fileName.endsWith('.markdown') || fileName.endsWith('.mdx')) {
    return 'markdown'
  }
  if (pluginId === BUILTIN_PLUGINS.PDF_VIEWER) return 'pdf'
  if (pluginId === BUILTIN_PLUGINS.IMAGE_VIEWER) return 'image'
  if (pluginId === BUILTIN_PLUGINS.NOTEBOOK) return 'notebook'
  return 'plain'
}

export function inferSnapshotContentKind(
  document: Pick<OpenDocumentPayload, 'path' | 'mime_type' | 'kind'> | null | undefined
): WorkspaceContentKind {
  return (
    inferWorkspaceContentKindFromMetadata({
      mimeType: document?.mime_type,
      resourceName: document?.path,
      resourcePath: document?.path,
    }) || 'file'
  )
}

export function formatGitDiffPathLabel(path?: string | null, oldPath?: string | null, fallback = 'Diff') {
  if (path && oldPath && path !== oldPath) {
    return `${oldPath} → ${path}`
  }
  return path || fallback
}
