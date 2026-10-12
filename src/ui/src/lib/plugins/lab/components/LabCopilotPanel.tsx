'use client'

import * as React from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Loader2, MessageCircle, MoreHorizontal, Plus, Search, ThumbsUp } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { ChatBox } from '@/lib/plugins/ai-manus/components/ChatBox'
import { ChatMessage } from '@/lib/plugins/ai-manus/components/ChatMessage'
import { renderMarkdown } from '@/lib/plugins/ai-manus/lib/markdown'
import type { ChatMessageItem, MessageContent } from '@/lib/plugins/ai-manus/types'
import type { AiManusChatActions, AiManusChatMeta, CopilotPrefill } from '@/lib/plugins/ai-manus/view-types'
import { useChatSessionStore } from '@/lib/stores/session'
import { useSSESession } from '@/lib/hooks/useSSESession'
import { useLabCopilotStore } from '@/lib/stores/lab-copilot'
import {
  useLabGraphSelectionStore,
  type LabGraphSelection,
} from '@/lib/stores/lab-graph-selection'
import { useAuthStore } from '@/lib/stores/auth'
import { useCopilotDockHeaderPortal } from '@/components/workspace/CopilotDockOverlay'
import {
  getLabAgentDirectSession,
  assignLabAgent,
  getLabFriendsSession,
  getLabGroupSession,
  likeLabMoment,
  unlikeLabMoment,
  commentLabMoment,
  type LabAgentInstance,
  type LabQuest,
  type LabTemplate,
} from '@/lib/api/lab'
import { cn } from '@/lib/utils'
import {
  buildAgentDescriptor,
  buildAvatarColorMap,
  formatRelativeTime,
  isLabWorkingStatus,
  pickAvatarFrameColor,
  resolveQuestLabel,
  resolveAgentDisplayName,
  resolveAgentMentionLabel,
  resolveAgentLogo,
} from './lab-helpers'
import { useLabAnimationLevel } from './lab-hooks'
import { LabDirectChatView } from './LabDirectChatView'
import type { AgentSSEEvent, AttachmentInfo, ChatSurface, EventMetadata } from '@/lib/types/chat-events'
import { useI18n } from '@/lib/i18n/useI18n'
import { DEFAULT_AGENT_ID } from '@/lib/utils/agent-mentions'
import { applyChatEvent } from '@/lib/plugins/ai-manus/lib/chat-event-reducer'

type LabCopilotPanelProps = {
  projectId: string
  readOnly: boolean
  cliStatus: 'online' | 'offline' | 'unbound'
  templates: LabTemplate[]
  agents: LabAgentInstance[]
  quests: LabQuest[]
  prefill?: CopilotPrefill | null
  onActionsChange?: (actions: AiManusChatActions | null) => void
}

type LabCopilotMode = 'direct' | 'group' | 'friends'

type LabCopilotHeaderProps = {
  disabled?: boolean
  agents: LabAgentInstance[]
  templates: LabTemplate[]
  quests: LabQuest[]
  onClearChat?: () => void
  clearChatDisabled?: boolean
}

const GROUP_FOLLOW_THRESHOLD_PX = 10
const LAB_SESSION_EVENT_LIMIT = 300

type LabSurfaceKind = 'group' | 'friends'

type LabCopilotHeaderContextMenu = {
  x: number
  y: number
}

const buildTextDeltaId = (eventId: string, seq: number) => {
  const base = eventId.trim() ? eventId.trim() : 'text'
  return `text-${base}-${seq}`
}

const isScrolledToBottom = (container: HTMLElement, threshold = GROUP_FOLLOW_THRESHOLD_PX) => {
  const { scrollTop, scrollHeight, clientHeight } = container
  return scrollHeight - scrollTop - clientHeight <= threshold
}

const isScrolledToTop = (container: HTMLElement, threshold = GROUP_FOLLOW_THRESHOLD_PX) => {
  return container.scrollTop <= threshold
}

const useLabSurfaceSession = ({
  projectId,
  questId,
  surface,
  enabled,
}: {
  projectId: string
  questId: string | null
  surface: LabSurfaceKind
  enabled: boolean
}) => {
  const [sessionId, setSessionId] = React.useState<string | null>(null)
  const [messages, setMessages] = React.useState<ChatMessageItem[]>([])
  const [historyTruncated, setHistoryTruncated] = React.useState(false)
  const [historyLimit, setHistoryLimit] = React.useState<number | null>(null)
  const [historyLoadingFull, setHistoryLoadingFull] = React.useState(false)
  const [historyLoading, setHistoryLoading] = React.useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false)
  const [restoreToken, setRestoreToken] = React.useState(0)
  const sessionIdRef = React.useRef<string | null>(null)
  const previousSessionIdRef = React.useRef<string | null>(null)
  const messagesRef = React.useRef<ChatMessageItem[]>([])
  const assistantMessageIndexRef = React.useRef<Map<string, string>>(new Map())
  const attachmentsSeenRef = React.useRef<Set<string>>(new Set())
  const lastAssistantSegmentIdRef = React.useRef<string | null>(null)
  const timelineSeqRef = React.useRef(0)
  const fullHistoryRef = React.useRef(false)
  const fullHistoryRequestRef = React.useRef(false)
  const setSessionIdForSurface = useChatSessionStore((state) => state.setSessionIdForSurface)
  const surfaceKey = `lab-${surface}` as ChatSurface

  const resolveTimelineSeq = React.useCallback((candidate?: number | null) => {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      if (candidate > timelineSeqRef.current) {
        timelineSeqRef.current = candidate
      }
      return candidate
    }
    timelineSeqRef.current += 1
    return timelineSeqRef.current
  }, [])

  const updateMessages = React.useCallback((next: ChatMessageItem[]) => {
    messagesRef.current = next
    setMessages(next)
  }, [])

  const appendMessage = React.useCallback(
    (message: ChatMessageItem) => {
      updateMessages([...messagesRef.current, message])
    },
    [updateMessages]
  )

  const resetState = React.useCallback(() => {
    messagesRef.current = []
    setMessages([])
    assistantMessageIndexRef.current = new Map()
    attachmentsSeenRef.current = new Set()
    lastAssistantSegmentIdRef.current = null
    timelineSeqRef.current = 0
  }, [])

  const resetHistoryState = React.useCallback(() => {
    setHistoryTruncated(false)
    setHistoryLimit(null)
    setHistoryLoadingFull(false)
    setHistoryLoading(false)
    setHasLoadedOnce(false)
    fullHistoryRef.current = false
    fullHistoryRequestRef.current = false
    setRestoreToken(0)
  }, [])

  const handleEvent = React.useCallback(
    (event: AgentSSEEvent) => {
      if (!sessionId) return
      applyChatEvent(event, {
        sessionId,
        messagesRef,
        assistantMessageIndexRef,
        lastAssistantSegmentIdRef,
        attachmentsSeenRef,
        resolveTimelineSeq,
        buildTextDeltaId,
        appendMessage,
        updateMessages,
      })
    },
    [appendMessage, resolveTimelineSeq, sessionId, updateMessages]
  )

  const { sendMessage, restoreSession, stop, connection } = useSSESession({
    sessionId,
    projectId,
    onEvent: handleEvent,
  })
  const pingTimerRef = React.useRef<number | null>(null)
  const pingInFlightRef = React.useRef(false)

  React.useEffect(() => {
    if (!enabled || !projectId || !questId) {
      setSessionId(null)
      resetState()
      resetHistoryState()
      return
    }
    if (sessionIdRef.current) {
      setSessionId(null)
    }
    let active = true
    const fetchSession = async () => {
      resetState()
      resetHistoryState()
      setHistoryLoading(true)
      try {
        const response =
          surface === 'group'
            ? await getLabGroupSession(projectId, questId)
            : await getLabFriendsSession(projectId, questId)
        if (!active) return
        const nextSessionId = response?.session_id?.trim?.() ?? response?.session_id
        if (!nextSessionId) {
          setSessionId(null)
          setHistoryLoading(false)
          setHasLoadedOnce(true)
          return
        }
        setSessionId(nextSessionId)
        setSessionIdForSurface(projectId, `lab-${surface}`, nextSessionId)
      } catch {
        if (active) {
          setHistoryLoading(false)
        }
      }
    }
    void fetchSession()
    return () => {
      active = false
    }
  }, [enabled, projectId, questId, resetHistoryState, resetState, setSessionIdForSurface, surface])

  React.useEffect(() => {
    if (!enabled || !sessionId) return
    let active = true
    const restore = async () => {
      const requestFull = fullHistoryRequestRef.current
      const wantsFull = fullHistoryRef.current || requestFull
      if (requestFull) {
        fullHistoryRequestRef.current = false
      }
      resetState()
      setHistoryLoading(true)
      try {
        const session = await restoreSession(
          wantsFull ? { full: true } : { limit: LAB_SESSION_EVENT_LIMIT }
        )
        if (!active) return
        const events = Array.isArray(session?.events) ? session.events : []
        let lastEventId: string | null = null
        events.forEach((record) => {
          if (!record || !record.event || !record.data) return
          if (record.data?.event_id) {
            lastEventId = record.data.event_id
          }
          applyChatEvent(
            { event: record.event as AgentSSEEvent['event'], data: record.data as AgentSSEEvent['data'] },
            {
              sessionId,
              messagesRef,
              assistantMessageIndexRef,
              lastAssistantSegmentIdRef,
              attachmentsSeenRef,
              resolveTimelineSeq,
              buildTextDeltaId,
              appendMessage,
              updateMessages,
            }
          )
        })
        const eventsTruncated = Boolean(session?.events_truncated)
        const eventLimit =
          typeof session?.event_limit === 'number' ? session.event_limit : null
        setHistoryTruncated(eventsTruncated)
        setHistoryLimit(eventLimit)
        if (wantsFull) {
          fullHistoryRef.current = !eventsTruncated
        } else {
          fullHistoryRef.current = false
        }
        if (lastEventId) {
          useChatSessionStore.getState().setLastEventId(sessionId, lastEventId)
        }
        if (!active) return
        try {
          await sendMessage({
            sessionId,
            message: '',
            surface: `lab-${surface}`,
            replayFromLastEvent: true,
          })
        } catch {
          void 0
        }
      } finally {
        if (requestFull && active) {
          setHistoryLoadingFull(false)
        }
        if (active) {
          setHistoryLoading(false)
          setHasLoadedOnce(true)
        }
      }
    }
    void restore()
    return () => {
      active = false
    }
  }, [
    appendMessage,
    enabled,
    resolveTimelineSeq,
    resetState,
    restoreSession,
    restoreToken,
    sendMessage,
    sessionId,
    surface,
    updateMessages,
  ])

  React.useEffect(() => {
    if (!enabled || !sessionId) return
    let isMounted = true

    const schedulePing = () => {
      const delay = 20000 + Math.floor(Math.random() * 10000)
      pingTimerRef.current = window.setTimeout(async () => {
        if (!isMounted || !sessionId || pingInFlightRef.current) {
          schedulePing()
          return
        }
        pingInFlightRef.current = true
        try {
          await sendMessage({
            sessionId,
            message: '',
            surface: surfaceKey,
            replayFromLastEvent: true,
          })
        } catch {
          // ignore ping errors
        } finally {
          pingInFlightRef.current = false
        }
        schedulePing()
      }, delay)
    }

    schedulePing()
    return () => {
      isMounted = false
      if (pingTimerRef.current) {
        window.clearTimeout(pingTimerRef.current)
        pingTimerRef.current = null
      }
    }
  }, [enabled, sendMessage, sessionId, surfaceKey])

  React.useEffect(() => {
    if (!enabled || !sessionId) return
    if (connection.status === 'closed' || connection.status === 'error') {
      if (pingInFlightRef.current) return
      pingInFlightRef.current = true
      void sendMessage({
        sessionId,
        message: '',
        surface: surfaceKey,
        replayFromLastEvent: true,
      }).finally(() => {
        pingInFlightRef.current = false
      })
    }
  }, [connection.status, enabled, sendMessage, sessionId, surfaceKey])

  React.useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  React.useEffect(() => {
    if (previousSessionIdRef.current && previousSessionIdRef.current !== sessionId) {
      stop(previousSessionIdRef.current)
    }
    previousSessionIdRef.current = sessionId
  }, [sessionId, stop])

  React.useEffect(() => {
    return () => {
      if (sessionIdRef.current) {
        stop(sessionIdRef.current)
      }
    }
  }, [stop])

  const loadFullHistory = React.useCallback(() => {
    if (!sessionId || !enabled) return
    if (historyLoadingFull || fullHistoryRef.current) return
    fullHistoryRequestRef.current = true
    setHistoryLoadingFull(true)
    setRestoreToken((value) => value + 1)
  }, [enabled, historyLoadingFull, sessionId])

  return {
    sessionId,
    messages,
    connection,
    sendMessage,
    historyTruncated,
    historyLimit,
    historyLoadingFull,
    historyLoading,
    hasLoadedOnce,
    loadFullHistory,
  }
}

const getMessageText = (message: ChatMessageItem) => {
  const content = message.content as { content?: unknown }
  return typeof content?.content === 'string' ? content.content : ''
}

const getMessageMetadata = (message: ChatMessageItem) => {
  const content = message.content as { metadata?: EventMetadata }
  return content?.metadata ?? null
}

const toSelectionMetadata = (selection: LabGraphSelection | null | undefined) => {
  if (!selection) return undefined
  return {
    selection_type: selection.selection_type,
    selection_ref: selection.selection_ref,
    quest_id: selection.quest_id,
    branch_name: selection.branch_name ?? undefined,
    edge_id: selection.edge_id ?? undefined,
    agent_instance_id: selection.agent_instance_id ?? undefined,
    worktree_rel_path: selection.worktree_rel_path ?? undefined,
  }
}

const resolveSelectionLabel = (selection: LabGraphSelection | null | undefined) => {
  if (!selection) return ''
  if (selection.label?.trim()) return selection.label.trim()
  return (
    selection.branch_name?.trim() ||
    selection.edge_id?.trim() ||
    selection.agent_instance_id?.trim() ||
    selection.selection_ref
  )
}

const resolveReplyStateLabel = (
  t: (key: string, variables?: Record<string, string | number>, fallback?: string) => string,
  replyState: string | null
) => {
  const normalized = typeof replyState === 'string' ? replyState.trim().toLowerCase() : ''
  if (!normalized) return null
  if (normalized === 'queued') {
    return t('copilot_group_reply_state_queued', undefined, 'Queued')
  }
  if (normalized === 'acked') {
    return t('copilot_group_reply_state_acked', undefined, 'Acknowledged')
  }
  if (normalized === 'final') {
    return t('copilot_group_reply_state_final', undefined, 'Final')
  }
  return normalized
}

