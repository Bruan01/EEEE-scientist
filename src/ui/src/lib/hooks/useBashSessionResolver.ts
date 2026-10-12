'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BashSession } from '@/lib/types/bash'
import { useBashSessionStream } from '@/lib/hooks/useBashSessionStream'

const DEFAULT_WINDOW_MS = 30000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const normalizeCommand = (value?: string | null) => {
  if (!value) return ''
  return value.replace(/\s*\n\s*/g, ' ').trim()
}

const normalizeWorkdir = (value?: string | null) => {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed || trimmed === '.') return ''
  return trimmed.replace(/^\.\//, '')
}

const parseTimestampMs = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.round(value * 1000)
}

const normalizeSessionId = (value?: string | null) => {
  if (!value) return { raw: '', uuid: null as string | null }
  const trimmed = value.trim()
  if (!trimmed) return { raw: '', uuid: null }
  return {
    raw: trimmed,
    uuid: UUID_RE.test(trimmed) ? trimmed : null,
  }
}

export function useBashSessionResolver({
  projectId,
  chatSessionId,
  agentInstanceId,
  agentId,
  command,
  workdir,
  timestamp,
  enabled = true,
  windowMs = DEFAULT_WINDOW_MS,
  keepAlive = false,
  preferChatSession = true,
}: {
  projectId?: string | null
  chatSessionId?: string | null
  agentInstanceId?: string | null
  agentId?: string | null
  command?: string | null
  workdir?: string | null
  timestamp?: number | null
  enabled?: boolean
  windowMs?: number
  keepAlive?: boolean
  preferChatSession?: boolean
}) {
  const normalizedCommand = useMemo(() => normalizeCommand(command), [command])
  const normalizedWorkdir = useMemo(() => normalizeWorkdir(workdir), [workdir])
  const toolTimestampMs = useMemo(() => parseTimestampMs(timestamp), [timestamp])
  const normalizedSessionId = useMemo(() => normalizeSessionId(chatSessionId), [chatSessionId])
  const rawChatSessionId = normalizedSessionId.raw
  const hasChatSessionId = Boolean(rawChatSessionId)
  const resolverKey = useMemo(
    () =>
      [
        projectId ?? '',
        rawChatSessionId,
        agentInstanceId ?? '',
        agentId ?? '',
        normalizedCommand,
        normalizedWorkdir,
        toolTimestampMs ?? '',
      ].join('|'),
    [
      agentId,
      agentInstanceId,
      normalizedCommand,
      normalizedWorkdir,
      projectId,
      rawChatSessionId,
      toolTimestampMs,
    ]
  )
  const startRef = useRef<number | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const [active, setActive] = useState(false)
  const [resolvedSession, setResolvedSession] = useState<BashSession | null>(null)
  const [exhausted, setExhausted] = useState(false)

  const clearTimeoutRef = useCallback(() => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    clearTimeoutRef()
    const hasSignal = Boolean(
      normalizedCommand ||
        normalizedWorkdir ||
        agentInstanceId ||
        agentId ||
        rawChatSessionId
    )
    if (!enabled || !projectId || !hasSignal) {
      setActive(false)
      setResolvedSession(null)
      setExhausted(false)
      startRef.current = null
      return
    }
    setActive(true)
    setResolvedSession(null)
    setExhausted(false)
    startRef.current = Date.now()
    return () => {
      clearTimeoutRef()
    }
  }, [
    agentId,
    agentInstanceId,
    clearTimeoutRef,
    enabled,
    normalizedCommand,
    normalizedWorkdir,
    projectId,
    rawChatSessionId,
    resolverKey,
  ])

  useEffect(() => {
    clearTimeoutRef()
    if (!active) return
    if (keepAlive) return
    timeoutRef.current = window.setTimeout(() => {
      setActive(false)
      setExhausted(true)
    }, windowMs)
    return () => {
      clearTimeoutRef()
    }
  }, [active, clearTimeoutRef, keepAlive, windowMs])

  const streamChatSessionId = preferChatSession ? normalizedSessionId.uuid ?? undefined : undefined
  const streamAgentInstanceIds = !streamChatSessionId && agentInstanceId ? [agentInstanceId] : undefined
  const streamAgentIds =
    !streamChatSessionId && !agentInstanceId && agentId ? [agentId] : undefined

  const { sessions, connection } = useBashSessionStream({
    projectId,
    chatSessionId: streamChatSessionId,
    agentInstanceIds: streamAgentInstanceIds,
    agentIds: streamAgentIds,
    enabled: active,
    limit: 200,
  })

  useEffect(() => {
    if (!active) return
    if (!sessions || sessions.length === 0) return
    const matchesChatSession = (session: BashSession) => {
      if (!hasChatSessionId) return true
      return (
        session.chat_session_id === rawChatSessionId ||
        session.task_id === rawChatSessionId
      )
    }
    const selectSessionMatches = (items: BashSession[]) => {
      if (!hasChatSessionId) return items
      const matched = items.filter((session) => matchesChatSession(session))
      return matched.length > 0 ? matched : items
    }
    const baseSessions = preferChatSession ? selectSessionMatches(sessions) : sessions
    const applyFilters = (
      items: BashSession[],
      options?: {
        includeAgent?: boolean
        includeWorkdir?: boolean
        includeCommand?: boolean
        includeSession?: boolean
      }
    ) => {
      const includeAgent = options?.includeAgent ?? true
      const includeCommand = options?.includeCommand ?? true
      const includeWorkdir = options?.includeWorkdir ?? true
      const includeSession = options?.includeSession ?? false
      return items.filter((session) => {
        if (includeSession && hasChatSessionId && !matchesChatSession(session)) {
          return false
        }
        if (includeAgent) {
          if (agentInstanceId) {
            if (session.agent_instance_id !== agentInstanceId) return false
          } else if (agentId) {
            if (session.agent_id !== agentId) return false
          }
        }
        if (includeCommand && normalizedCommand) {
          if (normalizeCommand(session.command) !== normalizedCommand) return false
        }
        if (includeWorkdir && normalizedWorkdir) {
          if (normalizeWorkdir(session.workdir) !== normalizedWorkdir) return false
        }
        return true
      })
    }
    let candidates = applyFilters(baseSessions, {
      includeAgent: true,
      includeSession: preferChatSession && hasChatSessionId,
    })
    if (candidates.length === 0 && preferChatSession && hasChatSessionId) {
      candidates = applyFilters(baseSessions, { includeAgent: true })
    }
    if (!preferChatSession && hasChatSessionId) {
      candidates = selectSessionMatches(candidates)
    }
    if (candidates.length === 0 && normalizedWorkdir) {
      candidates = applyFilters(baseSessions, { includeAgent: true, includeWorkdir: false })
      if (!preferChatSession && hasChatSessionId) {
        candidates = selectSessionMatches(candidates)
      }
    }
    if (candidates.length === 0 && (agentInstanceId || agentId)) {
      candidates = applyFilters(baseSessions, { includeAgent: false })
      if (candidates.length === 0 && normalizedWorkdir) {
        candidates = applyFilters(baseSessions, {
          includeAgent: false,
          includeWorkdir: false,
        })
      }
      if (!preferChatSession && hasChatSessionId) {
        candidates = selectSessionMatches(candidates)
      }
    }
    if (candidates.length === 0) {
      const running = baseSessions.filter((session) => session.status === 'running')
      if (running.length === 1) {
        candidates = running
      }
    }
    if (candidates.length === 0) return
    const ranked = candidates
      .map((session) => {
        const startedAtMs = Date.parse(session.started_at)
        const diff = toolTimestampMs != null ? Math.abs(startedAtMs - toolTimestampMs) : 0
        return { session, diff }
      })
      .filter((item) => (toolTimestampMs != null ? item.diff <= windowMs : true))
      .sort((a, b) => {
        if (a.diff !== b.diff) return a.diff - b.diff
        return Date.parse(b.session.started_at) - Date.parse(a.session.started_at)
      })
    if (ranked.length > 0) {
      setResolvedSession(ranked[0].session)
      setActive(false)
      return
    }
    if (toolTimestampMs != null && startRef.current != null) {
      const elapsed = Date.now() - startRef.current
      if (elapsed > windowMs) {
        const fallback = candidates
          .map((session) => {
            const startedAtMs = Date.parse(session.started_at)
            const diff = Math.abs(startedAtMs - toolTimestampMs)
            return { session, diff }
          })
          .sort((a, b) => {
            if (a.diff !== b.diff) return a.diff - b.diff
            return Date.parse(b.session.started_at) - Date.parse(a.session.started_at)
          })
        if (fallback.length > 0) {
          setResolvedSession(fallback[0].session)
          setActive(false)
        }
      }
    }
  }, [
    active,
    agentId,
    agentInstanceId,
    rawChatSessionId,
    hasChatSessionId,
    normalizedCommand,
    normalizedWorkdir,
    preferChatSession,
    sessions,
    toolTimestampMs,
    windowMs,
  ])

  return {
    bashId: resolvedSession?.bash_id ?? null,
    session: resolvedSession,
    loading: active && (connection.status === 'connecting' || connection.status === 'reconnecting'),
    error: connection.status === 'error' ? connection.error ?? 'stream_failed' : null,
    exhausted,
  }
}
