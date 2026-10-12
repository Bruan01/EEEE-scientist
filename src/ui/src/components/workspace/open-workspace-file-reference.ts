import { openQuestDocumentAsFileNode } from '@/lib/api/quest-files'
import { useFileTreeStore } from '@/lib/stores/file-tree'
import type { FileNode } from '@/lib/types/file'

import type { OpenFileResult } from '@/hooks/useOpenFile'
import { dispatchWorkspaceLeftVisibility, dispatchWorkspaceRevealFile } from './workspace-events'
import { resolveStudioFileLinkTarget } from './studio-file-links'

type OpenWorkspaceFileReferenceArgs = {
  href: string
  projectId: string
  currentOrigin?: string | null
  findNode: (nodeId: string) => FileNode | null
  findNodeByPath: (path: string) => FileNode | null
  refreshTree: () => Promise<void>
  openFileInTab: (
    node: FileNode,
    options?: { customData?: Record<string, unknown> }
  ) => Promise<OpenFileResult>
  onMissing?: (detail: { kind: 'file_id' | 'file_path'; value: string }) => void
  onOpenFailed?: (detail: { node: FileNode; error?: string }) => void
}

export async function openWorkspaceFileReference({
  href,
  projectId,
  currentOrigin = null,
  findNode,
  findNodeByPath,
  refreshTree,
  openFileInTab,
  onMissing,
  onOpenFailed,
}: OpenWorkspaceFileReferenceArgs): Promise<boolean> {
  const target = resolveStudioFileLinkTarget(href, {
    currentOrigin,
    questId: projectId,
  })
  if (!target) {
    return false
  }

  let node =
    target.kind === 'file_id'
      ? findNode(target.fileId)
      : findNodeByPath(target.filePath)

  if (!node) {
    await refreshTree()
    const refreshedStore = useFileTreeStore.getState()
    node =
      target.kind === 'file_id'
        ? refreshedStore.findNode(target.fileId)
        : refreshedStore.findNodeByPath(target.filePath)
  }

  if (!node && target.kind === 'file_path') {
    const documentIds = [`path::${target.filePath}`, `questpath::${target.filePath}`]
    for (const documentId of documentIds) {
      try {
        node = await openQuestDocumentAsFileNode(projectId, documentId)
        if (node) break
      } catch {
        continue
      }
    }
  }

  if (!node) {
    return true
  }

  dispatchWorkspaceLeftVisibility({ projectId, visible: true })
  if (node.path) {
    const revealDetail = {
      projectId,
      filePath: node.path,
      label: node.name,
    }
    dispatchWorkspaceRevealFile(revealDetail)
    if (typeof window !== 'undefined') {
      window.setTimeout(() => dispatchWorkspaceRevealFile(revealDetail), 50)
      window.setTimeout(() => dispatchWorkspaceRevealFile(revealDetail), 180)
      window.setTimeout(() => dispatchWorkspaceRevealFile(revealDetail), 360)
    }
  }

  const revealNodeInExplorer = () => {
    const store = useFileTreeStore.getState()
    store.expandToFile(node.id)
    store.select(node.id)
    store.setFocused(node.id)
    store.highlightFile(node.id)
  }

  const retriggerExplorerReveal = () => {
    const store = useFileTreeStore.getState()
    store.clearHighlight()
    revealNodeInExplorer()
  }

  revealNodeInExplorer()
  if (typeof window !== 'undefined') {
    window.setTimeout(retriggerExplorerReveal, 80)
    window.setTimeout(retriggerExplorerReveal, 220)
  }

  if (node.type === 'folder') {
    useFileTreeStore.getState().expand(node.id)
    return true
  }

  useFileTreeStore.getState().markFileRead(node.id)
  const result = await openFileInTab(node, {
    customData: { projectId },
  })
  if (!result.success) {
    onOpenFailed?.({ node, error: result.error })
  }
  return true
}
