'use client'

import { type ClipboardEvent, type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Folder, Paperclip, Send } from 'lucide-react'
import { EditorContent, EditorRoot, Placeholder, type EditorInstance } from 'novel'
import { useI18n } from '@/lib/i18n/useI18n'
import { cn } from '@/lib/utils'
import type { AttachmentInfo } from '@/lib/types/chat-events'
import { defaultExtensions } from '@/lib/plugins/notebook/lib/novel-extensions'
import { getEditorMarkdown, setEditorMarkdown } from '@/lib/plugins/notebook/lib/markdown-utils'
import { ConfirmModal } from '@/components/ui/modal'
import { ChatBoxFiles, type ChatBoxFilesHandle } from './ChatBoxFiles'
import { COPILOT_ATTACHMENT_DRAG_TYPE } from '../lib/attachment-drawer'
import '@/lib/plugins/notebook/NotebookEditor.css'

const DEFAULT_DOC = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

export function NotebookChatBox({
  value,
  onChange,
  onSubmit,
  onStop,
  isRunning,
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
  placeholder = 'Draft a response...',
  containerClassName,
  panelClassName,
  inputClassName,
  focusRef,
  onSessionAttachmentDrop,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onStop?: () => void
  isRunning: boolean
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
  placeholder?: string
  containerClassName?: string
  panelClassName?: string
  inputClassName?: string
  focusRef?: React.MutableRefObject<(() => void) | null>
  onSessionAttachmentDrop?: (fileId: string) => void
}) {
  const { t } = useI18n('ai_manus')
  const isCompact = Boolean(compact)
  const isInputDisabled = Boolean(readOnly || inputDisabled)
  const attachmentsAllowed = attachmentsEnabled ?? true
  const activeAttachments = attachmentsAllowed ? attachments : []
  const [dragActive, setDragActive] = useState(false)
  const [isAttachmentDragActive, setIsAttachmentDragActive] = useState(false)
  const [pendingUploadPromptOpen, setPendingUploadPromptOpen] = useState(false)
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
  const hasTextInput = value.trim().length > 0
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

  const fileListRef = useRef<ChatBoxFilesHandle | null>(null)
  const editorRef = useRef<EditorInstance | null>(null)
  const skipUpdateRef = useRef(false)
  const dragCounterRef = useRef(0)

  const extensions = useMemo(() => {
    const placeholderExtension = Placeholder.configure({
      placeholder,
      includeChildren: true,
    })
    const filtered = defaultExtensions.filter((extension) => extension.name !== 'placeholder')
    return [placeholderExtension, ...filtered] as unknown as any[]
  }, [placeholder])

  useEffect(() => {
    if (!focusRef) return
    focusRef.current = () => editorRef.current?.commands?.focus?.()
    return () => {
      focusRef.current = null
    }
  }, [focusRef])

  useEffect(() => {
    if (!editorRef.current) return
    editorRef.current.setEditable(!isInputDisabled)
  }, [isInputDisabled])

  useEffect(() => {
    if (!editorRef.current) return
    const next = value || ''
    const current = getEditorMarkdown(editorRef.current)
    if (current.trim() === next.trim()) return
    skipUpdateRef.current = true
    setEditorMarkdown(editorRef.current, next)
  }, [value])

  const handleUpdate = useCallback(
    (instance: EditorInstance) => {
      if (skipUpdateRef.current) {
        skipUpdateRef.current = false
        return
      }
      const markdown = getEditorMarkdown(instance)
      onChange(markdown)
    },
    [onChange]
  )

  const handleSubmit = useCallback(() => {
    if (!sendEnabled) return
    if (hasPendingUploads) {
      setPendingUploadPromptOpen(true)
      return
    }
    onSubmit()
  }, [hasPendingUploads, onSubmit, sendEnabled])

  const handleStop = useCallback(() => {
    if (!stopEnabled) return
    onStop?.()
  }, [onStop, stopEnabled])

  const handleKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (!sendEnabled || isInputDisabled) return false
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        handleSubmit()
        return true
      }
      return false
    },
    [handleSubmit, isInputDisabled, sendEnabled]
  )

  const openUpload = useCallback(() => {
    if (!attachmentsAllowed || isInputDisabled) return
    fileListRef.current?.openPicker()
  }, [attachmentsAllowed, isInputDisabled])

  const handleCancelPendingUpload = useCallback(() => {
    if (!pendingUploadTarget) return
    if (fileListRef.current?.cancelAttachment) {
      fileListRef.current.cancelAttachment(pendingUploadTarget.file_id)
    } else {
      onAttachmentsChange(activeAttachments.filter((item) => item.file_id !== pendingUploadTarget.file_id))
    }
    setPendingUploadPromptOpen(false)
  }, [activeAttachments, onAttachmentsChange, pendingUploadTarget])

  const hasFileTransfer = (event: DragEvent<HTMLDivElement>) =>
    Array.from(event.dataTransfer?.types ?? []).includes('Files')

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (Array.from(event.dataTransfer?.types ?? []).includes(COPILOT_ATTACHMENT_DRAG_TYPE)) {
      if (onSessionAttachmentDrop) {
        setIsAttachmentDragActive(true)
      }
      return
    }
    if (!attachmentsAllowed || isInputDisabled) return
    if (!hasFileTransfer(event)) return
    dragCounterRef.current += 1
    setDragActive(true)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (Array.from(event.dataTransfer?.types ?? []).includes(COPILOT_ATTACHMENT_DRAG_TYPE)) {
      if (onSessionAttachmentDrop) {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setIsAttachmentDragActive(true)
      }
      return
    }
    if (!attachmentsAllowed || isInputDisabled) return
    if (!hasFileTransfer(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (Array.from(event.dataTransfer?.types ?? []).includes(COPILOT_ATTACHMENT_DRAG_TYPE)) {
      if (!onSessionAttachmentDrop) return
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
    if (Array.from(event.dataTransfer?.types ?? []).includes(COPILOT_ATTACHMENT_DRAG_TYPE)) {
      if (!onSessionAttachmentDrop) return
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
    <div className={cn('relative bg-transparent', isCompact ? 'pb-1' : 'pb-3', containerClassName)}>
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
          <div className="relative overflow-y-auto">
            <div className={cn('notebook-editor-container', inputClassName)}>
              <EditorRoot>
                <EditorContent
                  extensions={extensions}
                  className={cn(
                    'notebook-doc-editor relative w-full overflow-y-auto',
                    isCompact ? 'max-h-[180px]' : 'max-h-[240px]'
                  )}
                  editorProps={{
                    handleDOMEvents: {
                      keydown: (_view, event) => handleKeydown(event),
                    },
                    attributes: {
                      class: cn(
                        'prose prose-sm max-w-full font-default focus:outline-none',
                        isCompact ? 'text-[12px]' : 'text-[13px]'
                      ),
                      style: 'padding: 0; min-height: 44px;',
                    },
                  }}
                  onCreate={({ editor }) => {
                    editorRef.current = editor
                    if (value.trim()) {
                      setEditorMarkdown(editor, value)
                    } else {
                      editor.commands.setContent(DEFAULT_DOC)
                    }
                    editor.setEditable(!isInputDisabled)
                  }}
                  onUpdate={({ editor }) => handleUpdate(editor)}
                />
              </EditorRoot>
            </div>
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

export default NotebookChatBox
