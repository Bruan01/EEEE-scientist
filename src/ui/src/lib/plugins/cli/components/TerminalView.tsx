'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Eraser, Layers, Pencil, Play, Plus, Search, X } from 'lucide-react'
import type { IProgressState } from '@xterm/addon-progress'
import type { CliServer, CliTerminalSession } from '../types/cli'
import { useCliSocket, type CliSocketHandlers } from '../hooks/useCliSocket'
import { useCliStore } from '../stores/cli-store'
import { ConnectionState } from '../types/connection'
import { nextSeq } from '../lib/protocol'
import { unwrapPayload } from '../lib/socket'
import { SessionManager } from '../services/session-manager'
import { EnhancedTerminal } from './EnhancedTerminal'
import { DangerCommandDialog } from './DangerCommandDialog'
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts'
import {
  hashScrollback,
  loadPersistedSessions,
  persistSessions,
  recoverSession,
} from '../services/session-persistence'
import { loadRecording, saveRecording } from '../services/recording-persistence'
import { sendBrowserNotification } from '../services/notification-service'
import { buildConversationSessionId, buildDefaultSessionId } from '../lib/session-id'
import { TerminalReplayDialog } from './TerminalReplayDialog'
import { BatchOperationsDialog } from './BatchOperationsDialog'
import { useToast } from '@/components/ui/toast'
import { listCliSessions, unbindCliServer, updateCliSession } from '@/lib/api/cli'
import { useActiveConversation, useProjectConversations } from '@/lib/stores/chat'
import { SpotlightCard } from '@/components/react-bits'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const MAX_RECORDING_ENTRIES = 4000

