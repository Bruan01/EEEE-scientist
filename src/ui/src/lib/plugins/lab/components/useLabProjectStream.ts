'use client'

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getApiBaseUrl } from '@/lib/api/client'
import { redirectToLanding } from '@/lib/navigation'
import { dispatchLabFocus } from '@/lib/plugins/lab/components/lab-focus'
import { isQuestRuntimeSurface } from '@/lib/runtime/quest-runtime'

type UseLabProjectStreamOptions = {
  projectId: string
  enabled: boolean
}

export type LabProjectStreamState = {
  status: 'idle' | 'connecting' | 'open' | 'reconnecting' | 'error'
  lastEventAt?: number | null
}

type StreamEnvelope = {
  data?: Record<string, unknown> | null
  quest_id?: unknown
  questId?: unknown
  active_quest_id?: unknown
}

type QueryInvalidateTarget = {
  queryKey: readonly unknown[]
  exact?: boolean
}

const INVALIDATION_BATCH_MS = 80

const AGENT_EVENT_TYPES = new Set(['lab.agent.changed', 'lab.agent.status'])
const ASSIGNMENT_EVENT_TYPES = new Set(['lab.assignment.changed'])
const QUEST_EVENT_TYPES = new Set([
  'lab.quest.changed',
  'lab.quest.event',
  'lab.quest.sync',
])
const RUNTIME_EVENT_TYPES = new Set(['lab.quest.runtime'])
const MEMORY_EVENT_TYPES = new Set(['lab.memory.changed'])
const PAPER_EVENT_TYPES = new Set(['lab.paper.changed'])
const BASELINE_EVENT_TYPES = new Set(['lab.baseline.archive', 'lab.baseline.restore'])

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === '1' || normalized === 'true' || normalized === 'yes'
  }
  return false
}

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => toNonEmptyString(item))
    .filter((item): item is string => Boolean(item))
}

const resolveQuestId = (envelope: StreamEnvelope | null): string | null => {
  if (!envelope) return null
  const payloadData = asRecord(envelope.data)

  const directQuest =
    toNonEmptyString(payloadData?.quest_id) ??
    toNonEmptyString(payloadData?.questId) ??
    toNonEmptyString(payloadData?.active_quest_id) ??
    toNonEmptyString(envelope.quest_id) ??
    toNonEmptyString(envelope.questId) ??
    toNonEmptyString(envelope.active_quest_id)
  if (directQuest) return directQuest

  const nestedQuest = asRecord(payloadData?.quest)
  return toNonEmptyString(nestedQuest?.quest_id) ?? toNonEmptyString(nestedQuest?.id)
}

const baseProjectTargets = (projectId: string): QueryInvalidateTarget[] => {
  return [
    { queryKey: ['lab-agents', projectId] },
    { queryKey: ['lab-quests', projectId] },
    { queryKey: ['lab-overview', projectId] },
  ]
}

const questTargets = (projectId: string, questId: string | null): QueryInvalidateTarget[] => {
  if (!questId) {
    return [
      { queryKey: ['lab-quest-detail', projectId] },
      { queryKey: ['lab-quest', projectId] },
      { queryKey: ['lab-quest-summary', projectId] },
      { queryKey: ['lab-quest-graph', projectId] },
      { queryKey: ['lab-quest-events', projectId] },
      { queryKey: ['lab-quest-event-payload', projectId] },
      { queryKey: ['lab-quest-node-trace', projectId] },
      { queryKey: ['lab-quest-decision-events', projectId] },
      { queryKey: ['lab-quest-pi-qa-events', projectId] },
      { queryKey: ['lab-quest-branch-insights', projectId] },
      { queryKey: ['lab-quest-runtime', projectId] },
      { queryKey: ['lab-papers', projectId] },
      { queryKey: ['lab-memory', projectId] },
    ]
  }

  return [
    { queryKey: ['lab-quest-detail', projectId, questId] },
    { queryKey: ['lab-quest', projectId, questId] },
    { queryKey: ['lab-quest-summary', projectId, questId] },
    { queryKey: ['lab-quest-graph', projectId, questId] },
    { queryKey: ['lab-quest-events', projectId, questId] },
    { queryKey: ['lab-quest-event-payload', projectId, questId] },
    { queryKey: ['lab-quest-node-trace', projectId, questId] },
    { queryKey: ['lab-quest-decision-events', projectId, questId] },
    { queryKey: ['lab-quest-pi-qa-events', projectId, questId] },
    { queryKey: ['lab-quest-branch-insights', projectId, questId] },
    { queryKey: ['lab-quest-runtime', projectId, questId] },
    { queryKey: ['lab-papers', projectId, questId] },
    { queryKey: ['lab-memory', projectId, questId] },
  ]
}

