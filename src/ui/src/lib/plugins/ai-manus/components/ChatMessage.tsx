'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Brain, Check, ChevronDown } from 'lucide-react'
import type {
  ChatMessageItem,
  MessageContent,
  StepContent,
  ToolContent,
  AttachmentsContent,
  ReasoningContent,
  StatusContent,
  QuestionPromptContent,
  QuestionPromptAnswerMap,
  ClarifyQuestionContent,
  PatchReviewContent,
} from '../types'
import { openCitationTarget } from '@/lib/ai/effect-dispatcher'
import { BRAND_LOGO_SMALL_SRC, BRAND_LOGO_SMALL_SRC_INVERTED } from '@/lib/constants/assets'
import {
  decodeHtmlEntities,
  renderMarkdown,
  renderMarkdownWithCitations,
  type CitationLookup,
} from '../lib/markdown'
import {
  isLikelyWorkspaceFileReference,
  resolveStudioFileLinkTarget,
} from '@/components/workspace/studio-file-links'
import { formatRelativeTime } from '../lib/time'
import { getToolInfo } from '../lib/tool-map'
import { getMcpToolKind } from '../lib/mcp-tools'
import { cn } from '@/lib/utils'
import { PngIcon } from '@/components/ui/png-icon'
import { ToolUse } from './ToolUse'
import { AttachmentsMessage } from './AttachmentsMessage'
import { LoadingIndicator } from './LoadingIndicator'
import { QuestionPrompt } from './QuestionPrompt'
import { ClarifyQuestion } from './ClarifyQuestion'
import { useTokenStream } from '../hooks/useTokenStream'
import { McpBashExecView } from '@/components/chat/toolViews/McpBashExecView'
import { PatchReviewCard } from './PatchReviewCard'

type DisplayCompleteHandler = (payload: {
  id: string
  kind: 'assistant' | 'reasoning' | 'tool' | 'status'
}) => void

type ChatMessageProps = {
  message: ChatMessageItem
  sessionId?: string
  projectId?: string
  readOnly?: boolean
  onToolClick?: (tool: ToolContent) => void
  onFileClick?: (fileId: string) => void
  onFileLinkClick?: (href: string) => boolean
  onQuestionPromptSubmit?: (toolCallId: string, answers: QuestionPromptAnswerMap) => Promise<void>
  onClarifyQuestionSubmit?: (toolCallId: string | undefined, selections: string[]) => Promise<void>
  onPatchAccept?: (messageId: string) => void
  onPatchReject?: (messageId: string) => void
  onAvatarContextMenu?: (event: React.MouseEvent<HTMLDivElement>, message: ChatMessageItem) => void
  displayStreaming?: boolean
  onDisplayComplete?: DisplayCompleteHandler
  streamActive?: boolean
  compact?: boolean
  showAssistantHeader?: boolean
  preferInlineToolView?: boolean
  inlineToolOpen?: boolean
  onInlineToolOpenChange?: (open: boolean) => void
}

type StreamedContentConfig = {
  content: string
  active: boolean
  streamKey: string
  allowComplete: boolean
  reducedMotion: boolean
  onComplete?: () => void
}

const MIN_STREAM_MS = 220
const TOKEN_STREAM_MAX_CHARS = 3500
function useStreamedContent({
  content,
  active,
  streamKey,
  allowComplete,
  reducedMotion,
  onComplete,
}: StreamedContentConfig) {
  const [streamed, setStreamed] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const completeTimerRef = useRef<number | null>(null)
  const linesRef = useRef<string[]>([])
  const displayCountRef = useRef(0)
  const completedRef = useRef(false)
  const startTimeRef = useRef<number | null>(null)
  const onCompleteRef = useRef(onComplete)
  const streamKeyRef = useRef(streamKey)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (streamKeyRef.current === streamKey) return
    streamKeyRef.current = streamKey
    displayCountRef.current = 0
    completedRef.current = false
    startTimeRef.current = null
    if (completeTimerRef.current) {
      window.clearTimeout(completeTimerRef.current)
      completeTimerRef.current = null
    }
    setStreamed(active ? '' : null)
  }, [active, streamKey])

  useEffect(() => {
    linesRef.current = content.split(/\r?\n/)
    const totalLines = linesRef.current.length

    const stopTimer = () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    const stopCompleteTimer = () => {
      if (completeTimerRef.current) {
        window.clearTimeout(completeTimerRef.current)
        completeTimerRef.current = null
      }
    }

    const finish = () => {
      if (completedRef.current) return
      completedRef.current = true
      onCompleteRef.current?.()
    }

    const maybeComplete = () => {
      if (!allowComplete || completedRef.current) return
      if (reducedMotion) {
        finish()
        return
      }
      const startedAt = startTimeRef.current ?? Date.now()
      startTimeRef.current = startedAt
      const elapsed = Date.now() - startedAt
      const remaining = Math.max(0, MIN_STREAM_MS - elapsed)
      if (remaining === 0) {
        finish()
        return
      }
      stopCompleteTimer()
      completeTimerRef.current = window.setTimeout(() => {
        completeTimerRef.current = null
        finish()
      }, remaining)
    }

    if (!active) {
      stopTimer()
      stopCompleteTimer()
      completedRef.current = false
      startTimeRef.current = null
      displayCountRef.current = totalLines
      setStreamed(null)
      return
    }

    if (reducedMotion) {
      stopTimer()
      stopCompleteTimer()
      displayCountRef.current = totalLines
      setStreamed(content)
      maybeComplete()
      return
    }

    if (!startTimeRef.current) {
      startTimeRef.current = Date.now()
    }

    if (displayCountRef.current > totalLines) {
      displayCountRef.current = totalLines
    }
    if (displayCountRef.current < totalLines) {
      completedRef.current = false
    }
    if (displayCountRef.current === 0 && totalLines > 0) {
      displayCountRef.current = 1
    }
    setStreamed(linesRef.current.slice(0, displayCountRef.current).join('\n'))

    if (displayCountRef.current >= totalLines) {
      stopTimer()
      maybeComplete()
      return
    }

    if (timerRef.current) return
    timerRef.current = window.setInterval(() => {
      const liveLines = linesRef.current
      const remaining = liveLines.length - displayCountRef.current
      if (remaining <= 0) {
        stopTimer()
        maybeComplete()
        return
      }
      const step = Math.max(1, Math.ceil(remaining / 12))
      displayCountRef.current = Math.min(liveLines.length, displayCountRef.current + step)
      setStreamed(liveLines.slice(0, displayCountRef.current).join('\n'))
      if (displayCountRef.current >= liveLines.length) {
        stopTimer()
        maybeComplete()
      }
    }, 64)

    return () => {
      stopTimer()
      stopCompleteTimer()
    }
  }, [active, allowComplete, content, reducedMotion])

  return streamed
}

