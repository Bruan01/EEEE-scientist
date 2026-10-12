import axios from 'axios'
import { apiClient, getApiBaseUrl } from '@/lib/api/client'
import { getCachedValue, setCachedValue } from '@/lib/api/cache'
import { supportsProductApis } from '@/lib/runtime/quest-runtime'
import type { AgentSSEEvent, ChatSurface, ExecutionTarget, PlanEventData } from '@/lib/types/chat-events'
import {
  createQuestSession,
  getQuestLatestSession,
  getQuestSession,
  isQuestSessionId,
  listQuestSessionSummaries,
  shouldUseQuestSessionCompat,
} from '@/lib/api/quest-session-compat'

export interface CreateSessionResponse {
  session_id: string
  status?: string
  title?: string | null
  is_active?: boolean
}

export interface SessionResponse {
  session_id: string
  status?: string
  title?: string | null
  is_shared?: boolean
  is_active?: boolean
  events?: AgentSSEEvent[]
  events_truncated?: boolean
  event_limit?: number | null
  plan_history?: PlanEventData[]
  execution_target?: string | null
  cli_server_id?: string | null
  session_metadata?: Record<string, unknown>
  agents?: SessionAgentSummary[]
  event_metadata_mode?: 'compact' | 'full' | string
}

export interface SessionAgentSummary {
  agent_instance_id?: string | null
  agent_id?: string | null
  agent_label?: string | null
  agent_display_name?: string | null
  agent_logo?: string | null
  agent_avatar_color?: string | null
  agent_role?: string | null
  agent_source?: string | null
  agent_engine?: string | null
}

export type SessionStatus = 'pending' | 'running' | 'waiting' | 'completed' | 'failed'

export interface SessionListItem {
  session_id: string
  status?: SessionStatus | null
  title?: string | null
  latest_message?: string | null
  latest_message_at?: number | null
  updated_at?: number | null
  is_shared?: boolean
  is_active?: boolean
  agent_engine?: string | null
  execution_target?: string | null
  cli_server_id?: string | null
}

export interface ListSessionsResponse {
  sessions: SessionListItem[]
}

export interface LatestSessionResponse extends SessionResponse {
  latest_message?: string | null
  latest_message_at?: number | null
  updated_at?: number | null
}

export interface ShellViewResponse {
  session_id?: string
  output?: string
  console?: Array<{ ps1: string; command: string; output: string }>
}

export interface FileViewResponse {
  content: string
  file?: string
}

export interface SessionFileResponse {
  file_id?: string | null
  filename: string
  content_type?: string | null
  size?: number | null
  file_path?: string | null
}

export interface SignedUrlResponse {
  signed_url: string
  expires_at?: string
}

export interface SessionRuntimeResponse {
  success: boolean
  execution_target: ExecutionTarget
  cli_server_id?: string | null
  provider_type?: string | null
  capabilities?: string[] | null
  vnc_url?: string | null
}

export interface ClarifySelectionResponse {
  merged_message: string
  selected: string[]
}

export async function createSession(projectId?: string): Promise<CreateSessionResponse> {
  if (projectId && (await shouldUseQuestSessionCompat(projectId))) {
    const session = await createQuestSession(projectId)
    return {
      session_id: session.session_id,
      status: session.status ?? undefined,
      title: session.title ?? null,
      is_active: session.is_active ?? false,
    }
  }
  const response = await apiClient.put('/api/v1/sessions', projectId ? { project_id: projectId } : undefined)
  return response.data as CreateSessionResponse
}

export async function getSession(
  sessionId: string,
  options?: { full?: boolean; limit?: number; metadata?: 'compact' | 'full' }
): Promise<SessionResponse> {
  if (isQuestSessionId(sessionId)) {
    return (await getQuestSession(sessionId, options)) as SessionResponse
  }
  const params: Record<string, unknown> = {}
  if (options?.full === true) {
    params.full = true
  } else if (typeof options?.limit === 'number') {
    params.limit = options.limit
  }
  if (options?.metadata) {
    params.metadata = options.metadata
  }
  const response = await apiClient.get(`/api/v1/sessions/${sessionId}`, { params })
  return response.data as SessionResponse
}

export async function listSessions(projectId?: string): Promise<ListSessionsResponse> {
  if (projectId && (await shouldUseQuestSessionCompat(projectId))) {
    return listQuestSessionSummaries(projectId)
  }
  const response = await apiClient.get('/api/v1/sessions', {
    params: projectId ? { project_id: projectId } : undefined,
  })
  return response.data as ListSessionsResponse
}

export async function listSessionSummaries(projectId?: string): Promise<ListSessionsResponse> {
  const cacheKey = `ds:session-summaries:${projectId ?? 'all'}`
  const cached = getCachedValue<ListSessionsResponse>(cacheKey)
  if (cached) return cached

  if (projectId && (await shouldUseQuestSessionCompat(projectId))) {
    const data = await listQuestSessionSummaries(projectId)
    setCachedValue(cacheKey, data, 30000)
    return data as ListSessionsResponse
  }

  const response = await apiClient.get('/api/v1/sessions/summary', {
    params: projectId ? { project_id: projectId } : undefined,
  })
  const data = response.data as ListSessionsResponse
  setCachedValue(cacheKey, data, 30000)
  return data
}