function LabControlReferenceChips({
  selection,
  proposal,
  onClearSelection,
  onClearProposal,
  selectionPrefix,
  proposalPrefix,
}: {
  selection: LabGraphSelection | null
  proposal: { proposal_id: string; action_type: string; status: string } | null
  onClearSelection: () => void
  onClearProposal: () => void
  selectionPrefix: string
  proposalPrefix: string
}) {
  if (!selection && !proposal) return null
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--lab-border)] bg-[var(--lab-background)] px-4 py-3">
      {selection ? (
        <button
          type="button"
          onClick={onClearSelection}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--lab-border)] bg-[var(--lab-surface)] px-3 py-1 text-[11px] font-medium text-[var(--lab-text-primary)]"
        >
          <span className="text-[var(--lab-text-secondary)]">{selectionPrefix}</span>
          <span>{resolveSelectionLabel(selection)}</span>
          <span className="text-[var(--lab-text-muted)]">×</span>
        </button>
      ) : null}
      {proposal ? (
        <button
          type="button"
          onClick={onClearProposal}
          className="inline-flex items-center gap-2 rounded-full border border-[rgba(83,176,174,0.28)] bg-[rgba(83,176,174,0.12)] px-3 py-1 text-[11px] font-medium text-[var(--lab-text-primary)]"
        >
          <span className="text-[var(--lab-text-secondary)]">{proposalPrefix}</span>
          <span>{proposal.action_type}</span>
          <span className="text-[var(--lab-text-muted)]">· {proposal.status}</span>
          <span className="text-[var(--lab-text-muted)]">×</span>
        </button>
      ) : null}
    </div>
  )
}

const getMessageRole = (message: ChatMessageItem) => {
  if (message.type !== 'text_delta') return null
  const content = message.content as MessageContent
  return content.role
}

const formatAbsoluteTimestamp = (value?: number | string | null) => {
  if (value === null || value === undefined) return ''
  const date =
    typeof value === 'number'
      ? new Date(value < 1e12 ? value * 1000 : value)
      : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (item: number) => String(item).padStart(2, '0')
  const year = pad(date.getFullYear() % 100)
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hour = pad(date.getHours())
  const minute = pad(date.getMinutes())
  const second = pad(date.getSeconds())
  return `${year}-${month}-${day} ${hour}-${minute}-${second}`
}

const resolveMessageTitle = (message: ChatMessageItem) => {
  const role = getMessageRole(message)
  if (role === 'user') return 'You'
  const metadata = getMessageMetadata(message)
  if (metadata?.sender_name) return metadata.sender_name
  if (metadata?.agent_display_name) return metadata.agent_display_name
  if (metadata?.sender_label) return metadata.sender_label
  if (metadata?.agent_label) return metadata.agent_label
  if (metadata?.agent_id) return `@${metadata.agent_id}`
  return 'Agent'
}

type MomentMediaItem = {
  url: string
  label?: string
}

type MomentLikeUser = {
  name: string
}

type MomentCommentItem = {
  name: string
  content: string
}

const resolveMomentMedia = (raw: unknown): MomentMediaItem[] => {
  if (!raw) return []
  const normalizeEntry = (entry: unknown): MomentMediaItem | null => {
    if (typeof entry === 'string') {
      const trimmed = entry.trim()
      return trimmed ? { url: trimmed } : null
    }
    if (!entry || typeof entry !== 'object') return null
    const record = entry as Record<string, unknown>
    const urlCandidate =
      (typeof record.url === 'string' && record.url) ||
      (typeof record.src === 'string' && record.src) ||
      (typeof record.file_url === 'string' && record.file_url) ||
      (typeof record.preview_url === 'string' && record.preview_url) ||
      (typeof record.path === 'string' && record.path) ||
      ''
    if (!urlCandidate) return null
    const label = typeof record.label === 'string' ? record.label : undefined
    return { url: urlCandidate, label }
  }

  const rawList =
    Array.isArray(raw)
      ? raw
      : typeof raw === 'object'
        ? (raw as Record<string, unknown>).items ||
          (raw as Record<string, unknown>).images ||
          (raw as Record<string, unknown>).files ||
          []
        : []

  if (!Array.isArray(rawList)) return []
  return rawList
    .map((entry) => normalizeEntry(entry))
    .filter((entry): entry is MomentMediaItem => Boolean(entry))
    .slice(0, 9)
}

const resolveMomentLikes = (raw: unknown): MomentLikeUser[] => {
  if (!raw) return []
  const normalizeEntry = (entry: unknown): MomentLikeUser | null => {
    if (typeof entry === 'string') {
      const trimmed = entry.trim()
      return trimmed ? { name: trimmed } : null
    }
    if (!entry || typeof entry !== 'object') return null
    const record = entry as Record<string, unknown>
    const nameCandidate =
      (typeof record.name === 'string' && record.name) ||
      (typeof record.user_name === 'string' && record.user_name) ||
      (typeof record.username === 'string' && record.username) ||
      (typeof record.display_name === 'string' && record.display_name) ||
      (typeof record.label === 'string' && record.label) ||
      (typeof record.user_id === 'string' && record.user_id) ||
      ''
    const trimmed = nameCandidate.trim()
    if (!trimmed) return null
    return { name: trimmed }
  }
  const rawListValue =
    Array.isArray(raw)
      ? raw
      : typeof raw === 'object'
        ? (raw as Record<string, unknown>).items ||
          (raw as Record<string, unknown>).users ||
          (raw as Record<string, unknown>).likes ||
          []
        : []
  const rawList = Array.isArray(rawListValue) ? rawListValue : []
  return rawList
    .map((entry) => normalizeEntry(entry))
    .filter((entry): entry is MomentLikeUser => Boolean(entry))
}

const resolveMomentComments = (raw: unknown): MomentCommentItem[] => {
  if (!raw) return []
  const normalizeEntry = (entry: unknown): MomentCommentItem | null => {
    if (typeof entry === 'string') {
      const trimmed = entry.trim()
      return trimmed ? { name: 'Unknown', content: trimmed } : null
    }
    if (!entry || typeof entry !== 'object') return null
    const record = entry as Record<string, unknown>
    const nameCandidate =
      (typeof record.name === 'string' && record.name) ||
      (typeof record.user_name === 'string' && record.user_name) ||
      (typeof record.username === 'string' && record.username) ||
      (typeof record.display_name === 'string' && record.display_name) ||
      (typeof record.label === 'string' && record.label) ||
      (typeof record.user_id === 'string' && record.user_id) ||
      ''
    const contentCandidate =
      (typeof record.content === 'string' && record.content) ||
      (typeof record.text === 'string' && record.text) ||
      (typeof record.message === 'string' && record.message) ||
      (typeof record.body === 'string' && record.body) ||
      ''
    const name = nameCandidate.trim() || 'Unknown'
    const content = contentCandidate.trim()
    if (!content) return null
    return { name, content }
  }
  const rawListValue =
    Array.isArray(raw)
      ? raw
      : typeof raw === 'object'
        ? (raw as Record<string, unknown>).items ||
          (raw as Record<string, unknown>).comments ||
          (raw as Record<string, unknown>).entries ||
          []
        : []
  const rawList = Array.isArray(rawListValue) ? rawListValue : []
  return rawList
    .map((entry) => normalizeEntry(entry))
    .filter((entry): entry is MomentCommentItem => Boolean(entry))
}

const mergeMomentLikes = (base: MomentLikeUser[], extra: MomentLikeUser[]) => {
  const seen = new Map<string, string>()
  base.forEach((item) => {
    const key = item.name.trim().toLowerCase()
    if (!key) return
    if (!seen.has(key)) seen.set(key, item.name)
  })
  extra.forEach((item) => {
    const key = item.name.trim().toLowerCase()
    if (!key) return
    if (!seen.has(key)) seen.set(key, item.name)
  })
  return Array.from(seen.values())
}

const mergeMomentComments = (base: MomentCommentItem[], extra: MomentCommentItem[]) => {
  const seen = new Map<string, MomentCommentItem>()
  base.forEach((item) => {
    const key = `${item.name.trim().toLowerCase()}::${item.content.trim().toLowerCase()}`
    if (seen.has(key)) return
    seen.set(key, item)
  })
  extra.forEach((item) => {
    const key = `${item.name.trim().toLowerCase()}::${item.content.trim().toLowerCase()}`
    if (seen.has(key)) return
    seen.set(key, item)
  })
  return Array.from(seen.values())
}

const resolveMomentTimestamp = (message: ChatMessageItem) => {
  const content = message.content as MessageContent
  if (typeof content?.timestamp === 'number') {
    return new Date(content.timestamp * 1000).toISOString()
  }
  const metadata = content?.metadata
  if (typeof metadata?.source_ts === 'string') {
    return metadata.source_ts
  }
  return null
}

