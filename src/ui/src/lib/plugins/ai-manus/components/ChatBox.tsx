'use client'

import {
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type Ref,
  type UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Folder, Paperclip, Send } from 'lucide-react'
import { useI18n } from '@/lib/i18n/useI18n'
import { cn } from '@/lib/utils'
import type { AttachmentInfo } from '@/lib/types/chat-events'
import type { AgentDescriptor } from '@/lib/api/projects'
import { ensureDefaultAgent } from '@/lib/utils/agent-mentions'
import { ConfirmModal } from '@/components/ui/modal'
import { ChatBoxFiles, type ChatBoxFilesHandle } from './ChatBoxFiles'
import { COPILOT_ATTACHMENT_DRAG_TYPE } from '../lib/attachment-drawer'

export function ChatBox({
  value,
  onChange,
  onSubmit,
  onStop,
  isRunning,
  mentionables,
  mentionEnabled,
  includeDefaultAgent = true,
  lockedPrefix,
  lockLeadingMentionSpace,
  attachments,
  onAttachmentsChange,
  attachmentsEnabled,
  recentFiles,
  recentFilesActivePath,
  recentFilesEnabled,
  onRecentFilesToggle,
  onRecentFilesRemove,
  onRecentFileOpen,
  showTerminalToggle,
  terminalActive,
  terminalLabel,
  onTerminalToggle,
  terminalToggleDisabled,
  recentFilesDisabled,
  projectId,
  sessionId,
  ensureSession,
  readOnly,
  inputDisabled,
  compact,
  rows = 1,
  placeholder = 'Give DeepScientist a task to work on...',
  inputRef,
  containerClassName,
  panelClassName,
  inputClassName,
  onSessionAttachmentDrop,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onStop?: () => void
  isRunning: boolean
  mentionables?: AgentDescriptor[]
  mentionEnabled?: boolean
  includeDefaultAgent?: boolean
  lockedPrefix?: string
  lockLeadingMentionSpace?: boolean
  attachments: AttachmentInfo[]
  onAttachmentsChange: (next: AttachmentInfo[]) => void
  attachmentsEnabled?: boolean
  recentFiles?: string[]
  recentFilesActivePath?: string
  recentFilesEnabled?: boolean
  onRecentFilesToggle?: () => void
  onRecentFilesRemove?: () => void
  onRecentFileOpen?: (path: string) => void
  showTerminalToggle?: boolean
  terminalActive?: boolean
  terminalLabel?: string
  onTerminalToggle?: () => void
  terminalToggleDisabled?: boolean
  recentFilesDisabled?: boolean
  projectId?: string | null
  sessionId?: string | null
  ensureSession?: () => Promise<string | null>
  readOnly?: boolean
  inputDisabled?: boolean
  compact?: boolean
  rows?: number
  placeholder?: string
  inputRef?: Ref<HTMLTextAreaElement>
  containerClassName?: string
  panelClassName?: string
  inputClassName?: string
  onSessionAttachmentDrop?: (fileId: string) => void
}) {
  const { t } = useI18n('ai_manus')
  const isCompact = Boolean(compact)
  const isInputDisabled = Boolean(readOnly || inputDisabled)
  const mentionsAllowed = mentionEnabled ?? true
  const attachmentsAllowed = attachmentsEnabled ?? true
  const [isComposing, setIsComposing] = useState(false)
  const [hasTextInput, setHasTextInput] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [pendingUploadPromptOpen, setPendingUploadPromptOpen] = useState(false)
  const fileListRef = useRef<ChatBoxFilesHandle | null>(null)
  const dragCounterRef = useRef(0)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const setTextareaRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node
      if (!inputRef) return
      if (typeof inputRef === 'function') {
        inputRef(node)
      } else if ('current' in inputRef) {
        ;(inputRef as MutableRefObject<HTMLTextAreaElement | null>).current = node
      }
    },
    [inputRef]
  )
  const mirrorRef = useRef<HTMLDivElement | null>(null)
  const mentionRangeRef = useRef<{ start: number; end: number } | null>(null)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [isAttachmentDragActive, setIsAttachmentDragActive] = useState(false)
  const lockedLeadingMentionRef = useRef<string | null>(null)
  const normalizedLockedPrefix = useMemo(() => {
    const raw = typeof lockedPrefix === 'string' ? lockedPrefix.trim() : ''
    if (!raw) return null
    return raw.startsWith('@') ? raw : `@${raw}`
  }, [lockedPrefix])
  const lockedPrefixWithSpace = useMemo(() => {
    if (!normalizedLockedPrefix) return null
    return `${normalizedLockedPrefix} `
  }, [normalizedLockedPrefix])
  const lockedPrefixLength = lockedPrefixWithSpace?.length ?? 0
  const mentionCatalog = useMemo(() => {
    if (!mentionsAllowed) return []
    const base = mentionables ?? []
    return includeDefaultAgent ? ensureDefaultAgent(base) : base
  }, [includeDefaultAgent, mentionables, mentionsAllowed])
  const mentionLabels = useMemo(() => {
    const labels = new Set<string>()
    mentionCatalog.forEach((agent) => {
      if (agent.label) {
        const raw = agent.label.trim()
        if (raw) {
          labels.add(raw.startsWith('@') ? raw : `@${raw}`)
        }
      }
      if (agent.id) {
        labels.add(`@${agent.id}`)
      }
    })
    if (normalizedLockedPrefix) {
      labels.add(normalizedLockedPrefix)
    }
    return Array.from(labels).sort((a, b) => b.length - a.length)
  }, [mentionCatalog, normalizedLockedPrefix])
  const resolveLeadingMentionEnd = useCallback(
    (text: string) => {
      const raw = text ?? ''
      if (!raw.startsWith('@')) return null
      const rawLower = raw.toLowerCase()
      for (const label of mentionLabels) {
        const labelLower = label.toLowerCase()
        if (rawLower.startsWith(labelLower)) {
          return label.length
        }
      }
      const fallbackMatch = raw.match(/^@([^\s]+)/)
      return fallbackMatch ? fallbackMatch[0].length : null
    },
    [mentionLabels]
  )
  const getLeadingMentionInfo = useCallback((text: string) => {
    const end = resolveLeadingMentionEnd(text)
    if (!end) return null
    const token = text.slice(1, end).trim()
    if (!token) return null
    return {
      token: token.toLowerCase(),
      end,
    }
  }, [resolveLeadingMentionEnd])

  useEffect(() => {
    setHasTextInput(value.trim().length > 0)
  }, [value])

  useEffect(() => {
    if (mentionsAllowed) return
    mentionRangeRef.current = null
    setMentionOpen(false)
    setMentionQuery('')
  }, [mentionsAllowed])

  const applyLockedPrefix = useCallback(
    (text: string) => {
      if (!normalizedLockedPrefix || !lockedPrefixWithSpace) return text
      const trimmedPrefix = normalizedLockedPrefix
      const normalizedLower = trimmedPrefix.toLowerCase()
      const raw = text ?? ''
      const leadingTrimmed = raw.replace(/^\s+/, '')
      if (leadingTrimmed.toLowerCase().startsWith(normalizedLower)) {
        const remainder = leadingTrimmed.slice(trimmedPrefix.length)
        if (!remainder) {
          return lockedPrefixWithSpace
        }
        if (/^\s/.test(remainder)) {
          const trimmedRemainder = remainder.trimStart()
          return trimmedRemainder
            ? `${lockedPrefixWithSpace}${trimmedRemainder}`
            : lockedPrefixWithSpace
        }
      }
      let remainder = leadingTrimmed
      if (leadingTrimmed.startsWith('@')) {
        const match = leadingTrimmed.match(/^@([^\s]+)(?:\s+|$)/)
        if (match) {
          remainder = leadingTrimmed.slice(match[0].length).trimStart()
        }
      }
      return remainder ? `${lockedPrefixWithSpace}${remainder}` : lockedPrefixWithSpace
    },
    [lockedPrefixWithSpace, normalizedLockedPrefix]
  )

  useEffect(() => {
    if (!lockLeadingMentionSpace) {
      lockedLeadingMentionRef.current = null
      return
    }
    const info = getLeadingMentionInfo(value)
    if (!info) {
      lockedLeadingMentionRef.current = null
      return
    }
    lockedLeadingMentionRef.current = info.token
  }, [getLeadingMentionInfo, lockLeadingMentionSpace, value])

  const applyLeadingMentionSpace = useCallback(
    (text: string, selectionStart?: number | null, selectionEnd?: number | null) => {
      if (!lockLeadingMentionSpace) {
        return { value: text, selectionStart, selectionEnd, changed: false }
      }
      const end = resolveLeadingMentionEnd(text)
      if (!end) {
        return { value: text, selectionStart, selectionEnd, changed: false }
      }
      if (text[end] === ' ') {
        return { value: text, selectionStart, selectionEnd, changed: false }
      }
      const nextValue = `${text.slice(0, end)} ${text.slice(end)}`
      const insertAt = end
      const nextSelectionStart =
        selectionStart != null && selectionStart >= insertAt ? selectionStart + 1 : selectionStart
      const nextSelectionEnd =
        selectionEnd != null && selectionEnd >= insertAt ? selectionEnd + 1 : selectionEnd
      return { value: nextValue, selectionStart: nextSelectionStart, selectionEnd: nextSelectionEnd, changed: true }
    },
    [lockLeadingMentionSpace, resolveLeadingMentionEnd]
  )

  const normalizeInputValue = useCallback(
    (text: string, selectionStart?: number | null, selectionEnd?: number | null) => {
      const baseValue = normalizedLockedPrefix ? applyLockedPrefix(text) : text
      const mentionLocked = applyLeadingMentionSpace(baseValue, selectionStart, selectionEnd)
      return {
        value: mentionLocked.value,
        selectionStart: mentionLocked.selectionStart,
        selectionEnd: mentionLocked.selectionEnd,
      }
    },
    [applyLeadingMentionSpace, applyLockedPrefix, normalizedLockedPrefix]
  )

  useEffect(() => {
    if (!normalizedLockedPrefix && !lockLeadingMentionSpace) return
    const enforced = normalizeInputValue(value).value
    if (enforced !== value) {
      onChange(enforced)
    }
  }, [lockLeadingMentionSpace, normalizeInputValue, normalizedLockedPrefix, onChange, value])

  const activeAttachments = attachmentsAllowed ? attachments : []
  const pendingUploads = useMemo(
    () => activeAttachments.filter((file) => file.status === 'queued' || file.status === 'uploading'),
    [activeAttachments]
  )
  const hasPendingUploads = pendingUploads.length > 0
  const hasFailedUploads = useMemo(
    () => activeAttachments.some((file) => file.status === 'failed'),
    [activeAttachments]
  )
  const pendingUploadTarget = pendingUploads[0] ?? null

  const sendEnabled = hasTextInput && !isInputDisabled && !hasFailedUploads
  const stopEnabled = Boolean(onStop && !readOnly)
  const showRecentFilesToggle = Boolean(onRecentFilesToggle)
  const recentFilesActive = Boolean(recentFilesEnabled)
  const recentFilesToggleDisabled = Boolean(isInputDisabled || recentFilesDisabled)
  const showTerminalRuntimeToggle = Boolean(showTerminalToggle)
  const terminalRuntimeActive = Boolean(terminalActive)
  const terminalRuntimeToggleDisabled = Boolean(isInputDisabled || terminalToggleDisabled)
  const terminalRuntimeLabel = terminalLabel || (terminalRuntimeActive ? 'CLI Server' : 'Copilot')
  const agentInputTone = terminalRuntimeActive
    ? 'bg-[var(--ai-manus-input-runtime-bg)]'
    : 'bg-[var(--fill-input-chat)]'
  const inputBaseClass = cn(
    'w-full flex-1 resize-none rounded-md border-0 bg-transparent p-0 pt-[1px] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50',
    isCompact ? 'min-h-[36px] text-[11px]' : 'min-h-[44px] text-[13px]',
    inputClassName
  )

  const getMentionMatch = useCallback((text: string, cursorIndex: number) => {
    if (!text.startsWith('@')) return null
    const clampedIndex = Math.max(0, Math.min(cursorIndex, text.length))
    const firstSpace = text.search(/\s/)
    const mentionEnd = firstSpace === -1 ? text.length : firstSpace
    if (clampedIndex > mentionEnd) return null
    const query = text.slice(1, clampedIndex)
    if (!/^[^\s]*$/.test(query)) return null
    return { query, start: 0, end: clampedIndex }
  }, [])

  const getLeadingMentionDeleteEnd = useCallback((text: string) => {
    if (!text.startsWith('@')) return null
    const firstSpace = text.search(/\s/)
    const mentionEnd = firstSpace === -1 ? text.length : firstSpace
    let deleteEnd = mentionEnd
    if (text[deleteEnd] === ' ') {
      deleteEnd += 1
    }
    return Math.min(deleteEnd, text.length)
  }, [])

  const updateMentionState = useCallback(
    (text: string, cursorIndex: number) => {
      const match = getMentionMatch(text, cursorIndex)
      if (!match) {
        mentionRangeRef.current = null
        setMentionOpen(false)
        setMentionQuery('')
        return
      }
      mentionRangeRef.current = { start: match.start, end: match.end }
      setMentionQuery(match.query)
      setMentionIndex(0)
      setMentionOpen(true)
    },
    [getMentionMatch]
  )

  const filteredMentions = useMemo(() => {
    if (!mentionOpen) return []
    const query =
      typeof mentionQuery === 'string'
        ? mentionQuery.toLowerCase()
        : String(mentionQuery ?? '').toLowerCase()
    return mentionCatalog.filter((agent) => {
      const rawId = typeof agent.id === 'string' ? agent.id : agent.id != null ? String(agent.id) : ''
      const rawLabel =
        typeof agent.label === 'string'
          ? agent.label
          : agent.label != null
            ? String(agent.label)
            : rawId
              ? `@${rawId}`
              : '@agent'
      const id = rawId.toLowerCase()
      const label = rawLabel.toLowerCase()
      return id.includes(query) || label.includes(query)
    })
  }, [mentionCatalog, mentionOpen, mentionQuery])

  const showMentions =
    mentionOpen && filteredMentions.length > 0 && !isInputDisabled && mentionsAllowed

  useEffect(() => {
    if (!showMentions) return
    if (mentionIndex >= filteredMentions.length) {
      setMentionIndex(0)
    }
  }, [filteredMentions.length, mentionIndex, showMentions])

  const applyMention = useCallback(
    (agent: AgentDescriptor) => {
      const range = mentionRangeRef.current
      if (!range) return
      const rawLabel = typeof agent.label === 'string' ? agent.label.trim() : ''
      const label = rawLabel ? (rawLabel.startsWith('@') ? rawLabel : `@${rawLabel}`) : `@${agent.id}`
      const before = value.slice(0, range.start)
      const after = value.slice(range.end)
      const separator = after.startsWith(' ') ? '' : ' '
      const nextValue = `${before}${label}${separator}${after}`
      onChange(nextValue)
      setMentionOpen(false)
      setMentionQuery('')
      mentionRangeRef.current = null
      requestAnimationFrame(() => {
        if (!textareaRef.current) return
        const nextCursor = before.length + label.length + separator.length
        textareaRef.current.setSelectionRange(nextCursor, nextCursor)
        textareaRef.current.focus()
      })
    },
    [onChange, value]
  )

  const handleInputChange = useCallback(
    (nextValue: string, selectionStart: number, selectionEnd: number) => {
      const normalized = normalizeInputValue(nextValue, selectionStart, selectionEnd)
      onChange(normalized.value)
      if (
        (normalized.selectionStart != null || normalized.selectionEnd != null) &&
        (normalized.selectionStart !== selectionStart || normalized.selectionEnd !== selectionEnd)
      ) {
        requestAnimationFrame(() => {
          if (!textareaRef.current) return
          const nextStart = normalized.selectionStart ?? selectionStart
          const nextEnd = normalized.selectionEnd ?? nextStart
          textareaRef.current.setSelectionRange(nextStart, nextEnd)
        })
      }
      if (isInputDisabled || !mentionsAllowed) {
        return
      }
      updateMentionState(normalized.value, normalized.selectionStart ?? selectionStart)
    },
    [isInputDisabled, mentionsAllowed, normalizeInputValue, onChange, updateMentionState]
  )

  const handleScroll = useCallback((event: UIEvent<HTMLTextAreaElement>) => {
    if (mirrorRef.current) {
      mirrorRef.current.scrollTop = event.currentTarget.scrollTop
    }
  }, [])

  const highlightedInput = useMemo(() => {
    const text = value || ''
    const baseText = text.length > 0 ? text : placeholder
    const nodes: Array<string | JSX.Element> = []
    if (text.length > 0 && mentionsAllowed) {
      const mentionMatch = text.match(/^@[^\s]+/)
      if (mentionMatch) {
        const mentionText = mentionMatch[0]
        nodes.push(
          <span key="mention-leading" className="ai-manus-mention">
            {mentionText}
          </span>
        )
        if (mentionText.length < text.length) {
          nodes.push(text.slice(mentionText.length))
        }
      } else {
        nodes.push(baseText)
      }
    } else {
      nodes.push(baseText)
    }
    if (baseText.endsWith('\\n')) {
      nodes.push('\\n')
    }
    return {
      nodes,
      isPlaceholder: text.length === 0,
    }
  }, [mentionsAllowed, placeholder, value])

  const handleEnterKeydown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    if (isComposing) return
    if (!sendEnabled) return
    event.preventDefault()
    handleSubmit()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (normalizedLockedPrefix && textareaRef.current) {
      const prefixLength = lockedPrefixLength || normalizedLockedPrefix.length
      const selectionStart = textareaRef.current.selectionStart ?? 0
      const selectionEnd = textareaRef.current.selectionEnd ?? selectionStart
      const blockDelete =
        selectionStart < prefixLength || (selectionStart === prefixLength && event.key === 'Backspace')
      if (blockDelete && (event.key === 'Backspace' || event.key === 'Delete')) {
        event.preventDefault()
        requestAnimationFrame(() => {
          textareaRef.current?.setSelectionRange(prefixLength, prefixLength)
        })
        return
      }
      if (selectionStart < prefixLength && selectionStart !== selectionEnd) {
        requestAnimationFrame(() => {
          textareaRef.current?.setSelectionRange(prefixLength, prefixLength)
        })
      }
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      if (isComposing) return
      if (!sendEnabled) return
      event.preventDefault()
      handleSubmit()
      return
    }
    if (event.key === 'Backspace' && mentionsAllowed && textareaRef.current) {
      const selectionStart = textareaRef.current.selectionStart ?? 0
      const selectionEnd = textareaRef.current.selectionEnd ?? selectionStart
      if (selectionStart === selectionEnd) {
        const deleteEnd = getLeadingMentionDeleteEnd(value)
        if (deleteEnd && selectionStart > 0 && selectionStart <= deleteEnd) {
          event.preventDefault()
          const nextValue = value.slice(deleteEnd)
          onChange(nextValue)
          mentionRangeRef.current = null
          setMentionOpen(false)
          setMentionQuery('')
          requestAnimationFrame(() => {
            if (!textareaRef.current) return
            textareaRef.current.setSelectionRange(0, 0)
          })
          return
        }
      }
    }
    if (showMentions) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setMentionIndex((prev) => (prev + 1) % filteredMentions.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setMentionIndex((prev) =>
          prev - 1 < 0 ? filteredMentions.length - 1 : prev - 1
        )
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const selected = filteredMentions[mentionIndex]
        if (selected) {
          applyMention(selected)
        }
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setMentionOpen(false)
        return
      }
    }
    handleEnterKeydown(event)
  }

  const handleSubmit = () => {
    if (!sendEnabled) return
    if (hasPendingUploads) {
      setPendingUploadPromptOpen(true)
      return
    }
    onSubmit()
  }

  const handleStop = () => {
    if (!stopEnabled) return
    onStop?.()
  }

  const openUpload = () => {
    if (!attachmentsAllowed || isInputDisabled) return
    fileListRef.current?.openPicker()
  }

  const handleCancelPendingUpload = () => {
    if (!pendingUploadTarget) return
    if (fileListRef.current?.cancelAttachment) {
      fileListRef.current.cancelAttachment(pendingUploadTarget.file_id)
    } else {
      onAttachmentsChange(activeAttachments.filter((item) => item.file_id !== pendingUploadTarget.file_id))
    }
    setPendingUploadPromptOpen(false)
  }

  const hasFileTransfer = (event: DragEvent<HTMLDivElement>) =>
    Array.from(event.dataTransfer?.types ?? []).includes('Files')

  const hasAttachmentTransfer = (event: DragEvent<HTMLDivElement>) =>
    Array.from(event.dataTransfer?.types ?? []).includes(COPILOT_ATTACHMENT_DRAG_TYPE)

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (hasAttachmentTransfer(event) && onSessionAttachmentDrop) {
      setIsAttachmentDragActive(true)
      return
    }
    if (!attachmentsAllowed || isInputDisabled) return
    if (!hasFileTransfer(event)) return
    dragCounterRef.current += 1
    setDragActive(true)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (hasAttachmentTransfer(event) && onSessionAttachmentDrop) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
      setIsAttachmentDragActive(true)
      return
    }
    if (!attachmentsAllowed || isInputDisabled) return
    if (!hasFileTransfer(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (hasAttachmentTransfer(event) && onSessionAttachmentDrop) {
      const related = event.relatedTarget as Node | null
      if (related && event.currentTarget.contains(related)) return
      setIsAttachmentDragActive(false)
      return
    }
    if (!attachmentsAllowed || isInputDisabled) return
    if (!hasFileTransfer(event)) return
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
    if (dragCounterRef.current === 0) {
      setDragActive(false)
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (hasAttachmentTransfer(event) && onSessionAttachmentDrop) {
      const fileId = event.dataTransfer?.getData(COPILOT_ATTACHMENT_DRAG_TYPE)
      if (!fileId) return
      event.preventDefault()
      setIsAttachmentDragActive(false)
      onSessionAttachmentDrop(fileId)
      return
    }
    if (!attachmentsAllowed || isInputDisabled) return
    if (!hasFileTransfer(event)) return
    event.preventDefault()
    dragCounterRef.current = 0
    setDragActive(false)
    const files = Array.from(event.dataTransfer?.files ?? [])
    if (files.length > 0) {
      fileListRef.current?.queueFiles(files)
    }
  }

  const handlePasteCapture = (event: ClipboardEvent<HTMLDivElement>) => {
    if (!attachmentsAllowed || isInputDisabled) return
    const items = Array.from(event.clipboardData?.items ?? [])
    const imageFiles = items
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
    if (imageFiles.length === 0) return
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const normalized = imageFiles.map((file, index) => {
      const ext = file.type.split('/')[1] || 'png'
      const fallbackName = `pasted-${stamp}-${index + 1}.${ext}`
      const name = file.name && file.name !== 'image.png' ? file.name : fallbackName
      return file.name === name ? file : new File([file], name, { type: file.type })
    })
    fileListRef.current?.queueFiles(normalized)
    event.preventDefault()
  }

  return (
    <div
      className={cn(
        'relative bg-transparent',
        isCompact ? 'pb-1' : 'pb-3',
        containerClassName
      )}
    >
      <div
        className={cn(
          'relative flex max-h-[320px] flex-col rounded-[12px] border border-[var(--border-light)] shadow-[0px_0px_1px_0px_var(--shadow-XS),0px_12px_28px_-20px_var(--shadow-S)] focus-within:border-[var(--border-input-active)] focus-within:ring-1 focus-within:ring-[var(--border-input-active)] transition-colors duration-200',
          agentInputTone,
          isCompact ? 'gap-1.5 py-1.5' : 'gap-3 py-3',
          dragActive && 'border-[var(--border-input-active)] ring-2 ring-[var(--border-input-active)]',
          isAttachmentDragActive &&
            'border-[var(--border-input-active)] ring-2 ring-[var(--border-input-active)]',
          panelClassName
        )}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPasteCapture={handlePasteCapture}
      >
        {attachmentsAllowed || showRecentFilesToggle || recentFilesActive ? (
          <ChatBoxFiles
            ref={fileListRef}
            projectId={projectId}
            sessionId={sessionId}
            attachments={activeAttachments}
            onAttachmentsChange={onAttachmentsChange}
            recentFiles={recentFiles}
            activeRecentFile={recentFilesActivePath}
            showRecentFiles={recentFilesActive}
            onRecentFilesRemove={onRecentFilesRemove}
            onRecentFileOpen={onRecentFileOpen}
            ensureSession={ensureSession}
            readOnly={readOnly}
            inputDisabled={inputDisabled}
            compact={isCompact}
          />
        ) : null}
        <div className={cn('relative pr-2', isCompact ? 'pl-3' : 'pl-4')}>
          {showMentions ? (
            <div className="ai-manus-mention-popover absolute bottom-full left-0 z-20 mb-2 max-h-56 overflow-auto rounded-[14px]">
              {filteredMentions.map((agent, index) => {
                const isActive = index === mentionIndex
                const displayLabel = agent.label?.trim() || `@${agent.id}`
                return (
                  <button
                    type="button"
                    key={agent.id}
                    onClick={() => applyMention(agent)}
                    className={cn(
                      'ai-manus-mention-option flex w-full items-center gap-3 px-3 py-2 text-left text-[12px]',
                      isActive && 'ai-manus-mention-option-active'
                    )}
                  >
                    <span className="flex flex-col">
                      <span className="text-[12px] font-semibold text-[var(--text-mention)]">
                        {displayLabel}
                      </span>
                      {agent.description ? (
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                          {agent.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : null}
          <div className="relative overflow-y-auto">
            <div
              ref={mirrorRef}
              aria-hidden
              className={cn(
                'pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words',
                highlightedInput.isPlaceholder ? 'text-[var(--text-disable)]' : 'text-[var(--text-primary)]'
              )}
            >
              <div className={cn(inputBaseClass, 'whitespace-pre-wrap break-words')}>
                {highlightedInput.nodes}
              </div>
            </div>
            <textarea
              ref={setTextareaRef}
              className={cn(
                inputBaseClass,
                'text-transparent caret-[var(--text-primary)] placeholder:text-transparent'
              )}
              style={{ color: 'transparent', WebkitTextFillColor: 'transparent' }}
              rows={rows}
              value={value}
              onChange={(event) =>
                handleInputChange(
                  event.target.value,
                  event.target.selectionStart ?? event.target.value.length,
                  event.target.selectionEnd ?? event.target.selectionStart ?? event.target.value.length
                )
              }
              onSelect={(event) =>
                mentionsAllowed
                  ? updateMentionState(
                      event.currentTarget.value,
                      event.currentTarget.selectionStart ?? event.currentTarget.value.length
                    )
                  : undefined
              }
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              onKeyDown={handleKeyDown}
              onScroll={handleScroll}
              placeholder={placeholder}
              disabled={isInputDisabled}
            />
          </div>
        </div>
        <footer className={cn('flex w-full flex-row justify-between', isCompact ? 'px-2' : 'px-3')}>
          <div className="flex min-w-0 flex-1 items-center gap-2 pr-2">
            {attachmentsAllowed ? (
              <button
                type="button"
                onClick={openUpload}
                disabled={isInputDisabled}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-main)] text-[11px] text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-gray-main)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Paperclip size={16} />
              </button>
            ) : null}
            {showRecentFilesToggle ? (
              <button
                type="button"
                onClick={() => onRecentFilesToggle?.()}
                disabled={recentFilesToggleDisabled}
                aria-pressed={recentFilesActive}
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-main)] text-[11px] text-[var(--text-secondary)] transition disabled:cursor-not-allowed disabled:opacity-60',
                  recentFilesActive
                    ? 'bg-[var(--fill-tsp-gray-main)] text-[var(--text-primary)]'
                    : 'hover:bg-[var(--fill-tsp-gray-main)]'
                )}
                title={t('recent_files')}
              >
                <Folder size={16} />
              </button>
            ) : null}
            {showTerminalRuntimeToggle ? (
              <button
                type="button"
                onClick={() => onTerminalToggle?.()}
                disabled={terminalRuntimeToggleDisabled}
                aria-pressed={terminalRuntimeActive}
                className={cn(
                  'inline-flex h-8 min-w-0 max-w-[200px] items-center gap-2 rounded-full border px-3 text-[10px] font-semibold transition',
                  terminalRuntimeActive
                    ? 'border-[var(--border-input-active)] bg-[var(--fill-blue)] text-[var(--text-primary)]'
                    : 'border-[var(--border-main)] text-[var(--text-tertiary)] hover:bg-[var(--fill-tsp-gray-main)]',
                  terminalRuntimeToggleDisabled && 'cursor-not-allowed opacity-60'
                )}
                title={terminalRuntimeLabel}
                aria-label={terminalRuntimeLabel}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    terminalRuntimeActive ? 'bg-[var(--text-primary)]' : 'bg-[var(--text-tertiary)]'
                  )}
                />
                <span className="min-w-0 truncate">{terminalRuntimeLabel}</span>
              </button>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            {isRunning ? (
              <button
                type="button"
                onClick={handleStop}
                disabled={!stopEnabled}
                aria-label={t('pause')}
                title={t('pause')}
                className={
                  stopEnabled
                    ? 'flex h-8 w-8 items-center justify-center rounded-full bg-[var(--Button-primary-black)] text-[var(--text-onblack)]'
                    : 'flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full bg-[var(--fill-tsp-white-dark)] text-[var(--text-tertiary)]'
                }
              >
                <span className="h-[10px] w-[10px] rounded-[2px] bg-[var(--icon-onblack)]" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleSubmit}
              className={
                sendEnabled
                  ? 'flex h-8 w-8 items-center justify-center rounded-full bg-[var(--Button-primary-black)] text-[var(--text-onblack)] transition hover:opacity-90'
                  : 'flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full bg-[var(--fill-tsp-white-dark)] text-[var(--text-tertiary)]'
              }
            >
              <Send size={17} />
            </button>
          </div>
        </footer>
      </div>
      <ConfirmModal
        open={pendingUploadPromptOpen}
        onClose={() => setPendingUploadPromptOpen(false)}
        onConfirm={handleCancelPendingUpload}
        title="仍有文件上传中"
        description={
          pendingUploadTarget
            ? `还有 ${pendingUploads.length} 个文件上传中，当前上传：${pendingUploadTarget.filename}。`
            : '仍有文件上传中，请等待上传完成或取消该文件。'
        }
        confirmText="取消该文件"
        cancelText="等待"
        variant="warning"
      />
    </div>
  )
}

export default ChatBox
