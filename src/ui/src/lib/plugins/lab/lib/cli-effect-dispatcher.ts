import { useTabsStore } from '@/lib/stores/tabs'
import { useCliStore } from '@/lib/plugins/cli/stores/cli-store'
import { useLabCopilotStore } from '@/lib/stores/lab-copilot'
import { buildCliFileId, getCliFileName } from '@/lib/api/cli-file-id'
import { toCliResourcePath } from '@/lib/utils/resource-paths'
import { normalizePath, splitPath, joinPath } from '@/lib/plugins/cli/lib/file-utils'
import { BUILTIN_PLUGINS, getPluginIdFromExtension } from '@/lib/types/plugin'
import { buildCliEffectKey, useCliFileEffectsStore } from '@/lib/stores/cli-file-effects'
import { useFileContentStore } from '@/lib/stores/file-content'
import { getMcpToolKind, getMcpToolPath } from '@/lib/plugins/ai-manus/lib/mcp-tools'
import type { ToolEventData } from '@/lib/types/chat-events'
import {
  EXPLORER_REFRESH_EVENT,
  type ExplorerRefreshDetail,
  type ExplorerRefreshTarget,
} from './explorer-events'

type CliEffectKind = 'read' | 'write'

type LabCliEffectPayload = {
  projectId: string
  sessionId?: string | null
  serverId: string
  path: string
  kind: CliEffectKind
  readOnly?: boolean
}

type FileReloadDetail = {
  projectId?: string
  fileId: string
  filePath?: string
  source?: string
  force?: boolean
}

const FILE_RELOAD_EVENT = 'ds:file:reload'
const EXPLORER_REFRESH_TIMEOUT_MS = 1500

const isAbsolutePath = (path: string) => path.trim().startsWith('/')

const resolveCliPath = (path: string, serverRoot?: string | null) => {
  const trimmed = path.trim()
  if (!trimmed) return ''
  if (isAbsolutePath(trimmed)) return normalizePath(trimmed)
  if (!serverRoot) return normalizePath(trimmed)
  return joinPath([...splitPath(serverRoot), ...splitPath(trimmed)])
}

const resolveServerId = (serverId?: string | null) => {
  const cliState = useCliStore.getState()
  if (serverId) return serverId
  if (cliState.activeServerId) return cliState.activeServerId
  if (cliState.servers.length === 1) return cliState.servers[0].id
  return null
}

const resolveServerRoot = (serverId: string) => {
  const cliState = useCliStore.getState()
  return cliState.servers.find((server) => server.id === serverId)?.server_root ?? '/'
}

const resolvePluginId = (path: string) => {
  const pluginId = getPluginIdFromExtension(path)
  return pluginId ?? BUILTIN_PLUGINS.CODE_EDITOR
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

const resolvePlanningTaskId = (params: {
  metadata?: Record<string, unknown> | null
  args?: Record<string, unknown>
  sessionId?: string | null
}) => {
  const candidates: Array<unknown> = [
    params.metadata?.task_id,
    params.metadata?.taskId,
    params.metadata?.agent_kernel_task_id,
    params.metadata?.session_id,
    params.metadata?.lab_session_id,
    params.metadata?.resume_task_id,
    params.args?.task_id,
    params.args?.taskId,
    params.sessionId,
  ]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const trimmed = candidate.trim()
    if (!trimmed || trimmed.startsWith('draft-')) continue
    return trimmed
  }
  return null
}

const resolvePlanningPath = (path: string, taskId: string | null) => {
  if (!path) return path
  const normalized = normalizePath(path)
  const marker = '/.core/memory/working'
  const markerIndex = normalized.indexOf(marker)
  if (markerIndex === -1) return path
  const basePath = normalized.slice(0, markerIndex)
  const restRaw = normalized.slice(markerIndex + marker.length)
  let restSegments = splitPath(restRaw)
  let resolvedTaskId = taskId
  if (!resolvedTaskId && restSegments.length > 0 && isUuid(restSegments[0])) {
    resolvedTaskId = restSegments[0]
    restSegments = restSegments.slice(1)
  }
  if (!resolvedTaskId) return path
  if (restSegments.length > 0 && restSegments[0] === resolvedTaskId) {
    restSegments = restSegments.slice(1)
  }
  return joinPath([...splitPath(basePath), '.core', 'planning', resolvedTaskId, ...restSegments])
}

