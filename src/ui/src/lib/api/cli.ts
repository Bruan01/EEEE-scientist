import { apiClient } from '@/lib/api/client'
import { client as questClient } from '@/lib/api'
import type {
  CliServer,
  CliFileListResponse,
  CliFileContentResponse,
  CliLogManifestResponse,
  CliTelemetryResponse,
  CliMethodListResponse,
  CliMethodGetResponse,
  CliMethodCreateResponse,
  CliSessionSnapshot,
  CliSessionTranscriptResponse,
} from '@/lib/plugins/cli/types/cli'

function isLocalCliFallbackError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const status = (error as { response?: { status?: number } }).response?.status
  return status === 401 || status === 403 || status === 404 || status === 405 || status === 501 || status === 502 || status === 503
}

async function buildLocalQuestCliServers(projectId: string) {
  try {
    const session = await questClient.session(projectId)
    const questRoot =
      typeof session.snapshot?.quest_root === 'string' ? session.snapshot.quest_root : null
    const now = new Date().toISOString()
    return [
      {
        id: `local:${projectId}`,
        project_id: projectId,
        name: 'Local Quest Runtime',
        hostname: 'localhost',
        ip_address: '127.0.0.1',
        os_info: 'Local daemon',
        server_root: questRoot,
        allowed_roots: questRoot ? [questRoot] : [],
        gpu_count: 0,
        memory_gb: 0,
        disk_gb: 0,
        status: 'online',
        last_seen_at: now,
        registered_at: now,
      },
    ] as CliServer[]
  } catch {
    return []
  }
}

export async function listCliServers(projectId: string) {
  const localServers = await buildLocalQuestCliServers(projectId)
  if (localServers.length) {
    return localServers
  }
  try {
    const response = await apiClient.get(`/api/v1/projects/${projectId}/cli/servers`)
    return response.data as CliServer[]
  } catch (error) {
    if (!isLocalCliFallbackError(error)) {
      throw error
    }
    return []
  }
}

export async function getCliServer(projectId: string, serverId: string) {
  const response = await apiClient.get(`/api/v1/projects/${projectId}/cli/servers/${serverId}`)
  return response.data as CliServer
}

export async function updateCliServer(projectId: string, serverId: string, payload: { name?: string }) {
  const response = await apiClient.patch(`/api/v1/projects/${projectId}/cli/servers/${serverId}`, payload)
  return response.data as CliServer
}

export async function unbindCliServer(projectId: string, serverId: string) {
  const response = await apiClient.post(`/api/v1/projects/${projectId}/cli/servers/${serverId}/unbind`)
  return response.data as { success: boolean }
}

export async function removeCliServerFromProject(projectId: string, serverId: string) {
  const response = await apiClient.post(`/api/v1/projects/${projectId}/cli/servers/${serverId}/remove`)
  return response.data as { success: boolean; action?: string }
}

export async function refreshCliServerStatus(projectId: string, serverId: string) {
  if (serverId.startsWith('local:')) {
    return { success: true }
  }
  const response = await apiClient.post(`/api/v1/projects/${projectId}/cli/servers/${serverId}/refresh`)
  return response.data as { success: boolean }
}

export async function listCliFiles(projectId: string, serverId: string, path: string, refresh = false) {
  const response = await apiClient.get(`/api/v1/projects/${projectId}/cli/servers/${serverId}/files`, {
    params: { path, refresh },
  })
  return response.data as CliFileListResponse
}

export async function readCliFile(projectId: string, serverId: string, path: string, tailBytes?: number) {
  const response = await apiClient.get(`/api/v1/projects/${projectId}/cli/servers/${serverId}/file`, {
    params: { path, tail_bytes: tailBytes },
  })
  return response.data as CliFileContentResponse
}

export async function writeCliFile(projectId: string, serverId: string, payload: { path: string; content?: string; encoding?: string; operation?: string }) {
  const response = await apiClient.post(`/api/v1/projects/${projectId}/cli/servers/${serverId}/file`, payload)
  return response.data as { success: boolean }
}

export async function deleteCliFile(projectId: string, serverId: string, path: string, recursive = false) {
  const response = await apiClient.delete(`/api/v1/projects/${projectId}/cli/servers/${serverId}/file`, {
    params: { path, recursive },
  })
  return response.data as { success: boolean }
}

export async function uploadCliFile(projectId: string, serverId: string, file: File, path: string) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await apiClient.post(`/api/v1/projects/${projectId}/cli/servers/${serverId}/upload`, formData, {
    params: { path },
  })
  return response.data as { success: boolean }
}

