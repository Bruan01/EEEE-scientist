export type CliFileIdPayload = {
  projectId: string
  serverId: string
  path: string
}

const CLI_FILE_ID_PREFIX = 'cli:'

export function buildCliFileId(payload: CliFileIdPayload): string {
  const encodedPath = encodeURIComponent(payload.path || '/')
  return `${CLI_FILE_ID_PREFIX}${payload.projectId}:${payload.serverId}:${encodedPath}`
}

export function parseCliFileId(fileId: string): CliFileIdPayload | null {
  if (!fileId.startsWith(CLI_FILE_ID_PREFIX)) return null
  const parts = fileId.split(':')
  if (parts.length < 4) return null
  const projectId = parts[1]
  const serverId = parts[2]
  const encodedPath = parts.slice(3).join(':')
  if (!projectId || !serverId || !encodedPath) return null
  return {
    projectId,
    serverId,
    path: decodeURIComponent(encodedPath),
  }
}

export function isCliFileId(fileId?: string | null): boolean {
  if (!fileId) return false
  return fileId.startsWith(CLI_FILE_ID_PREFIX)
}

export function getCliFileName(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1] || normalized || 'Untitled'
}