const classifyExplorerTarget = (path: string) => {
  const normalized = normalizePath(path)
  if (normalized.includes('/.core/memory/working') || normalized.includes('/.core/planning/')) {
    return 'planning' as const
  }
  return 'cli' as const
}

const dispatchExplorerFocus = (payload: {
  target: 'planning' | 'cli'
  projectId: string
  path: string
}) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('ds:explorer:focus', { detail: payload }))
}

const dispatchFileReload = (detail: FileReloadDetail) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(FILE_RELOAD_EVENT, { detail }))
}

const requestExplorerRefresh = (payload: {
  target: ExplorerRefreshTarget
  projectId: string
}) => {
  if (typeof window === 'undefined') return Promise.resolve()
  return new Promise<void>((resolve) => {
    let completed = false
    const finish = () => {
      if (completed) return
      completed = true
      window.clearTimeout(timeoutId)
      resolve()
    }
    const timeoutId = window.setTimeout(finish, EXPLORER_REFRESH_TIMEOUT_MS)
    const detail: ExplorerRefreshDetail = {
      target: payload.target,
      projectId: payload.projectId,
      onComplete: finish,
    }
    window.dispatchEvent(new CustomEvent(EXPLORER_REFRESH_EVENT, { detail }))
  })
}

const openCliFileInTab = (payload: LabCliEffectPayload) => {
  const tabsStore = useTabsStore.getState()
  const serverRoot = resolveServerRoot(payload.serverId)
  const fileId = buildCliFileId({
    projectId: payload.projectId,
    serverId: payload.serverId,
    path: payload.path,
  })
  const fileName = getCliFileName(payload.path)
  const pluginId = resolvePluginId(payload.path)
  tabsStore.openTab({
    pluginId,
    context: {
      type: 'file',
      resourceId: fileId,
      resourcePath: toCliResourcePath({
        serverId: payload.serverId,
        path: payload.path,
        serverRoot,
      }),
      resourceName: fileName,
      customData: {
        projectId: payload.projectId,
        fileSource: 'cli',
        cliServerId: payload.serverId,
        cliPath: payload.path,
        cliRoot: serverRoot,
        readOnly: payload.readOnly ?? false,
        readonly: payload.readOnly ?? false,
        lab_context: true,
        lab_session_id: payload.sessionId ?? null,
      },
    },
    title: fileName,
  })
}

const refreshCliFile = (payload: LabCliEffectPayload) => {
  const fileId = buildCliFileId({
    projectId: payload.projectId,
    serverId: payload.serverId,
    path: payload.path,
  })
  const fileStore = useFileContentStore.getState()
  if (fileStore.getEntry(payload.projectId, fileId)) {
    void fileStore
      .reload({
        projectId: payload.projectId,
        fileId,
      })
      .catch((error) => {
        console.warn('[LabCliEffect] Reload failed:', error)
      })
  }
  dispatchFileReload({
    projectId: payload.projectId,
    fileId,
    filePath: payload.path,
    source: 'lab-cli',
  })
}

export const dispatchLabCliEffect = (payload: LabCliEffectPayload) => {
  const effectStore = useCliFileEffectsStore.getState()
  const key = buildCliEffectKey(payload.serverId, payload.path)
  effectStore.highlight(key)
  if (payload.kind === 'read') {
    effectStore.markRead(key)
  } else if (payload.kind === 'write') {
    effectStore.markWrite(key)
  }

  const target = classifyExplorerTarget(payload.path)
  dispatchExplorerFocus({ target, projectId: payload.projectId, path: payload.path })

  if (payload.kind === 'write') {
    openCliFileInTab(payload)
  }
}

const WRITE_KINDS = new Set([
  'append_file',
  'write_task_plan',
  'write_memory',
  'request_patch',
  'pull_file',
])

const CLI_READ_FUNCTIONS = new Set(['file_read', 'file_info'])
const CLI_WRITE_FUNCTIONS = new Set([
  'file_write',
  'file_str_replace',
  'file_patch',
  'ds_system_write_file',
  'ds_system_append_file',
])

const pendingToolPaths = new Map<string, { serverId: string; path: string }>()

const getToolCallId = (toolData: Partial<ToolEventData>) => {
  const raw = toolData.tool_call_id
  return typeof raw === 'string' && raw.trim() ? raw.trim() : ''
}

const getToolContentRecord = (toolData: Partial<ToolEventData>) => {
  const content = toolData.content
  if (!content || typeof content !== 'object' || Array.isArray(content)) return null
  return content as Record<string, unknown>
}