const memoryTargets = (projectId: string): QueryInvalidateTarget[] => {
  return [
    { queryKey: ['lab-memory', projectId] },
  ]
}

const buildTargetsForEvent = (
  eventType: string,
  projectId: string,
  questId: string | null
): QueryInvalidateTarget[] => {
  if (AGENT_EVENT_TYPES.has(eventType)) {
    return [
      { queryKey: ['lab-agents', projectId] },
      { queryKey: ['lab-overview', projectId] },
    ]
  }

  if (ASSIGNMENT_EVENT_TYPES.has(eventType)) {
    return [
      { queryKey: ['lab-agents', projectId] },
      { queryKey: ['lab-quests', projectId] },
      { queryKey: ['lab-overview', projectId] },
      ...questTargets(projectId, questId),
    ]
  }

  if (QUEST_EVENT_TYPES.has(eventType)) {
    return [
      { queryKey: ['lab-agents', projectId] },
      { queryKey: ['lab-quests', projectId] },
      { queryKey: ['lab-overview', projectId] },
      ...questTargets(projectId, questId),
    ]
  }

  if (RUNTIME_EVENT_TYPES.has(eventType)) {
    return [
      { queryKey: ['lab-quests', projectId] },
      { queryKey: ['lab-overview', projectId] },
      ...questTargets(projectId, questId),
    ]
  }

  if (MEMORY_EVENT_TYPES.has(eventType)) {
    return [...memoryTargets(projectId), ...questTargets(projectId, questId)]
  }

  if (PAPER_EVENT_TYPES.has(eventType)) {
    return [
      { queryKey: ['lab-papers', projectId] },
      { queryKey: ['lab-overview', projectId] },
      ...questTargets(projectId, questId),
    ]
  }

  if (BASELINE_EVENT_TYPES.has(eventType)) {
    return [
      { queryKey: ['lab-baselines', projectId] },
      { queryKey: ['lab-quests', projectId] },
      { queryKey: ['lab-overview', projectId] },
      ...questTargets(projectId, questId),
    ]
  }

  if (eventType.startsWith('lab.')) {
    return [
      { queryKey: ['lab-quests', projectId] },
      { queryKey: ['lab-overview', projectId] },
      ...(questId ? questTargets(projectId, questId) : []),
    ]
  }

  return baseProjectTargets(projectId)
}

const buildFocusPayloadForEvent = (
  eventType: string,
  projectId: string,
  envelope: StreamEnvelope | null
) => {
  if (eventType !== 'lab.agent.changed') return null
  const payload = asRecord(envelope?.data)
  if (!payload) return null
  const action = toNonEmptyString(payload.action)?.toLowerCase()
  if (action !== 'created' && action !== 'promoted') return null
  if (!toBoolean(payload.auto_focus)) return null
  const agentId = toNonEmptyString(payload.agent_instance_id)
  if (!agentId) return null
  return {
    projectId,
    focusType: 'agent' as const,
    focusId: agentId,
  }
}

