import type { CliTerminalSession } from '../types/cli'

export type SessionManagerState = {
  sessions: Map<string, CliTerminalSession>
  activeSessionId: string | null
}

export class SessionManager {
  private state: SessionManagerState
  private maxScrollbackLines = 10000
  private maxSessionsPerServer = 10
  private listeners: Set<(state: SessionManagerState) => void> = new Set()

  constructor() {
    this.state = {
      sessions: new Map(),
      activeSessionId: null,
    }
  }

  createSession(serverId: string, options: Partial<CliTerminalSession> = {}) {
    const existingSessions = this.getSessionsByServer(serverId)
    const sessionId = options.id ?? crypto.randomUUID()
    const existing = this.state.sessions.get(sessionId)

    if (!existing && existingSessions.length >= this.maxSessionsPerServer) {
      throw new Error(`Reached max sessions per server (${this.maxSessionsPerServer})`)
    }

    const now = Date.now()
    if (existing) {
      existing.state = 'active'
      existing.lastActiveAt = now
      if (options.name) {
        existing.name = options.name
      }
      if (options.mode) {
        existing.mode = options.mode
      }
      if (options.cols) existing.cols = options.cols
      if (options.rows) existing.rows = options.rows
      if (options.cwd) existing.cwd = options.cwd
      if (options.cwdRel) existing.cwdRel = options.cwdRel
      if (options.condaEnv !== undefined) existing.condaEnv = options.condaEnv
      if (options.shell) existing.shell = options.shell
      this.state.activeSessionId = sessionId
      this.notifyListeners()
      return existing
    }

    const sessionNumber = existingSessions.length + 1
    const sessionLabel = toAlphaLabel(sessionNumber)
    const session: CliTerminalSession = {
      id: sessionId,
      serverId,
      name: options.name ?? `${sessionLabel} Session`,
      createdAt: now,
      state: 'active',
      scrollback: [],
      lineBuffer: '',
      lastActiveAt: now,
      cols: options.cols ?? 120,
      rows: options.rows ?? 40,
      mode: options.mode ?? 'terminal',
      cwd: options.cwd,
      cwdRel: options.cwdRel,
      condaEnv: options.condaEnv,
      shell: options.shell,
      env: options.env,
      serialized: options.serialized,
    }
    this.state.sessions.set(sessionId, session)
    this.state.activeSessionId = sessionId
    this.notifyListeners()
    return session
  }

  restoreSession(session: CliTerminalSession) {
    const createdAt = session.createdAt || Date.now()
    const lastActiveAt = session.lastActiveAt || createdAt
    this.state.sessions.set(session.id, {
      ...session,
      createdAt,
      lastActiveAt,
      lineBuffer: '',
      mode: session.mode ?? 'terminal',
    })
    if (!this.state.activeSessionId) {
      this.state.activeSessionId = session.id
    }
    this.notifyListeners()
  }

  getSessionsByServer(
    serverId: string,
    options?: { includeClosed?: boolean }
  ): CliTerminalSession[] {
    return Array.from(this.state.sessions.values()).filter(
      (session) =>
        session.serverId === serverId &&
        (options?.includeClosed || session.state !== 'closed')
    )
  }

  getActiveSession(): CliTerminalSession | null {
    return this.state.activeSessionId
      ? this.state.sessions.get(this.state.activeSessionId) ?? null
      : null
  }

  getSession(sessionId: string): CliTerminalSession | null {
    return this.state.sessions.get(sessionId) ?? null
  }

  switchSession(
    sessionId: string,
    options?: { allowClosed?: boolean }
  ): CliTerminalSession | null {
    const session = this.state.sessions.get(sessionId)
    if (session && (options?.allowClosed || session.state !== 'closed')) {
      this.state.activeSessionId = sessionId
      if (session.state !== 'closed') {
        session.lastActiveAt = Date.now()
      }
      this.notifyListeners()
      return session
    }
    return null
  }

  detachSession(sessionId: string): boolean {
    const session = this.state.sessions.get(sessionId)
    if (!session || session.state !== 'active') return false
    session.state = 'detached'
    this.notifyListeners()
    return true
  }

  attachSession(sessionId: string): CliTerminalSession | null {
    const session = this.state.sessions.get(sessionId)
    if (!session || session.state !== 'detached') return null
    session.state = 'active'
    session.lastActiveAt = Date.now()
    this.state.activeSessionId = sessionId
    this.notifyListeners()
    return session
  }

  closeSession(sessionId: string): boolean {
    const session = this.state.sessions.get(sessionId)
    if (!session) return false
    session.state = 'closed'
    if (this.state.activeSessionId === sessionId) {
      const next = Array.from(this.state.sessions.values()).find((s) => s.state !== 'closed')
      this.state.activeSessionId = next ? next.id : null
    }
    this.notifyListeners()
    return true
  }

  removeSession(sessionId: string): boolean {
    const session = this.state.sessions.get(sessionId)
    if (!session) return false
    this.state.sessions.delete(sessionId)
    if (this.state.activeSessionId === sessionId) {
      const sessions = Array.from(this.state.sessions.values())
      const next = sessions.find((item) => item.state !== 'closed') ?? sessions[0]
      this.state.activeSessionId = next ? next.id : null
    }
    this.notifyListeners()
    return true
  }

  renameSession(sessionId: string, name: string): boolean {
    const session = this.state.sessions.get(sessionId)
    if (!session) return false
    session.name = name
    this.notifyListeners()
    return true
  }

  updateScrollback(sessionId: string, output: string) {
    const session = this.state.sessions.get(sessionId)
    if (!session) return
    if (!output) return
    const normalized = `${session.lineBuffer ?? ''}${output}`
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
    const parts = normalized.split('\n')
    let buffer = ''
    if (normalized.endsWith('\n')) {
      if (parts.length && parts[parts.length - 1] === '') {
        parts.pop()
      }
    } else {
      buffer = parts.pop() ?? ''
    }
    if (parts.length) {
      session.scrollback = (session.scrollback.concat(parts)).slice(-this.maxScrollbackLines)
    }
    session.lineBuffer = buffer
    session.lastActiveAt = Date.now()
    this.notifyListeners()
  }

  setScrollback(sessionId: string, lines: string[]) {
    const session = this.state.sessions.get(sessionId)
    if (!session) return
    session.scrollback = lines.slice(-this.maxScrollbackLines)
    session.lineBuffer = ''
    session.lastActiveAt = Date.now()
    this.notifyListeners()
  }

  setSerialized(sessionId: string, serialized: string) {
    const session = this.state.sessions.get(sessionId)
    if (!session) return
    session.serialized = serialized
    session.lastActiveAt = Date.now()
    this.notifyListeners()
  }

  getState() {
    return this.state
  }

  subscribe(listener: (state: SessionManagerState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.state))
  }
}

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function toAlphaLabel(index: number) {
  if (index <= 0) return 'A'
  let current = index
  let label = ''
  while (current > 0) {
    current -= 1
    label = ALPHA[current % 26] + label
    current = Math.floor(current / 26)
  }
  if (label.length > 2) return 'ZZ'
  return label
}
