'use client'

import {
  type ChangeEvent,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Eye,
  Folder,
  Loader2,
  RefreshCcw,
  X,
} from 'lucide-react'
import { uploadCopilotAttachment } from '@/lib/api/copilot'
import { createFileObjectUrl, getFileTextPreview } from '@/lib/api/files'
import { getPdfMarkdownPreview, requestPdfParse } from '@/lib/api/pdf'
import { useToast } from '@/components/ui/toast'
import { copyToClipboard } from '@/lib/clipboard'
import { FileIcon } from '@/components/file-tree/FileIcon'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { formatFileSize, getMimeTypeFromExtension } from '@/lib/types/file'
import { useI18n } from '@/lib/i18n/useI18n'
import { cn } from '@/lib/utils'
import { buildCopilotFilePath } from '../lib/file-operations'
import type { AttachmentInfo } from '@/lib/types/chat-events'

type AttachmentDraft = AttachmentInfo & { file?: File | null }
type UploadTask = { file: File; tempId: string }
type TextPreviewState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  content?: string
  truncated?: boolean
  error?: string
}
type PdfPreviewState = {
  status: 'idle' | 'loading' | 'processing' | 'ready' | 'error'
  content?: string
  truncated?: boolean
  pageCount?: number
  phase?: string
  progress?: number
  error?: string
}

export type ChatBoxFilesHandle = {
  openPicker: () => void
  queueFiles: (files: File[]) => void
  cancelAttachment: (fileId: string) => void
}

const MAX_ATTACHMENT_COUNT = 10
const MAX_ATTACHMENT_SIZE_MB = 20
const MAX_SESSION_TOTAL_MB = 200
const MAX_CONCURRENT_UPLOADS = 3
const MAX_ATTACHMENT_SIZE = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024
const MAX_SESSION_TOTAL_SIZE = MAX_SESSION_TOTAL_MB * 1024 * 1024
const TEXT_PREVIEW_MAX_CHARS = 2000
const DEFAULT_INJECT_MAX_BYTES = 20 * 1024
const TEXT_PREVIEW_EXTENSIONS = new Set(['.txt', '.md', '.json', '.csv'])
const ALLOWED_MIME_TYPES = new Set([
  'application/json',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
])
const ALLOWED_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.csv',
  '.json',
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
])
const ACCEPT_ATTRIBUTE =
  'text/*,application/json,application/pdf,image/png,image/jpeg,image/webp,.md,.txt,.csv'

const normalizeRecentFilePath = (value: string) =>
  value.trim().replace(/\\/g, '/').replace(/\/+$/, '')

const getFileExtension = (filename: string) => {
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex <= 0) return ''
  return filename.slice(dotIndex).toLowerCase()
}

const getAttachmentMimeType = (filename: string, contentType?: string | null) => {
  return (contentType || getMimeTypeFromExtension(filename) || '').toLowerCase()
}

const isTextPreviewable = (filename: string, contentType?: string | null) => {
  const ext = getFileExtension(filename)
  if (ext && TEXT_PREVIEW_EXTENSIONS.has(ext)) return true
  const mimeType = getAttachmentMimeType(filename, contentType)
  return mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'text/csv'
}

const isImageAttachment = (filename: string, contentType?: string | null) => {
  const mimeType = getAttachmentMimeType(filename, contentType)
  return mimeType.startsWith('image/')
}

const isPdfAttachment = (filename: string, contentType?: string | null) => {
  const mimeType = getAttachmentMimeType(filename, contentType)
  if (mimeType === 'application/pdf') return true
  return filename.toLowerCase().endsWith('.pdf')
}

const shouldDefaultInject = (filename: string, contentType: string | null | undefined, size?: number) => {
  if (!isTextPreviewable(filename, contentType)) return false
  const resolvedSize = typeof size === 'number' ? size : 0
  return resolvedSize > 0 && resolvedSize <= DEFAULT_INJECT_MAX_BYTES
}

const ChatBoxFiles = forwardRef<
  ChatBoxFilesHandle,
  {
    projectId?: string | null
    sessionId?: string | null
    attachments: AttachmentInfo[]
    onAttachmentsChange: (next: AttachmentInfo[]) => void
    recentFiles?: string[]
    activeRecentFile?: string
    showRecentFiles?: boolean
    onRecentFilesRemove?: () => void
    onRecentFileOpen?: (path: string) => void
    ensureSession?: () => Promise<string | null>
    readOnly?: boolean
    inputDisabled?: boolean
    compact?: boolean
  }