export default function useLabProjectStream({ projectId, enabled }: UseLabProjectStreamOptions) {
  const queryClient = useQueryClient()
  const [state, setState] = React.useState<LabProjectStreamState>({ status: 'idle', lastEventAt: null })
  const localQuestSurface = isQuestRuntimeSurface()

  React.useEffect(() => {
    if (!enabled || !projectId || localQuestSurface) {
      setState((current) => (current.status === 'idle' ? current : { ...current, status: 'idle' }))
      return
    }
    let closed = false
    let reconnectTimer: number | null = null
    let invalidateTimer: number | null = null
    let attempts = 0
    let lastEventId: string | null = null
    let abortController: AbortController | null = null
    const seenEventIds = new Set<string>()
    const seenEventOrder: string[] = []
    const maxSeenEventIds = 512
    const pendingTargets = new Map<string, QueryInvalidateTarget>()
    const streamUrl = `${getApiBaseUrl()}/api/v1/projects/${projectId}/lab/stream`

    const parseEventBlock = (block: string) => {
      const lines = block.split(/\n/)
      let eventType = ''
      let eventId = ''
      const dataLines: string[] = []

      for (const line of lines) {
        if (!line) continue
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim()
          continue
        }
        if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart())
          continue
        }
        if (line.startsWith('id:')) {
          eventId = line.slice(3).trim()
        }
      }

      if (dataLines.length === 0) return null
      return {
        event: eventType || 'message',
        data: dataLines.join('\n'),
        id: eventId || undefined,
      }
    }

    const isDuplicateEventId = (eventType?: string, eventId?: string) => {
      const normalizedId = (eventId || '').trim()
      if (!normalizedId) return false
      const normalizedType = (eventType || '').trim().toLowerCase()
      const dedupeKey = normalizedType ? `${normalizedType}|${normalizedId}` : normalizedId
      if (seenEventIds.has(dedupeKey)) return true
      seenEventIds.add(dedupeKey)
      seenEventOrder.push(dedupeKey)
      if (seenEventOrder.length > maxSeenEventIds) {
        const evicted = seenEventOrder.shift()
        if (evicted) seenEventIds.delete(evicted)
      }
      return false
    }

    const flushInvalidations = () => {
      if (pendingTargets.size === 0) return
      const entries = Array.from(pendingTargets.values())
      pendingTargets.clear()
      entries.forEach((target) => {
        queryClient.invalidateQueries({
          queryKey: target.queryKey,
          exact: target.exact,
        })
      })
    }

    const enqueueInvalidations = (targets: QueryInvalidateTarget[]) => {
      targets.forEach((target) => {
        const key = `${target.exact ? 1 : 0}:${JSON.stringify(target.queryKey)}`
        pendingTargets.set(key, target)
      })
      if (invalidateTimer) return
      invalidateTimer = window.setTimeout(() => {
        invalidateTimer = null
        flushInvalidations()
      }, INVALIDATION_BATCH_MS)
    }

    const handleStreamEvent = (eventType: string, payloadText: string) => {
      if (eventType === 'lab.ping') return
      setState((current) => ({ ...current, lastEventAt: Date.now() }))

      let envelope: StreamEnvelope | null = null
      try {
        const parsed = JSON.parse(payloadText || '{}')
        envelope = asRecord(parsed) as StreamEnvelope | null
      } catch {
        envelope = null
      }

      const questId = resolveQuestId(envelope)
      const payload = asRecord(envelope?.data)
      const questIds = toStringArray(payload?.quest_ids)
      const targets = buildTargetsForEvent(eventType, projectId, questId)
      enqueueInvalidations(targets)
      questIds.forEach((id) => {
        enqueueInvalidations(questTargets(projectId, id))
      })
      const focusPayload = buildFocusPayloadForEvent(eventType, projectId, envelope)
      if (focusPayload) {
        dispatchLabFocus(focusPayload)
      }
    }

    const scheduleReconnect = () => {
      if (closed) return
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer)
      }
      const capped = Math.min(attempts, 4)
      const baseDelay = Math.min(10000, 1000 * 2 ** capped)
      const jitter = Math.min(250, attempts * 50)
      setState((current) =>
        current.status === 'connecting' || current.status === 'open'
          ? { ...current, status: 'reconnecting' }
          : current
      )
      reconnectTimer = window.setTimeout(connect, baseDelay + jitter)
    }

    const connect = () => {
      if (closed) return
      if (abortController) {
        abortController.abort()
      }
      abortController = new AbortController()
      const controller = abortController
      setState((current) => ({
        ...current,
        status: attempts > 0 ? 'reconnecting' : 'connecting',
      }))

      void (async () => {
        try {
          const token =
            typeof window !== 'undefined' ? window.localStorage.getItem('ds_access_token') : null
          if (!token) return

          const headers: Record<string, string> = {
            Accept: 'text/event-stream',
            Authorization: `Bearer ${token}`,
          }
          if (lastEventId) {
            headers['Last-Event-ID'] = lastEventId
          }

          const response = await fetch(streamUrl, {
            method: 'GET',
            headers,
            signal: controller.signal,
          })

          if (closed || controller.signal.aborted) return

          if (response.status === 401) {
            if (typeof window !== 'undefined') {
              window.localStorage.removeItem('ds_access_token')
              redirectToLanding('session_expired')
            }
            return
          }

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          attempts = 0
          setState((current) => ({ ...current, status: 'open' }))
          // Recover from any events missed while disconnected (project stream is best-effort, no replay).
          enqueueInvalidations(baseProjectTargets(projectId))

          const reader = response.body?.getReader()
          if (!reader) {
            throw new Error('No response body')
          }

          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            if (closed || controller.signal.aborted) break
            const { done, value } = await reader.read()
            if (done) break
            if (closed || controller.signal.aborted) break
            buffer += decoder.decode(value, { stream: true })
            if (buffer.includes('\r')) {
              buffer = buffer.replace(/\r\n/g, '\n')
            }

            let boundaryIndex = buffer.indexOf('\n\n')
            while (boundaryIndex !== -1) {
              const raw = buffer.slice(0, boundaryIndex)
              buffer = buffer.slice(boundaryIndex + 2)
              const normalized = raw.replace(/\r\n/g, '\n').trim()
              const parsed = parseEventBlock(normalized)
              if (parsed?.id) {
                lastEventId = parsed.id
                if (isDuplicateEventId(parsed.event, parsed.id)) {
                  boundaryIndex = buffer.indexOf('\n\n')
                  continue
                }
              }
              if (parsed && !closed && !controller.signal.aborted) {
                handleStreamEvent(parsed.event, parsed.data)
              }
              boundaryIndex = buffer.indexOf('\n\n')
            }
          }

          const trailing = buffer.replace(/\r\n/g, '\n').trim()
          if (trailing && !closed && !controller.signal.aborted) {
            const parsed = parseEventBlock(trailing)
            if (parsed?.id) {
              lastEventId = parsed.id
              if (isDuplicateEventId(parsed.event, parsed.id)) {
                return
              }
            }
            if (parsed) {
              handleStreamEvent(parsed.event, parsed.data)
            }
          }

          if (!closed && !controller.signal.aborted) {
            attempts += 1
            scheduleReconnect()
          }
        } catch {
          if (closed || controller.signal.aborted) return
          setState((current) => ({ ...current, status: 'error' }))
          attempts += 1
          scheduleReconnect()
        }
      })()
    }

    connect()

    return () => {
      closed = true
      flushInvalidations()
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer)
      }
      if (invalidateTimer) {
        window.clearTimeout(invalidateTimer)
      }
      if (abortController) {
        abortController.abort()
      }
    }
  }, [enabled, localQuestSurface, projectId, queryClient])

  return state
}