export async function switchSessionRuntime(
  sessionId: string,
  payload: { executionTarget: ExecutionTarget; cliServerId?: string | null }
): Promise<SessionRuntimeResponse> {
  const response = await apiClient.post(`/api/v1/sessions/${sessionId}/runtime`, {
    execution_target: payload.executionTarget,
    cli_server_id: payload.cliServerId ?? null,
  })
  return response.data as SessionRuntimeResponse
}

export async function getLatestSession(
  projectId: string,
  limit?: number,
  surface?: ChatSurface,
  options?: { metadata?: 'compact' | 'full' }
): Promise<LatestSessionResponse | null> {
  if (await shouldUseQuestSessionCompat(projectId)) {
    return (await getQuestLatestSession(projectId, limit)) as LatestSessionResponse
  }
  if (!supportsProductApis()) {
    return null
  }
  try {
    const response = await apiClient.get('/api/v1/sessions/latest', {
      params: {
        project_id: projectId,
        ...(surface ? { surface } : {}),
        ...(typeof limit === 'number' ? { limit } : {}),
        ...(options?.metadata ? { metadata: options.metadata } : {}),
      },
    })
    return response.data as LatestSessionResponse
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null
    }
    throw error
  }
}

export async function stopSession(sessionId: string): Promise<void> {
  if (isQuestSessionId(sessionId)) {
    const questId = sessionId.slice('quest:'.length)
    await apiClient.post(`/api/quests/${questId}/commands`, {
      command: '/stop',
      source: 'web-react',
    })
    return
  }
  await apiClient.post(`/api/v1/sessions/${sessionId}/stop`)
}

export async function deleteSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/api/v1/sessions/${sessionId}`)
}

export async function viewShellSession(
  sessionId: string,
  shellSessionId: string
): Promise<ShellViewResponse> {
  const response = await apiClient.post(`/api/v1/sessions/${sessionId}/shell`, {
    session_id: shellSessionId,
  })
  return response.data as ShellViewResponse
}

export async function writeShellSession(
  sessionId: string,
  shellSessionId: string,
  input: string,
  pressEnter: boolean
): Promise<ShellViewResponse> {
  const response = await apiClient.post(`/api/v1/sessions/${sessionId}/shell/write`, {
    session_id: shellSessionId,
    input,
    press_enter: pressEnter,
  })
  return response.data as ShellViewResponse
}

export async function viewFile(sessionId: string, file: string): Promise<FileViewResponse> {
  const response = await apiClient.post(`/api/v1/sessions/${sessionId}/file`, { file })
  return response.data as FileViewResponse
}

export async function getSessionFiles(sessionId: string) {
  const response = await apiClient.get(`/api/v1/sessions/${sessionId}/files`)
  return response.data as SessionFileResponse[]
}

export async function submitToolOutput(
  sessionId: string,
  toolCallId: string,
  output: Record<string, unknown>
) {
  const response = await apiClient.post(`/api/v1/sessions/${sessionId}/tools/${toolCallId}`, {
    output,
  })
  return response.data
}

export type ApplyPatchResponse = {
  success: boolean
  summary?: {
    added?: number
    updated?: number
    deleted?: number
    moved?: number
  }
  operations?: Array<Record<string, unknown>>
  diffs?: Array<Record<string, unknown>>
  effects?: Array<{ name: string; data: Record<string, unknown> }>
  recompile_triggered?: boolean
  error?: string
}

export async function applySessionPatch(
  sessionId: string,
  payload: { patch: string; recompile?: boolean }
): Promise<ApplyPatchResponse> {
  const headers: Record<string, string> = {}
  if (typeof window !== 'undefined') {
    const ownerToken =
      window.localStorage.getItem('ds_owner_token') ||
      window.localStorage.getItem('deepscientist_api_token')
    if (ownerToken) {
      headers['X-DS-Owner-Token'] = ownerToken
    }
  }
  const response = await apiClient.post(`/api/v1/sessions/${sessionId}/apply_patch`, payload, { headers })
  return response.data as ApplyPatchResponse
}

export async function submitClarifySelection(
  sessionId: string,
  toolCallId: string,
  selections: string[]
): Promise<ClarifySelectionResponse> {
  const response = await apiClient.post(`/api/v1/sessions/${sessionId}/clarify`, {
    tool_call_id: toolCallId,
    selections,
  })
  return response.data as ClarifySelectionResponse
}

export async function createVncSignedUrl(
  sessionId: string,
  expireMinutes: number = 15
): Promise<SignedUrlResponse> {
  const response = await apiClient.post(`/api/v1/sessions/${sessionId}/vnc/signed-url`, {
    expire_minutes: expireMinutes,
  })
  return response.data as SignedUrlResponse
}

export async function getVncUrl(sessionId: string, expireMinutes: number = 15): Promise<string> {
  const baseUrl = getApiBaseUrl().replace(/^http/, 'ws')
  try {
    const signed = await createVncSignedUrl(sessionId, expireMinutes)
    return `${baseUrl}${signed.signed_url}`
  } catch (error) {
    if (typeof window === 'undefined') {
      throw error
    }
    const userToken = window.localStorage.getItem('ds_access_token')
    const token = userToken || null
    const query = token ? `?token=${encodeURIComponent(token)}` : ''
    return `${baseUrl}/api/v1/sessions/${sessionId}/vnc${query}`
  }
}