>(
  (
    {
      projectId,
      sessionId,
      attachments,
      onAttachmentsChange,
      recentFiles,
      activeRecentFile,
      showRecentFiles,
      onRecentFilesRemove,
      onRecentFileOpen,
      ensureSession,
      readOnly,
      inputDisabled,
      compact,
    },
    ref
  ) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const attachmentsRef = useRef<AttachmentDraft[]>([])
    const uploadQueueRef = useRef<UploadTask[]>([])
    const activeUploadsRef = useRef(0)
    const canceledUploadsRef = useRef<Set<string>>(new Set())
    const resolvedSessionRef = useRef<string | null>(sessionId ?? null)
    const ensureSessionPromiseRef = useRef<Promise<string | null> | null>(null)
    const { addToast } = useToast()
    const isCompact = Boolean(compact)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(false)
    const [recentFilesOpen, setRecentFilesOpen] = useState(false)
    const [activePreviewId, setActivePreviewId] = useState<string | null>(null)
    const [textPreviews, setTextPreviews] = useState<Record<string, TextPreviewState>>({})
    const [pdfPreviews, setPdfPreviews] = useState<Record<string, PdfPreviewState>>({})
    const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
    const [textPreviewOpen, setTextPreviewOpen] = useState(true)
    const [imageDialogId, setImageDialogId] = useState<string | null>(null)
    const imageUrlsRef = useRef<Record<string, string>>({})
    const { t } = useI18n('ai_manus')

    const attachmentsWithFiles = useMemo(
      () => attachments as AttachmentDraft[],
      [attachments]
    )
    const recentFilesList = useMemo(() => recentFiles ?? [], [recentFiles])
    const normalizedActiveRecentFile = useMemo(
      () => (activeRecentFile ? normalizeRecentFilePath(activeRecentFile) : ''),
      [activeRecentFile]
    )
    const hasRecentFiles = Boolean(showRecentFiles && recentFilesList.length > 0)
    const canOpenRecentFiles = Boolean(onRecentFileOpen)
    const activeAttachment = useMemo(
      () => attachmentsWithFiles.find((item) => item.file_id === activePreviewId) ?? null,
      [attachmentsWithFiles, activePreviewId]
    )
    const activePreviewType = useMemo(() => {
      if (!activeAttachment || activeAttachment.status !== 'success') return null
      if (isTextPreviewable(activeAttachment.filename, activeAttachment.content_type)) return 'text'
      if (isImageAttachment(activeAttachment.filename, activeAttachment.content_type)) return 'image'
      if (isPdfAttachment(activeAttachment.filename, activeAttachment.content_type)) return 'pdf'
      return 'unknown'
    }, [activeAttachment])
    const activeTextPreview = useMemo(() => {
      if (!activeAttachment) return null
      return textPreviews[activeAttachment.file_id] ?? null
    }, [activeAttachment, textPreviews])
    const activePdfPreview = useMemo(() => {
      if (!activeAttachment) return null
      return pdfPreviews[activeAttachment.file_id] ?? null
    }, [activeAttachment, pdfPreviews])
    const activeImageUrl = useMemo(() => {
      if (!activeAttachment) return null
      return imageUrls[activeAttachment.file_id] ?? null
    }, [activeAttachment, imageUrls])

    const updateAttachments = (updater: (items: AttachmentDraft[]) => AttachmentDraft[]) => {
      const next = updater(attachmentsRef.current)
      attachmentsRef.current = next
      onAttachmentsChange(next)
    }

    useEffect(() => {
      attachmentsRef.current = attachmentsWithFiles
    }, [attachmentsWithFiles])

    useEffect(() => {
      imageUrlsRef.current = imageUrls
    }, [imageUrls])

    useEffect(() => {
      const activeIds = new Set(attachmentsWithFiles.map((item) => item.file_id))
      setImageUrls((prev) => {
        const next = { ...prev }
        for (const [fileId, url] of Object.entries(prev)) {
          if (!activeIds.has(fileId)) {
            URL.revokeObjectURL(url)
            delete next[fileId]
          }
        }
        return next
      })
    }, [attachmentsWithFiles])

    useEffect(() => {
      return () => {
        Object.values(imageUrlsRef.current).forEach((url) => {
          URL.revokeObjectURL(url)
        })
      }
    }, [])

    useEffect(() => {
      if (sessionId) {
        resolvedSessionRef.current = sessionId
      }
    }, [sessionId])

    const updateScrollButtons = () => {
      const container = scrollRef.current
      if (!container) return
      const { scrollLeft, scrollWidth, clientWidth } = container
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4)
    }

    const scrollLeft = () => {
      scrollRef.current?.scrollBy({ left: -280, behavior: 'smooth' })
    }

    const scrollRight = () => {
      scrollRef.current?.scrollBy({ left: 280, behavior: 'smooth' })
    }

    useEffect(() => {
      updateScrollButtons()
    }, [attachments.length, hasRecentFiles, recentFilesList.length])

    useEffect(() => {
      if (!showRecentFiles) {
        setRecentFilesOpen(false)
      }
    }, [showRecentFiles])

    useEffect(() => {
      if (!activePreviewId) return
      if (attachmentsWithFiles.some((item) => item.file_id === activePreviewId)) return
      setActivePreviewId(null)
    }, [activePreviewId, attachmentsWithFiles])

    useEffect(() => {
      if (!activePreviewId) return
      setTextPreviewOpen(true)
    }, [activePreviewId])

    const resolveSessionId = useCallback(async () => {
      if (sessionId) return sessionId
      if (resolvedSessionRef.current) return resolvedSessionRef.current
      if (!ensureSession) return null
      if (!ensureSessionPromiseRef.current) {
        ensureSessionPromiseRef.current = ensureSession().finally(() => {
          ensureSessionPromiseRef.current = null
        })
      }
      const resolved = await ensureSessionPromiseRef.current
      resolvedSessionRef.current = resolved
      return resolved
    }, [ensureSession, sessionId])

    const resolveUploadError = (error: unknown) => {
      if (error instanceof Error && error.message) return error.message
      if (typeof error === 'string') return error
      if (error && typeof error === 'object') {
        const typed = error as { response?: { data?: { detail?: string; message?: string } } }
        const detail = typed.response?.data?.detail || typed.response?.data?.message
        if (typeof detail === 'string' && detail.trim()) return detail
      }
      return 'Upload failed'
    }

    const isAllowedFile = (file: File) => {
      const mimeType = file.type || ''
      if (mimeType && (mimeType.startsWith('text/') || ALLOWED_MIME_TYPES.has(mimeType))) {
        return true
      }
      const extension = getFileExtension(file.name)
      if (extension && ALLOWED_EXTENSIONS.has(extension)) return true
      const inferred = getMimeTypeFromExtension(file.name)
      if (inferred && (inferred.startsWith('text/') || ALLOWED_MIME_TYPES.has(inferred))) {
        return true
      }
      return false
    }


    const startUpload = async (task: UploadTask) => {
      if (canceledUploadsRef.current.has(task.tempId)) return
      if (!projectId) {
        addToast({
          type: 'error',
          title: 'Upload failed',
          description: 'Open a project before uploading files.',
        })
        updateAttachments((items) =>
          items.map((item) =>
            item.file_id === task.tempId
              ? { ...item, status: 'failed', error: 'No active project.' }
              : item
          )
        )
        return
      }

      const resolvedSessionId = await resolveSessionId()
      if (!resolvedSessionId) {
        addToast({
          type: 'error',
          title: 'Upload failed',
          description: 'Unable to create a session for uploads.',
        })
        updateAttachments((items) =>
          items.map((item) =>
            item.file_id === task.tempId
              ? { ...item, status: 'failed', error: 'No active session.' }
              : item
          )
        )
        return
      }

      updateAttachments((items) =>
        items.map((item) =>
          item.file_id === task.tempId
            ? {
                ...item,
                status: 'uploading',
                progress: typeof item.progress === 'number' ? item.progress : 0,
                error: undefined,
                file_path: item.file_path || buildCopilotFilePath(resolvedSessionId, item.filename),
              }
            : item
        )
      )

      try {
        const uploaded = await uploadCopilotAttachment({
          projectId,
          sessionId: resolvedSessionId,
          file: task.file,
          onProgress: (progress) => {
            if (canceledUploadsRef.current.has(task.tempId)) return
            updateAttachments((items) =>
              items.map((item) =>
                item.file_id === task.tempId
                  ? {
                      ...item,
                      status: 'uploading',
                      progress: Math.max(0, Math.min(100, progress)),
                    }
                  : item
              )
            )
          },
        })
        if (canceledUploadsRef.current.has(task.tempId)) return
        updateAttachments((items) =>
          items.map((item) =>
            item.file_id === task.tempId
              ? {
                  ...item,
                  file_id: uploaded.file_id,
                  filename: uploaded.name,
                  content_type: uploaded.mime ?? task.file.type,
                  size: uploaded.size ?? task.file.size,
                  upload_date: new Date().toISOString(),
                  status: 'success',
                  progress: 100,
                  file: null,
                  error: undefined,
                  file_path: buildCopilotFilePath(resolvedSessionId, uploaded.name),
                }
              : item
          )
        )
      } catch (error) {
        if (canceledUploadsRef.current.has(task.tempId)) return
        const message = resolveUploadError(error)
        console.error('[AiManus] Upload failed', error)
        updateAttachments((items) =>
          items.map((item) =>
            item.file_id === task.tempId
              ? {
                  ...item,
                  status: 'failed',
                  error: message,
                }
              : item
          )
        )
      }
    }

    const scheduleUploads = () => {
      while (
        activeUploadsRef.current < MAX_CONCURRENT_UPLOADS &&
        uploadQueueRef.current.length > 0
      ) {
        const task = uploadQueueRef.current.shift()
        if (!task) break
        activeUploadsRef.current += 1
        void startUpload(task).finally(() => {
          activeUploadsRef.current = Math.max(0, activeUploadsRef.current - 1)
          scheduleUploads()
        })
      }
    }

    const queueFiles = useCallback(
      (files: File[]) => {
        if (readOnly || inputDisabled) return
        if (!files.length) return
        let nextCount = attachmentsRef.current.length
        let totalSize = attachmentsRef.current.reduce((sum, item) => sum + (item.size || 0), 0)
        const draftSessionId = sessionId ?? resolvedSessionRef.current
        const drafts: AttachmentDraft[] = []
        for (const file of files) {
          if (nextCount >= MAX_ATTACHMENT_COUNT) {
            addToast({
              type: 'warning',
              title: 'Attachment limit reached',
              description: `You can attach up to ${MAX_ATTACHMENT_COUNT} files per session.`,
            })
            break
          }
          if (file.size > MAX_ATTACHMENT_SIZE) {
            addToast({
              type: 'warning',
              title: 'File too large',
              description: `Each file must be under ${MAX_ATTACHMENT_SIZE_MB} MB.`,
            })
            continue
          }
          if (!isAllowedFile(file)) {
            addToast({
              type: 'warning',
              title: 'Unsupported file type',
              description: 'Allowed: text, JSON, PDF, PNG, JPEG, or WebP.',
            })
            continue
          }
          if (totalSize + file.size > MAX_SESSION_TOTAL_SIZE) {
            addToast({
              type: 'warning',
              title: 'Attachment quota reached',
              description: `Total attachments must stay under ${MAX_SESSION_TOTAL_MB} MB.`,
            })
            continue
          }
          const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`
          const inferredType = file.type || getMimeTypeFromExtension(file.name) || undefined
          drafts.push({
            file_id: tempId,
            filename: file.name,
            content_type: inferredType,
            size: file.size,
            upload_date: new Date().toISOString(),
            status: 'queued',
            progress: 0,
            file,
            file_path: draftSessionId ? buildCopilotFilePath(draftSessionId, file.name) : undefined,
            include_in_context: shouldDefaultInject(file.name, inferredType, file.size),
            metadata: { client_id: tempId },
          })
          uploadQueueRef.current.push({ file, tempId })
          nextCount += 1
          totalSize += file.size
        }
        if (drafts.length > 0) {
          updateAttachments((items) => [...items, ...drafts])
          scheduleUploads()
        }
      },
      [addToast, inputDisabled, readOnly, scheduleUploads, sessionId, updateAttachments]
    )

    const cancelAttachment = useCallback(
      (fileId: string) => {
        if (inputDisabled) return
        canceledUploadsRef.current.add(fileId)
        uploadQueueRef.current = uploadQueueRef.current.filter((task) => task.tempId !== fileId)
        updateAttachments((items) => items.filter((item) => item.file_id !== fileId))
      },
      [inputDisabled, updateAttachments]
    )

    useImperativeHandle(
      ref,
      () => ({
        openPicker: () => {
          if (readOnly || inputDisabled) return
          fileInputRef.current?.click()
        },
        queueFiles,
        cancelAttachment,
      }),
      [cancelAttachment, inputDisabled, queueFiles, readOnly]
    )

    const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? [])
      queueFiles(files)
      event.target.value = ''
    }

    const removeFile = (fileId: string) => {
      cancelAttachment(fileId)
    }

    const retryUpload = useCallback(
      (fileInfo: AttachmentDraft) => {
        if (inputDisabled) return
        if (!fileInfo.file) return
        canceledUploadsRef.current.delete(fileInfo.file_id)
        updateAttachments((items) =>
          items.map((item) =>
            item.file_id === fileInfo.file_id
              ? { ...item, status: 'queued', progress: 0, error: undefined }
              : item
          )
        )
        uploadQueueRef.current.push({ file: fileInfo.file, tempId: fileInfo.file_id })
        scheduleUploads()
      },
      [inputDisabled, scheduleUploads, updateAttachments]
    )

    const setIncludeInContext = useCallback(
      (fileId: string, includeInContext: boolean) => {
        if (inputDisabled) return
        updateAttachments((items) =>
          items.map((item) =>
            item.file_id === fileId ? { ...item, include_in_context: includeInContext } : item
          )
        )
      },
      [inputDisabled, updateAttachments]
    )

    const togglePreview = useCallback((fileId: string) => {
      setActivePreviewId((current) => (current === fileId ? null : fileId))
    }, [])

    const loadTextPreview = useCallback(
      async (file: AttachmentInfo) => {
        const fileId = file.file_id
        if (!fileId) return
        const existing = textPreviews[fileId]
        if (existing && (existing.status === 'loading' || existing.status === 'ready')) return
        setTextPreviews((prev) => ({
          ...prev,
          [fileId]: { status: 'loading' },
        }))
        try {
          const preview = await getFileTextPreview(fileId, { maxChars: TEXT_PREVIEW_MAX_CHARS })
          setTextPreviews((prev) => ({
            ...prev,
            [fileId]: {
              status: 'ready',
              content: preview.content,
              truncated: preview.truncated,
            },
          }))
        } catch (error) {
          const message = resolveUploadError(error)
          setTextPreviews((prev) => ({
            ...prev,
            [fileId]: { status: 'error', error: message },
          }))
        }
      },
      [textPreviews]
    )

    const ensureImageUrl = useCallback(async (fileId: string) => {
      if (!fileId) return
      if (imageUrlsRef.current[fileId]) return
      try {
        const url = await createFileObjectUrl(fileId)
        setImageUrls((prev) => ({
          ...prev,
          [fileId]: url,
        }))
      } catch (error) {
        console.error('[AiManus] Failed to load image preview', error)
      }
    }, [])

    useEffect(() => {
      if (!activeAttachment || activeAttachment.status !== 'success') return
      if (activePreviewType === 'text') {
        void loadTextPreview(activeAttachment)
      }
      if (activePreviewType === 'image') {
        void ensureImageUrl(activeAttachment.file_id)
      }
    }, [activeAttachment, activePreviewType, ensureImageUrl, loadTextPreview])

    const handlePdfExtract = useCallback(async (file: AttachmentInfo) => {
      const fileId = file.file_id
      if (!fileId) return
      setPdfPreviews((prev) => ({
        ...prev,
        [fileId]: { ...(prev[fileId] || { status: 'idle' }), status: 'loading' },
      }))
      try {
        const status = await requestPdfParse(fileId)
        if (status.status === 'ready') {
          const markdown = await getPdfMarkdownPreview(fileId, TEXT_PREVIEW_MAX_CHARS)
          setPdfPreviews((prev) => ({
            ...prev,
            [fileId]: {
              status: 'ready',
              content: markdown,
              truncated: markdown.length >= TEXT_PREVIEW_MAX_CHARS,
              pageCount: status.page_count,
              phase: status.phase,
              progress: status.progress,
            },
          }))
          return
        }
        const nextStatus = status.status === 'processing' ? 'processing' : 'error'
        setPdfPreviews((prev) => ({
          ...prev,
          [fileId]: {
            ...(prev[fileId] || { status: 'idle' }),
            status: nextStatus,
            pageCount: status.page_count,
            phase: status.phase,
            progress: status.progress,
            error: status.error,
          },
        }))
      } catch (error) {
        const message = resolveUploadError(error)
        setPdfPreviews((prev) => ({
          ...prev,
          [fileId]: { status: 'error', error: message },
        }))
      }
    }, [])

    const handleCopyPreview = useCallback(
      async (content: string) => {
        if (!content) return
        const ok = await copyToClipboard(content)
        addToast({
          type: ok ? 'success' : 'error',
          title: ok ? t('copied_preview_title') : t('copy_failed_title'),
          description: ok ? t('copied_preview_desc') : t('copy_failed_desc'),
        })
      },
      [addToast, t]
    )

    const getFileTypeText = (filename: string) => {
      const ext = filename.split('.').pop()
      return ext ? ext.toUpperCase() : 'FILE'
    }

    if (attachmentsWithFiles.length === 0 && !hasRecentFiles) {
      return (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="hidden"
          onChange={handleFileSelect}
        />
      )
    }

    return (
      <div
        className={cn(
          'relative w-full flex-shrink-0 overflow-hidden',
          isCompact ? 'pb-2' : 'pb-3'
        )}
      >
        {attachmentsWithFiles.length > 0 ? (
          <div
            className={cn(
              'px-3 pb-2 text-[10px] text-[var(--text-tertiary)]',
              isCompact && 'px-2 text-[11px]'
            )}
          >
            已附加 {attachmentsWithFiles.length} 个文件
          </div>
        ) : null}
        {canScrollLeft ? (
          <button
            type="button"
            onClick={scrollLeft}
            className="absolute left-0 top-0 z-10 flex h-full items-center gap-2 px-3"
            style={{
              backgroundImage: 'linear-gradient(270deg, var(--gradual-white-0) 0%, var(--fill-input-chat) 100%)',
            }}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-white)] bg-[var(--background-menu-white)] shadow-[0_0_1.25px_0_var(--shadow-M),0_5px_16px_0_var(--shadow-M)]">
              <ChevronLeft size={14} />
            </div>
          </button>
        ) : null}

        <div
          ref={scrollRef}
          onScroll={updateScrollButtons}
          className="flex overflow-x-auto overflow-y-hidden pb-[10px] pl-[10px] pr-2 scrollbar-hide"
        >
          <div className="flex gap-3">
            {hasRecentFiles ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() => setRecentFilesOpen((prev) => !prev)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setRecentFilesOpen((prev) => !prev)
                  }
                }}
                className="group/attach relative flex w-[240px] max-w-full cursor-pointer items-center gap-2 rounded-[10px] bg-[var(--fill-tsp-white-main)] p-2 pr-2.5 transition hover:bg-[var(--fill-tsp-white-dark)] animate-in fade-in-0 zoom-in-95 duration-200"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md">
                  <Folder className="h-4 w-4 text-[var(--icon-primary)]" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div
                    className={
                      isCompact
                        ? 'flex-1 truncate text-[12px] text-[var(--text-primary)]'
                        : 'flex-1 truncate text-[10px] text-[var(--text-primary)]'
                    }
                  >
                    Recent files
                  </div>
                  <div
                    className={
                      isCompact
                        ? 'text-[11px] text-[var(--text-tertiary)]'
                        : 'text-[9px] text-[var(--text-tertiary)]'
                    }
                  >
                    {recentFilesList.length} files
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {recentFilesOpen ? (
                    <ChevronUp size={14} className="text-[var(--icon-tertiary)]" />
                  ) : (
                    <ChevronDown size={14} className="text-[var(--icon-tertiary)]" />
                  )}
                  {onRecentFilesRemove ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onRecentFilesRemove()
                      }}
                      className="hidden rounded-full bg-[var(--icon-tertiary)] p-[2px] text-white group-hover/attach:flex"
                    >
                      <X size={10} />
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {attachmentsWithFiles.map((file) => {
              const mimeType = file.content_type || getMimeTypeFromExtension(file.filename)
              const isQueued = file.status === 'queued'
              const isUploading = file.status === 'uploading'
              const isFailed = file.status === 'failed'
              const isText = isTextPreviewable(file.filename, file.content_type)
              const isPdf = isPdfAttachment(file.filename, file.content_type)
              const isImage = isImageAttachment(file.filename, file.content_type)
              const canPreview = file.status === 'success' && (isText || isPdf || isImage)
              const canInject = isText || isPdf
              const isActivePreview = activePreviewId === file.file_id
              const progressValue =
                typeof file.progress === 'number' ? file.progress : file.status === 'success' ? 100 : 0
              const progressClamped = Math.max(0, Math.min(100, progressValue))
              return (
                <div
                  key={file.file_id}
                  onClick={() => {
                    if (!canPreview) return
                    togglePreview(file.file_id)
                  }}
                  className={cn(
                    'group/attach relative flex w-[280px] max-w-full items-center gap-2 rounded-[10px] bg-[var(--fill-tsp-white-main)] p-2 pr-2.5 hover:bg-[var(--fill-tsp-white-dark)]',
                    canPreview ? 'cursor-pointer' : 'cursor-default',
                    isActivePreview && 'border border-[var(--border-input-active)]'
                  )}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md">
                    {isUploading || isQueued ? (
                      <Loader2
                        className={cn(
                          'h-4 w-4 text-[var(--icon-tertiary)]',
                          isUploading && 'animate-spin'
                        )}
                      />
                    ) : (
                      <FileIcon type="file" mimeType={mimeType} name={file.filename} className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex min-w-0 items-center">
                      <div
                        className={
                          isCompact
                            ? 'flex-1 truncate text-[12px] text-[var(--text-primary)]'
                            : 'flex-1 truncate text-[10px] text-[var(--text-primary)]'
                        }
                      >
                        {file.filename}
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          removeFile(file.file_id)
                        }}
                        className="hidden rounded-full bg-[var(--icon-tertiary)] p-[2px] text-white group-hover/attach:flex"
                      >
                        <X size={10} />
                      </button>
                    </div>
                    {!isCompact || file.status !== 'success' ? (
                      <div
                        className={
                          isCompact
                            ? 'text-[11px] text-[var(--text-tertiary)]'
                            : 'text-[9px] text-[var(--text-tertiary)]'
                        }
                      >
                        {isFailed ? (
                          <span className="flex items-center gap-1 text-[var(--function-error)]">
                            <span className="truncate" title={file.error || 'Upload failed'}>
                              {file.error || 'Upload failed'}
                            </span>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                retryUpload(file)
                              }}
                              className="flex items-center gap-1 rounded-full px-1 text-[var(--function-error)] hover:opacity-80"
                            >
                              <RefreshCcw size={12} />
                              <span className="text-[10px]">{t('retry')}</span>
                            </button>
                          </span>
                        ) : isUploading ? (
                          `Uploading ${progressClamped}% · ${formatFileSize(file.size)}`
                        ) : isQueued ? (
                          `Queued · ${formatFileSize(file.size)}`
                        ) : (
                          `${getFileTypeText(file.filename)} · ${formatFileSize(file.size)}`
                        )}
                        {isQueued || isUploading || isFailed ? (
                          <div className="mt-1 h-1 w-full rounded-full bg-[var(--fill-tsp-gray-main)]">
                            <div
                              className={cn(
                                'h-1 rounded-full transition-[width] duration-200',
                                isFailed
                                  ? 'bg-[var(--function-error)]'
                                  : isUploading
                                    ? 'bg-[var(--fill-blue)]'
                                    : 'bg-[var(--fill-tsp-white-dark)]'
                              )}
                              style={{ width: `${progressClamped}%` }}
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {canInject ? (
                      <label
                        className="mt-1 flex items-center gap-1 text-[9px] text-[var(--text-tertiary)]"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(file.include_in_context)}
                          onChange={(event) => setIncludeInContext(file.file_id, event.target.checked)}
                          className="h-3 w-3 rounded border border-[var(--border-light)] text-[var(--text-brand)]"
                        />
                        <span>{t('context')}</span>
                      </label>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {hasRecentFiles && recentFilesOpen ? (
          <div
            className={cn(
              'mt-1 rounded-[10px] border border-[var(--border-light)] bg-[var(--fill-tsp-white-main)] px-3 py-2 text-[var(--text-secondary)] animate-in fade-in-0 slide-in-from-top-2 duration-200',
              isCompact ? 'mx-2 text-[11px]' : 'mx-3 text-[10px]'
            )}
          >
            <div className={cn('text-[var(--text-tertiary)]', isCompact ? 'text-[11px]' : 'text-[10px]')}>
              Currently reading
            </div>
            <div className="mt-1 max-h-[120px] space-y-1 overflow-y-auto pr-1">
              {recentFilesList.map((path) => {
                const normalizedPath = normalizeRecentFilePath(path)
                const isActive =
                  normalizedActiveRecentFile && normalizedPath === normalizedActiveRecentFile
                return (
                  <button
                    key={path}
                    type="button"
                    onClick={() => onRecentFileOpen?.(path)}
                    disabled={!canOpenRecentFiles}
                    title={path}
                    className={cn(
                      'w-full text-left transition',
                      isCompact ? 'text-[11px]' : 'text-[10px]',
                      canOpenRecentFiles
                        ? 'cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        : 'cursor-default text-[var(--text-tertiary)]'
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-1">
                      {isActive ? (
                        <Eye size={12} className="shrink-0 text-[var(--icon-primary)]" />
                      ) : null}
                      <span className="min-w-0 truncate">{path}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {activeAttachment && activeAttachment.status === 'success' ? (
          <div
            className={cn(
              'mt-1 rounded-[10px] border border-[var(--border-light)] bg-[var(--fill-tsp-white-main)] px-3 py-2 text-[var(--text-secondary)] animate-in fade-in-0 slide-in-from-top-2 duration-200',
              isCompact ? 'mx-2 text-[11px]' : 'mx-3 text-[10px]'
            )}
          >
            {(() => {
              const activeMime =
                activeAttachment.content_type || getMimeTypeFromExtension(activeAttachment.filename)
              const activeSize = activeAttachment.size ? formatFileSize(activeAttachment.size) : ''
              const typeLabel = activeAttachment.filename.split('.').pop()
              const typeText = typeLabel ? typeLabel.toUpperCase() : activeMime || 'FILE'
              return (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[9px] text-[var(--text-tertiary)]">{t('attachment_preview')}</div>
                    <div className="truncate text-[11px] font-medium text-[var(--text-primary)]">
                      {activeAttachment.filename}
                    </div>
                    <div className="text-[9px] text-[var(--text-tertiary)]">
                      {[typeText, activeSize].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActivePreviewId(null)}
                    className="rounded-full bg-[var(--icon-tertiary)] p-[2px] text-white"
                    aria-label={t('close_preview')}
                  >
                    <X size={10} />
                  </button>
                </div>
              )
            })()}

            {activePreviewType === 'text' ? (
              <div className="mt-2 rounded-[8px] border border-[var(--border-light)] bg-[var(--background-white-main)] px-2 py-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setTextPreviewOpen((prev) => !prev)}
                    className="flex items-center gap-2 text-[9px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  >
                    <ChevronDown
                      size={12}
                      className={cn('transition-transform', textPreviewOpen && 'rotate-180')}
                    />
                    <span>{t('text_preview')}</span>
                    {activeTextPreview?.truncated ? (
                      <span className="rounded-full bg-[var(--fill-tsp-gray-main)] px-2 py-0.5 text-[8px] text-[var(--text-tertiary)]">
                        {t('truncated')}
                      </span>
                    ) : null}
                  </button>
                  {activeTextPreview?.status === 'ready' ? (
                    <button
                      type="button"
                      onClick={() => handleCopyPreview(activeTextPreview.content || '')}
                      className="flex items-center gap-1 rounded-full border border-[var(--border-light)] px-2 py-0.5 text-[8px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                      <Copy size={12} />
                      {t('copy')}
                    </button>
                  ) : null}
                </div>
                {textPreviewOpen ? (
                  <div className="mt-2 max-h-[160px] overflow-y-auto whitespace-pre-wrap text-[10px] text-[var(--text-primary)]">
                    {activeTextPreview?.status === 'loading' ? (
                      <span className="text-[var(--text-tertiary)]">{t('loading_preview')}</span>
                    ) : activeTextPreview?.status === 'error' ? (
                      <span className="text-[var(--function-error)]">
                        {activeTextPreview.error || t('preview_unavailable')}
                      </span>
                    ) : (
                      activeTextPreview?.content || (
                        <span className="text-[var(--text-tertiary)]">{t('no_preview_available')}</span>
                      )
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {activePreviewType === 'image' ? (
              <div className="mt-2 flex items-center gap-3">
                {activeImageUrl ? (
                  <button
                    type="button"
                    onClick={() => setImageDialogId(activeAttachment.file_id)}
                    className="overflow-hidden rounded-[8px] border border-[var(--border-light)]"
                  >
                    <img
                      src={activeImageUrl}
                      alt={activeAttachment.filename}
                      className="h-[88px] w-[88px] object-cover"
                    />
                  </button>
                ) : (
                  <span className="text-[9px] text-[var(--text-tertiary)]">{t('loading_image')}</span>
                )}
                <div className="text-[9px] text-[var(--text-tertiary)]">
                  {t('click_thumbnail_to_enlarge')}
                </div>
                <Dialog
                  open={imageDialogId === activeAttachment.file_id}
                  onOpenChange={(open) => setImageDialogId(open ? activeAttachment.file_id : null)}
                >
                  <DialogContent className="max-w-[90vw]">
                    {activeImageUrl ? (
                      <img
                        src={activeImageUrl}
                        alt={activeAttachment.filename}
                        className="max-h-[80vh] w-auto"
                      />
                    ) : null}
                  </DialogContent>
                </Dialog>
              </div>
            ) : null}

            {activePreviewType === 'pdf' ? (
              <div className="mt-2 rounded-[8px] border border-[var(--border-light)] bg-[var(--background-white-main)] px-2 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[9px] text-[var(--text-tertiary)]">
                    PDF preview
                    {activePdfPreview?.pageCount ? ` · ${activePdfPreview.pageCount} pages` : ''}
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePdfExtract(activeAttachment)}
                    disabled={activePdfPreview?.status === 'loading'}
                    className="rounded-full border border-[var(--border-light)] px-2 py-0.5 text-[8px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Extract text
                  </button>
                </div>
                <div className="mt-2 text-[9px] text-[var(--text-tertiary)]">
                  {activePdfPreview?.status === 'loading'
                    ? 'Requesting parser...'
                    : activePdfPreview?.status === 'processing'
                      ? `Processing${activePdfPreview.progress != null ? ` · ${activePdfPreview.progress}%` : ''}`
                      : activePdfPreview?.status === 'error'
                        ? activePdfPreview.error || 'PDF parse failed.'
                        : activePdfPreview?.content
                          ? 'PDF text ready.'
                          : 'Extract text to preview a snippet.'}
                </div>
                {activePdfPreview?.status === 'ready' && activePdfPreview.content ? (
                  <div className="mt-2 max-h-[160px] overflow-y-auto whitespace-pre-wrap text-[10px] text-[var(--text-primary)]">
                    {activePdfPreview.content}
                  </div>
                ) : null}
              </div>
            ) : null}

            {activePreviewType === 'unknown' ? (
              <div className="mt-2 text-[9px] text-[var(--text-tertiary)]">
                Preview not available for this file type.
              </div>
            ) : null}
          </div>
        ) : null}

        {canScrollRight ? (
          <button
            type="button"
            onClick={scrollRight}
            className="absolute right-0 top-0 z-10 flex h-full items-center gap-2 px-3"
            style={{
              backgroundImage: 'linear-gradient(90deg, var(--gradual-white-0) 0%, var(--fill-input-chat) 100%)',
            }}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-white)] bg-[var(--background-menu-white)] shadow-[0_0_1.25px_0_var(--shadow-M),0_5px_16px_0_var(--shadow-M)]">
              <ChevronRight size={14} />
            </div>
          </button>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    )
  }
)

ChatBoxFiles.displayName = 'ChatBoxFiles'

export { ChatBoxFiles }
export default ChatBoxFiles