const getPathFromContent = (toolData: Partial<ToolEventData>) => {
  const contentRecord = getToolContentRecord(toolData)
  if (!contentRecord) return ''
  const directPath = getMcpToolPath(contentRecord)
  if (directPath) return directPath
  const writtenPath =
    typeof contentRecord.written_path === 'string' ? contentRecord.written_path : ''
  if (writtenPath) return writtenPath
  const result = contentRecord.result
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const resultPath = getMcpToolPath(result as Record<string, unknown>)
    if (resultPath) return resultPath
    if (typeof (result as Record<string, unknown>).written_path === 'string') {
      return (result as Record<string, unknown>).written_path as string
    }
  }
  return ''
}

export const applyLabCliToolEffect = (params: {
  toolData: Partial<ToolEventData>
  functionName: string
  status: string
  projectId?: string | null
  sessionId?: string | null
  cliServerId?: string | null
  readOnly?: boolean
}) => {
  const followEffects = useLabCopilotStore.getState().followEffects
  if (!followEffects) return false
  if (!params.projectId) return false

  const normalizedFunction = params.functionName.trim().toLowerCase()
  const fallbackFunction = normalizedFunction.startsWith('mcp__')
    ? normalizedFunction.split('__').slice(-1)[0] ?? normalizedFunction
    : normalizedFunction
  const kind = getMcpToolKind(params.functionName)
  let effectKind: CliEffectKind | null = null
  if (kind) {
    if (kind === 'read_file') {
      effectKind = 'read'
    } else if (WRITE_KINDS.has(kind)) {
      effectKind = 'write'
    } else {
      return false
    }
  } else if (fallbackFunction) {
    if (CLI_READ_FUNCTIONS.has(fallbackFunction)) {
      effectKind = 'read'
    } else if (CLI_WRITE_FUNCTIONS.has(fallbackFunction)) {
      effectKind = 'write'
    } else {
      return false
    }
  } else {
    return false
  }

  const isPatchTool =
    kind === 'request_patch' ||
    fallbackFunction === 'file_patch' ||
    fallbackFunction === 'ds_system_request_patch'

  const args =
    params.toolData.args && typeof params.toolData.args === 'object' && !Array.isArray(params.toolData.args)
      ? (params.toolData.args as Record<string, unknown>)
      : {}
  const metadata =
    params.toolData.metadata && typeof params.toolData.metadata === 'object'
      ? (params.toolData.metadata as Record<string, unknown>)
      : null
  const rawPath = getMcpToolPath(args) || getPathFromContent(params.toolData)
  const toolCallId = getToolCallId(params.toolData)

  const serverId = resolveServerId(params.cliServerId)
  if (!serverId) return false
  const serverRoot = resolveServerRoot(serverId)
  const planningTaskId = resolvePlanningTaskId({
    metadata,
    args,
    sessionId: params.sessionId ?? null,
  })
  const resolvedPath = rawPath ? resolveCliPath(rawPath, serverRoot) : ''
  const mappedPath = resolvedPath ? resolvePlanningPath(resolvedPath, planningTaskId) : ''
  const effectivePath = mappedPath || resolvedPath
  if (params.status === 'calling') {
    if (toolCallId && effectivePath) {
      pendingToolPaths.set(toolCallId, { serverId, path: effectivePath })
    }
    return false
  }
  if (params.status !== 'called') return false
  let finalServerId = serverId
  let finalPath = effectivePath
  if (!finalPath && toolCallId) {
    const pending = pendingToolPaths.get(toolCallId)
    if (pending) {
      finalServerId = pending.serverId
      finalPath = pending.path
    }
  }
  if (toolCallId) {
    pendingToolPaths.delete(toolCallId)
  }
  if (!finalPath) return false

  const effectPayload = {
    projectId: params.projectId,
    sessionId: params.sessionId ?? null,
    serverId: finalServerId,
    path: finalPath,
    kind: effectKind,
    readOnly: params.readOnly,
  }
  const target = classifyExplorerTarget(finalPath)
  const runEffect = () => {
    dispatchLabCliEffect(effectPayload)
    if (effectKind === 'write' && isPatchTool) {
      refreshCliFile(effectPayload)
    }
  }
  void requestExplorerRefresh({ target, projectId: params.projectId }).then(runEffect)
  return true
}
