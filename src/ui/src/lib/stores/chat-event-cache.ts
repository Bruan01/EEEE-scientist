import type { AgentSSEEvent } from '@/lib/types/chat-events'

const MAX_SESSIONS = 24
const MAX_EVENTS_PER_SESSION = 6000
const MAX_EVENTS_PER_QUEST_SESSION = 50000

const sessionEventCache = new Map<string, AgentSSEEvent[]>()

const hashString = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return hash
}

const fingerprintEvent = (event: AgentSSEEvent) => {
  const data = event?.data as unknown as Partial<Record<string, unknown>> | undefined
  const eventId = typeof data?.event_id === 'string' ? data.event_id : ''
  const timestamp = typeof data?.timestamp === 'number' ? data.timestamp : 0
  const toolCallId = typeof data?.tool_call_id === 'string' ? data.tool_call_id : ''
  const status = typeof data?.status === 'string' ? data.status : ''
  const delta = typeof data?.delta === 'string' ? data.delta : ''
  const deltaLen = delta.length
  const deltaHash = delta ? hashString(delta) : 0
  return `${event.event}|${eventId}|${timestamp}|${toolCallId}|${status}|${deltaLen}|${deltaHash}`
}

const getEventTimestamp = (event: AgentSSEEvent) => {
  const data = event?.data as unknown as Partial<Record<string, unknown>> | undefined
  return typeof data?.timestamp === 'number' ? data.timestamp : null
}

const getEventSequence = (event: AgentSSEEvent) => {
  const data = event?.data as unknown as Partial<Record<string, unknown>> | undefined
  if (typeof data?.seq === 'number') return data.seq
  const fallback = (data as { _seq?: unknown } | undefined)?._seq
  if (typeof fallback === 'number') return fallback
  return null
}

const touchSession = (sessionId: string) => {
  const existing = sessionEventCache.get(sessionId)
  if (!existing) return
  sessionEventCache.delete(sessionId)
  sessionEventCache.set(sessionId, existing)
}

const maxEventsForSession = (sessionId: string) =>
  sessionId.startsWith('quest:') ? MAX_EVENTS_PER_QUEST_SESSION : MAX_EVENTS_PER_SESSION

const enforceLimits = () => {
  while (sessionEventCache.size > MAX_SESSIONS) {
    const first = sessionEventCache.keys().next().value as string | undefined
    if (!first) return
    sessionEventCache.delete(first)
  }
}

const trimSession = (sessionId: string) => {
  const events = sessionEventCache.get(sessionId)
  if (!events) return
  const maxEvents = maxEventsForSession(sessionId)
  if (events.length <= maxEvents) return
  events.splice(0, events.length - maxEvents)
}

export const getCachedSessionEvents = (sessionId?: string | null) => {
  if (!sessionId) return null
  const events = sessionEventCache.get(sessionId)
  if (!events) return null
  touchSession(sessionId)
  return events
}

export const mergeCachedSessionEvents = (sessionId: string, events: AgentSSEEvent[]) => {
  if (!sessionId) return
  const nextEvents = [...events]
  const existing = sessionEventCache.get(sessionId)
  if (existing && existing.length > 0) {
    const seen = new Set<string>()
    for (const event of nextEvents) {
      try {
        seen.add(fingerprintEvent(event))
      } catch {
        // ignore
      }
    }
    for (const event of existing) {
      let fingerprint: string | null = null
      try {
        fingerprint = fingerprintEvent(event)
      } catch {
        fingerprint = null
      }
      if (!fingerprint || seen.has(fingerprint)) continue
      nextEvents.push(event)
      seen.add(fingerprint)
    }
  }
  let ordered = nextEvents
  if (existing && existing.length > 0) {
    ordered = nextEvents
      .map((event, index) => ({
        event,
        index,
        seq: getEventSequence(event),
        timestamp: getEventTimestamp(event),
      }))
      .sort((a, b) => {
        if (a.seq != null || b.seq != null) {
          if (a.seq != null && b.seq != null && a.seq !== b.seq) return a.seq - b.seq
          if (a.seq != null && b.seq == null) return -1
          if (a.seq == null && b.seq != null) return 1
        }
        const ta = a.timestamp ?? Number.MAX_SAFE_INTEGER
        const tb = b.timestamp ?? Number.MAX_SAFE_INTEGER
        if (ta !== tb) return ta - tb
        return a.index - b.index
      })
      .map((item) => item.event)
  }
  sessionEventCache.set(sessionId, ordered)
  touchSession(sessionId)
  trimSession(sessionId)
  enforceLimits()
}

export const replaceCachedSessionEvents = (sessionId: string, events: AgentSSEEvent[]) => {
  if (!sessionId) return
  sessionEventCache.set(sessionId, [...events])
  touchSession(sessionId)
  trimSession(sessionId)
  enforceLimits()
}

export const appendCachedSessionEvent = (sessionId: string, event: AgentSSEEvent) => {
  if (!sessionId) return
  const existing = sessionEventCache.get(sessionId)
  if (existing) {
    const last = existing.length > 0 ? existing[existing.length - 1] : null
    if (last) {
      try {
        if (fingerprintEvent(last) === fingerprintEvent(event)) {
          touchSession(sessionId)
          return
        }
      } catch {
        // ignore
      }
    }
    existing.push(event)
    trimSession(sessionId)
    touchSession(sessionId)
    return
  }
  sessionEventCache.set(sessionId, [event])
  touchSession(sessionId)
  enforceLimits()
}

export const clearCachedSessionEvents = (sessionId: string) => {
  sessionEventCache.delete(sessionId)
}

export const __resetChatEventCacheForTests = () => {
  sessionEventCache.clear()
}