function UserDeliveryIndicator({ state }: { state?: string | null }) {
  if (!state || state === 'delivered' || state === 'sent') {
    return (
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--text-tertiary)]"
        aria-label="Sent"
        title="Sent"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
      </span>
    )
  }
  if (state === 'sending') {
    return (
      <span
        className="block h-2.5 w-2.5 rounded-full bg-[rgba(148,163,184,0.55)]"
        aria-label="Queued"
        title="Queued"
      />
    )
  }
  if (state === 'failed') {
    return (
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full text-[rgba(185,28,28,0.72)]"
        aria-label="Failed"
        title="Failed"
      >
        !
      </span>
    )
  }
  return null
}

function ChatMessageBase({
  message,
  sessionId,
  projectId,
  readOnly,
  onToolClick,
  onFileClick,
  onFileLinkClick,
  onQuestionPromptSubmit,
  onClarifyQuestionSubmit,
  onPatchAccept,
  onPatchReject,
  onAvatarContextMenu,
  displayStreaming,
  onDisplayComplete,
  streamActive,
  compact,
  showAssistantHeader,
  preferInlineToolView,
  inlineToolOpen,
  onInlineToolOpenChange,
}: ChatMessageProps) {
  const isCompact = Boolean(compact)
  const showHeader = showAssistantHeader ?? true
  const isToolMessage =
    message.type === 'tool' || message.type === 'tool_call' || message.type === 'tool_result'
  const toolContent = useMemo(() => message.content as ToolContent, [message])
  const rawToolFunction =
    isToolMessage && typeof toolContent.function === 'string' ? toolContent.function : ''
  const normalizedToolFunction = rawToolFunction.toLowerCase()
  const normalizedToolFunctionLeaf = normalizedToolFunction.startsWith('mcp__')
    ? (() => {
        const parts = normalizedToolFunction.split('__').filter(Boolean)
        return parts[parts.length - 1] || normalizedToolFunction
      })()
    : normalizedToolFunction
  const toolArgs =
    isToolMessage && toolContent.args && typeof toolContent.args === 'object' && !Array.isArray(toolContent.args)
      ? (toolContent.args as Record<string, unknown>)
      : {}
  const bashMode =
    typeof toolArgs.mode === 'string' ? toolArgs.mode.trim().toLowerCase() : ''
  const isBashReadOrKill = bashMode === 'read' || bashMode === 'kill'
  const shouldAutoOpenInline =
    isCompact &&
    isToolMessage &&
    (getMcpToolKind(rawToolFunction) === 'bash_exec' ||
      normalizedToolFunction === 'bash_exec' ||
      normalizedToolFunctionLeaf === 'paper_search' ||
      normalizedToolFunctionLeaf === 'read_paper')
  const [expanded, setExpanded] = useState(true)
  const [toolInlineOpenState, setToolInlineOpenState] = useState(shouldAutoOpenInline)
  const prefersReducedMotion = useReducedMotion()
  const assistantRef = useRef<HTMLDivElement | null>(null)
  const reasoningRef = useRef<HTMLDivElement | null>(null)
  const statusRef = useRef<HTMLDivElement | null>(null)
  const toolRef = useRef<HTMLDivElement | null>(null)
  const shouldStream = Boolean(displayStreaming)
  const isStreamActive = streamActive ?? shouldStream
  const isTextDelta = message.type === 'text_delta'

  const messageContent = useMemo(() => message.content as MessageContent, [message])
  const resolvedRole =
    message.type === 'user' || messageContent.role === 'user' ? 'user' : 'assistant'
  const isUserMessage = message.type === 'user' || (isTextDelta && resolvedRole === 'user')
  const isAssistantTextDelta = isTextDelta && resolvedRole === 'assistant'
  const stepContent = useMemo(() => message.content as StepContent, [message])
  const attachmentsContent = useMemo(() => message.content as AttachmentsContent, [message])
  const reasoningContent = useMemo(() => message.content as ReasoningContent, [message])
  const statusContent = useMemo(() => message.content as StatusContent, [message])
  const questionPromptContent = useMemo(() => message.content as QuestionPromptContent, [message])
  const clarifyQuestionContent = useMemo(() => message.content as ClarifyQuestionContent, [message])
  const patchReviewContent = useMemo(() => message.content as PatchReviewContent, [message])
  const fullContent = typeof messageContent.content === 'string' ? messageContent.content : ''
  const reasoningText =
    message.type === 'reasoning' && typeof reasoningContent.content === 'string'
      ? reasoningContent.content
      : ''
  const statusText = useMemo(
    () => decodeHtmlEntities(statusContent.content ?? ''),
    [statusContent.content]
  )
  const assistantStreaming =
    isAssistantTextDelta && messageContent.status === 'in_progress'
  const reasoningStreaming =
    message.type === 'reasoning' && reasoningContent.status === 'in_progress'
  const toolStreaming = isToolMessage && toolContent.status === 'calling'
  const statusStreaming = message.type === 'status' && statusContent.status === 'in_progress'
  const assistantStreamEffect = isAssistantTextDelta && shouldStream
  const reasoningStreamEffect = message.type === 'reasoning' && shouldStream
  const tokenStreamingActive = shouldStream && isStreamActive && !(prefersReducedMotion ?? false)
  const tokenUsage = messageContent.metadata?.ai_usage
  const senderType =
    typeof messageContent.metadata?.sender_type === 'string'
      ? messageContent.metadata.sender_type
      : null
  const fallbackLabel =
    typeof messageContent.metadata?.agent_label === 'string'
      ? messageContent.metadata.agent_label
      : typeof messageContent.metadata?.agent_id === 'string'
        ? `@${messageContent.metadata.agent_id}`
        : null
  const fallbackName =
    typeof messageContent.metadata?.agent_display_name === 'string'
      ? messageContent.metadata.agent_display_name
      : null
  const fallbackAvatar =
    typeof messageContent.metadata?.agent_logo === 'string'
      ? messageContent.metadata.agent_logo
      : null
  const senderLabel =
    senderType === 'agent' && typeof messageContent.metadata?.sender_label === 'string'
      ? messageContent.metadata.sender_label
      : fallbackLabel
  const senderName =
    senderType === 'agent' && typeof messageContent.metadata?.sender_name === 'string'
      ? messageContent.metadata.sender_name
      : fallbackName
  const senderAvatarUrl =
    senderType === 'agent' && typeof messageContent.metadata?.sender_avatar_url === 'string'
      ? messageContent.metadata.sender_avatar_url
      : fallbackAvatar
  const assistantTitle = senderName || 'DeepScientist'
  const deliveryState =
    typeof messageContent.metadata?.delivery_state === 'string'
      ? messageContent.metadata.delivery_state.toLowerCase()
      : null
  const tokenUsageLabel =
    tokenUsage && Number.isFinite(tokenUsage.total_tokens)
      ? `Tokens: ${tokenUsage.total_tokens} (in ${tokenUsage.input_tokens}, out ${tokenUsage.output_tokens})${tokenUsage.estimated ? ' ~' : ''}`
      : null
  const displayCompleteRef = useRef(false)
  const canCompleteImmediately = !tokenStreamingActive
  const shouldCompleteAssistant = isAssistantTextDelta && !assistantStreaming && canCompleteImmediately
  const shouldCompleteReasoning = message.type === 'reasoning' && !reasoningStreaming && canCompleteImmediately
  const shouldCompleteTool = isToolMessage && !toolStreaming && canCompleteImmediately
  const shouldCompleteStatus = message.type === 'status' && !statusStreaming && canCompleteImmediately
  const shouldCompleteAssistantOnToken = isAssistantTextDelta && !assistantStreaming
  const shouldCompleteReasoningOnToken = message.type === 'reasoning' && !reasoningStreaming
  const shouldCompleteToolOnToken = isToolMessage && !toolStreaming
  const shouldCompleteStatusOnToken = message.type === 'status' && !statusStreaming

  useEffect(() => {
    if (!shouldAutoOpenInline) return
    setToolInlineOpenState(true)
  }, [shouldAutoOpenInline])

  const handleInlineToolOpenChange = useCallback(
    (next: boolean) => {
      if (inlineToolOpen == null) {
        setToolInlineOpenState(next)
      }
      onInlineToolOpenChange?.(next)
    },
    [inlineToolOpen, onInlineToolOpenChange]
  )

  useEffect(() => {
    displayCompleteRef.current = false
  }, [message.id])

  const finishDisplay = useCallback(
    (kind: 'assistant' | 'reasoning' | 'tool' | 'status') => {
      if (!onDisplayComplete || displayCompleteRef.current) return
      displayCompleteRef.current = true
      onDisplayComplete({ id: message.id, kind })
    },
    [message.id, onDisplayComplete]
  )

  const renderAssistantHeader = (timestamp?: number, showUsage = false) => {
    const handleAvatarContextMenu = onAvatarContextMenu
      ? (event: React.MouseEvent<HTMLDivElement>) => {
          event.preventDefault()
          onAvatarContextMenu(event, message)
        }
      : undefined
    const avatarClassName = cn(
      'shrink-0',
      isCompact ? 'h-[22px] w-[22px]' : 'h-6 w-6'
    )
    const avatarNode = senderAvatarUrl ? (
      <img
        src={senderAvatarUrl}
        alt={assistantTitle}
        className={avatarClassName}
        draggable={false}
      />
    ) : (
      <>
        <img
          src={BRAND_LOGO_SMALL_SRC}
          alt="DeepScientist logo"
          className={cn(avatarClassName, 'dark:hidden')}
          draggable={false}
        />
        <img
          src={BRAND_LOGO_SMALL_SRC_INVERTED}
          alt="DeepScientist logo"
          className={cn(avatarClassName, 'hidden dark:block')}
          draggable={false}
        />
      </>
    )
    return (
      <div className="flex h-7 items-center justify-between">
        <div className="flex items-center gap-[6px] text-[var(--text-primary)]">
          <div
            className={cn('flex items-center', onAvatarContextMenu && 'cursor-context-menu')}
            onContextMenu={handleAvatarContextMenu}
          >
            {avatarNode}
          </div>
          <span className={cn('font-semibold', isCompact ? 'text-[10px]' : 'text-[10px]')}>
            {assistantTitle}
          </span>
          {senderLabel ? (
            <span className="ai-manus-mention-label text-[10px] font-semibold">{senderLabel}</span>
          ) : null}
        </div>
        {!isCompact && (showUsage || Number.isFinite(timestamp)) ? (
          <div className="flex flex-col items-end gap-[2px] text-[9px] text-[var(--text-tertiary)]">
            {showUsage && tokenUsageLabel ? <div className="opacity-80">{tokenUsageLabel}</div> : null}
            {Number.isFinite(timestamp) ? (
              <div className="opacity-0 transition group-hover:opacity-100">
                {formatRelativeTime(timestamp as number)}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  const handleWorkspaceLinkClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!onFileLinkClick) return false
      const target = event.target as HTMLElement | null
      const fileButton = target?.closest<HTMLElement>('[data-file-href]')
      const buttonHref = fileButton?.getAttribute('data-file-href')?.trim() || ''
      const anchor = target?.closest<HTMLAnchorElement>('a[href]')
      const rawHref = buttonHref || anchor?.getAttribute('href')?.trim() || ''
      if (!rawHref) return false
      const handled = onFileLinkClick(rawHref)
      if (!handled) return false
      event.preventDefault()
      event.stopPropagation()
      return true
    },
    [onFileLinkClick]
  )

  const handleMarkdownAction = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement | null
      if (!target) return false
      const copyButton = target.closest('button.ai-manus-code-copy') as HTMLButtonElement | null
      if (copyButton) {
        event.preventDefault()
        event.stopPropagation()
        const block = copyButton.closest('.ai-manus-codeblock') as HTMLElement | null
        const code = block?.querySelector('pre code')?.textContent ?? ''
        if (!code) return true
        const previousLabel = copyButton.textContent ?? 'Copy'
        const setLabel = (label: string) => {
          copyButton.textContent = label
        }
        const done = () => {
          setLabel('Copied')
          window.setTimeout(() => setLabel(previousLabel), 1400)
        }
        if (navigator.clipboard?.writeText) {
          navigator.clipboard
            .writeText(code)
            .then(done)
            .catch(() => {})
          return true
        }
        const textarea = document.createElement('textarea')
        textarea.value = code
        textarea.style.position = 'fixed'
        textarea.style.top = '-9999px'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        try {
          document.execCommand('copy')
          done()
        } catch {
          // ignore clipboard failures
        } finally {
          textarea.remove()
        }
        return true
      }
      return false
    },
    []
  )

  const streamedContent = useStreamedContent({
    content: fullContent,
    active: isAssistantTextDelta && shouldStream && !assistantStreaming && !tokenStreamingActive,
    streamKey: message.id,
    allowComplete: isAssistantTextDelta,
    reducedMotion: prefersReducedMotion ?? false,
    onComplete: shouldCompleteAssistant ? () => finishDisplay('assistant') : undefined,
  })

  const streamedReasoning = useStreamedContent({
    content: reasoningText,
    active: message.type === 'reasoning' && shouldStream && !reasoningStreaming && !tokenStreamingActive,
    streamKey: message.id,
    allowComplete: message.type === 'reasoning' && reasoningContent.status === 'completed',
    reducedMotion: prefersReducedMotion ?? false,
    onComplete: shouldCompleteReasoning ? () => finishDisplay('reasoning') : undefined,
  })

  const reasoningBody = streamedReasoning ?? reasoningText
  const workspaceLinkResolver = useCallback(
    (href: string) =>
      Boolean(
        projectId &&
          resolveStudioFileLinkTarget(href, {
            currentOrigin: typeof window !== 'undefined' ? window.location.origin : null,
            questId: projectId,
          })
      ),
    [projectId]
  )
  const workspaceLinkMatcher = useCallback(
    (href: string) =>
      Boolean(
        projectId &&
          isLikelyWorkspaceFileReference(href, {
            currentOrigin: typeof window !== 'undefined' ? window.location.origin : null,
            questId: projectId,
          })
      ),
    [projectId]
  )
  const userHtml = useMemo(
    () =>
      isUserMessage
        ? renderMarkdown(fullContent, {
            resolveWorkspaceFileLink: workspaceLinkResolver,
            isWorkspaceFileLink: workspaceLinkMatcher,
          })
        : '',
    [fullContent, isUserMessage, workspaceLinkMatcher, workspaceLinkResolver]
  )
  const assistantRendered = useMemo(() => {
    if (!isAssistantTextDelta) return { html: '', citationLookup: {} as CitationLookup }
    const resolved = streamedContent !== null ? streamedContent : fullContent
    return renderMarkdownWithCitations(resolved, messageContent.metadata?.citations, {
      resolveWorkspaceFileLink: workspaceLinkResolver,
      isWorkspaceFileLink: workspaceLinkMatcher,
    })
  }, [fullContent, isAssistantTextDelta, messageContent.metadata?.citations, streamedContent, workspaceLinkMatcher, workspaceLinkResolver])
  const assistantHtml = assistantRendered.html
  const citationLookupRef = useRef<CitationLookup>({})
  useEffect(() => {
    citationLookupRef.current = assistantRendered.citationLookup
  }, [assistantRendered.citationLookup])
  const reasoningHtml = useMemo(() => {
    if (message.type !== 'reasoning') return ''
    return renderMarkdown(reasoningBody, {
      resolveWorkspaceFileLink: workspaceLinkResolver,
      isWorkspaceFileLink: workspaceLinkMatcher,
    })
  }, [message.type, reasoningBody, workspaceLinkMatcher, workspaceLinkResolver])
  const stepDescriptionHtml = useMemo(() => {
    if (message.type !== 'step') return ''
    return renderMarkdown(stepContent.description || '', {
      resolveWorkspaceFileLink: workspaceLinkResolver,
      isWorkspaceFileLink: workspaceLinkMatcher,
    })
  }, [message.type, stepContent.description, workspaceLinkMatcher, workspaceLinkResolver])
  const toolContentKey = useMemo(() => {
    if (!isToolMessage) return ''
    const args =
      toolContent.args && typeof toolContent.args === 'object' && !Array.isArray(toolContent.args)
        ? (toolContent.args as Record<string, unknown>)
        : {}
    const statusMessageRaw =
      typeof args.message === 'string'
        ? args.message
        : typeof args.text === 'string'
          ? args.text
          : ''
    const statusMessage = decodeHtmlEntities(statusMessageRaw)
    const toolError = typeof toolContent.error === 'string' ? toolContent.error : ''
    const resultError =
      toolContent.content && typeof toolContent.content === 'object'
        ? typeof (toolContent.content as Record<string, unknown>).error === 'string'
          ? String((toolContent.content as Record<string, unknown>).error)
          : ''
        : ''
    return [
      toolContent.tool_call_id,
      toolContent.status,
      toolContent.name,
      toolContent.function,
      toolContent.duration_ms ?? '',
      statusMessage,
      toolError,
      resultError,
    ].join('|')
  }, [isToolMessage, toolContent])

  const handleCitationClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null
    if (!target) return
    const citationEl = target.closest<HTMLElement>('[data-cite-key]')
    if (!citationEl) return
    const key = citationEl.getAttribute('data-cite-key')
    if (!key) return
    const citation = citationLookupRef.current[key]
    if (!citation) return
    event.preventDefault()
    event.stopPropagation()
    openCitationTarget(citation)
  }, [])

  const handleAssistantClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (handleWorkspaceLinkClick(event)) return
      if (handleMarkdownAction(event)) return
      handleCitationClick(event)
    },
    [handleCitationClick, handleMarkdownAction, handleWorkspaceLinkClick]
  )

  const handleWorkspaceLinkContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null
    if (!target) return
    if (!target.closest('[data-file-href]')) return
    event.preventDefault()
    event.stopPropagation()
  }, [])

  useEffect(() => {
    if (!shouldStream || !onDisplayComplete || displayCompleteRef.current) return
    if (shouldCompleteAssistant) {
      finishDisplay('assistant')
      return
    }
    if (shouldCompleteReasoning) {
      finishDisplay('reasoning')
      return
    }
    if (shouldCompleteStatus) {
      finishDisplay('status')
    }
  }, [
    finishDisplay,
    onDisplayComplete,
    shouldCompleteAssistant,
    shouldCompleteReasoning,
    shouldCompleteStatus,
    shouldStream,
  ])

  useEffect(() => {
    if (!isToolMessage) return
    if (!shouldStream || !onDisplayComplete || displayCompleteRef.current) return
    if (!shouldCompleteTool) return
    const delay = prefersReducedMotion ? 0 : 220
    const timer = window.setTimeout(() => {
      finishDisplay('tool')
    }, delay)
    return () => window.clearTimeout(timer)
  }, [
    finishDisplay,
    isToolMessage,
    onDisplayComplete,
    prefersReducedMotion,
    shouldCompleteTool,
    shouldStream,
  ])

  useEffect(() => {
    if (!shouldStream || !onDisplayComplete) return
    return () => {
      if (displayCompleteRef.current) return
      if (isAssistantTextDelta) {
        finishDisplay('assistant')
      } else if (message.type === 'reasoning') {
        finishDisplay('reasoning')
      } else if (message.type === 'status') {
        finishDisplay('status')
      } else if (isToolMessage) {
        finishDisplay('tool')
      }
    }
  }, [
    finishDisplay,
    isAssistantTextDelta,
    isToolMessage,
    message.id,
    message.type,
    onDisplayComplete,
    shouldStream,
  ])

  useTokenStream({
    ref: assistantRef,
    active: tokenStreamingActive && isAssistantTextDelta,
    contentKey: assistantHtml,
    mode: 'assistant',
    maxChars: TOKEN_STREAM_MAX_CHARS,
    reducedMotion: prefersReducedMotion ?? false,
    onComplete:
      shouldStream && shouldCompleteAssistantOnToken ? () => finishDisplay('assistant') : undefined,
  })

  useTokenStream({
    ref: reasoningRef,
    active: tokenStreamingActive && message.type === 'reasoning',
    contentKey: `${reasoningHtml}::${reasoningContent.status ?? ''}`,
    mode: 'reasoning',
    maxChars: TOKEN_STREAM_MAX_CHARS,
    reducedMotion: prefersReducedMotion ?? false,
    onComplete:
      shouldStream && shouldCompleteReasoningOnToken ? () => finishDisplay('reasoning') : undefined,
  })

  useTokenStream({
    ref: toolRef,
    active: tokenStreamingActive && isToolMessage,
    contentKey: toolContentKey,
    mode: 'status',
    reducedMotion: prefersReducedMotion ?? false,
    onComplete: shouldStream && shouldCompleteToolOnToken ? () => finishDisplay('tool') : undefined,
  })

  useTokenStream({
    ref: statusRef,
    active: tokenStreamingActive && message.type === 'status',
    contentKey: statusText,
    mode: 'status',
    reducedMotion: prefersReducedMotion ?? false,
    onComplete:
      shouldStream && shouldCompleteStatusOnToken ? () => finishDisplay('status') : undefined,
  })

  useEffect(() => {
    if (message.type !== 'reasoning') return
    if (reasoningContent.collapsed) {
      setExpanded(false)
    }
  }, [message.type, reasoningContent.collapsed])

  if (isUserMessage) {
    return (
      <div className="ai-manus-fade-in group mt-3 flex w-full flex-col items-end justify-end gap-1">
        <div className="flex items-end">
          {!isCompact ? (
            <div className="flex items-center gap-[2px] text-[9px] text-[var(--text-tertiary)] opacity-0 transition group-hover:opacity-100">
              {formatRelativeTime(messageContent.timestamp)}
            </div>
          ) : null}
        </div>
        <div className="flex max-w-[90%] items-end gap-2">
          <div className="mb-2 shrink-0">
            <UserDeliveryIndicator state={deliveryState} />
          </div>
          <div
            className={cn(
              'relative rounded-[10px] border border-[var(--border-main)] bg-[var(--fill-white)] p-3 text-[var(--text-primary)]',
              isCompact ? 'text-[11px] leading-relaxed' : 'text-[12px] leading-relaxed'
            )}
            onClick={handleMarkdownAction}
            onClickCapture={handleAssistantClick}
            onContextMenuCapture={handleWorkspaceLinkContextMenu}
            dangerouslySetInnerHTML={{ __html: userHtml }}
          />
        </div>
      </div>
    )
  }

  if (isTextDelta) {
    return (
      <div className="ai-manus-fade-in group mt-3 flex w-full flex-col gap-2">
        {showHeader ? renderAssistantHeader(messageContent.timestamp, true) : null}
        <div
          ref={assistantRef}
          data-content-streaming={assistantStreamEffect ? 'true' : undefined}
          data-stream-caret={assistantStreaming && isStreamActive ? 'true' : undefined}
          className={cn(
            'prose max-w-none text-[var(--text-primary)] dark:prose-invert [&_pre:not(.shiki)]:!bg-[var(--fill-tsp-white-light)] [&_code]:text-[var(--text-primary)] [&_pre:not(.shiki)_code]:text-[var(--text-primary)]',
            isCompact
              ? 'prose-sm text-[11px] [&_p]:text-[11px] [&_li]:text-[11px]'
              : 'prose-sm text-[12px] [&_p]:text-[12px] [&_li]:text-[12px]'
          )}
          onClick={handleAssistantClick}
          onContextMenuCapture={handleWorkspaceLinkContextMenu}
          dangerouslySetInnerHTML={{
            __html: assistantHtml,
          }}
        />
      </div>
    )
  }

  if (isToolMessage) {
    const toolInfo = getToolInfo(toolContent)
    const mcpKind = getMcpToolKind(toolContent.function)
    const isMcpBashExec = mcpKind === 'bash_exec'
    const InlineView = isMcpBashExec ? McpBashExecView : toolInfo.view
    const isPaperSearch = toolInfo.category === 'paper_search'
    const isReadPaper = toolInfo.category === 'read_paper'
    const isBashInline = toolInfo.category === 'bash' && isCompact && !isBashReadOrKill
    const preferredInlineCategories = new Set([
      'shell',
      'bash',
      'file',
      'browser',
      'search',
      'paper_search',
      'read_paper',
      'mcp',
    ])
    const allowPreferredInlineView =
      Boolean(preferInlineToolView) &&
      isCompact &&
      Boolean(InlineView) &&
      preferredInlineCategories.has(toolInfo.category)
    const allowInlineView =
      Boolean(InlineView) &&
      (allowPreferredInlineView || isPaperSearch || isReadPaper || isBashInline || isMcpBashExec)
    const resolvedToolInlineOpen = inlineToolOpen ?? toolInlineOpenState
    const showInlineView = InlineView && allowInlineView && resolvedToolInlineOpen
    const inlineWrapperClass =
      isBashInline || isMcpBashExec || toolInfo.category === 'shell'
        ? 'overflow-hidden rounded-[12px]'
        : 'overflow-hidden rounded-[12px] border border-[var(--border-light)] bg-[var(--background-main)]'
    const handleToolAction = () => {
      if (allowInlineView) {
        handleInlineToolOpenChange(!resolvedToolInlineOpen)
        return
      }
      if (onToolClick) {
        onToolClick(toolContent)
        return
      }
    }
    return (
      <div
        className={cn(
          'ai-manus-fade-in group flex flex-col gap-2',
          shouldStream && 'ai-manus-slide-in'
        )}
        data-content-streaming={shouldStream ? 'true' : undefined}
        ref={toolRef}
      >
        {showHeader ? renderAssistantHeader(toolContent.timestamp) : null}
          <ToolUse
            tool={toolContent}
            compact={isCompact}
            collapsible
            projectId={projectId}
            onClick={allowInlineView || onToolClick ? handleToolAction : undefined}
          />
        {showInlineView ? (
          <div className={inlineWrapperClass}>
            <InlineView
              toolContent={toolContent}
              live={toolContent.status === 'calling'}
              sessionId={sessionId}
              projectId={projectId}
              readOnly={readOnly}
              panelMode="inline"
            />
          </div>
        ) : null}
      </div>
    )
  }

  if (message.type === 'status') {
    if (!statusText) return null
    return (
      <div
        ref={statusRef}
        data-content-streaming={shouldStream ? 'true' : undefined}
        className="ai-manus-fade-in text-center text-[11px] text-[var(--text-tertiary)]"
      >
        {statusText}
      </div>
    )
  }

  if (message.type === 'reasoning') {
    const isSummary = reasoningContent.kind === 'summary'
    const headerLabel = isSummary ? 'Reasoning summary' : 'Reasoning'
    if (!reasoningBody.trim()) return null
    const showThinking = reasoningContent.status === 'in_progress' && isStreamActive
    return (
      <div className="ai-manus-fade-in group flex flex-col gap-2">
        {showHeader ? renderAssistantHeader(reasoningContent.timestamp) : null}
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className={cn(
            'group/header flex w-full items-center justify-between gap-2 text-[var(--text-primary)]',
            isCompact ? 'text-[11px]' : 'text-[10px]'
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <PngIcon
              name="Brain"
              alt=""
              size={isCompact ? 22 : 24}
              className="shrink-0"
              fallback={
                <Brain
                  className={cn('text-[var(--text-primary)]', isCompact ? 'h-4 w-4' : 'h-5 w-5')}
                />
              }
            />
            <span className="truncate font-medium">{headerLabel}</span>
            {showThinking ? <LoadingIndicator text="Thinking" compact={isCompact} /> : null}
            <ChevronDown
              size={isCompact ? 14 : 16}
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </div>
          {!isCompact ? (
            <div className="text-[9px] text-[var(--text-tertiary)] opacity-0 transition group-hover/header:opacity-100">
              {formatRelativeTime(reasoningContent.timestamp)}
            </div>
          ) : null}
        </button>
        <div
          className={cn(
            'overflow-hidden rounded-[10px] border border-[var(--border-light)] bg-[var(--fill-tsp-white-light)] px-3 py-2',
            expanded ? 'max-h-[100000px] opacity-100' : 'max-h-0 opacity-0',
            'transition-[max-height,opacity] duration-150 ease-in-out'
          )}
        >
          <div
            ref={reasoningRef}
            data-content-streaming={reasoningStreamEffect ? 'true' : undefined}
            className={cn(
              'prose max-w-none text-[var(--text-primary)] dark:prose-invert [&_code]:text-[var(--text-primary)] [&_pre:not(.shiki)_code]:text-[var(--text-primary)]',
              isCompact
                ? 'prose-sm text-[11px] [&_p]:text-[11px] [&_li]:text-[11px]'
                : 'prose-sm text-[12px] [&_p]:text-[12px] [&_li]:text-[12px]'
            )}
            onClick={handleMarkdownAction}
            onClickCapture={handleAssistantClick}
            onContextMenuCapture={handleWorkspaceLinkContextMenu}
            dangerouslySetInnerHTML={{
              __html: reasoningHtml,
            }}
          />
        </div>
      </div>
    )
  }

  if (message.type === 'step') {
    return (
      <div className="ai-manus-fade-in group flex flex-col">
        {showHeader ? renderAssistantHeader(stepContent.timestamp) : null}
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className={cn(
            'group/header flex w-full items-center justify-between gap-2 text-[var(--text-primary)]',
            isCompact ? 'text-[11px]' : 'text-[10px]'
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            {stepContent.status === 'completed' ? (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--text-disable)] text-[var(--icon-white)]">
                <Check size={10} />
              </span>
            ) : (
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border-dark)]" />
            )}
            <div
              className="truncate font-medium"
              onClick={handleAssistantClick}
              onContextMenuCapture={handleWorkspaceLinkContextMenu}
              dangerouslySetInnerHTML={{ __html: stepDescriptionHtml }}
            />
            <ChevronDown
              size={isCompact ? 14 : 16}
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </div>
          {!isCompact ? (
            <div className="text-[9px] text-[var(--text-tertiary)] opacity-0 transition group-hover/header:opacity-100">
              {formatRelativeTime(stepContent.timestamp)}
            </div>
          ) : null}
        </button>
        <div className="flex">
          <div className="relative w-[24px]">
            <div
              className="absolute left-[8px] top-0 bottom-0 border-l border-dashed border-[var(--border-dark)]"
              style={{ height: 'calc(100% + 14px)' }}
            />
          </div>
          <div
            className={`flex flex-1 flex-col gap-3 overflow-hidden pt-2 transition-[max-height,opacity] duration-150 ease-in-out ${
              expanded ? 'max-h-[100000px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            {stepContent.tools.map((tool) => (
              <ToolUse
                key={tool.tool_call_id}
                tool={tool}
                compact={isCompact}
                collapsible
                projectId={projectId}
                onClick={() => onToolClick?.(tool)}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (message.type === 'attachments' || message.type === 'attachment') {
    const showAttachmentHeader = showHeader && attachmentsContent.role === 'assistant'
    return (
      <div className="ai-manus-fade-in group flex flex-col gap-2">
        {showAttachmentHeader ? renderAssistantHeader(attachmentsContent.timestamp) : null}
        <AttachmentsMessage
          content={attachmentsContent}
          compact={isCompact}
          onFileClick={onFileClick}
        />
      </div>
    )
  }

  if (message.type === 'question_prompt') {
    return (
      <div className="ai-manus-fade-in group flex flex-col gap-2">
        {showHeader ? renderAssistantHeader(questionPromptContent.timestamp) : null}
        <QuestionPrompt
          toolCallId={questionPromptContent.toolCallId}
          args={questionPromptContent.args}
          status={questionPromptContent.status}
          answers={questionPromptContent.answers}
          error={questionPromptContent.error}
          compact={isCompact}
          resolveWorkspaceFileLink={workspaceLinkResolver}
          isWorkspaceFileLink={workspaceLinkMatcher}
          onFileLinkClick={onFileLinkClick}
          onSubmit={
            onQuestionPromptSubmit
              ? (answers) => onQuestionPromptSubmit(questionPromptContent.toolCallId, answers)
              : undefined
          }
        />
      </div>
    )
  }

  if (message.type === 'clarify_question') {
    return (
      <div className="ai-manus-fade-in group flex flex-col gap-2">
        {showHeader ? renderAssistantHeader(clarifyQuestionContent.timestamp) : null}
        <ClarifyQuestion
          question={clarifyQuestionContent.question}
          options={clarifyQuestionContent.options}
          multi={clarifyQuestionContent.multi}
          status={clarifyQuestionContent.status}
          defaultSelected={clarifyQuestionContent.defaultSelected}
          selections={clarifyQuestionContent.selections}
          missingFields={clarifyQuestionContent.missingFields}
          error={clarifyQuestionContent.error}
          compact={isCompact}
          resolveWorkspaceFileLink={workspaceLinkResolver}
          isWorkspaceFileLink={workspaceLinkMatcher}
          onFileLinkClick={onFileLinkClick}
          onSubmit={
            onClarifyQuestionSubmit
              ? (selections) => onClarifyQuestionSubmit(clarifyQuestionContent.toolCallId, selections)
              : undefined
          }
        />
      </div>
    )
  }

  if (message.type === 'patch_review') {
    return (
      <div className="ai-manus-fade-in group flex flex-col gap-2">
        {showHeader ? renderAssistantHeader(patchReviewContent.timestamp) : null}
        <PatchReviewCard
          content={patchReviewContent}
          compact={isCompact}
          readOnly={readOnly}
          onAccept={onPatchAccept ? () => onPatchAccept(message.id) : undefined}
          onReject={onPatchReject ? () => onPatchReject(message.id) : undefined}
        />
      </div>
    )
  }

  return null
}

const ChatMessage = memo(ChatMessageBase, (prev, next) => {
  if (prev.message !== next.message) return false
  if (prev.sessionId !== next.sessionId) return false
  if (prev.projectId !== next.projectId) return false
  if (prev.readOnly !== next.readOnly) return false
  if (prev.compact !== next.compact) return false
  if (prev.showAssistantHeader !== next.showAssistantHeader) return false
  if (prev.preferInlineToolView !== next.preferInlineToolView) return false
  if (prev.inlineToolOpen !== next.inlineToolOpen) return false
  if (prev.onInlineToolOpenChange !== next.onInlineToolOpenChange) return false
  if (prev.displayStreaming !== next.displayStreaming) return false
  if (prev.onToolClick !== next.onToolClick) return false
  if (prev.onFileClick !== next.onFileClick) return false
  if (prev.onFileLinkClick !== next.onFileLinkClick) return false
  if (prev.onQuestionPromptSubmit !== next.onQuestionPromptSubmit) return false
  if (prev.onClarifyQuestionSubmit !== next.onClarifyQuestionSubmit) return false
  if (prev.onPatchAccept !== next.onPatchAccept) return false
  if (prev.onPatchReject !== next.onPatchReject) return false
  if (prev.onDisplayComplete !== next.onDisplayComplete) return false
  if (prev.streamActive !== next.streamActive) {
    if (prev.message.type === 'reasoning' || next.message.type === 'reasoning') {
      return false
    }
  }
  return true
})

ChatMessage.displayName = 'ChatMessage'

export { ChatMessage }
export default ChatMessage
