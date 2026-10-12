import type { Socket } from 'socket.io-client'
import { getCliClientId } from '../lib/socket'
import { wrapEnvelope } from '../lib/protocol'
import type { CliTerminalSession } from '../types/cli'

const SESSION_STORAGE_KEY = 'cli_terminal_sessions'
const SESSION_EXPIRY_HOURS = 24

export type PersistedSession = {
  sessionId: string
  serverId: string
  name: string
  lastActiveAt: number
  scrollbackHash: string
  cols: number
  rows: number
  mode?: 'terminal' | 'ui'
  cwd?: string
  cwdRel?: string
  shell?: string
  condaEnv?: string
  serialized?: string
}

export type RecoverSessionRequest = {
  sessionId: string
  serverId: string
  scrollbackHash?: string
}

export function persistSessions(sessions: CliTerminalSession[]): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return
  const persisted: PersistedSession[] = sessions
    .filter((session) => session.state !== 'closed')
    .map((session) => ({
      sessionId: session.id,
      serverId: session.serverId,
      name: session.name,
      lastActiveAt: session.lastActiveAt,
      scrollbackHash: hashScrollback(session.scrollback),
      cols: session.cols,
      rows: session.rows,
      mode: session.mode,
      cwd: session.cwd,
      cwdRel: session.cwdRel,
      shell: session.shell,
      condaEnv: session.condaEnv,
      serialized: session.serialized && session.serialized.length <= 200_000 ? session.serialized : undefined,
    }))

  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(persisted))
}

export function loadPersistedSessions(): PersistedSession[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return []
  try {
    const data = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!data) return []
    const sessions: PersistedSession[] = JSON.parse(data)
    const now = Date.now()
    const expiryMs = SESSION_EXPIRY_HOURS * 60 * 60 * 1000
    return sessions.filter((session) => now - session.lastActiveAt < expiryMs)
  } catch (error) {
    console.error('Failed to load persisted sessions:', error)
    return []
  }
}

export async function recoverSession(
  socket: Socket,
  request: RecoverSessionRequest,
  options?: { timeoutMs?: number }
): Promise<{ recovered: boolean; scrollback?: string[] }>
{
  const scrollbackHash = request.scrollbackHash ?? ''
  const timeoutMs = options?.timeoutMs ?? 5000
  return new Promise((resolve) => {
    let settled = false

    const cleanup = (result: { recovered: boolean; scrollback?: string[] }) => {
      if (settled) return
      settled = true
      socket.off('cli:session:recover:response', handleResponse)
      clearTimeout(timeout)
      resolve(result)
    }

    const handleResponse = (response: {
      success?: boolean
      scrollback?: string[]
      session_id?: string
      sessionId?: string
    }) => {
      const responseSessionId = response?.session_id || response?.sessionId
      if (responseSessionId && responseSessionId !== request.sessionId) {
        return
      }
      if (response?.success) {
        cleanup({ recovered: true, scrollback: response.scrollback })
        return
      }
      cleanup({ recovered: false })
    }

    const timeout = setTimeout(() => {
      cleanup({ recovered: false })
    }, timeoutMs)

    socket.on('cli:session:recover:response', handleResponse)
    socket.emit(
      'cli:session:recover',
      wrapEnvelope(
        {
          scrollback_hash: scrollbackHash,
        },
        {
          session_id: request.sessionId,
          server_id: request.serverId,
          client_id: getCliClientId(),
        }
      )
    )
  })
}

export function hashScrollback(lines: string[]): string {
  const content = lines.slice(-100).join('\n')
  try {
    return btoa(content).slice(0, 32)
  } catch {
    return btoa(unescape(encodeURIComponent(content))).slice(0, 32)
  }
}
