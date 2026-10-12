import * as fileApi from '@/lib/api/files'
import { useFileTreeStore } from '@/lib/stores/file-tree'

const COPILOT_ROOT = 'Copilot'

function findFolderByPath(path: string): { id: string; name: string } | null {
  const node = useFileTreeStore.getState().findNodeByPath(path)
  if (node && node.type === 'folder') {
    return { id: node.id, name: node.name }
  }
  return null
}

async function findChildFolder(
  projectId: string,
  parentId: string | null,
  folderName: string
): Promise<{ id: string; name: string } | null> {
  try {
    const files = await fileApi.listFiles(projectId, parentId)
    const folder = files.find((file) => file.type === 'folder' && file.name === folderName)
    if (folder) {
      return { id: folder.id, name: folder.name }
    }
  } catch (error) {
    console.error('[AiManus] Failed to find folder', error)
  }
  return null
}

async function ensureFolder(
  projectId: string,
  parentId: string | null,
  folderName: string
): Promise<string> {
  const existing = await findChildFolder(projectId, parentId, folderName)
  if (existing) return existing.id

  const created = await fileApi.createFolder(projectId, {
    name: folderName,
    parent_id: parentId,
  })
  return created.id
}

export function buildCopilotFilePath(sessionId: string, filename: string): string {
  return `/FILES/${COPILOT_ROOT}/${sessionId}/${filename}`
}

export async function ensureCopilotSessionFolder(projectId: string, sessionId: string) {
  const existingRoot = findFolderByPath(`/${COPILOT_ROOT}`)
  const rootId = existingRoot?.id ?? (await ensureFolder(projectId, null, COPILOT_ROOT))
  const sessionFolderId = await ensureFolder(projectId, rootId, sessionId)

  await useFileTreeStore.getState().refresh()

  return {
    rootId,
    sessionFolderId,
  }
}