export function TerminalView({
  projectId,
  server,
  readOnly,
  canUnbind,
}: {
  projectId: string
  server: CliServer
  readOnly?: boolean
  canUnbind?: boolean
}) {
  const sessionManagerRef = useRef(new SessionManager())
  const [sessions, setSessions] = useState<CliTerminalSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const terminalWriterRef = useRef<(data: string, onComplete?: () => void) => void>(() => {})
  const terminalClearRef = useRef<() => void>(() => {})
  const terminalScrollRef = useRef<() => void>(() => {})
  const terminalFocusRef = useRef<() => void>(() => {})
  const terminalSizeRef = useRef<{ cols: number; rows: number } | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [progress, setProgress] = useState<IProgressState | null>(null)
  const [terminalReady, setTerminalReady] = useState(false)
  const [pendingDanger, setPendingDanger] = useState<{
    command: string
    sessionId: string
    operationId: string
    level?: string
    description?: string
    matchedPattern?: string
  } | null>(null)
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null)
  const [replayOpen, setReplayOpen] = useState(false)
  const [replayEntries, setReplayEntries] = useState<Array<{ ts: number; data: string }>>([])
  const [replayTitle, setReplayTitle] = useState('Terminal session')
  const [batchOpen, setBatchOpen] = useState(false)
  const [unbinding, setUnbinding] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingSessionName, setEditingSessionName] = useState('')
  const hasRestoredRef = useRef(false)
  const persistTimeoutRef = useRef<number | null>(null)
  const recordingPersistRef = useRef<Map<string, number>>(new Map())
  const lastStatusRef = useRef(server.status)
  const autoCreatedRef = useRef(false)
  const recordingRef = useRef<Map<string, Array<{ ts: number; data: string }>>>(new Map())
  const terminalSerializeRef = useRef<() => string>(() => '')
  const terminalResetProgressRef = useRef<() => void>(() => {})
  const recoveryInFlightRef = useRef<Set<string>>(new Set())
  const recoveryAttemptsRef = useRef<Map<string, number>>(new Map())
  const activeSessionIdRef = useRef<string | null>(null)
  const activeConversation = useActiveConversation()
  const projectConversations = useProjectConversations(projectId)
  const conversationId = useMemo(() => {
    if (activeConversation?.projectId === projectId) {
      return activeConversation.id
    }
    return projectConversations[0]?.id ?? null
  }, [activeConversation, projectConversations, projectId])

  const setConnectionStatus = useCliStore((state) => state.setConnectionStatus)
  const updateServerStatus = useCliStore((state) => state.updateServerStatus)
  const setSessionsInStore = useCliStore((state) => state.setSessions)
  const addNotification = useCliStore((state) => state.addNotification)
  const pushTelemetryPoint = useCliStore((state) => state.pushTelemetryPoint)
  const refreshServers = useCliStore((state) => state.refreshServers)
  const { addToast } = useToast()
  const handlersRef = useRef<CliSocketHandlers>({})
  const decoderRef = useRef<TextDecoder | null>(typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null)

  const writeToTerminal = useCallback((data: string, onComplete?: () => void) => {
    terminalWriterRef.current?.(data, onComplete)
  }, [])

  const clearTerminal = useCallback(() => {
    terminalClearRef.current?.()
  }, [])

  const handleUnbind = useCallback(async () => {
    if (!canUnbind || unbinding) return
    const confirmed = window.confirm(
      'Unbind this server? The CLI agent will disconnect and can be reconnected by logging in again.'
    )
    if (!confirmed) return
    setUnbinding(true)
    try {
      await unbindCliServer(projectId, server.id)
      await refreshServers()
      addToast({
        type: 'success',
        title: 'Server unbound',
        description: 'The CLI agent has been disconnected. Re-login to bind again.',
      })
    } catch {
      addToast({
        type: 'error',
        title: 'Unbind failed',
        description: 'Unable to unbind this server.',
      })
    } finally {
      setUnbinding(false)
    }
  }, [addToast, canUnbind, projectId, refreshServers, server.id, unbinding])

  const syncSessions = useCallback(() => {
    const updated = sessionManagerRef.current.getSessionsByServer(server.id)
    setSessions(updated)
    setSessionsInStore(server.id, updated)
    return updated
  }, [server.id, setSessionsInStore])

  const captureSerialized = useCallback(
    (sessionId: string | null) => {
      if (!sessionId) return
      const snapshot = terminalSerializeRef.current?.() ?? ''
      if (!snapshot) return
      if (snapshot.length > 200_000) return
      sessionManagerRef.current.setSerialized(sessionId, snapshot)
    },
    []
  )

  const flushRecording = useCallback(
    (sessionId: string) => {
      const entries = recordingRef.current.get(sessionId)
      if (!entries || entries.length === 0) return
      const session = sessionManagerRef.current.getSession(sessionId)
      saveRecording(sessionId, server.id, session?.name ?? 'Terminal session', entries)
    },
    [server.id]
  )

  const scheduleRecordingPersist = useCallback(
    (sessionId: string) => {
      const existing = recordingPersistRef.current.get(sessionId)
      if (existing) {
        window.clearTimeout(existing)
      }
      const timer = window.setTimeout(() => {
        flushRecording(sessionId)
        recordingPersistRef.current.delete(sessionId)
      }, 1200)
      recordingPersistRef.current.set(sessionId, timer)
    },
    [flushRecording]
  )

  const recordOutput = useCallback((sessionId: string, output: string) => {
    const now = Date.now()
    const existing = recordingRef.current.get(sessionId)
    if (!existing) {
      recordingRef.current.set(sessionId, [{ ts: now, data: output }])
      scheduleRecordingPersist(sessionId)
      return
    }
    existing.push({ ts: now, data: output })
    if (existing.length > MAX_RECORDING_ENTRIES) {
      existing.splice(0, existing.length - MAX_RECORDING_ENTRIES)
    }
    scheduleRecordingPersist(sessionId)
  }, [scheduleRecordingPersist])

  const socketHandlers = useMemo<CliSocketHandlers>(
    () => ({
      onTerminalOutput: (payload) => handlersRef.current.onTerminalOutput?.(payload),
      onStatusUpdate: (payload) => handlersRef.current.onStatusUpdate?.(payload),
      onConfirmRequired: (payload) => handlersRef.current.onConfirmRequired?.(payload),
      onBlocked: (payload) => handlersRef.current.onBlocked?.(payload),
      onSessionAttached: (payload) => handlersRef.current.onSessionAttached?.(payload),
      onSessionDetached: (payload) => handlersRef.current.onSessionDetached?.(payload),
      onSessionClosed: (payload) => handlersRef.current.onSessionClosed?.(payload),
      onSessionError: (payload) => handlersRef.current.onSessionError?.(payload),
      onError: (message) => handlersRef.current.onError?.(message),
    }),
    []
  )

  handlersRef.current = {
    onTerminalOutput: (payload) => {
      const rawSessionId = payload.session_id || (payload.payload as Record<string, unknown>)?.session_id
      const sessionId = typeof rawSessionId === 'string' ? rawSessionId : String(rawSessionId || '')
      if (!sessionId) return
      const rawData = (payload.payload as Record<string, unknown>)?.data
      let output = ''
      if (typeof rawData === 'string') {
        output = rawData
      } else if (rawData instanceof ArrayBuffer) {
        output = decoderRef.current?.decode(new Uint8Array(rawData)) ?? ''
      } else if (ArrayBuffer.isView(rawData)) {
        const view = rawData as ArrayBufferView
        output = decoderRef.current?.decode(new Uint8Array(view.buffer, view.byteOffset, view.byteLength)) ?? ''
      } else if (Array.isArray(rawData)) {
        try {
          output = decoderRef.current?.decode(new Uint8Array(rawData)) ?? ''
        } catch {
          output = String(rawData)
        }
      } else if (rawData != null) {
        output = String(rawData)
      }
      let session = sessionManagerRef.current.getSession(sessionId)
      if (!session) {
        sessionManagerRef.current.restoreSession({
          id: sessionId,
          serverId: server.id,
          name: `Terminal ${sessionManagerRef.current.getSessionsByServer(server.id).length + 1}`,
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
          state: 'active',
          scrollback: [],
          cols: terminalSizeRef.current?.cols ?? 120,
          rows: terminalSizeRef.current?.rows ?? 40,
          mode: 'terminal',
        })
        session = sessionManagerRef.current.getSession(sessionId)
        if (!activeSessionId) {
          setActiveSessionId(sessionId)
        }
      }
      sessionManagerRef.current.updateScrollback(sessionId, output)
      recordOutput(sessionId, output)
      if (sessionId === activeSessionId) {
        writeToTerminal(output, () => {
          terminalScrollRef.current?.()
        })
      }
      const updated = sessionManagerRef.current.getSessionsByServer(server.id)
      setSessions(updated)
      setSessionsInStore(server.id, updated)
    },
    onStatusUpdate: (payload) => {
      const payloadData = payload.payload as Record<string, unknown>
      const statusValue = payloadData?.status as string | undefined
      const lastSeenRaw = payloadData?.last_seen_at
      const lastSeenAt =
        typeof lastSeenRaw === 'string' && lastSeenRaw
          ? lastSeenRaw
          : typeof payload.ts === 'string' && payload.ts
            ? payload.ts
            : undefined
      if (statusValue) {
        const next = statusValue as CliServer['status']
        const previous = lastStatusRef.current
        if (next !== previous) {
          const title = next === 'online' ? 'CLI server online' : 'CLI server offline'
          addNotification({
            id: crypto.randomUUID(),
            title,
            body: `${server.name || server.hostname} is now ${next}`,
            level: next === 'online' ? 'success' : 'warning',
            createdAt: Date.now(),
          })
          sendBrowserNotification(title, `${server.name || server.hostname} is now ${next}`)
          lastStatusRef.current = next
        }
        updateServerStatus(server.id, next, lastSeenAt ?? null)
      } else if (lastSeenAt) {
        updateServerStatus(server.id, lastStatusRef.current, lastSeenAt)
      }
      const metricsPayload = payloadData?.metrics
      if (metricsPayload && typeof metricsPayload === 'object') {
        const metrics = metricsPayload as Record<string, unknown>
        const timestampRaw = metrics.timestamp
        const timestamp =
          typeof timestampRaw === 'string' && timestampRaw ? timestampRaw : new Date().toISOString()
        const parseNumber = (value: unknown) => {
          if (typeof value === 'number' && Number.isFinite(value)) return value
          if (typeof value === 'string') {
            const parsed = Number.parseFloat(value)
            return Number.isFinite(parsed) ? parsed : null
          }
          return null
        }
        const point = {
          timestamp,
          cpu_percent: parseNumber(metrics.cpu_percent),
          mem_used_mb: parseNumber(metrics.mem_used_mb),
          mem_total_mb: parseNumber(metrics.mem_total_mb),
          mem_percent: parseNumber(metrics.mem_percent),
          disk_used_gb: parseNumber(metrics.disk_used_gb),
          disk_total_gb: parseNumber(metrics.disk_total_gb),
          disk_percent: parseNumber(metrics.disk_percent),
          gpu: Array.isArray(metrics.gpu)
            ? metrics.gpu.map((gpu) => ({
                index: Number.parseInt(String((gpu as Record<string, unknown>)?.index ?? 0), 10),
                name: (gpu as Record<string, unknown>)?.name as string | null,
                uuid: (gpu as Record<string, unknown>)?.uuid as string | null,
                utilization_gpu: parseNumber((gpu as Record<string, unknown>)?.utilization_gpu),
                utilization_memory: parseNumber((gpu as Record<string, unknown>)?.utilization_memory),
                memory_total_mb: parseNumber((gpu as Record<string, unknown>)?.memory_total_mb),
                memory_used_mb: parseNumber((gpu as Record<string, unknown>)?.memory_used_mb),
                memory_free_mb: parseNumber((gpu as Record<string, unknown>)?.memory_free_mb),
              }))
            : null,
        }
        pushTelemetryPoint(server.id, point)
      }
    },
    onConfirmRequired: (payload) => {
      const innerPayload = payload.payload as Record<string, unknown>
      const command = String(innerPayload?.command || '')
      const danger = (innerPayload?.danger || {}) as Record<string, unknown>
      const sessionId = payload.session_id || String(innerPayload?.session_id || '')
      if (!sessionId) return
      const session = sessionManagerRef.current.getSession(String(sessionId))
      if (session?.mode === 'ui') return
      setPendingDanger({
        command,
        sessionId: String(sessionId),
        operationId: payload.operation_id || crypto.randomUUID(),
        level: danger?.level ? String(danger.level) : undefined,
        description: danger?.description ? String(danger.description) : undefined,
        matchedPattern: danger?.matched_pattern ? String(danger.matched_pattern) : undefined,
      })
    },
    onBlocked: (payload) => {
      const innerPayload = payload.payload as Record<string, unknown>
      const command = String(innerPayload?.command || '')
      const danger = (innerPayload?.danger || {}) as Record<string, unknown>
      const sessionId = payload.session_id || String(innerPayload?.session_id || '')
      const session = sessionManagerRef.current.getSession(String(sessionId))
      if (session?.mode === 'ui') return
      setBlockedNotice(
        danger?.description ? String(danger.description) : 'Command was blocked for safety.'
      )
      addToast({
        type: 'warning',
        title: 'Command blocked',
        description: command ? `${command} was blocked.` : 'Command was blocked.',
      })
    },
    onSessionAttached: (payload) => {
      const inner = unwrapPayload(payload) as Record<string, unknown>
      const sessionId = String(inner?.sessionId || inner?.session_id || '')
      const scrollback = inner?.scrollback as string[] | undefined
      if (!sessionId) return
      if (Array.isArray(scrollback)) {
        sessionManagerRef.current.setScrollback(sessionId, scrollback)
      }
      const updated = sessionManagerRef.current.getSessionsByServer(server.id)
      setSessions(updated)
      setSessionsInStore(server.id, updated)
    },
    onSessionDetached: (payload) => {
      const inner = unwrapPayload(payload) as Record<string, unknown>
      const sessionId = String(inner?.sessionId || inner?.session_id || '')
      if (!sessionId) return
      sessionManagerRef.current.detachSession(sessionId)
      const updated = sessionManagerRef.current.getSessionsByServer(server.id)
      setSessions(updated)
      setSessionsInStore(server.id, updated)
    },
    onSessionClosed: (payload) => {
      const inner = unwrapPayload(payload) as Record<string, unknown>
      const sessionId = String(inner?.sessionId || inner?.session_id || '')
      if (!sessionId) return
      sessionManagerRef.current.closeSession(sessionId)
      flushRecording(sessionId)
      recordingRef.current.delete(sessionId)
      const updated = sessionManagerRef.current.getSessionsByServer(server.id)
      setSessions(updated)
      setSessionsInStore(server.id, updated)
      if (activeSessionId === sessionId) {
        setActiveSessionId(sessionManagerRef.current.getState().activeSessionId)
      }
    },
    onSessionError: (payload) => {
      const inner = unwrapPayload(payload) as Record<string, unknown>
      console.warn('[CLI] Session error:', inner)
    },
    onError: (message) => {
      const text = message || 'CLI server error'
      addToast({
        type: 'error',
        title: 'CLI server error',
        description: text,
      })
    },
  }

  const { socket, status, sendTerminalInput, sendTerminalResize, emitEnvelope } = useCliSocket({
    projectId,
    serverId: server.id,
    handlers: socketHandlers,
  })

  const requestSessionRecovery = useCallback(
    async (sessionId: string, options?: { force?: boolean }) => {
      if (status.state !== ConnectionState.CONNECTED) return
      if (recoveryInFlightRef.current.has(sessionId)) return
      const session = sessionManagerRef.current.getSession(sessionId)
      if (!session) return
      if (!options?.force && (session.scrollback.length > 0 || session.serialized)) return
      const now = Date.now()
      const lastAttempt = recoveryAttemptsRef.current.get(sessionId) ?? 0
      if (!options?.force && now - lastAttempt < 3000) return
      recoveryAttemptsRef.current.set(sessionId, now)
      recoveryInFlightRef.current.add(sessionId)

      try {
        const scrollbackHash = session.scrollback.length > 0 ? hashScrollback(session.scrollback) : ''
        const result = await recoverSession(
          socket,
          {
            sessionId,
            serverId: server.id,
            scrollbackHash,
          },
          { timeoutMs: 5000 }
        )
        if (result.recovered && result.scrollback) {
          sessionManagerRef.current.setScrollback(sessionId, result.scrollback)
          const updated = sessionManagerRef.current.getSessionsByServer(server.id)
          setSessions(updated)
          setSessionsInStore(server.id, updated)
          if (sessionId === activeSessionId && terminalReady) {
            clearTerminal()
            writeToTerminal(result.scrollback.join('\n') + '\n', () => {
              terminalScrollRef.current?.()
              terminalFocusRef.current?.()
            })
          }
        }
      } finally {
        recoveryInFlightRef.current.delete(sessionId)
      }
    },
    [
      activeSessionId,
      clearTerminal,
      server.id,
      setSessionsInStore,
      socket,
      status.state,
      terminalReady,
      writeToTerminal,
    ]
  )

  useEffect(() => {
    setConnectionStatus(status)
  }, [status, setConnectionStatus])

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId
  }, [activeSessionId])

  useEffect(() => {
    hasRestoredRef.current = false
    autoCreatedRef.current = false
    const existing = sessionManagerRef.current.getSessionsByServer(server.id)
    setSessions(existing)
    setActiveSessionId(existing[0]?.id ?? null)
    lastStatusRef.current = server.status
  }, [server.id])

  useEffect(() => {
    if (persistTimeoutRef.current) {
      window.clearTimeout(persistTimeoutRef.current)
    }
    persistTimeoutRef.current = window.setTimeout(() => {
      persistSessions(sessionManagerRef.current.getSessionsByServer(server.id))
    }, 1000)

    return () => {
      if (persistTimeoutRef.current) {
        window.clearTimeout(persistTimeoutRef.current)
      }
    }
  }, [sessions, server.id])

  useEffect(() => {
    return () => {
      recordingPersistRef.current.forEach((timer) => window.clearTimeout(timer))
      recordingPersistRef.current.clear()
    }
  }, [server.id])

  useEffect(() => {
    return () => {
      const sessionId = activeSessionIdRef.current
      if (sessionId) {
        captureSerialized(sessionId)
        flushRecording(sessionId)
      }
      persistSessions(sessionManagerRef.current.getSessionsByServer(server.id))
    }
  }, [captureSerialized, flushRecording, server.id])

  const activeSession = useMemo(
    () => (activeSessionId ? sessionManagerRef.current.getSession(activeSessionId) : null),
    [activeSessionId]
  )
  const terminalAppearance = activeSession?.mode === 'ui' ? 'ui' : 'terminal'

  const handleOpenReplay = useCallback(() => {
    if (!activeSessionId) return
    const session = sessionManagerRef.current.getSession(activeSessionId)
    const inMemory = recordingRef.current.get(activeSessionId) ?? []
    const persisted = inMemory.length === 0 ? loadRecording(activeSessionId) : null
    const entries = inMemory.length > 0 ? inMemory : persisted?.entries ?? []
    setReplayEntries([...entries])
    setReplayTitle(session?.name ?? persisted?.title ?? 'Terminal session')
    setReplayOpen(true)
  }, [activeSessionId])

  const createSession = useCallback((options?: { id?: string; name?: string; mode?: 'terminal' | 'ui'; cols?: number; rows?: number }) => {
    try {
      if (activeSessionId) {
        captureSerialized(activeSessionId)
      }
      clearTerminal()
      const nextSize = terminalSizeRef.current
      const session = sessionManagerRef.current.createSession(server.id, {
        id: options?.id,
        name: options?.name,
        mode: options?.mode,
        cols: options?.cols ?? nextSize?.cols,
        rows: options?.rows ?? nextSize?.rows,
      })
      const updated = sessionManagerRef.current.getSessionsByServer(server.id)
      setSessions(updated)
      setSessionsInStore(server.id, updated)
      setActiveSessionId(session.id)
      const payload: Record<string, unknown> = {
        session_id: session.id,
        cols: session.cols,
        rows: session.rows,
      }
      if (projectId) {
        payload.project_id = projectId
      }
      if (session.name) {
        payload.name = session.name
      }
      if (session.mode === 'ui') {
        payload.mode = 'ui'
      }
      emitEnvelope(
        'cli:session:create',
        payload,
        { session_id: session.id }
      )
      return session
    } catch (error) {
      console.error('[CLI] Failed to create session:', error)
      return null
    }
  }, [activeSessionId, captureSerialized, clearTerminal, emitEnvelope, server.id, setSessionsInStore])

  const ensureDefaultSession = useCallback(async () => {
    if (!projectId) return null
    const defaultSessionId = await buildDefaultSessionId(projectId, server.id)
    const existing = sessionManagerRef.current.getSession(defaultSessionId)
    if (existing && existing.state !== 'closed') {
      setActiveSessionId(existing.id)
      return existing
    }
    return createSession({ id: defaultSessionId })
  }, [createSession, projectId, server.id])

  const ensureConversationSession = useCallback(async () => {
    if (!projectId || !conversationId) return null
    const conversationSessionId = await buildConversationSessionId(projectId, server.id, conversationId)
    const existing = sessionManagerRef.current.getSession(conversationSessionId)
    if (existing && existing.state !== 'closed') {
      setActiveSessionId(existing.id)
      return existing
    }
    return createSession({ id: conversationSessionId, name: 'Conversation session' })
  }, [conversationId, createSession, projectId, server.id])

  useEffect(() => {
    if (status.state !== ConnectionState.CONNECTED) return
    if (hasRestoredRef.current) return
    hasRestoredRef.current = true

    const restore = async () => {
      const toMillis = (value?: string | null) => {
        if (!value) return Date.now()
        const parsed = Date.parse(value)
        return Number.isFinite(parsed) ? parsed : Date.now()
      }

      try {
        const remote = await listCliSessions(projectId, server.id)
        if (remote.length > 0) {
          const persisted = loadPersistedSessions().filter((session) => session.serverId === server.id)
          const persistedById = new Map(persisted.map((session) => [session.sessionId, session]))
          const existing = sessionManagerRef.current.getSessionsByServer(server.id)
          const remoteIds = new Set(remote.map((session) => session.id))
          existing.forEach((session) => {
            if (!remoteIds.has(session.id)) {
              sessionManagerRef.current.closeSession(session.id)
            }
          })
          remote.forEach((session) => {
            const scrollback = Array.isArray(session.scrollback) ? session.scrollback : []
            const persistedSession = persistedById.get(session.id)
            const serialized = scrollback.length === 0 ? persistedSession?.serialized : undefined
            sessionManagerRef.current.restoreSession({
              id: session.id,
              serverId: server.id,
              name: session.name || 'Terminal',
              createdAt: toMillis(session.connected_at),
              lastActiveAt: toMillis(session.last_active_at || session.connected_at),
              state: (session.state as 'active' | 'detached' | 'closed') || 'active',
              scrollback,
              cols: session.cols ?? terminalSizeRef.current?.cols ?? 120,
              rows: session.rows ?? terminalSizeRef.current?.rows ?? 40,
              mode: session.session_type === 'ui' ? 'ui' : 'terminal',
              cwd: session.cwd ?? undefined,
              shell: session.shell ?? undefined,
              serialized,
            })
          })
          const updated = sessionManagerRef.current.getSessionsByServer(server.id)
          if (updated.length === 0) {
            await ensureDefaultSession()
            return
          }
          setSessions(updated)
          setSessionsInStore(server.id, updated)
          setActiveSessionId(updated[0]?.id ?? null)
          return
        }
      } catch (error) {
        console.warn('[CLI] Failed to load sessions from API:', error)
      }

      const persisted = loadPersistedSessions().filter((session) => session.serverId === server.id)
      if (persisted.length === 0) {
        if (sessionManagerRef.current.getSessionsByServer(server.id).length === 0) {
          await ensureDefaultSession()
        }
        return
      }

      for (const persistedSession of persisted) {
        const result = await recoverSession(socket, {
          sessionId: persistedSession.sessionId,
          serverId: persistedSession.serverId,
          scrollbackHash: persistedSession.serialized ? persistedSession.scrollbackHash : '',
        })
        if (!result.recovered) continue
        sessionManagerRef.current.restoreSession({
          id: persistedSession.sessionId,
          serverId: persistedSession.serverId,
          name: persistedSession.name,
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
          state: 'active',
          scrollback: result.scrollback || [],
          cols: persistedSession.cols,
          rows: persistedSession.rows,
          mode: persistedSession.mode,
          cwd: persistedSession.cwd,
          shell: persistedSession.shell,
          serialized: persistedSession.serialized,
        })
      }

      const updated = sessionManagerRef.current.getSessionsByServer(server.id)
      if (updated.length === 0) {
        await ensureDefaultSession()
        return
      }
      setSessions(updated)
      setSessionsInStore(server.id, updated)
      setActiveSessionId(updated[0]?.id ?? null)
    }

    void restore()
  }, [projectId, status.state, server.id, socket, createSession, ensureDefaultSession, setSessionsInStore])

  useEffect(() => {
    if (autoCreatedRef.current) return
    if (sessions.length > 0 || activeSessionId) return
    autoCreatedRef.current = true
    if (conversationId) {
      void ensureConversationSession()
    } else {
      void ensureDefaultSession()
    }
  }, [activeSessionId, conversationId, ensureConversationSession, ensureDefaultSession, sessions.length])

  const restoreActiveSession = useCallback(() => {
    if (!activeSession || !terminalReady) return
    clearTerminal()
    const serialized = activeSession.serialized
    const scrollback = activeSession.scrollback
    if (serialized) {
      writeToTerminal(serialized, () => {
        terminalScrollRef.current?.()
        terminalFocusRef.current?.()
      })
    } else if (scrollback.length > 0) {
      writeToTerminal(scrollback.join('\n') + '\n', () => {
        terminalScrollRef.current?.()
        terminalFocusRef.current?.()
      })
    } else {
      terminalScrollRef.current?.()
      terminalFocusRef.current?.()
    }
    setProgress(null)
    terminalResetProgressRef.current?.()
  }, [activeSession, clearTerminal, terminalReady, writeToTerminal])

  useEffect(() => {
    restoreActiveSession()
  }, [restoreActiveSession])

  useEffect(() => {
    if (!terminalReady || !activeSessionId) return
    void requestSessionRecovery(activeSessionId)
  }, [activeSessionId, requestSessionRecovery, terminalReady])

  const handleSwitchSession = useCallback(
    (sessionId: string) => {
      if (sessionId === activeSessionId) return
      if (editingSessionId === sessionId) return
      captureSerialized(activeSessionId)
      clearTerminal()
      if (activeSessionId) {
        const previous = sessionManagerRef.current.getSession(activeSessionId)
        if (previous?.state === 'active') {
          sessionManagerRef.current.detachSession(activeSessionId)
          emitEnvelope('cli:session:detach', { session_id: activeSessionId }, { session_id: activeSessionId })
        }
      }
      const attached = sessionManagerRef.current.attachSession(sessionId)
      if (!attached) {
        sessionManagerRef.current.switchSession(sessionId)
      }
      emitEnvelope('cli:session:attach', { session_id: sessionId }, { session_id: sessionId })
      const updated = sessionManagerRef.current.getSessionsByServer(server.id)
      setSessions(updated)
      setSessionsInStore(server.id, updated)
      setActiveSessionId(sessionId)
    },
    [activeSessionId, editingSessionId, emitEnvelope, server.id, setSessionsInStore]
  )

  const handleCloseSession = useCallback(
    (sessionId: string) => {
      const session = sessionManagerRef.current.getSession(sessionId)
      if (!session) return
      captureSerialized(sessionId)
      if (sessionId === activeSessionId) {
        clearTerminal()
      }
      sessionManagerRef.current.closeSession(sessionId)
      emitEnvelope('cli:session:close', { session_id: sessionId }, { session_id: sessionId })
      flushRecording(sessionId)
      recordingRef.current.delete(sessionId)
      const updated = syncSessions()
      const nextActive = sessionManagerRef.current.getState().activeSessionId
      setActiveSessionId(nextActive)
      if (!nextActive && updated.length === 0) {
        clearTerminal()
      }
      if (editingSessionId === sessionId) {
        setEditingSessionId(null)
        setEditingSessionName('')
      }
    },
    [captureSerialized, clearTerminal, emitEnvelope, editingSessionId, flushRecording, syncSessions]
  )

  const startEditingSession = useCallback((sessionId: string, name: string) => {
    setEditingSessionId(sessionId)
    setEditingSessionName(name)
  }, [])

  const commitSessionRename = useCallback(
    (sessionId: string, nextName: string) => {
      const session = sessionManagerRef.current.getSession(sessionId)
      if (!session) {
        setEditingSessionId(null)
        setEditingSessionName('')
        return
      }
      const trimmed = nextName.trim()
      const finalName = trimmed || session.name || 'Terminal'
      if (finalName !== session.name) {
        sessionManagerRef.current.renameSession(sessionId, finalName)
        syncSessions()
        if (!readOnly) {
          updateCliSession(projectId, server.id, sessionId, { name: finalName }).catch(() => {
            addToast({
              type: 'warning',
              title: 'Session rename failed',
              description: 'Unable to persist the session name. Changes are local only.',
            })
          })
        }
      }
      setEditingSessionId(null)
      setEditingSessionName('')
    },
    [addToast, projectId, readOnly, server.id, syncSessions]
  )

  const cancelSessionRename = useCallback(() => {
    setEditingSessionId(null)
    setEditingSessionName('')
  }, [])

  const handleNewSession = useCallback(() => {
    if (conversationId) {
      void ensureConversationSession()
      return
    }
    createSession()
  }, [conversationId, createSession, ensureConversationSession])

  useGlobalShortcuts({
    onClear: clearTerminal,
    onNewSession: handleNewSession,
    onCloseSession: () => {
      if (!activeSessionId) return
      handleCloseSession(activeSessionId)
    },
    onSearch: () => setSearchOpen(true),
  })

  const handleInput = useCallback(
    (data: string) => {
      if (readOnly || !activeSessionId) return
      const operationId = crypto.randomUUID()
      const mode = activeSession?.mode
      sendTerminalInput({
        data,
        sessionId: activeSessionId,
        seq: nextSeq(),
        operationId,
        mode,
      })
    },
    [readOnly, activeSessionId, sendTerminalInput, activeSession]
  )

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      terminalSizeRef.current = { cols, rows }
      if (!activeSessionId) return
      sendTerminalResize({ cols, rows, sessionId: activeSessionId })
    },
    [activeSessionId, sendTerminalResize]
  )

  const handleProgress = useCallback((state: IProgressState) => {
    if (state.state === 0) {
      setProgress(null)
      return
    }
    setProgress(state)
  }, [])

  const progressLabel = useMemo(() => {
    if (!progress) return null
    if (progress.state === 3) return 'Running…'
    return `${Math.round(progress.value)}%`
  }, [progress])

  const progressClass = useMemo(() => {
    if (!progress) return ''
    if (progress.state === 2) return 'bg-[var(--cli-status-error)] text-[var(--cli-ink-0)]'
    if (progress.state === 4) return 'bg-[var(--cli-status-warning)] text-[var(--cli-ink-0)]'
    if (progress.state === 3) return 'bg-[var(--cli-status-warning)] text-[var(--cli-ink-0)]'
    return 'bg-[var(--cli-accent-emerald)] text-[var(--cli-ink-0)]'
  }, [progress])

  const sidebarWidthClass = sidebarCollapsed ? 'w-14' : 'w-56'

  return (
    <div className="flex h-full min-h-0 flex-col">
      {readOnly ? (
        <SpotlightCard className="mb-3 rounded-xl border border-white/40 bg-white/70 px-4 py-2 text-xs text-[var(--cli-muted-1)]">
          Read-only access. Terminal input is disabled.
        </SpotlightCard>
      ) : null}
      {blockedNotice ? (
        <SpotlightCard className="mb-3 rounded-xl border border-white/40 bg-white/70 px-4 py-2 text-xs text-[var(--cli-muted-1)]">
          {blockedNotice}
        </SpotlightCard>
      ) : null}

      <div className="flex min-h-0 flex-1 gap-3">
        <div className={`flex ${sidebarWidthClass} shrink-0 flex-col gap-3`}>
          {sidebarCollapsed ? (
            <SpotlightCard className="cli-card flex min-h-0 flex-1 flex-col items-center rounded-2xl border border-white/40 bg-white/70 px-2 py-3">
              <button
                type="button"
                className="cli-focus-ring rounded-full border border-white/60 bg-white/80 p-2 text-[var(--cli-muted-1)] hover:text-[var(--cli-ink-1)]"
                onClick={() => setSidebarCollapsed(false)}
                title="Expand sessions panel"
                aria-label="Expand sessions panel"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="mt-3 flex flex-1 flex-col items-center gap-2 overflow-auto">
                {sessions.map((session) => {
                  const isActive = session.id === activeSessionId
                  const label = (session.name || 'Terminal').slice(0, 2).toUpperCase()
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => handleSwitchSession(session.id)}
                      aria-pressed={isActive}
                      title={session.name || 'Terminal'}
                      className={`cli-focus-ring flex h-9 w-9 items-center justify-center rounded-xl text-[10px] font-semibold transition ${
                        isActive
                          ? 'bg-[var(--cli-accent-olive)] text-[var(--cli-ink-0)]'
                          : 'bg-white/70 text-[var(--cli-muted-1)] hover:text-[var(--cli-ink-1)]'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                className="cli-focus-ring mt-3 flex h-9 w-9 items-center justify-center rounded-xl border border-white/40 bg-white/60 text-[var(--cli-muted-1)] hover:text-[var(--cli-ink-1)]"
                onClick={handleNewSession}
                title="New session"
                aria-label="Create new session"
              >
                <Plus className="h-4 w-4" />
              </button>
              <div className="mt-3 flex flex-col items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="cli-focus-ring flex h-9 w-9 items-center justify-center rounded-xl border border-white/40 bg-white/70 text-[var(--cli-muted-1)] hover:text-[var(--cli-ink-1)]"
                      title="Actions"
                      aria-label="Actions"
                    >
                      <Layers className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={handleOpenReplay}
                      disabled={!activeSession?.scrollback.length}
                    >
                      <Play className="mr-2 h-3.5 w-3.5" />
                      Replay session
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setBatchOpen(true)} disabled={readOnly}>
                      <Layers className="mr-2 h-3.5 w-3.5" />
                      Batch operations
                    </DropdownMenuItem>
                    {canUnbind ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => void handleUnbind()} disabled={unbinding}>
                          <X className="mr-2 h-3.5 w-3.5" />
                          Unbind server
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  type="button"
                  className="cli-focus-ring flex h-9 w-9 items-center justify-center rounded-xl border border-white/40 bg-white/70 text-[var(--cli-muted-1)] hover:text-[var(--cli-ink-1)]"
                  onClick={() => setSearchOpen((prev) => !prev)}
                  title="Search output"
                  aria-label="Search output"
                >
                  <Search className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="cli-focus-ring flex h-9 w-9 items-center justify-center rounded-xl border border-white/40 bg-white/70 text-[var(--cli-muted-1)] hover:text-[var(--cli-ink-1)]"
                  onClick={clearTerminal}
                  title="Clear output"
                  aria-label="Clear output"
                >
                  <Eraser className="h-4 w-4" />
                </button>
              </div>
            </SpotlightCard>
          ) : (
            <>
              <SpotlightCard className="cli-card flex min-h-0 flex-1 flex-col rounded-2xl border border-white/40 bg-white/70 px-3 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-[var(--cli-ink-1)]">Sessions</div>
                  <button
                    type="button"
                    className="cli-focus-ring rounded-full border border-white/60 bg-white/80 p-1.5 text-[var(--cli-muted-1)] hover:text-[var(--cli-ink-1)]"
                    onClick={() => setSidebarCollapsed(true)}
                    title="Collapse sessions panel"
                    aria-label="Collapse sessions panel"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-3 flex flex-1 flex-col gap-2 overflow-auto pr-1">
                  {sessions.map((session) => {
                    const isActive = session.id === activeSessionId
                    const isEditing = session.id === editingSessionId
                    return (
                      <div key={session.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => handleSwitchSession(session.id)}
                          onDoubleClick={() => startEditingSession(session.id, session.name)}
                          aria-pressed={isActive}
                          className={`cli-focus-ring w-full rounded-xl px-3 py-2 pr-10 text-left text-xs font-medium transition ${
                            isActive
                              ? 'bg-[var(--cli-accent-olive)] text-[var(--cli-ink-0)]'
                              : 'bg-white/60 text-[var(--cli-muted-1)] hover:text-[var(--cli-ink-1)]'
                          }`}
                        >
                          {isEditing ? (
                            <input
                              className="w-full rounded-lg border border-white/50 bg-white/80 px-2 py-1 text-xs text-[var(--cli-ink-1)] outline-none focus:ring-2 focus:ring-[var(--cli-accent-olive)]"
                              value={editingSessionName}
                              onChange={(event) => setEditingSessionName(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  commitSessionRename(session.id, editingSessionName)
                                }
                                if (event.key === 'Escape') {
                                  event.preventDefault()
                                  cancelSessionRename()
                                }
                              }}
                              onBlur={() => commitSessionRename(session.id, editingSessionName)}
                              onClick={(event) => event.stopPropagation()}
                              autoFocus
                            />
                          ) : (
                            session.name
                          )}
                        </button>
                        {!isEditing ? (
                          <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                            <button
                              type="button"
                              className="cli-focus-ring rounded-full border border-white/40 bg-white/80 p-1 text-[var(--cli-muted-1)] hover:text-[var(--cli-ink-1)]"
                              onClick={(event) => {
                                event.stopPropagation()
                                startEditingSession(session.id, session.name)
                              }}
                              aria-label="Rename session"
                              title="Rename session"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              className="cli-focus-ring rounded-full border border-white/40 bg-white/80 p-1 text-[var(--cli-status-error)] hover:text-[var(--cli-status-error)]"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleCloseSession(session.id)
                              }}
                              aria-label="Close session"
                              title="Close session"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
                <button
                  type="button"
                  className="cli-focus-ring mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/60 px-3 py-2 text-xs text-[var(--cli-muted-1)] hover:text-[var(--cli-ink-1)]"
                  onClick={handleNewSession}
                  title="New session"
                  aria-label="Create new session"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New session
                </button>
              </SpotlightCard>

              <SpotlightCard className="cli-card shrink-0 rounded-2xl border border-white/40 bg-white/70 px-3 py-3">
                <div className="text-xs font-semibold text-[var(--cli-ink-1)]">Controls</div>
                <div className="mt-3 flex flex-col gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="secondary" className="h-8 w-full justify-start rounded-xl px-3 text-[11px]">
                        Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onClick={handleOpenReplay}
                        disabled={!activeSession?.scrollback.length}
                      >
                        <Play className="mr-2 h-3.5 w-3.5" />
                        Replay session
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setBatchOpen(true)} disabled={readOnly}>
                        <Layers className="mr-2 h-3.5 w-3.5" />
                        Batch operations
                      </DropdownMenuItem>
                      {canUnbind ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => void handleUnbind()} disabled={unbinding}>
                            <X className="mr-2 h-3.5 w-3.5" />
                            Unbind server
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-3 space-y-2 text-[11px] text-[var(--cli-muted-1)]">
                  <div className="rounded-full border border-white/40 bg-white/70 px-2 py-0.5 text-center">
                    {status.state} · {status.latencyMs ? `${status.latencyMs} ms` : '–'}
                  </div>
                  {progressLabel ? (
                    <div className={`rounded-full px-2 py-0.5 text-center text-[10px] font-medium ${progressClass}`}>
                      Progress: {progressLabel}
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    className="cli-focus-ring rounded-full border border-white/40 bg-white/80 p-2 text-[var(--cli-muted-1)] hover:text-[var(--cli-ink-1)]"
                    onClick={() => setSearchOpen((prev) => !prev)}
                    title="Search output"
                    aria-label="Search output"
                  >
                    <Search className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="cli-focus-ring rounded-full border border-white/40 bg-white/80 p-2 text-[var(--cli-muted-1)] hover:text-[var(--cli-ink-1)]"
                    onClick={clearTerminal}
                    title="Clear output"
                    aria-label="Clear output"
                  >
                    <Eraser className="h-3.5 w-3.5" />
                  </button>
                </div>
              </SpotlightCard>
            </>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 min-h-0">
            <EnhancedTerminal
              onInput={handleInput}
              onResize={handleResize}
              onProgress={handleProgress}
              appearance={terminalAppearance}
              searchOpen={searchOpen}
              onSearchOpenChange={setSearchOpen}
              onReady={({ write, clear, serialize, resetProgress, scrollToBottom, focus }) => {
                terminalWriterRef.current = write
                terminalClearRef.current = clear
                terminalSerializeRef.current = serialize
                terminalResetProgressRef.current = resetProgress
                terminalScrollRef.current = scrollToBottom
                terminalFocusRef.current = focus
                setTerminalReady(true)
              }}
            />
          </div>
        </div>
      </div>

      <TerminalReplayDialog
        open={replayOpen}
        onOpenChange={setReplayOpen}
        entries={replayEntries}
        title={replayTitle}
      />

      <BatchOperationsDialog
        open={batchOpen}
        onOpenChange={setBatchOpen}
        projectId={projectId}
        activeServerId={server.id}
      />

      <DangerCommandDialog
        open={Boolean(pendingDanger)}
        command={pendingDanger?.command || ''}
        level={pendingDanger?.level}
        description={pendingDanger?.description}
        matchedPattern={pendingDanger?.matchedPattern}
        onCancel={() => setPendingDanger(null)}
        onConfirm={() => {
          if (!pendingDanger) return
          sendTerminalInput({
            data: pendingDanger.command,
            sessionId: pendingDanger.sessionId,
            seq: nextSeq(),
            operationId: pendingDanger.operationId,
            confirmed: true,
          })
          setPendingDanger(null)
        }}
      />
    </div>
  )
}