export async function downloadCliFile(projectId: string, serverId: string, path: string) {
  const response = await apiClient.get(`/api/v1/projects/${projectId}/cli/servers/${serverId}/download`, {
    params: { path },
    responseType: 'blob',
  })
  return response.data as Blob
}

export async function listCliSessions(projectId: string, serverId: string) {
  const response = await apiClient.get(`/api/v1/projects/${projectId}/cli/servers/${serverId}/sessions`)
  return response.data as CliSessionSnapshot[]
}

export async function updateCliSession(
  projectId: string,
  serverId: string,
  sessionId: string,
  payload: { name?: string }
) {
  const response = await apiClient.patch(
    `/api/v1/projects/${projectId}/cli/servers/${serverId}/sessions/${sessionId}`,
    payload
  )
  return response.data as CliSessionSnapshot
}

export async function deleteCliSession(projectId: string, serverId: string, sessionId: string) {
  const response = await apiClient.delete(
    `/api/v1/projects/${projectId}/cli/servers/${serverId}/sessions/${sessionId}`
  )
  return response.data as { success: boolean }
}

export async function getCliSessionTranscript(
  projectId: string,
  serverId: string,
  sessionId: string,
  params?: { limit?: number; direction?: 'head' | 'tail'; cursor?: string }
) {
  const response = await apiClient.get(
    `/api/v1/projects/${projectId}/cli/servers/${serverId}/sessions/${sessionId}/transcript`,
    { params }
  )
  return response.data as CliSessionTranscriptResponse
}

export async function listCliLogs(
  projectId: string,
  serverId: string,
  params?: { start_time?: string; end_time?: string; limit?: number; offset?: number }
) {
  const response = await apiClient.get(`/api/v1/projects/${projectId}/cli/servers/${serverId}/logs/manifest`, {
    params,
  })
  return response.data as CliLogManifestResponse
}

export async function getCliServerMetrics(
  projectId: string,
  serverId: string,
  options?: { range?: string; bucket?: number }
) {
  if (serverId.startsWith('local:')) {
    return {
      points: [],
      cpu: [],
      memory: [],
      gpu: [],
      network: [],
      disk: [],
      range: options?.range ?? '30m',
      bucket: options?.bucket ?? 60,
      latest: null,
    } as CliTelemetryResponse
  }
  const response = await apiClient.get(
    `/api/v1/projects/${projectId}/cli/servers/${serverId}/metrics`,
    {
      params: {
        range: options?.range,
        bucket: options?.bucket,
      },
    }
  )
  return response.data as CliTelemetryResponse
}

export async function getCliLogObject(
  projectId: string,
  serverId: string,
  logObjectId: string,
  options?: { download?: boolean; decompress?: boolean }
) {
  const response = await apiClient.get(`/api/v1/projects/${projectId}/cli/servers/${serverId}/logs/${logObjectId}`, {
    params: options,
    responseType: options?.download || options?.decompress ? 'blob' : 'json',
  })
  return response.data
}

export async function listCliTasks(projectId: string, serverId: string) {
  const response = await apiClient.get(`/api/v1/projects/${projectId}/cli/servers/${serverId}/tasks`)
  return response.data as Array<{ id: string; title: string; status: string; updated_at: string }>
}

export async function listCliFindings(projectId: string, serverId: string) {
  const response = await apiClient.get(`/api/v1/projects/${projectId}/cli/servers/${serverId}/findings`)
  return response.data as Array<{ id: string; title: string; severity: string; updated_at: string }>
}

export async function listCliMethods(projectId: string, serverId: string) {
  const response = await apiClient.get(`/api/v1/projects/${projectId}/cli/servers/${serverId}/methods`)
  return response.data as CliMethodListResponse
}

export async function getCliMethod(projectId: string, serverId: string, methodId: string) {
  const response = await apiClient.get(
    `/api/v1/projects/${projectId}/cli/servers/${serverId}/methods/${methodId}`
  )
  return response.data as CliMethodGetResponse
}

export async function createCliMethod(
  projectId: string,
  serverId: string,
  payload: {
    session_id: string
    method_name?: string
    paper_source: string
    topic?: string
    code_source?: string
    auto_name?: boolean
  }
) {
  const response = await apiClient.post(
    `/api/v1/projects/${projectId}/cli/servers/${serverId}/methods`,
    payload
  )
  return response.data as CliMethodCreateResponse
}

export type CliHealthCheck = {
  status: string
  latency_ms?: number
  error?: string
  active_connections?: number
  local_connections?: number
  online_count?: number
}

export type CliHealthResponse = {
  status: string
  timestamp: string
  checks: Record<string, CliHealthCheck>
}

export async function getCliHealth() {
  const response = await apiClient.get('/api/v1/health/cli')
  return response.data as CliHealthResponse
}
