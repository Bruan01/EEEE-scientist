import { apiClient } from '@/lib/api/client'
import type { BashSession } from '@/lib/types/bash'

export type EnsureTerminalSessionResponse = {
  ok: boolean
  session: BashSession
}

export type TerminalHistoryResponse = {
  ok: boolean
  default_session_id?: string | null
  terminal_sessions: BashSession[]
  exec_sessions: BashSession[]
}

export type TerminalRestoreCommand = {
  command_id?: string | null
  command?: string | null
  source?: string | null
  submitted_at?: string | null
}

export type TerminalRestoreTailEntry = {
  seq?: number | null
  stream?: string | null
  line?: string | null
  timestamp?: string | null
}

export type TerminalRestoreResponse = {
  ok: boolean
  session_id: string
  status?: string | null
  cwd?: string | null
  latest_commands: TerminalRestoreCommand[]
  tail: TerminalRestoreTailEntry[]
  latest_seq?: number | null
  tail_start_seq?: number | null
  session: BashSession
}

export type TerminalAttachResponse = {
  ok: boolean
  port: number
  path: string
  token: string
  expires_at?: string | null
  session: BashSession
}

export async function ensureTerminalSession(
  projectId: string,
  input?: {
    bashId?: string
    label?: string
    cwd?: string
    createNew?: boolean
    source?: string
    conversationId?: string
    userId?: string
  }
) {
  const response = await apiClient.post<EnsureTerminalSessionResponse>(
    `/api/quests/${projectId}/terminal/session/ensure`,
    {
      bash_id: input?.bashId,
      label: input?.label,
      cwd: input?.cwd,
      create_new: input?.createNew,
      source: input?.source,
      conversation_id: input?.conversationId,
      user_id: input?.userId,
    }
  )
  return response.data
}

export async function sendTerminalInput(
  projectId: string,
  sessionId: string,
  input: {
    data: string
    source?: string
    conversationId?: string
    userId?: string
  }
) {
  const response = await apiClient.post(`/api/quests/${projectId}/terminal/sessions/${sessionId}/input`, {
    data: input.data,
    source: input.source,
    conversation_id: input.conversationId,
    user_id: input.userId,
  })
  return response.data as Record<string, unknown>
}

export async function attachTerminalSession(
  projectId: string,
  sessionId: string
) {
  const response = await apiClient.post<TerminalAttachResponse>(
    `/api/quests/${projectId}/terminal/sessions/${sessionId}/attach`,
    {}
  )
  return response.data
}

export async function getTerminalHistory(
  projectId: string,
  input?: {
    limit?: number
  }
) {
  const response = await apiClient.get<TerminalHistoryResponse>(
    `/api/quests/${projectId}/terminal/history`,
    {
      params: {
        limit: input?.limit,
      },
    }
  )
  return response.data
}

export async function restoreTerminalSession(
  projectId: string,
  sessionId: string,
  input?: {
    commands?: number
    output?: number
  }
) {
  const response = await apiClient.get<TerminalRestoreResponse>(
    `/api/quests/${projectId}/terminal/sessions/${sessionId}/restore`,
    {
      params: {
        commands: input?.commands,
        output: input?.output,
      },
    }
  )
  return response.data
}