export function LabCopilotHeader({
  disabled,
  agents,
  templates,
  quests,
  onClearChat,
  clearChatDisabled,
}: LabCopilotHeaderProps) {
  const mode = useLabCopilotStore((state) => state.mode) as LabCopilotMode
  const setMode = useLabCopilotStore((state) => state.setMode)
  const activeAgentId = useLabCopilotStore((state) => state.activeAgentId)
  const activeQuestId = useLabCopilotStore((state) => state.activeQuestId)
  const followEffects = useLabCopilotStore((state) => state.followEffects)
  const setFollowEffects = useLabCopilotStore((state) => state.setFollowEffects)
  const agentStatusOverrides = useLabCopilotStore((state) => state.agentStatusOverrides)
  const piOnboardingActive = useLabCopilotStore((state) => state.piOnboardingActive)
  const endPiOnboarding = useLabCopilotStore((state) => state.endPiOnboarding)
  const templatesById = React.useMemo(() => {
    return new Map(templates.map((template) => [template.template_id, template]))
  }, [templates])
  const avatarColors = React.useMemo(() => buildAvatarColorMap(agents), [agents])
  const activeAgent = React.useMemo(() => {
    if (!activeAgentId) return null
    return agents.find((agent) => agent.instance_id === activeAgentId) ?? null
  }, [activeAgentId, agents])
  const activeTemplate =
    activeAgent?.template_id ? templatesById.get(activeAgent.template_id) ?? null : null
  const resolvedQuestId = activeAgent?.active_quest_id ?? activeQuestId ?? null
  const activeQuest = resolvedQuestId
    ? quests.find((quest) => quest.quest_id === resolvedQuestId) ?? null
    : null
  const questLabel = activeQuest ? resolveQuestLabel(activeQuest) : 'Not joined yet'
  const agentDisplayName = activeAgent ? resolveAgentDisplayName(activeAgent) : ''
  const agentLogo = activeAgent ? resolveAgentLogo(activeAgent, activeTemplate) : ''
  const agentAvatarColor = activeAgent
    ? avatarColors.get(activeAgent.instance_id) || pickAvatarFrameColor(activeAgent.instance_id)
    : null
  const overrideStatus = activeAgent ? agentStatusOverrides[activeAgent.instance_id] ?? null : null
  const rawAgentStatus = overrideStatus ?? activeAgent?.status ?? ''
  const activeAgentStatus =
    typeof rawAgentStatus === 'string' ? rawAgentStatus.trim() : ''
  const showRunningStatus =
    mode === 'direct' &&
    activeAgent &&
    Boolean(activeAgentStatus) &&
    isLabWorkingStatus(activeAgentStatus) &&
    activeAgentStatus.toLowerCase() !== 'waiting'
  const [contextMenu, setContextMenu] = React.useState<LabCopilotHeaderContextMenu | null>(null)
  const clearChatBlocked = Boolean(clearChatDisabled || !onClearChat)
  const items: Array<{ value: LabCopilotMode; label: string }> = [
    { value: 'direct', label: 'Direct' },
    { value: 'group', label: 'Group' },
    { value: 'friends', label: 'Friends' },
  ]

  const handleAvatarContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!onClearChat) return
      event.preventDefault()
      event.stopPropagation()
      setContextMenu({ x: event.clientX, y: event.clientY })
    },
    [onClearChat]
  )

  const handleClearChat = React.useCallback(() => {
    if (clearChatBlocked || !onClearChat) return
    onClearChat()
    setContextMenu(null)
  }, [clearChatBlocked, onClearChat])

  const handleToggleFollow = React.useCallback(() => {
    setFollowEffects(!followEffects)
    setContextMenu(null)
  }, [followEffects, setFollowEffects])

  React.useEffect(() => {
    if (!contextMenu) return
    const handleDismiss = () => setContextMenu(null)
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null)
      }
    }
    window.addEventListener('click', handleDismiss)
    window.addEventListener('contextmenu', handleDismiss)
    window.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', handleDismiss, true)
    return () => {
      window.removeEventListener('click', handleDismiss)
      window.removeEventListener('contextmenu', handleDismiss)
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', handleDismiss, true)
    }
  }, [contextMenu])

  const contextMenuPortal =
    contextMenu && typeof document !== 'undefined'
      ? createPortal(
          <div className="lab-copilot-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <div className="lab-copilot-context-item">Quest: {questLabel}</div>
            <button type="button" onClick={handleClearChat} disabled={clearChatBlocked}>
              Clear chat
            </button>
            <button type="button" onClick={handleToggleFollow}>
              <Check
                size={14}
                className={cn('shrink-0', followEffects ? 'opacity-100' : 'opacity-0')}
              />
              Follow effects
            </button>
          </div>,
          document.body
        )
      : null

  return (
    <>
      <div className="lab-copilot-header">
        <div className="lab-section-tabs lab-copilot-tabs" role="tablist" aria-label="Copilot modes">
          {items.map((item) => {
            const isActive = mode === item.value
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                disabled={disabled}
                onClick={() => setMode(item.value)}
                className={cn(
                  'lab-section-tab',
                  isActive && 'lab-section-tab-active',
                  disabled && 'cursor-not-allowed opacity-60'
                )}
              >
                {item.label}
                {isActive ? <span className="lab-section-tab-indicator" /> : null}
              </button>
            )
          })}
        </div>
        {mode === 'direct' && activeAgent ? (
          <div className="lab-copilot-agent" onContextMenu={handleAvatarContextMenu}>
            <div className="lab-avatar lab-avatar-sm">
              <span
                className="lab-avatar-ring"
                style={{ borderColor: agentAvatarColor || pickAvatarFrameColor(activeAgent.instance_id) }}
              />
              <img src={agentLogo} alt={agentDisplayName || 'Agent'} />
            </div>
            <div className="lab-copilot-agent-meta">
              {agentDisplayName ? (
                <div className="lab-copilot-agent-name">{agentDisplayName}</div>
              ) : null}
              {showRunningStatus ? (
                <div className="lab-copilot-agent-status">
                  <span className="lab-status-dot lab-status-dot-running" />
                  <span>Working</span>
                </div>
              ) : null}
            </div>
            {piOnboardingActive ? (
              <button type="button" className="lab-onboarding-exit" onClick={endPiOnboarding}>
                Exit onboarding
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {contextMenuPortal}
    </>
  )
}

export default function LabCopilotPanel({
  projectId,
  readOnly,
  cliStatus,
  templates,
  agents,
  quests,
  prefill: externalPrefill,
  onActionsChange,
}: LabCopilotPanelProps) {
  const queryClient = useQueryClient()
  const { addToast } = useToast()
  const { t } = useI18n('lab')
  const mode = useLabCopilotStore((state) => state.mode) as LabCopilotMode
  const activeAgentId = useLabCopilotStore((state) => state.activeAgentId)
  const activeQuestId = useLabCopilotStore((state) => state.activeQuestId)
  const directPrefill = useLabCopilotStore((state) => state.directPrefill)
  const directComposeRequest = useLabCopilotStore((state) => state.directComposeRequest)
  const setActiveQuest = useLabCopilotStore((state) => state.setActiveQuest)
  const setActiveAgent = useLabCopilotStore((state) => state.setActiveAgent)
  const setDirectPrefill = useLabCopilotStore((state) => state.setDirectPrefill)
  const clearDirectComposeRequest = useLabCopilotStore((state) => state.clearDirectComposeRequest)
  const agentStatusOverrides = useLabCopilotStore((state) => state.agentStatusOverrides)
  const setAgentStatusOverride = useLabCopilotStore((state) => state.setAgentStatusOverride)
  const piOnboardingActive = useLabCopilotStore((state) => state.piOnboardingActive)
  const piOnboardingQuestId = useLabCopilotStore((state) => state.piOnboardingQuestId)
  const piOnboardingKind = useLabCopilotStore((state) => state.piOnboardingKind)
  const endPiOnboarding = useLabCopilotStore((state) => state.endPiOnboarding)
  const selection = useLabGraphSelectionStore((state) => state.selection)
  const activeProposal = useLabGraphSelectionStore((state) => state.activeProposal)
  const setSelection = useLabGraphSelectionStore((state) => state.setSelection)
  const setActiveProposal = useLabGraphSelectionStore((state) => state.setActiveProposal)
  const setSessionIdForSurface = useChatSessionStore((state) => state.setSessionIdForSurface)
  const clearSessionIdForSurface = useChatSessionStore((state) => state.clearSessionIdForSurface)
  const currentSessionId = useChatSessionStore((state) =>
    projectId ? state.sessionIdsByProjectSurface[projectId]?.['lab-direct'] ?? null : null
  )
  const cliServerId = useChatSessionStore((state) =>
    projectId ? state.cliServerIdsByProject[projectId] ?? null : null
  )
  const [agentPrefill, setAgentPrefill] = React.useState<CopilotPrefill | null>(null)
  const [copilotActions, setCopilotActions] = React.useState<AiManusChatActions | null>(null)
  const [copilotMeta, setCopilotMeta] = React.useState<AiManusChatMeta | null>(null)
  const autoSubmittedComposeTokenRef = React.useRef<number | null>(null)
  const resetKeyRef = React.useRef('init')
  const prevAgentIdRef = React.useRef<string | null>(null)
  const prevRespondingRef = React.useRef(false)
  const { level: animationLevel } = useLabAnimationLevel()
  const prefersReducedMotion = useReducedMotion()
  const allowMotion = animationLevel === 'full' && !prefersReducedMotion
  const isCopilotMetaEqual = React.useCallback(
    (prev: AiManusChatMeta | null, next: AiManusChatMeta) => {
      if (!prev) return false
      return (
        prev.threadId === next.threadId &&
        prev.historyOpen === next.historyOpen &&
        prev.isResponding === next.isResponding &&
        prev.ready === next.ready &&
        prev.isRestoring === next.isRestoring &&
        prev.restoreAttempted === next.restoreAttempted &&
        prev.hasHistory === next.hasHistory &&
        prev.error === next.error &&
        prev.title === next.title &&
        prev.statusText === next.statusText &&
        prev.statusPrevText === next.statusPrevText &&
        prev.statusKey === next.statusKey &&
        prev.toolPanelVisible === next.toolPanelVisible &&
        prev.toolToggleVisible === next.toolToggleVisible &&
        prev.attachmentsDrawerOpen === next.attachmentsDrawerOpen &&
        prev.fixWithAiRunning === next.fixWithAiRunning
      )
    },
    []
  )

  React.useEffect(() => {
    if (mode !== 'direct') {
      resetKeyRef.current = 'init'
    }
  }, [mode])

  const templatesById = React.useMemo(() => {
    return new Map(templates.map((template) => [template.template_id, template]))
  }, [templates])

  const agentsById = React.useMemo(() => {
    return new Map(agents.map((agent) => [agent.instance_id, agent]))
  }, [agents])
  const avatarColors = React.useMemo(() => buildAvatarColorMap(agents), [agents])

  const resolvedAgentId = activeAgentId ?? null
  const activeAgent = resolvedAgentId ? agentsById.get(resolvedAgentId) ?? null : null
  const isResponding = Boolean(copilotMeta?.isResponding)
  const rawActiveAgentStatus =
    activeAgent && agentStatusOverrides[activeAgent.instance_id]
      ? agentStatusOverrides[activeAgent.instance_id]
      : activeAgent?.status ?? ''
  const activeAgentStatusKey =
    typeof rawActiveAgentStatus === 'string' ? rawActiveAgentStatus.toLowerCase() : ''
  const activeAgentWorking =
    Boolean(activeAgent) &&
    Boolean(activeAgentStatusKey) &&
    isLabWorkingStatus(activeAgentStatusKey) &&
    activeAgentStatusKey !== 'waiting'
  const activeAgentStatusLabel =
    typeof activeAgent?.status === 'string' ? activeAgent.status.toLowerCase() : ''
  const shouldOverrideWorking =
    mode === 'direct' && Boolean(activeAgent) && isResponding && activeAgentStatusLabel !== 'waiting'
  const desiredStatusOverride = shouldOverrideWorking ? 'working' : null
  const currentStatusOverride = activeAgent
    ? agentStatusOverrides[activeAgent.instance_id] ?? null
    : null

  React.useEffect(() => {
    const prev = prevAgentIdRef.current
    const next = activeAgent?.instance_id ?? null
    if (prev && prev !== next) {
      setAgentStatusOverride(prev, null)
    }
    prevAgentIdRef.current = next
  }, [activeAgent?.instance_id, setAgentStatusOverride])

  React.useEffect(() => {
    if (!activeAgent?.instance_id) return
    if (currentStatusOverride === desiredStatusOverride) return
    setAgentStatusOverride(activeAgent.instance_id, desiredStatusOverride)
  }, [activeAgent?.instance_id, currentStatusOverride, desiredStatusOverride, setAgentStatusOverride])

  React.useEffect(() => {
    if (!projectId || mode !== 'direct' || !activeAgent?.instance_id) {
      prevRespondingRef.current = false
      return
    }
    const wasResponding = prevRespondingRef.current
    prevRespondingRef.current = isResponding
    if (wasResponding && !isResponding) {
      queryClient.invalidateQueries({ queryKey: ['lab-agents', projectId] })
    }
  }, [activeAgent?.instance_id, isResponding, mode, projectId, queryClient])
  const activeTemplate =
    activeAgent?.template_id ? templatesById.get(activeAgent.template_id) ?? null : null
  const initQuestion = activeTemplate?.init_question?.trim() || ''
  const hasInitQuestion = Boolean(initQuestion)
  const activeQuest =
    (activeAgent?.active_quest_id
      ? quests.find((quest) => quest.quest_id === activeAgent.active_quest_id)
      : quests.find((quest) => quest.quest_id === activeQuestId)) ?? null

  const initTemplateEligible = mode === 'direct' && hasInitQuestion
  const initTemplateReady = Boolean(
    copilotMeta?.ready && copilotMeta?.restoreAttempted && !copilotMeta?.isRestoring
  )
  const shouldShowInitTemplate =
    initTemplateEligible && initTemplateReady && !copilotMeta?.hasHistory
  const shouldHoldInitPrefill = initTemplateEligible && !initTemplateReady

  const [directSessionId, setDirectSessionId] = React.useState<string | null>(null)
  const [directSessionRetryToken, setDirectSessionRetryToken] = React.useState(0)
  const directSessionRetryRef = React.useRef<number | null>(null)
  const directSessionRetryCountRef = React.useRef(0)

  const resetDirectSessionRetry = React.useCallback(() => {
    if (directSessionRetryRef.current) {
      window.clearTimeout(directSessionRetryRef.current)
    }
    directSessionRetryRef.current = null
    directSessionRetryCountRef.current = 0
  }, [])

  const scheduleDirectSessionRetry = React.useCallback(() => {
    if (directSessionRetryRef.current) return
    const attempt = Math.min(directSessionRetryCountRef.current, 4)
    const delayMs = Math.min(15000, 1500 * 2 ** attempt)
    directSessionRetryCountRef.current = attempt + 1
    directSessionRetryRef.current = window.setTimeout(() => {
      directSessionRetryRef.current = null
      setDirectSessionRetryToken((value) => value + 1)
    }, delayMs)
  }, [])

  React.useEffect(() => {
    return () => resetDirectSessionRetry()
  }, [resetDirectSessionRetry])

  React.useEffect(() => {
    if (activeQuestId || quests.length !== 1) return
    setActiveQuest(quests[0].quest_id)
  }, [activeQuestId, quests, setActiveQuest])

  React.useEffect(() => {
    if (!projectId || mode !== 'direct') return
    if (!activeAgent?.instance_id) {
      setDirectSessionId(null)
      resetDirectSessionRetry()
      clearSessionIdForSurface(projectId, 'lab-direct')
      return
    }
    const fallbackSessionId = activeAgent.direct_session_id ?? null
    if (fallbackSessionId) {
      setDirectSessionId((prev) => (prev === fallbackSessionId ? prev : fallbackSessionId))
      if (currentSessionId !== fallbackSessionId) {
        setSessionIdForSurface(projectId, 'lab-direct', fallbackSessionId)
      }
    }
    let cancelled = false
    getLabAgentDirectSession(projectId, activeAgent.instance_id)
      .then((response) => {
        if (cancelled) return
        resetDirectSessionRetry()
        setDirectSessionId(response.session_id)
        if (currentSessionId !== response.session_id) {
          setSessionIdForSurface(projectId, 'lab-direct', response.session_id)
        }
      })
      .catch((error) => {
        if (cancelled) return
        const detail =
          typeof (error as any)?.response?.data?.detail === 'string'
            ? (error as any).response.data.detail
            : null
        if (detail && ['cli_server_required', 'cli_offline', 'cli_server_not_bound'].includes(detail)) {
          scheduleDirectSessionRetry()
          queryClient.invalidateQueries({ queryKey: ['lab-agents', projectId] })
          return
        }
        if (!fallbackSessionId) {
          setDirectSessionId(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [
    activeAgent?.direct_session_id,
    activeAgent?.instance_id,
    activeAgent?.cli_server_id,
    activeAgent?.active_quest_id,
    activeAgent?.active_quest_node_id,
    clearSessionIdForSurface,
    currentSessionId,
    directSessionRetryToken,
    mode,
    projectId,
    queryClient,
    resetDirectSessionRetry,
    scheduleDirectSessionRetry,
    setSessionIdForSurface,
  ])

  React.useEffect(() => {
    if (!piOnboardingActive) return
    if (!activeAgent) {
      endPiOnboarding()
      return
    }
    if (activeTemplate?.template_key !== 'pi' && activeAgent.agent_id !== 'pi') {
      endPiOnboarding()
    }
  }, [activeAgent, activeTemplate?.template_key, endPiOnboarding, piOnboardingActive])

  React.useEffect(() => {
    if (!piOnboardingActive) return
    if (copilotMeta?.hasHistory) {
      endPiOnboarding()
    }
  }, [copilotMeta?.hasHistory, endPiOnboarding, piOnboardingActive])

  const cliReadOnly = cliStatus !== 'online'
  const labReadOnly = readOnly || cliReadOnly
  const mentionsEnabled = !labReadOnly && !(mode === 'direct' && shouldShowInitTemplate)
  const mentionablesOverride = React.useMemo(() => {
    return agents.map((agent) => {
      const template = agent.template_id ? templatesById.get(agent.template_id) ?? null : null
      return buildAgentDescriptor(agent, template)
    })
  }, [agents, templatesById])

  const defaultAgentOverride = React.useMemo(() => {
    if (!activeAgent) return undefined
    const template = activeAgent.template_id
      ? templatesById.get(activeAgent.template_id) ?? null
      : null
    return buildAgentDescriptor(activeAgent, template)
  }, [activeAgent, templatesById])

  React.useEffect(() => {
    if (!activeAgent) {
      setAgentPrefill(null)
      return
    }
    if (shouldShowInitTemplate) {
      setAgentPrefill(null)
      return
    }
    if (shouldHoldInitPrefill) {
      setAgentPrefill(null)
      return
    }
    const rawLabel = activeAgent.mention_label?.trim() || activeAgent.agent_id
    const label = rawLabel.startsWith('@') ? rawLabel : `@${rawLabel}`
    setAgentPrefill({ text: `${label} `, focus: false, token: Date.now() })
  }, [activeAgent, shouldHoldInitPrefill, shouldShowInitTemplate])

  const enforcedMentionLabel = React.useMemo(() => {
    if (activeAgent) {
      const rawLabel = activeAgent.mention_label?.trim() || activeAgent.agent_id
      return rawLabel.startsWith('@') ? rawLabel : `@${rawLabel}`
    }
    return `@${DEFAULT_AGENT_ID}`
  }, [activeAgent])
  const useStarterPrompt = shouldShowInitTemplate
  const enforcedMentionPrefix = mode === 'direct' ? enforcedMentionLabel : undefined
  const lockedMentionPrefix = activeAgent && mode === 'direct' ? enforcedMentionLabel : undefined

  const handleOpenRecruit = React.useCallback(() => {
    if (labReadOnly) {
      addToast({
        type: 'warning',
        title: 'Recruitment unavailable',
        description:
          cliStatus === 'online'
            ? 'Recruitment is disabled in read-only mode.'
            : 'Bind an execution server to recruit agents.',
      })
      return
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lab:open-recruit'))
    }
  }, [addToast, cliStatus, labReadOnly])

  const handleSelectAgent = React.useCallback(
    (agentId: string) => {
      setActiveAgent(agentId)
    },
    [setActiveAgent]
  )
  const starterMetadata = React.useMemo<EventMetadata>(() => {
    if (!activeAgent) {
      return { agent_label: enforcedMentionLabel }
    }
    const logo = resolveAgentLogo(activeAgent, activeTemplate)
    return {
      agent_label: enforcedMentionLabel,
      agent_id: activeAgent.agent_id,
      agent_instance_id: activeAgent.instance_id,
      agent_display_name: resolveAgentDisplayName(activeAgent),
      agent_logo: logo || undefined,
    }
  }, [activeAgent, activeTemplate, enforcedMentionLabel])
  const starterMessage = React.useMemo<ChatMessageItem | null>(() => {
    if (!useStarterPrompt) return null
    const timestamp = Math.floor(Date.now() / 1000)
    return {
      id: `lab-starter-${resolvedAgentId ?? 'unknown'}`,
      type: 'text_delta',
      seq: 0,
      ts: timestamp,
      content: {
        content: initQuestion,
        role: 'assistant',
        status: 'completed',
        timestamp,
        metadata: starterMetadata,
      },
    }
  }, [initQuestion, resolvedAgentId, starterMetadata, useStarterPrompt])

  const handleActionsChange = React.useCallback(
    (actions: AiManusChatActions | null) => {
      setCopilotActions(actions)
      onActionsChange?.(actions)
    },
    [onActionsChange]
  )

  const handleMetaChange = React.useCallback(
    (meta: AiManusChatMeta) => {
      setCopilotMeta((prev) => (isCopilotMetaEqual(prev, meta) ? prev : meta))
    },
    [isCopilotMetaEqual]
  )

  const handleDirectSubmit = React.useCallback(
    (_message: string) => {
      if (directComposeRequest) {
        clearDirectComposeRequest()
      } else if (directPrefill) {
        setDirectPrefill(null)
      }
      if (piOnboardingActive) {
        endPiOnboarding()
      }
    },
    [
      clearDirectComposeRequest,
      directComposeRequest,
      directPrefill,
      endPiOnboarding,
      piOnboardingActive,
      setDirectPrefill,
    ]
  )

  const resolvedDirectPrefill = React.useMemo<CopilotPrefill | null>(() => {
    if (externalPrefill) return externalPrefill
    if (directComposeRequest?.text?.trim()) {
      return {
        text: directComposeRequest.text,
        focus: true,
        token: directComposeRequest.token,
      }
    }
    if (directPrefill && directPrefill.trim()) {
      return {
        text: directPrefill,
        focus: true,
        token: Date.now(),
      }
    }
    return agentPrefill
  }, [agentPrefill, directComposeRequest, directPrefill, externalPrefill])

  React.useEffect(() => {
    const request = directComposeRequest
    if (!request || request.submitMode !== 'auto') return
    if (mode !== 'direct') return
    if (!copilotActions?.setComposerValue || !copilotActions.submitComposer) return
    if (copilotMeta?.isResponding) return
    if (autoSubmittedComposeTokenRef.current === request.token) return
    autoSubmittedComposeTokenRef.current = request.token
    copilotActions.setComposerValue(request.text, true)
    const timer = window.setTimeout(() => {
      copilotActions.submitComposer?.()
    }, 30)
    return () => {
      window.clearTimeout(timer)
    }
  }, [copilotActions, copilotMeta?.isResponding, directComposeRequest, mode])

  React.useEffect(() => {
    if (mode !== 'direct') return
    if (!copilotActions) return
    const key = activeAgent?.instance_id ?? 'none'
    const sessionId =
      directSessionId ??
      activeAgent?.direct_session_id ??
      currentSessionId ??
      null
    if (sessionId) {
      if (currentSessionId !== sessionId) {
        copilotActions.clearThread?.()
        copilotActions.setThreadId(sessionId)
      }
      resetKeyRef.current = key
      return
    }
    if (resetKeyRef.current === key) return
    resetKeyRef.current = key
    copilotActions.setThreadId(null)
  }, [
    activeAgent?.direct_session_id,
    activeAgent?.instance_id,
    copilotActions,
    currentSessionId,
    directSessionId,
    labReadOnly,
    mode,
  ])

  const directMetadata = React.useMemo(() => {
    if (!activeAgent) return null
    const questOverride =
      piOnboardingActive && piOnboardingQuestId ? piOnboardingQuestId : null
    const logo = resolveAgentLogo(activeAgent, activeTemplate)
    const selectionContext = toSelectionMetadata(selection)
    return {
      lab_mode: 'direct',
      quest_id: questOverride ?? activeAgent.active_quest_id ?? undefined,
      quest_node_id: activeAgent.active_quest_node_id ?? undefined,
      agent_id: activeAgent.agent_id,
      agent_label: resolveAgentMentionLabel(activeAgent),
      agent_display_name: resolveAgentDisplayName(activeAgent),
      agent_logo: logo || null,
      agent_avatar_color: activeAgent.avatar_frame_color ?? undefined,
      agent_instance_id: activeAgent.instance_id,
      cli_server_id: activeAgent.cli_server_id ?? cliServerId ?? undefined,
      pi_onboarding_kind: piOnboardingActive ? piOnboardingKind ?? undefined : undefined,
      selection_context: selectionContext,
      proposal_id: activeProposal?.proposal_id ?? undefined,
      target_label: resolveAgentMentionLabel(activeAgent),
      message_kind:
        selectionContext || activeProposal ? 'user_control' : piOnboardingActive ? 'pi_onboarding' : 'text',
    }
  }, [
    activeAgent,
    activeTemplate,
    activeProposal,
    cliServerId,
    piOnboardingActive,
    piOnboardingKind,
    piOnboardingQuestId,
    selection,
  ])
  const controlReferenceFooter = React.useMemo(
    () => (
      <LabControlReferenceChips
        selection={selection}
        proposal={
          activeProposal
            ? {
                proposal_id: activeProposal.proposal_id,
                action_type: activeProposal.action_type,
                status: activeProposal.status,
              }
            : null
        }
        onClearSelection={() => setSelection(null)}
        onClearProposal={() => setActiveProposal(null)}
        selectionPrefix={t('copilot_selection_chip', undefined, 'Ref')}
        proposalPrefix={t('copilot_proposal_chip', undefined, 'Proposal')}
      />
    ),
    [activeProposal, selection, setActiveProposal, setSelection, t]
  )
  const EASE_OUT: [number, number, number, number] = [0, 0, 0.2, 1]
  const modeMotion = allowMotion
    ? {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -12 },
        transition: { duration: 0.2, ease: EASE_OUT },
      }
    : {
        initial: false,
        animate: { opacity: 1 },
        exit: { opacity: 1 },
        transition: { duration: 0 },
      }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <>
        {cliReadOnly ? (
          <div className="border-b border-[var(--lab-border)] px-5 py-2 text-xs text-[var(--lab-text-secondary)]">
            {cliStatus === 'unbound'
              ? 'Bind an execution server to activate Lab Copilot.'
              : 'Your execution server is offline. Messages will be sent once it reconnects.'}
          </div>
        ) : null}
        <AnimatePresence mode="wait" initial={false}>
            {mode === 'direct' ? (
              <motion.div key="direct" className="flex flex-1 min-h-0 flex-col overflow-hidden" {...modeMotion}>
                <div className="flex-1 min-h-0 overflow-hidden">
                  {piOnboardingActive ? (
                    <div className="lab-pi-onboarding-banner">
                      <div>
                        <div className="lab-pi-onboarding-title">
                          Chat with PI
                        </div>
                        <div className="lab-pi-onboarding-subtitle">
                          Send your message to start the conversation.
                        </div>
                      </div>
                      <button type="button" onClick={endPiOnboarding}>
                        Exit
                      </button>
                    </div>
                  ) : null}
                  {!activeAgent ? (
                    <div className="flex h-full flex-col items-center justify-center px-6 py-8">
                      <div className="w-full max-w-3xl">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-base font-semibold text-[var(--lab-text-primary)]">
                              Choose an agent
                            </div>
                            <div className="text-xs text-[var(--lab-text-secondary)]">
                              Select an agent to start a direct chat.
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 px-3 text-xs"
                            onClick={handleOpenRecruit}
                            disabled={labReadOnly}
                          >
                            Recruit Agent
                          </Button>
                        </div>
                        {agents.length === 0 ? (
                          <div className="mt-4 rounded-xl border border-[var(--lab-border)] bg-[var(--lab-surface)] p-4 text-xs text-[var(--lab-text-secondary)]">
                            No agents yet. Recruit an agent to begin a direct chat.
                          </div>
                        ) : (
                          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {agents.map((agent, index) => {
                              const template = agent.template_id
                                ? templatesById.get(agent.template_id) ?? null
                                : null
                              const displayName = resolveAgentDisplayName(agent)
                              const mentionLabel = resolveAgentMentionLabel(agent)
                              const avatarColor =
                                avatarColors.get(agent.instance_id) ??
                                pickAvatarFrameColor(agent.instance_id, index)
                              const logoPath = resolveAgentLogo(agent, template)
                              const statusLabel =
                                typeof agent.status === 'string' ? agent.status.toLowerCase() : 'idle'
                              const isWorking =
                                statusLabel !== 'waiting' && isLabWorkingStatus(statusLabel)
                              const statusClass = isWorking
                                ? 'lab-status-dot-running'
                                : statusLabel === 'waiting'
                                  ? 'lab-status-dot-busy'
                                  : 'lab-status-dot-idle'
                              return (
                                <button
                                  key={agent.instance_id}
                                  type="button"
                                  className="text-left"
                                  onClick={() => handleSelectAgent(agent.instance_id)}
                                >
                                  <div className="lab-card lab-card-hover flex items-center gap-3 rounded-xl border border-[var(--lab-border)] bg-[var(--lab-surface)] p-3">
                                    <div className="lab-avatar lab-avatar-sm">
                                      <span className="lab-avatar-ring" style={{ borderColor: avatarColor }} />
                                      <img src={logoPath} alt={displayName} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-semibold text-[var(--lab-text-primary)] truncate">
                                        {displayName}
                                      </div>
                                      <div className="text-xs text-[var(--lab-text-secondary)] truncate">
                                        {mentionLabel}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] uppercase text-[var(--lab-text-muted)]">
                                      <span className={`lab-status-dot ${statusClass}`} />
                                      {isWorking ? 'Working' : statusLabel === 'waiting' ? 'Waiting' : 'Idle'}
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <LabDirectChatView
                      projectId={projectId}
                      readOnly={labReadOnly}
                      prefill={resolvedDirectPrefill}
                      leadMessage={useStarterPrompt ? starterMessage : null}
                      mentionablesOverride={mentionablesOverride}
                      defaultAgentOverride={defaultAgentOverride}
                      mentionsEnabledOverride={mentionsEnabled}
                      enforcedMentionPrefix={enforcedMentionPrefix}
                      lockedMentionPrefix={lockedMentionPrefix}
                      messageMetadata={directMetadata ?? undefined}
                      composerFooter={controlReferenceFooter}
                      hideCopilotGreeting={useStarterPrompt}
                      busyOverride={activeAgentWorking}
                      onActionsChange={handleActionsChange}
                      onMetaChange={handleMetaChange}
                      onUserSubmit={handleDirectSubmit}
                    />
                  )}
                </div>
              </motion.div>
            ) : null}

            {mode === 'group' ? (
              <motion.div key="group" className="flex flex-1 min-h-0 flex-col overflow-hidden" {...modeMotion}>
                <LabGroupChatView
                  projectId={projectId}
                  quest={activeQuest}
                  quests={quests}
                  agents={agents}
                  templatesById={templatesById}
                  readOnly={labReadOnly}
                  onQuestChange={setActiveQuest}
                />
              </motion.div>
            ) : null}

            {mode === 'friends' ? (
              <motion.div key="friends" className="flex flex-1 min-h-0 flex-col overflow-hidden" {...modeMotion}>
                <LabFriendsFeed
                  projectId={projectId}
                  agents={agents}
                  templatesById={templatesById}
                  readOnly={labReadOnly}
                  quest={activeQuest}
                  quests={quests}
                  onQuestChange={setActiveQuest}
                />
              </motion.div>
            ) : null}
        </AnimatePresence>
      </>
    </div>
  )
}

type LabCopilotMenuEntity = {
  id: string
  name: string
  avatar: string
}

type LabCopilotSearchResult = {
  id: string
  index: number
  title: string
  excerpt: string
}

type LabCopilotRosterContextMenu = {
  agentId: string
  x: number
  y: number
}

type LabCopilotMessageContextMenu = {
  messageId: string
  x: number
  y: number
}

type LabCopilotOverflowMenuProps = {
  label: string
  entities: LabCopilotMenuEntity[]
  emptyEntitiesLabel: string
  searchValue: string
  onSearchChange: (value: string) => void
  searchResults: LabCopilotSearchResult[]
  onSearchSelect: (result: LabCopilotSearchResult) => void
  searchPlaceholder: string
  questId: string | null
  quests: LabQuest[]
  onQuestChange: (questId: string | null) => void
  canManageRoster?: boolean
  rosterBusy?: boolean
  availableAgents?: LabCopilotMenuEntity[]
  onAddAgents?: (agentIds: string[]) => Promise<void> | void
  onRemoveAgent?: (agentId: string) => void
}

const buildSearchSnippet = (content: string, query: string, maxLength = 90) => {
  const trimmed = content.trim()
  if (!trimmed) return ''
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return trimmed.slice(0, maxLength)
  const lower = trimmed.toLowerCase()
  const matchIndex = lower.indexOf(normalizedQuery)
  if (matchIndex === -1) return trimmed.slice(0, maxLength)
  const half = Math.floor(maxLength / 2)
  const start = Math.max(0, matchIndex - half)
  const end = Math.min(trimmed.length, matchIndex + normalizedQuery.length + half)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < trimmed.length ? '...' : ''
  return `${prefix}${trimmed.slice(start, end)}${suffix}`
}

function LabCopilotOverflowMenu({
  label,
  entities,
  emptyEntitiesLabel,
  searchValue,
  onSearchChange,
  searchResults,
  onSearchSelect,
  searchPlaceholder,
  questId,
  quests,
  onQuestChange,
  canManageRoster,
  rosterBusy,
  availableAgents,
  onAddAgents,
  onRemoveAgent,
}: LabCopilotOverflowMenuProps) {
  const hasSearch = searchValue.trim().length > 0
  const manageEnabled = Boolean(canManageRoster && !rosterBusy)
  const availableList = availableAgents ?? []
  const [addOpen, setAddOpen] = React.useState(false)
  const [selectedAgentIds, setSelectedAgentIds] = React.useState<Set<string>>(new Set())
  const [isAdding, setIsAdding] = React.useState(false)
  const [contextMenu, setContextMenu] = React.useState<LabCopilotRosterContextMenu | null>(null)

  React.useEffect(() => {
    if (addOpen) return
    setSelectedAgentIds(new Set())
  }, [addOpen])

  React.useEffect(() => {
    setSelectedAgentIds(new Set())
  }, [questId])

  React.useEffect(() => {
    if (!contextMenu) return
    const handleDismiss = () => setContextMenu(null)
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null)
      }
    }
    window.addEventListener('click', handleDismiss)
    window.addEventListener('contextmenu', handleDismiss)
    window.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', handleDismiss, true)
    return () => {
      window.removeEventListener('click', handleDismiss)
      window.removeEventListener('contextmenu', handleDismiss)
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', handleDismiss, true)
    }
  }, [contextMenu])

  const toggleAgentSelection = React.useCallback((agentId: string) => {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev)
      if (next.has(agentId)) {
        next.delete(agentId)
      } else {
        next.add(agentId)
      }
      return next
    })
  }, [])

  const handleAddConfirm = React.useCallback(async () => {
    if (!manageEnabled || !onAddAgents) return
    const agentIds = Array.from(selectedAgentIds)
    if (agentIds.length === 0) return
    setIsAdding(true)
    try {
      await onAddAgents(agentIds)
      setAddOpen(false)
      setSelectedAgentIds(new Set())
    } finally {
      setIsAdding(false)
    }
  }, [manageEnabled, onAddAgents, selectedAgentIds])

  const handleContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>, agentId: string) => {
      if (!manageEnabled || !onRemoveAgent) return
      event.preventDefault()
      event.stopPropagation()
      setContextMenu({ agentId, x: event.clientX, y: event.clientY })
    },
    [manageEnabled, onRemoveAgent]
  )

  const handleRemove = React.useCallback(() => {
    if (!contextMenu || !onRemoveAgent || !manageEnabled) return
    onRemoveAgent(contextMenu.agentId)
    setContextMenu(null)
  }, [contextMenu, manageEnabled, onRemoveAgent])

  const contextMenuPortal =
    contextMenu && typeof document !== 'undefined'
      ? createPortal(
          <div className="lab-copilot-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <button type="button" onClick={handleRemove} disabled={!manageEnabled}>
              Remove from quest
            </button>
          </div>,
          document.body
        )
      : null

  const canShowAdd = Boolean(onAddAgents)
  const addDisabled = !manageEnabled || availableList.length === 0
  const addHint = !questId
    ? 'Select a quest to add agents.'
    : availableList.length === 0
      ? 'All available agents are already in this quest.'
      : 'Add agents to this quest.'

  return (
    <Popover modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="ds-copilot-icon-btn lab-copilot-overflow-trigger"
          aria-label={`${label} options`}
          data-tooltip={`${label} options`}
        >
          <MoreHorizontal size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={12} className="lab-copilot-menu">
        <div className="lab-copilot-menu-section">
          <div className="lab-copilot-menu-title">{label} roster</div>
          <div className="lab-copilot-entity-list">
            {entities.map((entity) => (
              <div
                key={entity.id}
                className={cn('lab-copilot-entity', manageEnabled && 'is-manageable')}
                onContextMenu={(event) => handleContextMenu(event, entity.id)}
              >
                <div className="lab-avatar lab-avatar-sm">
                  <img src={entity.avatar} alt={entity.name} />
                </div>
                <span className="lab-copilot-entity-name" title={entity.name}>
                  {entity.name}
                </span>
              </div>
            ))}
            {canShowAdd ? (
              <button
                type="button"
                className="lab-copilot-entity lab-copilot-entity-add"
                onClick={() => setAddOpen(true)}
                disabled={addDisabled}
                title={addHint}
                aria-label="Add agents"
              >
                <Plus size={14} />
              </button>
            ) : null}
          </div>
          {!entities.length ? (
            <div className="lab-copilot-menu-muted">{emptyEntitiesLabel}</div>
          ) : null}
        </div>
        <div className="lab-copilot-menu-section">
          <div className="lab-copilot-menu-title">Search chat</div>
          <div className="lab-copilot-search">
            <Search size={14} />
            <input
              type="text"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="lab-copilot-search-input"
            />
          </div>
          {hasSearch ? (
            searchResults.length ? (
              <div className="lab-copilot-search-results">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    className="lab-copilot-search-result"
                    onClick={() => onSearchSelect(result)}
                  >
                    <div className="lab-copilot-search-title">{result.title}</div>
                    <div className="lab-copilot-search-excerpt">{result.excerpt}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="lab-copilot-menu-muted">No matches found.</div>
            )
          ) : (
            <div className="lab-copilot-menu-muted">Type to search this chat.</div>
          )}
        </div>
        <div className="lab-copilot-menu-section">
          <div className="lab-copilot-menu-title">Switch quest</div>
          {quests.length ? (
            <Select value={questId ?? ''} onValueChange={(value) => onQuestChange(value || null)}>
              <SelectTrigger className="lab-copilot-menu-select">
                <SelectValue placeholder="Select quest" />
              </SelectTrigger>
              <SelectContent>
                {quests.map((item) => (
                  <SelectItem key={item.quest_id} value={item.quest_id}>
                    <span className="block max-w-[var(--radix-select-trigger-width)] line-clamp-2">
                      {resolveQuestLabel(item)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="lab-copilot-menu-muted">No quests available.</div>
          )}
        </div>
      </PopoverContent>
      {contextMenuPortal}
      {canShowAdd ? (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="lab-copilot-add-dialog" showCloseButton>
            <DialogHeader>
              <DialogTitle className="lab-copilot-add-title">Add agents</DialogTitle>
              <div className="lab-copilot-add-subtitle">
                {questId ? 'Select agents to join this quest.' : 'Select a quest first to add agents.'}
              </div>
            </DialogHeader>
            {availableList.length ? (
              <div className="lab-copilot-add-list">
                {availableList.map((agent) => {
                  const selected = selectedAgentIds.has(agent.id)
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      className={cn('lab-copilot-add-row', selected && 'is-selected')}
                      onClick={() => toggleAgentSelection(agent.id)}
                    >
                      <span className="lab-copilot-add-check">
                        {selected ? <Check size={12} /> : null}
                      </span>
                      <div className="lab-avatar lab-avatar-sm">
                        <img src={agent.avatar} alt={agent.name} />
                      </div>
                      <span className="lab-copilot-add-name" title={agent.name}>
                        {agent.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="lab-copilot-add-empty">
                {questId ? 'No available agents to add right now.' : 'Select a quest to see available agents.'}
              </div>
            )}
            <DialogFooter className="lab-copilot-add-footer">
              <Button
                variant="outline"
                size="sm"
                className="min-h-[40px] px-4 text-xs"
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="min-h-[40px] px-4 text-xs"
                onClick={handleAddConfirm}
                disabled={addDisabled || selectedAgentIds.size === 0 || isAdding}
              >
                {isAdding ? 'Adding...' : 'Add to quest'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </Popover>
  )
}

type LabGroupChatViewProps = {
  projectId: string
  quest: LabQuest | null
  quests: LabQuest[]
  agents: LabAgentInstance[]
  templatesById: Map<string, LabTemplate>
  readOnly: boolean
  onQuestChange: (questId: string | null) => void
}

function LabGroupChatView({
  projectId,
  quest,
  quests,
  agents,
  templatesById,
  readOnly,
  onQuestChange,
}: LabGroupChatViewProps) {
  const { t } = useI18n('lab')
  const { addToast } = useToast()
  const queryClient = useQueryClient()
  const [input, setInput] = React.useState('')
  const [attachments, setAttachments] = React.useState<AttachmentInfo[]>([])
  const [rosterBusy, setRosterBusy] = React.useState(false)
  const [highlightedMessageId, setHighlightedMessageId] = React.useState<string | null>(null)
  const [messageContextMenu, setMessageContextMenu] =
    React.useState<LabCopilotMessageContextMenu | null>(null)
  const lastSeenMessageIdRef = React.useRef<string | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const [follow, setFollow] = React.useState(true)
  const groupPrefill = useLabCopilotStore((state) => state.groupPrefill)
  const setGroupPrefill = useLabCopilotStore((state) => state.setGroupPrefill)
  const selection = useLabGraphSelectionStore((state) => state.selection)
  const activeProposal = useLabGraphSelectionStore((state) => state.activeProposal)
  const setSelection = useLabGraphSelectionStore((state) => state.setSelection)
  const setActiveProposal = useLabGraphSelectionStore((state) => state.setActiveProposal)
  const setMode = useLabCopilotStore((state) => state.setMode)
  const setActiveAgent = useLabCopilotStore((state) => state.setActiveAgent)
  const setSessionIdForSurface = useChatSessionStore((state) => state.setSessionIdForSurface)
  const user = useAuthStore((state) => state.user)
  const headerPortalTarget = useCopilotDockHeaderPortal()
  const [searchQuery, setSearchQuery] = React.useState('')
  const questId = quest?.quest_id ?? null
  const {
    sessionId,
    messages,
    connection,
    sendMessage,
    historyTruncated,
    historyLimit,
    historyLoadingFull,
    historyLoading,
    hasLoadedOnce,
    loadFullHistory,
  } = useLabSurfaceSession({
    projectId,
    questId,
    surface: 'group',
    enabled: Boolean(questId),
  })
  const agentsById = React.useMemo(() => new Map(agents.map((agent) => [agent.instance_id, agent])), [agents])
  const questAgents = React.useMemo(() => {
    if (!questId) return []
    return agents.filter((agent) => agent.active_quest_id === questId)
  }, [agents, questId])
  const questAgentIds = React.useMemo(
    () => questAgents.map((agent) => agent.instance_id),
    [questAgents]
  )
  const mentionLookup = React.useMemo(() => {
    const map = new Map<string, string>()
    questAgents.forEach((agent) => {
      const mentionLabel = resolveAgentMentionLabel(agent)
      const candidates = new Set<string>()
      if (mentionLabel) {
        candidates.add(mentionLabel)
        candidates.add(mentionLabel.replace(/^@/, ''))
      }
      if (agent.agent_id) {
        candidates.add(agent.agent_id)
      }
      if (agent.display_name) {
        candidates.add(agent.display_name)
      }
      candidates.forEach((candidate) => {
        const normalized = candidate.trim().toLowerCase()
        if (!normalized) return
        if (!map.has(normalized)) {
          map.set(normalized, agent.instance_id)
        }
      })
    })
    return map
  }, [questAgents])
  const mentionables = React.useMemo(() => {
    if (!questId) return []
    const allDescriptor = {
      id: 'all',
      label: '@ALL',
      description: 'Notify all agents in this quest',
      role: 'broadcast',
      source: 'lab',
    }
    const entries = questAgents.map((agent) => {
      const template = agent.template_id ? templatesById.get(agent.template_id) ?? null : null
      return buildAgentDescriptor(agent, template)
    })
    return [allDescriptor, ...entries]
  }, [questAgents, questId, templatesById])
  const menuEntities = React.useMemo(() => {
    return questAgents.map((agent) => {
      const template = agent.template_id ? templatesById.get(agent.template_id) ?? null : null
      return {
        id: agent.instance_id,
        name: resolveAgentDisplayName(agent),
        avatar: resolveAgentLogo(agent, template),
      }
    })
  }, [questAgents, templatesById])
  const availableAgents = React.useMemo(() => {
    if (!questId) return []
    return agents
      .filter((agent) => agent.active_quest_id !== questId)
      .map((agent) => {
        const template = agent.template_id ? templatesById.get(agent.template_id) ?? null : null
        return {
          id: agent.instance_id,
          name: resolveAgentDisplayName(agent),
          avatar: resolveAgentLogo(agent, template),
        }
      })
  }, [agents, questId, templatesById])
  const emptyStateLabel = React.useMemo(() => {
    if (quests.length === 0) return 'Create a quest to get started.'
    return 'Select a quest to start collaborating.'
  }, [quests.length])
  const emptyRosterLabel = questId
    ? 'No agents assigned to this quest yet.'
    : 'Select a quest to see its agents.'
  const connectionStatus = React.useMemo(() => {
    if (connection.status === 'rate_limited') return 'Rate limited. Retrying...'
    if (connection.status === 'reconnecting') return 'Reconnecting...'
    if (connection.status === 'error') return connection.error || 'Connection error'
    return null
  }, [connection.error, connection.status])
  const showLoadFullHistory = historyTruncated && Boolean(sessionId)
  const showHistoryLoadingOverlay =
    Boolean(questId) && historyLoading && messages.length === 0 && !hasLoadedOnce
  const historyLabel =
    typeof historyLimit === 'number' && historyLimit > 0
      ? `Showing latest ${historyLimit} messages.`
      : 'Showing recent messages.'
  const currentUserLabel = React.useMemo(() => {
    const raw = user?.username || user?.email || user?.id || 'You'
    const trimmed = raw?.trim?.() ?? ''
    return trimmed || 'You'
  }, [user?.email, user?.id, user?.username])

  React.useEffect(() => {
    setSearchQuery('')
    setHighlightedMessageId(null)
    lastSeenMessageIdRef.current = null
    setFollow(true)
    setInput('')
  }, [questId])

  React.useEffect(() => {
    if (!messageContextMenu) return
    const handleDismiss = () => setMessageContextMenu(null)
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMessageContextMenu(null)
      }
    }
    window.addEventListener('click', handleDismiss)
    window.addEventListener('contextmenu', handleDismiss)
    window.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', handleDismiss, true)
    return () => {
      window.removeEventListener('click', handleDismiss)
      window.removeEventListener('contextmenu', handleDismiss)
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', handleDismiss, true)
    }
  }, [messageContextMenu])

  React.useEffect(() => {
    if (!groupPrefill) return
    if (!input.trim()) {
      setInput(groupPrefill.trim() ? `${groupPrefill} ` : '')
    }
    setGroupPrefill(null)
  }, [groupPrefill, input, setGroupPrefill])

  const stripLeadingMentions = React.useCallback((raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return ''
    const parts = trimmed.split(/\s+/)
    let index = 0
    while (index < parts.length) {
      const token = parts[index]
      if (!token || !token.startsWith('@') || token.length === 1) break
      index += 1
    }
    return parts.slice(index).join(' ').trim()
  }, [])

  const parseGroupInput = React.useCallback(
    (raw: string) => {
      const text = raw.trim()
      const mentionPattern = /@([A-Za-z0-9_.-]+)/g
      const targets = new Set<string>()
      const missing = new Set<string>()
      let hasAll = false
      let match: RegExpExecArray | null
      while ((match = mentionPattern.exec(text)) !== null) {
        const token = match[1]?.trim()
        if (!token) continue
        const lowered = token.toLowerCase()
        if (lowered === 'all') {
          hasAll = true
          continue
        }
        const directKey = lowered.startsWith('@') ? lowered : `@${lowered}`
        const targetId = mentionLookup.get(directKey) ?? mentionLookup.get(lowered)
        if (targetId) {
          targets.add(targetId)
        } else {
          missing.add(`@${token}`)
        }
      }
      if (hasAll) {
        questAgentIds.forEach((agentId) => targets.add(agentId))
        missing.clear()
      }
      const stripped = stripLeadingMentions(text)
      const content = stripped || (targets.size > 0 || hasAll ? '' : text)
      return {
        content,
        targets: Array.from(targets),
        missing: Array.from(missing),
      }
    },
    [mentionLookup, questAgentIds, stripLeadingMentions]
  )

  const resolveMentionLabel = React.useCallback(
    (agentInstanceId: string) => {
      const agent = agentsById.get(agentInstanceId)
      if (!agent) return ''
      return resolveAgentMentionLabel(agent)
    },
    [agentsById]
  )

  const handleSend = async () => {
    if (!questId || !input.trim() || readOnly || !sessionId) return
    try {
      const parsed = parseGroupInput(input)
      if (parsed.missing.length > 0) {
        addToast({
          type: 'error',
          title: 'Unknown agent',
          description: `Unknown mention: ${parsed.missing.join(', ')}`,
        })
        return
      }
      if (parsed.targets.length === 0) {
        addToast({
          type: 'error',
          title: 'Mention required',
          description: 'Mention a quest agent to start a group request.',
        })
        return
      }
      setFollow(true)
      await sendMessage({
        sessionId,
        message: parsed.content,
        surface: 'lab-group',
        mentionTargets: parsed.targets,
        metadata: {
          selection_context: toSelectionMetadata(selection),
          proposal_id: activeProposal?.proposal_id ?? undefined,
          message_kind:
            activeProposal || selection ? 'user_control' : parsed.targets.length > 0 ? 'group_request' : 'text',
          target_label:
            parsed.targets.length === 1 ? resolveMentionLabel(parsed.targets[0]) || undefined : undefined,
        },
      })
      setInput('')
      setAttachments([])
    } catch {
      addToast({
        type: 'error',
        title: 'Message failed',
        description: "Message couldn't be sent. Please check your connection and try again.",
      })
    }
  }

  React.useEffect(() => {
    const latest = messages[messages.length - 1]
    if (!latest?.id) return
    if (!lastSeenMessageIdRef.current) {
      lastSeenMessageIdRef.current = latest.id
      return
    }
    if (latest.id !== lastSeenMessageIdRef.current) {
      lastSeenMessageIdRef.current = latest.id
      setHighlightedMessageId(latest.id)
      const timer = window.setTimeout(() => setHighlightedMessageId(null), 1200)
      return () => window.clearTimeout(timer)
    }
  }, [messages])

  const resolveGroupMentionPrefix = React.useCallback(
    (message: ChatMessageItem) => {
      const metadata = getMessageMetadata(message)
      const targets = Array.isArray(metadata?.mention_targets) ? metadata?.mention_targets : []
      if (!targets.length) return ''
      const labels = targets
        .map((agentId) => resolveMentionLabel(agentId))
        .filter((label) => Boolean(label))
      if (!labels.length) return ''
      return Array.from(new Set(labels)).join(' ')
    },
    [resolveMentionLabel]
  )

  const resolveGroupDisplayText = React.useCallback(
    (message: ChatMessageItem) => {
      const base = getMessageText(message)
      if (getMessageRole(message) !== 'user') return base
      const prefix = resolveGroupMentionPrefix(message)
      if (!prefix) return base
      return base ? `${prefix} ${base}` : prefix
    },
    [resolveGroupMentionPrefix]
  )

  const resolveGroupDisplayMessage = React.useCallback(
    (message: ChatMessageItem) => {
      if (getMessageRole(message) !== 'user') return message
      const base = getMessageText(message)
      const nextText = resolveGroupDisplayText(message)
      if (!nextText || nextText === base) return message
      const content = message.content as MessageContent
      if (!content || typeof content !== 'object' || typeof content.content !== 'string') {
        return message
      }
      return {
        ...message,
        content: {
          ...content,
          content: nextText,
        },
      }
    },
    [resolveGroupDisplayText]
  )

  const messageContentById = React.useMemo(() => {
    const map = new Map<string, string>()
    messages.forEach((message) => {
      const content = resolveGroupDisplayText(message)
      if (content) {
        map.set(message.id, content)
      }
    })
    return map
  }, [messages, resolveGroupDisplayText])

  const messagesById = React.useMemo(() => {
    return new Map(messages.map((message) => [message.id, message]))
  }, [messages])

  const messageContentByGroupId = React.useMemo(() => {
    const map = new Map<string, string>()
    messages.forEach((message) => {
      const metadata = getMessageMetadata(message)
      const groupId = typeof metadata?.group_message_id === 'string' ? metadata.group_message_id : ''
      if (!groupId) return
      const content = resolveGroupDisplayText(message)
      if (content) {
        map.set(groupId, content)
      }
    })
    return map
  }, [messages, resolveGroupDisplayText])

  const messagesByGroupId = React.useMemo(() => {
    const map = new Map<string, ChatMessageItem>()
    messages.forEach((message) => {
      const metadata = getMessageMetadata(message)
      const groupId = typeof metadata?.group_message_id === 'string' ? metadata.group_message_id : ''
      if (groupId) {
        map.set(groupId, message)
      }
    })
    return map
  }, [messages])

  const resolveGroupQuote = React.useCallback(
    (message: ChatMessageItem) => {
      const metadata = getMessageMetadata(message)
      if (!metadata) return null
      const metaRecord = metadata as Record<string, unknown>
      const context =
        metaRecord.context && typeof metaRecord.context === 'object'
          ? (metaRecord.context as Record<string, unknown>)
          : null
      const replyToMessageId =
        (typeof metaRecord.reply_to_message_id === 'string' && metaRecord.reply_to_message_id) ||
        (typeof metaRecord.quote_message_id === 'string' && metaRecord.quote_message_id) ||
        (typeof context?.reply_to_message_id === 'string' && context.reply_to_message_id) ||
        (typeof context?.quote_message_id === 'string' && context.quote_message_id) ||
        ''
      const rawSnapshot =
        metaRecord.quote_snapshot && typeof metaRecord.quote_snapshot === 'object'
          ? (metaRecord.quote_snapshot as Record<string, unknown>)
          : context?.quote_snapshot && typeof context.quote_snapshot === 'object'
            ? (context.quote_snapshot as Record<string, unknown>)
            : null
      if (!replyToMessageId && !rawSnapshot) return null

      const snapshotMessageId =
        rawSnapshot && typeof rawSnapshot.group_message_id === 'string'
          ? rawSnapshot.group_message_id
          : ''
      const lookupMessageId = replyToMessageId || snapshotMessageId
      const quotedMessage = lookupMessageId ? messagesByGroupId.get(lookupMessageId) ?? null : null
      const snapshotContent =
        rawSnapshot && typeof rawSnapshot.content === 'string' ? rawSnapshot.content : ''
      const fallbackContent = lookupMessageId
        ? messageContentByGroupId.get(lookupMessageId) ?? ''
        : ''
      const quoteContent = (snapshotContent || fallbackContent).replace(/\s+/g, ' ').trim()
      if (!quoteContent) return null

      let sender = ''
      if (quotedMessage) {
        sender = resolveMessageTitle(quotedMessage)
      } else if (rawSnapshot) {
        sender =
          (typeof rawSnapshot.sender_name === 'string' && rawSnapshot.sender_name) ||
          (typeof rawSnapshot.agent_display_name === 'string' && rawSnapshot.agent_display_name) ||
          (typeof rawSnapshot.sender_label === 'string' && rawSnapshot.sender_label) ||
          (typeof rawSnapshot.agent_label === 'string' && rawSnapshot.agent_label) ||
          ''
      }
      if (!sender) sender = 'User'

      return { sender, content: quoteContent }
    },
    [messageContentByGroupId, messagesByGroupId]
  )

  const handleAvatarContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>, message: ChatMessageItem) => {
      const metadata = getMessageMetadata(message)
      const agentId = metadata?.agent_instance_id ?? metadata?.sender_instance_id
      const sessionId = metadata?.session_id
      if (!agentId && !sessionId) return
      setMessageContextMenu({ messageId: message.id, x: event.clientX, y: event.clientY })
    },
    []
  )

  const contextTarget = messageContextMenu
    ? messagesById.get(messageContextMenu.messageId) ?? null
    : null
  const contextMetadata = contextTarget ? getMessageMetadata(contextTarget) : null
  const contextAgentId = contextMetadata?.agent_instance_id ?? null
  const contextSessionId =
    typeof contextMetadata?.session_id === 'string' ? contextMetadata.session_id : null
  const canOpenDirect = Boolean(contextAgentId)

  const handleOpenDirect = React.useCallback(() => {
    if (!contextAgentId) return
    setActiveAgent(contextAgentId)
    if (contextSessionId) {
      setSessionIdForSurface(projectId, 'lab-direct', contextSessionId)
    }
    setMode('direct')
    setMessageContextMenu(null)
  }, [contextAgentId, contextSessionId, projectId, setActiveAgent, setMode, setSessionIdForSurface])

  const scrollToBottom = React.useCallback(() => {
    const node = scrollRef.current
    if (!node) return
    if (typeof node.scrollTo === 'function') {
      node.scrollTo({ top: node.scrollHeight, behavior: 'auto' })
    } else {
      node.scrollTop = node.scrollHeight
    }
  }, [])

  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget
      const nextFollow = isScrolledToBottom(target)
      setFollow((prev) => (prev === nextFollow ? prev : nextFollow))
    },
    [isScrolledToBottom]
  )

  const handleLoadFullHistory = React.useCallback(() => {
    setFollow(false)
    loadFullHistory()
  }, [loadFullHistory])

  React.useEffect(() => {
    if (!questId || messages.length === 0) return
    if (!follow) return
    window.requestAnimationFrame(() => scrollToBottom())
  }, [follow, messages, questId, scrollToBottom])

  const listOffset = showLoadFullHistory ? 1 : 0
  const listCount = messages.length + listOffset
  const shouldVirtualize = listCount > 20
  const rowVirtualizer = useVirtualizer({
    count: listCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (showLoadFullHistory && index === 0 ? 56 : 160),
    getItemKey: (index) => {
      if (showLoadFullHistory && index === 0) return 'lab-group-history-banner'
      const message = messages[index - listOffset]
      return message?.id ?? `lab-group-${index}`
    },
    overscan: 6,
  })

  const groupSearchResults = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return []
    const results: LabCopilotSearchResult[] = []
    messages.forEach((item, index) => {
      const content = messageContentById.get(item.id) ?? ''
      if (!content) return
      if (!content.toLowerCase().includes(query)) return
      const title = resolveMessageTitle(item)
      results.push({
        id: item.id,
        index,
        title,
        excerpt: buildSearchSnippet(content, query),
      })
    })
    return results
  }, [messageContentById, messages, searchQuery])

  const handleAddAgents = React.useCallback(
    async (agentIds: string[]) => {
      if (!questId || readOnly || agentIds.length === 0) return
      setRosterBusy(true)
      try {
        const results = await Promise.allSettled(
          agentIds.map((agentId) =>
            assignLabAgent(projectId, agentId, { quest_id: questId, quest_node_id: null })
          )
        )
        const failed: string[] = []
        results.forEach((result, index) => {
          if (result.status !== 'fulfilled') {
            failed.push(agentIds[index])
          }
        })
        if (failed.length) {
          const names = failed.map((agentId) => {
            const agent = agentsById.get(agentId)
            return agent ? resolveAgentDisplayName(agent) : agentId
          })
          addToast({
            type: 'error',
            title: 'Unable to add agents',
            description: `Failed to add: ${names.join(', ')}`,
          })
        }
        queryClient.invalidateQueries({ queryKey: ['lab-agents', projectId] })
      } finally {
        setRosterBusy(false)
      }
    },
    [addToast, agentsById, projectId, queryClient, questId, readOnly]
  )

  const handleRemoveAgent = React.useCallback(
    async (agentId: string) => {
      if (!questId || readOnly) return
      setRosterBusy(true)
      try {
        await assignLabAgent(projectId, agentId, { quest_id: null, quest_node_id: null })
        queryClient.invalidateQueries({ queryKey: ['lab-agents', projectId] })
      } catch (error) {
        const agent = agentsById.get(agentId)
        const label = agent ? resolveAgentDisplayName(agent) : agentId
        addToast({
          type: 'error',
          title: 'Unable to remove agent',
          description: `Failed to remove ${label} from this quest.`,
        })
      } finally {
        setRosterBusy(false)
      }
    },
    [addToast, agentsById, projectId, queryClient, questId, readOnly]
  )

  const flashMessageHighlight = React.useCallback((messageId: string) => {
    setHighlightedMessageId(messageId)
    if (typeof window !== 'undefined') {
      window.setTimeout(() => setHighlightedMessageId(null), 1200)
    }
  }, [])

  const jumpToGroupResult = React.useCallback(
    (result: LabCopilotSearchResult) => {
      if (!result) return
      if (!scrollRef.current) return
      setFollow(false)
      if (shouldVirtualize) {
        rowVirtualizer.scrollToIndex(result.index, { align: 'center' })
      } else {
        const node = scrollRef.current?.querySelector(
          `[data-group-message-id="${result.id}"]`
        ) as HTMLElement | null
        if (node) {
          node.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
      flashMessageHighlight(result.id)
    },
    [flashMessageHighlight, listOffset, rowVirtualizer, shouldVirtualize]
  )

  React.useEffect(() => {
    if (!searchQuery.trim()) return
    if (groupSearchResults.length === 0) return
    jumpToGroupResult(groupSearchResults[0])
  }, [groupSearchResults, jumpToGroupResult, searchQuery])

  const menuPortal = headerPortalTarget
    ? createPortal(
        <LabCopilotOverflowMenu
          label="Group"
          entities={menuEntities}
          emptyEntitiesLabel={emptyRosterLabel}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchResults={groupSearchResults}
          onSearchSelect={jumpToGroupResult}
          searchPlaceholder="Search group chat"
          questId={questId}
          quests={quests}
          onQuestChange={onQuestChange}
          canManageRoster={!readOnly && Boolean(questId)}
          rosterBusy={rosterBusy}
          availableAgents={availableAgents}
          onAddAgents={handleAddAgents}
          onRemoveAgent={handleRemoveAgent}
        />,
        headerPortalTarget
      )
    : null

  const messageContextMenuPortal =
    messageContextMenu && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="lab-copilot-context-menu"
            style={{ left: messageContextMenu.x, top: messageContextMenu.y }}
          >
            <button type="button" onClick={handleOpenDirect} disabled={!canOpenDirect}>
              Open direct session
            </button>
          </div>,
          document.body
        )
      : null

  const renderGroupMessage = (message: ChatMessageItem) => {
    const displayMessage = resolveGroupDisplayMessage(message)
    const content = displayMessage.content as MessageContent
    const displayStreaming = message.type === 'text_delta' && content.status === 'in_progress'
    const isHighlighted = highlightedMessageId === message.id
    const role = getMessageRole(displayMessage)
    const metadata = getMessageMetadata(displayMessage) as Record<string, unknown> | null
    const timestampLabel =
      role === 'assistant' ? formatAbsoluteTimestamp(content?.timestamp) : ''
    const quote = resolveGroupQuote(displayMessage)
    const senderLabel =
      typeof metadata?.sender_label === 'string'
        ? metadata.sender_label
        : typeof metadata?.agent_label === 'string'
          ? metadata.agent_label
          : null
    const targetLabel = typeof metadata?.target_label === 'string' ? metadata.target_label : null
    const replyState = typeof metadata?.reply_state === 'string' ? metadata.reply_state : null
    const replyStateLabel = resolveReplyStateLabel(t, replyState)
    const proposalId = typeof metadata?.proposal_id === 'string' ? metadata.proposal_id : null
    const selectionLabel = resolveSelectionLabel(
      metadata?.selection_context && typeof metadata.selection_context === 'object'
        ? ({
            ...(metadata.selection_context as Record<string, unknown>),
            label:
              typeof (metadata.selection_context as Record<string, unknown>).branch_name === 'string'
                ? ((metadata.selection_context as Record<string, unknown>).branch_name as string)
                : undefined,
          } as LabGraphSelection)
        : null
    )
    return (
      <div
        key={message.id}
        className={cn('rounded-[12px] px-1', isHighlighted && 'lab-message-highlight')}
        data-group-message-id={message.id}
      >
        {senderLabel || targetLabel || replyStateLabel || proposalId || selectionLabel ? (
          <div className="mb-2 flex flex-wrap items-center gap-2 px-2">
            {senderLabel || targetLabel ? (
              <span className="inline-flex items-center rounded-full border border-[var(--lab-border)] bg-[var(--lab-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--lab-text-secondary)]">
                {senderLabel || t('copilot_group_sender_fallback', undefined, 'Agent')}
                {targetLabel ? ` → ${targetLabel}` : ''}
              </span>
            ) : null}
            {replyStateLabel ? (
              <span className="inline-flex items-center rounded-full border border-[rgba(83,176,174,0.2)] bg-[rgba(83,176,174,0.1)] px-2 py-0.5 text-[10px] font-medium text-[var(--lab-text-secondary)]">
                {replyStateLabel}
              </span>
            ) : null}
            {proposalId ? (
              <span className="inline-flex items-center rounded-full border border-[var(--lab-border)] bg-[var(--lab-background)] px-2 py-0.5 text-[10px] text-[var(--lab-text-secondary)]">
                {t('copilot_group_proposal_badge', undefined, 'Proposal')} · {proposalId.slice(0, 8)}
              </span>
            ) : null}
            {selectionLabel ? (
              <span className="inline-flex items-center rounded-full border border-[var(--lab-border)] bg-[var(--lab-background)] px-2 py-0.5 text-[10px] text-[var(--lab-text-secondary)]">
                {selectionLabel}
              </span>
            ) : null}
          </div>
        ) : null}
        <ChatMessage
          message={displayMessage}
          compact
          onAvatarContextMenu={handleAvatarContextMenu}
          displayStreaming={displayStreaming}
          streamActive={
            connection.status === 'open' ||
            connection.status === 'connecting' ||
            connection.status === 'reconnecting'
          }
        />
        {quote ? (
          <div
            className={cn('mt-2 flex w-full', role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div className="max-w-[85%] rounded-[8px] bg-[rgba(0,0,0,0.06)] px-3 py-2 text-[10px] leading-relaxed text-[var(--text-secondary)]">
              <div className="line-clamp-2">
                <span className="font-medium text-[var(--text-tertiary)]">
                  {quote.sender}:
                </span>{' '}
                {quote.content}
              </div>
            </div>
          </div>
        ) : null}
        {timestampLabel ? <div className="lab-message-timestamp">{timestampLabel}</div> : null}
      </div>
    )
  }

  const renderHistoryBanner = () => (
    <div className="mb-3 flex justify-center">
      <div
        className={cn(
          'inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1 font-medium',
          'border-[var(--lab-border)] bg-[var(--lab-surface)] text-[var(--lab-text-secondary)]',
          'text-[11px]'
        )}
      >
        <span>{historyLabel}</span>
        <button
          type="button"
          onClick={() => {
            setFollow(false)
            loadFullHistory()
          }}
          disabled={historyLoadingFull}
          className="text-[var(--lab-text-primary)] underline decoration-dotted underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {historyLoadingFull ? 'Loading full history...' : 'Load full history'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      {menuPortal}
      {messageContextMenuPortal}
      <div className="ai-manus-root ai-manus-copilot ai-manus-embedded flex flex-1 min-h-0 flex-col">
        <div className="relative flex flex-1 min-h-0 flex-col">
          <ScrollArea ref={scrollRef} className="flex-1 min-h-0" onScroll={handleScroll}>
            <div className="flex min-h-full flex-col px-4 py-4">
              {!questId ? (
                <div className="flex flex-1 items-center justify-center text-[12px] text-[var(--text-tertiary)]">
                  {emptyStateLabel}
                </div>
              ) : (
                <>
                  {connectionStatus ? (
                    <div className="mb-3 text-center text-[11px] text-[var(--text-tertiary)]">
                      {connectionStatus}
                    </div>
                  ) : null}
                  {shouldVirtualize ? (
                    <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
                      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        if (showLoadFullHistory && virtualRow.index === 0) {
                          return (
                            <div
                              key={virtualRow.key}
                              data-index={virtualRow.index}
                              ref={rowVirtualizer.measureElement}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${virtualRow.start}px)`,
                              }}
                            >
                              {renderHistoryBanner()}
                            </div>
                          )
                        }
                        const message = messages[virtualRow.index - listOffset]
                        if (!message) return null
                        return (
                          <div
                            key={virtualRow.key}
                            data-index={virtualRow.index}
                            ref={rowVirtualizer.measureElement}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              transform: `translateY(${virtualRow.start}px)`,
                            }}
                          >
                            <div className="pb-3">{renderGroupMessage(message)}</div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {showLoadFullHistory ? renderHistoryBanner() : null}
                      {messages.map((message) => renderGroupMessage(message))}
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
          {showHistoryLoadingOverlay ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-sm',
                  'border-[var(--lab-border)] bg-[var(--lab-surface)] text-[var(--lab-text-secondary)]'
                )}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('common_loading', undefined, 'Loading...')}</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-[var(--border-main)] px-4 py-3">
          <LabControlReferenceChips
            selection={selection}
            proposal={
              activeProposal
                ? {
                    proposal_id: activeProposal.proposal_id,
                    action_type: activeProposal.action_type,
                    status: activeProposal.status,
                  }
                : null
            }
            onClearSelection={() => setSelection(null)}
            onClearProposal={() => setActiveProposal(null)}
            selectionPrefix={t('copilot_selection_chip', undefined, 'Ref')}
            proposalPrefix={t('copilot_proposal_chip', undefined, 'Proposal')}
          />
          <ChatBox
            value={input}
            onChange={setInput}
            onSubmit={handleSend}
            isRunning={false}
            mentionables={mentionables}
            mentionEnabled={!readOnly}
            includeDefaultAgent={false}
            lockLeadingMentionSpace
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            attachmentsEnabled={false}
            readOnly={readOnly}
            inputDisabled={!questId}
            rows={2}
            placeholder={
              !questId
                ? emptyStateLabel
                : readOnly
                  ? t(
                      'copilot_group_placeholder_offline',
                      undefined,
                      'Your execution server is offline. Messages will be sent once it reconnects.'
                    )
                  : t(
                      'copilot_group_placeholder',
                      undefined,
                      'Message @ALL or a quest agent'
                    )
            }
            compact
            containerClassName="pb-0"
          />
        </div>
      </div>
    </div>
  )
}

type LabFriendsFeedProps = {
  projectId: string
  agents: LabAgentInstance[]
  templatesById: Map<string, LabTemplate>
  readOnly: boolean
  quest: LabQuest | null
  quests: LabQuest[]
  onQuestChange: (questId: string | null) => void
}

type FriendsMomentCardProps = {
  message: ChatMessageItem
  readOnly: boolean
  liked: boolean
  busy: boolean
  likeUsers: string[]
  comments: MomentCommentItem[]
  onToggleLike: (momentId: string, nextLiked: boolean) => Promise<void>
  onCommentSubmit: (momentId: string, content: string) => Promise<boolean>
  onAvatarContextMenu?: (event: React.MouseEvent<HTMLDivElement>, message: ChatMessageItem) => void
}

function FriendsMomentCard({
  message,
  readOnly,
  liked,
  busy,
  likeUsers,
  comments,
  onToggleLike,
  onCommentSubmit,
  onAvatarContextMenu,
}: FriendsMomentCardProps) {
  const metadata = getMessageMetadata(message)
  const metadataRecord = metadata as Record<string, unknown> | null
  const momentId = typeof metadata?.moment_id === 'string' ? metadata.moment_id : ''
  const contentText = getMessageText(message)
  const mediaItems = resolveMomentMedia(metadata?.moment_media)
  const senderName = metadata?.sender_name || resolveMessageTitle(message)
  const senderLabel = metadata?.sender_label || metadata?.agent_label
  const avatarUrl = metadata?.sender_avatar_url || metadata?.agent_logo || ''
  const avatarColor = metadata?.sender_avatar_color || metadata?.agent_avatar_color || ''
  const timestampLabel = formatAbsoluteTimestamp(resolveMomentTimestamp(message))
  const contentHtml = contentText ? renderMarkdown(contentText) : ''
  const [commentOpen, setCommentOpen] = React.useState(false)
  const [commentDraft, setCommentDraft] = React.useState('')

  React.useEffect(() => {
    setCommentOpen(false)
    setCommentDraft('')
  }, [momentId])

  const countValue = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
    return 0
  }

  const likeCount = countValue(metadata?.moment_like_count)
  const commentCount = countValue(metadata?.moment_comment_count)
  const avatarInitial = senderName?.trim().slice(0, 1).toUpperCase() || '?'
  const displayName = (() => {
    const raw = senderLabel || senderName || 'Agent'
    const trimmed = raw.trim()
    if (!trimmed) return '@Agent'
    return trimmed.startsWith('@') ? trimmed : `@${trimmed}`
  })()
  const resolvedLikeUsers = mergeMomentLikes(
    resolveMomentLikes(
      metadataRecord?.moment_like_users ??
        metadataRecord?.moment_likes ??
        metadataRecord?.like_users ??
        metadataRecord?.likes ??
        metadataRecord?.moment_reactions ??
        null
    ),
    likeUsers.map((name) => ({ name }))
  )
  const resolvedComments = mergeMomentComments(
    resolveMomentComments(
      metadataRecord?.moment_comments ??
        metadataRecord?.moment_comment_list ??
        metadataRecord?.comments ??
        metadataRecord?.moment_comment_items ??
        metadataRecord?.comment_items ??
        null
    ),
    comments
  )
  const showReactions = resolvedLikeUsers.length > 0 || resolvedComments.length > 0

  const handleLikeClick = async () => {
    if (!momentId || readOnly || busy) return
    await onToggleLike(momentId, !liked)
  }

  const handleCommentToggle = () => {
    if (readOnly) return
    setCommentOpen((prev) => !prev)
  }

  const handleCommentSubmit = async () => {
    if (!momentId || readOnly || busy) return
    const trimmed = commentDraft.trim()
    if (!trimmed) return
    const ok = await onCommentSubmit(momentId, trimmed)
    if (ok) {
      setCommentDraft('')
      setCommentOpen(false)
    }
  }

  const handleCommentKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleCommentSubmit()
    }
  }

  return (
    <div className="lab-moment-card">
      <div
        className="lab-avatar lab-avatar-sm lab-moment-avatar"
        onContextMenu={(event) => onAvatarContextMenu?.(event, message)}
      >
        <span className="lab-avatar-ring" style={avatarColor ? { borderColor: avatarColor } : undefined} />
        {avatarUrl ? <img src={avatarUrl} alt={senderName} /> : <span>{avatarInitial}</span>}
      </div>
      <div className="lab-moment-main">
        <div className="lab-moment-name">{displayName}</div>
        {contentHtml ? (
          <div
            className="lab-moment-content"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        ) : null}
        {mediaItems.length ? (
          <div className="lab-moment-media">
            {mediaItems.map((item, index) => (
              <div key={`${item.url}-${index}`} className="lab-moment-media-item">
                <img src={item.url} alt={item.label || `Moment media ${index + 1}`} />
              </div>
            ))}
          </div>
        ) : null}
        <div className="lab-moment-meta-row">
          {timestampLabel ? <div className="lab-moment-timestamp">{timestampLabel}</div> : <div />}
          <div className="lab-moment-actions">
            <button
              type="button"
              className={cn('lab-moment-action', liked && 'is-active')}
              onClick={handleLikeClick}
              disabled={readOnly || busy}
              aria-label="Like moment"
            >
              <ThumbsUp size={14} />
              <span>{likeCount}</span>
            </button>
            <button
              type="button"
              className="lab-moment-action"
              onClick={handleCommentToggle}
              disabled={readOnly || busy}
              aria-label="Comment on moment"
            >
              <MessageCircle size={14} />
              <span>{commentCount}</span>
            </button>
          </div>
        </div>
        {showReactions ? (
          <div className="lab-moment-reactions">
            {resolvedLikeUsers.length ? (
              <div className="lab-moment-like-row">
                <ThumbsUp size={12} />
                <span className="lab-moment-like-names">{resolvedLikeUsers.join(', ')}</span>
              </div>
            ) : null}
            {resolvedComments.map((comment, index) => (
              <div key={`${comment.name}-${index}`} className="lab-moment-comment-row">
                <span className="lab-moment-comment-name">{comment.name}</span>
                <span className="lab-moment-comment-sep">:</span>
                <span className="lab-moment-comment-text">{comment.content}</span>
              </div>
            ))}
          </div>
        ) : null}
        {commentOpen ? (
          <div className="lab-moment-comment">
            <textarea
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              onKeyDown={handleCommentKeyDown}
              placeholder="Write a comment"
              className="lab-moment-comment-input"
              rows={2}
              disabled={readOnly || busy}
            />
            <div className="lab-moment-comment-actions">
              <button
                type="button"
                className="lab-moment-action lab-moment-action-secondary"
                onClick={() => setCommentOpen(false)}
                disabled={readOnly || busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="lab-moment-action lab-moment-action-primary"
                onClick={handleCommentSubmit}
                disabled={readOnly || busy || !commentDraft.trim()}
              >
                Send
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function LabFriendsFeed({
  projectId,
  agents,
  templatesById,
  readOnly,
  quest,
  quests,
  onQuestChange,
}: LabFriendsFeedProps) {
  const { addToast } = useToast()
  const queryClient = useQueryClient()
  const [rosterBusy, setRosterBusy] = React.useState(false)
  const [momentBusy, setMomentBusy] = React.useState<Set<string>>(new Set())
  const [likedMoments, setLikedMoments] = React.useState<Record<string, boolean>>({})
  const [momentLikeUsers, setMomentLikeUsers] = React.useState<Record<string, string[]>>({})
  const [momentComments, setMomentComments] = React.useState<Record<string, MomentCommentItem[]>>({})
  const [messageContextMenu, setMessageContextMenu] =
    React.useState<LabCopilotMessageContextMenu | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const lastSeenMessageIdRef = React.useRef<string | null>(null)
  const [highlightedMessageId, setHighlightedMessageId] = React.useState<string | null>(null)
  const [follow, setFollow] = React.useState(true)
  const setMode = useLabCopilotStore((state) => state.setMode)
  const setActiveAgent = useLabCopilotStore((state) => state.setActiveAgent)
  const setSessionIdForSurface = useChatSessionStore((state) => state.setSessionIdForSurface)
  const user = useAuthStore((state) => state.user)
  const currentUserLabel = React.useMemo(() => {
    const raw = user?.username || user?.email || user?.id || 'You'
    const trimmed = raw?.trim?.() ?? ''
    return trimmed || 'You'
  }, [user?.email, user?.id, user?.username])
  const headerPortalTarget = useCopilotDockHeaderPortal()
  const [searchQuery, setSearchQuery] = React.useState('')
  const agentsById = React.useMemo(() => new Map(agents.map((agent) => [agent.instance_id, agent])), [agents])
  const questId = quest?.quest_id ?? null
  const {
    messages,
    connection,
    historyTruncated,
    historyLimit,
    historyLoadingFull,
    historyLoading,
    hasLoadedOnce,
    loadFullHistory,
  } = useLabSurfaceSession({
    projectId,
    questId,
    surface: 'friends',
    enabled: Boolean(questId),
  })
  const friendEntities = React.useMemo(() => {
    if (!questId) return []
    return agents
      .filter((agent) => agent.active_quest_id === questId)
      .map((agent) => {
        const template = agent.template_id ? templatesById.get(agent.template_id) ?? null : null
        return {
          id: agent.instance_id,
          name: resolveAgentDisplayName(agent),
          avatar: resolveAgentLogo(agent, template),
        }
      })
  }, [agents, questId, templatesById])
  const availableAgents = React.useMemo(() => {
    if (!questId) return []
    return agents
      .filter((agent) => agent.active_quest_id !== questId)
      .map((agent) => {
        const template = agent.template_id ? templatesById.get(agent.template_id) ?? null : null
        return {
          id: agent.instance_id,
          name: resolveAgentDisplayName(agent),
          avatar: resolveAgentLogo(agent, template),
        }
      })
  }, [agents, questId, templatesById])
  const emptyRosterLabel = questId
    ? 'No agents assigned to this quest yet.'
    : 'Select a quest to see its agents.'
  const emptyStateLabel = React.useMemo(() => {
    if (!questId) return 'Select a quest to view friend updates.'
    return 'No friend updates yet for this quest.'
  }, [questId])
  const connectionStatus = React.useMemo(() => {
    if (connection.status === 'rate_limited') return 'Rate limited. Retrying...'
    if (connection.status === 'reconnecting') return 'Reconnecting...'
    if (connection.status === 'error') return connection.error || 'Connection error'
    return null
  }, [connection.error, connection.status])
  const showLoadFullHistory = historyTruncated && Boolean(questId)
  const showHistoryLoadingOverlay =
    Boolean(questId) && historyLoading && messages.length === 0 && !hasLoadedOnce
  const historyLabel =
    typeof historyLimit === 'number' && historyLimit > 0
      ? `Showing latest ${historyLimit} messages.`
      : 'Showing recent messages.'

  React.useEffect(() => {
    if (!messageContextMenu) return
    const handleDismiss = () => setMessageContextMenu(null)
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMessageContextMenu(null)
      }
    }
    window.addEventListener('click', handleDismiss)
    window.addEventListener('contextmenu', handleDismiss)
    window.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', handleDismiss, true)
    return () => {
      window.removeEventListener('click', handleDismiss)
      window.removeEventListener('contextmenu', handleDismiss)
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', handleDismiss, true)
    }
  }, [messageContextMenu])

  React.useEffect(() => {
    setSearchQuery('')
    setHighlightedMessageId(null)
    lastSeenMessageIdRef.current = null
    setFollow(true)
    setMomentBusy(new Set())
    setLikedMoments({})
    setMomentLikeUsers({})
    setMomentComments({})
  }, [questId])

  React.useEffect(() => {
    const latest = messages[messages.length - 1]
    if (!latest?.id) return
    if (!lastSeenMessageIdRef.current) {
      lastSeenMessageIdRef.current = latest.id
      return
    }
    if (latest.id !== lastSeenMessageIdRef.current) {
      lastSeenMessageIdRef.current = latest.id
      setHighlightedMessageId(latest.id)
      const timer = window.setTimeout(() => setHighlightedMessageId(null), 1200)
      return () => window.clearTimeout(timer)
    }
  }, [messages])

  const messageContentById = React.useMemo(() => {
    const map = new Map<string, string>()
    messages.forEach((message) => {
      const content = getMessageText(message)
      if (content) {
        map.set(message.id, content)
      }
    })
    return map
  }, [messages])

  const messagesById = React.useMemo(() => {
    return new Map(messages.map((message) => [message.id, message]))
  }, [messages])

  const friendMessages = React.useMemo(() => {
    return messages.length ? [...messages].reverse() : []
  }, [messages])

  const handleAvatarContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>, message: ChatMessageItem) => {
      const metadata = getMessageMetadata(message)
      const agentId = metadata?.agent_instance_id
      const sessionId = metadata?.session_id
      if (!agentId && !sessionId) return
      setMessageContextMenu({ messageId: message.id, x: event.clientX, y: event.clientY })
    },
    []
  )

  const contextTarget = messageContextMenu
    ? messagesById.get(messageContextMenu.messageId) ?? null
    : null
  const contextMetadata = contextTarget ? getMessageMetadata(contextTarget) : null
  const contextAgentId = contextMetadata?.agent_instance_id ?? null
  const contextSessionId =
    typeof contextMetadata?.session_id === 'string' ? contextMetadata.session_id : null
  const canOpenDirect = Boolean(contextAgentId)

  const handleOpenDirect = React.useCallback(() => {
    if (!contextAgentId) return
    setActiveAgent(contextAgentId)
    if (contextSessionId) {
      setSessionIdForSurface(projectId, 'lab-direct', contextSessionId)
    }
    setMode('direct')
    setMessageContextMenu(null)
  }, [contextAgentId, contextSessionId, projectId, setActiveAgent, setMode, setSessionIdForSurface])

  const listCount = friendMessages.length + (showLoadFullHistory ? 1 : 0)
  const historyBannerIndex = showLoadFullHistory ? friendMessages.length : -1
  const shouldVirtualize = listCount > 20
  const rowVirtualizer = useVirtualizer({
    count: listCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (showLoadFullHistory && index === historyBannerIndex ? 56 : 180),
    getItemKey: (index) => {
      if (showLoadFullHistory && index === historyBannerIndex) return 'lab-friends-history-banner'
      const message = friendMessages[index]
      return message?.id ?? `lab-friends-${index}`
    },
    overscan: 6,
  })

  const friendSearchResults = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return []
    const results: LabCopilotSearchResult[] = []
    friendMessages.forEach((item, index) => {
      const content = messageContentById.get(item.id) ?? ''
      if (!content) return
      if (!content.toLowerCase().includes(query)) return
      const title = resolveMessageTitle(item)
      results.push({
        id: item.id,
        index,
        title,
        excerpt: buildSearchSnippet(content, query),
      })
    })
    return results
  }, [friendMessages, messageContentById, searchQuery])

  const handleAddAgents = React.useCallback(
    async (agentIds: string[]) => {
      if (!questId || readOnly || agentIds.length === 0) return
      setRosterBusy(true)
      try {
        const results = await Promise.allSettled(
          agentIds.map((agentId) =>
            assignLabAgent(projectId, agentId, { quest_id: questId, quest_node_id: null })
          )
        )
        const failed: string[] = []
        results.forEach((result, index) => {
          if (result.status !== 'fulfilled') {
            failed.push(agentIds[index])
          }
        })
        if (failed.length) {
          const names = failed.map((agentId) => {
            const agent = agentsById.get(agentId)
            return agent ? resolveAgentDisplayName(agent) : agentId
          })
          addToast({
            type: 'error',
            title: 'Unable to add agents',
            description: `Failed to add: ${names.join(', ')}`,
          })
        }
        queryClient.invalidateQueries({ queryKey: ['lab-agents', projectId] })
      } finally {
        setRosterBusy(false)
      }
    },
    [addToast, agentsById, projectId, queryClient, questId, readOnly]
  )

  const handleRemoveAgent = React.useCallback(
    async (agentId: string) => {
      if (!questId || readOnly) return
      setRosterBusy(true)
      try {
        await assignLabAgent(projectId, agentId, { quest_id: null, quest_node_id: null })
        queryClient.invalidateQueries({ queryKey: ['lab-agents', projectId] })
      } catch (error) {
        const agent = agentsById.get(agentId)
        const label = agent ? resolveAgentDisplayName(agent) : agentId
        addToast({
          type: 'error',
          title: 'Unable to remove agent',
          description: `Failed to remove ${label} from this quest.`,
        })
      } finally {
        setRosterBusy(false)
      }
    },
    [addToast, agentsById, projectId, queryClient, questId, readOnly]
  )

  const setMomentBusyState = React.useCallback((momentId: string, busy: boolean) => {
    setMomentBusy((prev) => {
      const next = new Set(prev)
      if (busy) {
        next.add(momentId)
      } else {
        next.delete(momentId)
      }
      return next
    })
  }, [])

  const handleMomentToggleLike = React.useCallback(
    async (momentId: string, nextLiked: boolean) => {
      if (!momentId || readOnly) return
      setMomentBusyState(momentId, true)
      try {
        if (nextLiked) {
          await likeLabMoment(projectId, momentId)
        } else {
          await unlikeLabMoment(projectId, momentId)
        }
        setLikedMoments((prev) => ({ ...prev, [momentId]: nextLiked }))
        setMomentLikeUsers((prev) => {
          const existing = prev[momentId] ?? []
          const next = new Set(existing)
          if (nextLiked) {
            next.add(currentUserLabel)
          } else {
            next.delete(currentUserLabel)
          }
          return { ...prev, [momentId]: Array.from(next) }
        })
      } catch {
        addToast({
          type: 'error',
          title: 'Unable to update like',
          description: 'Please try again once your connection stabilizes.',
        })
      } finally {
        setMomentBusyState(momentId, false)
      }
    },
    [addToast, currentUserLabel, projectId, readOnly, setMomentBusyState]
  )

  const handleMomentComment = React.useCallback(
    async (momentId: string, content: string) => {
      if (!momentId || readOnly) return false
      setMomentBusyState(momentId, true)
      try {
        await commentLabMoment(projectId, momentId, { content })
        setMomentComments((prev) => {
          const existing = prev[momentId] ?? []
          const nextItem = { name: currentUserLabel, content }
          return { ...prev, [momentId]: [...existing, nextItem] }
        })
        return true
      } catch {
        addToast({
          type: 'error',
          title: 'Unable to send comment',
          description: 'Please try again once your connection stabilizes.',
        })
        return false
      } finally {
        setMomentBusyState(momentId, false)
      }
    },
    [addToast, currentUserLabel, projectId, readOnly, setMomentBusyState]
  )

  const flashPostHighlight = React.useCallback((messageId: string) => {
    setHighlightedMessageId(messageId)
    if (typeof window !== 'undefined') {
      window.setTimeout(() => setHighlightedMessageId(null), 1200)
    }
  }, [])

  const jumpToFriendResult = React.useCallback(
    (result: LabCopilotSearchResult) => {
      if (!result) return
      if (!scrollRef.current) return
      if (shouldVirtualize) {
        rowVirtualizer.scrollToIndex(result.index, { align: 'center' })
      } else {
        const node = scrollRef.current?.querySelector(
          `[data-friend-post-id="${result.id}"]`
        ) as HTMLElement | null
        if (node) {
          node.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
      flashPostHighlight(result.id)
    },
    [flashPostHighlight, rowVirtualizer, shouldVirtualize]
  )

  React.useEffect(() => {
    if (!searchQuery.trim()) return
    if (friendSearchResults.length === 0) return
    jumpToFriendResult(friendSearchResults[0])
  }, [friendSearchResults, jumpToFriendResult, searchQuery])

  const menuPortal = headerPortalTarget
    ? createPortal(
        <LabCopilotOverflowMenu
          label="Friends"
          entities={friendEntities}
          emptyEntitiesLabel={emptyRosterLabel}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchResults={friendSearchResults}
          onSearchSelect={jumpToFriendResult}
          searchPlaceholder="Search friend updates"
          questId={questId}
          quests={quests}
          onQuestChange={onQuestChange}
          canManageRoster={!readOnly && Boolean(questId)}
          rosterBusy={rosterBusy}
          availableAgents={availableAgents}
          onAddAgents={handleAddAgents}
          onRemoveAgent={handleRemoveAgent}
        />,
        headerPortalTarget
      )
    : null

  const messageContextMenuPortal =
    messageContextMenu && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="lab-copilot-context-menu"
            style={{ left: messageContextMenu.x, top: messageContextMenu.y }}
          >
            <button type="button" onClick={handleOpenDirect} disabled={!canOpenDirect}>
              Open direct session
            </button>
          </div>,
          document.body
        )
    : null

  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget
      const nextFollow = isScrolledToTop(target)
      setFollow((prev) => (prev === nextFollow ? prev : nextFollow))
    },
    [isScrolledToTop]
  )

  const renderFriendMessage = (message: ChatMessageItem) => {
    const content = message.content as MessageContent
    const metadata = getMessageMetadata(message)
    const displayStreaming = message.type === 'text_delta' && content.status === 'in_progress'
    const isHighlighted = highlightedMessageId === message.id
    const isMoment = metadata?.message_kind === 'moment'
    const momentId = typeof metadata?.moment_id === 'string' ? metadata.moment_id : ''
    const localLikeUsers = momentId ? momentLikeUsers[momentId] ?? [] : []
    const localComments = momentId ? momentComments[momentId] ?? [] : []
    return (
      <div
        key={message.id}
        className={cn('rounded-[12px] px-1', isHighlighted && 'lab-message-highlight')}
        data-friend-post-id={message.id}
      >
        {isMoment ? (
          <FriendsMomentCard
            message={message}
            readOnly={readOnly}
            liked={momentId ? Boolean(likedMoments[momentId]) : false}
            busy={momentId ? momentBusy.has(momentId) : false}
            likeUsers={localLikeUsers}
            comments={localComments}
            onToggleLike={handleMomentToggleLike}
            onCommentSubmit={handleMomentComment}
            onAvatarContextMenu={handleAvatarContextMenu}
          />
        ) : (
          <ChatMessage
            message={message}
            compact
            onAvatarContextMenu={handleAvatarContextMenu}
            displayStreaming={displayStreaming}
            streamActive={
              connection.status === 'open' ||
              connection.status === 'connecting' ||
              connection.status === 'reconnecting'
            }
          />
        )}
      </div>
    )
  }

  const renderHistoryBanner = () => (
    <div className="mb-4 flex justify-center">
      <div
        className={cn(
          'inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1 font-medium',
          'border-[var(--lab-border)] bg-[var(--lab-surface)] text-[var(--lab-text-secondary)]',
          'text-[11px]'
        )}
      >
        <span>{historyLabel}</span>
        <button
          type="button"
          onClick={() => {
            setFollow(false)
            loadFullHistory()
          }}
          disabled={historyLoadingFull}
          className="text-[var(--lab-text-primary)] underline decoration-dotted underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {historyLoadingFull ? 'Loading full history...' : 'Load full history'}
        </button>
      </div>
    </div>
  )

  const scrollToTop = React.useCallback(() => {
    const node = scrollRef.current
    if (!node) return
    if (typeof node.scrollTo === 'function') {
      node.scrollTo({ top: 0, behavior: 'auto' })
    } else {
      node.scrollTop = 0
    }
  }, [])

  React.useEffect(() => {
    if (!questId || messages.length === 0) return
    if (!follow) return
    window.requestAnimationFrame(() => scrollToTop())
  }, [follow, messages, questId, scrollToTop])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {menuPortal}
      {messageContextMenuPortal}
      <div className="ai-manus-root ai-manus-copilot ai-manus-embedded flex flex-1 min-h-0 flex-col">
        <div className="relative flex flex-1 min-h-0 flex-col">
          <ScrollArea ref={scrollRef} className="flex-1 min-h-0" onScroll={handleScroll}>
            <div className="px-5 py-6">
              {connectionStatus ? (
                <div className="mb-3 text-center text-[11px] text-[var(--text-tertiary)]">
                  {connectionStatus}
                </div>
              ) : null}
              {!questId ? (
                <div className="flex min-h-[200px] items-center justify-center text-[12px] text-[var(--text-tertiary)]">
                  {emptyStateLabel}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex min-h-[200px] items-center justify-center text-[12px] text-[var(--text-tertiary)]">
                  {emptyStateLabel}
                </div>
              ) : shouldVirtualize ? (
                <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    if (showLoadFullHistory && virtualRow.index === historyBannerIndex) {
                      return (
                        <div
                          key={virtualRow.key}
                          data-index={virtualRow.index}
                          ref={rowVirtualizer.measureElement}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          {renderHistoryBanner()}
                        </div>
                      )
                    }
                    const message = friendMessages[virtualRow.index]
                    if (!message) return null
                    return (
                      <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        ref={rowVirtualizer.measureElement}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <div className="pb-5">{renderFriendMessage(message)}</div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col lab-friends-list">
                  {friendMessages.map((message) => renderFriendMessage(message))}
                  {showLoadFullHistory ? renderHistoryBanner() : null}
                </div>
              )}
            </div>
          </ScrollArea>
          {showHistoryLoadingOverlay ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-sm',
                  'border-[var(--lab-border)] bg-[var(--lab-surface)] text-[var(--lab-text-secondary)]'
                )}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading...</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
