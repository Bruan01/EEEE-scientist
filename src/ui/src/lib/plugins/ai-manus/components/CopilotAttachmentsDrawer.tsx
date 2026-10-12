'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Copy,
  Download,
  Eye,
  FileSearch,
  HelpCircle,
  ListChecks,
  PencilLine,
  Sparkles,
  Trash2,
  ZoomIn,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { copyToClipboard } from '@/lib/clipboard'
import { useToast } from '@/components/ui/toast'
import { useFileTreeStore } from '@/lib/stores/file-tree'
import { useOpenFile } from '@/hooks/useOpenFile'
import { BUILTIN_PLUGINS } from '@/lib/types/plugin'
import {
  formatFileSize,
  getMimeTypeFromExtension,
  getNodePath,
} from '@/lib/types/file'
import { createFileObjectUrl, getFileTextPreview } from '@/lib/api/files'
import { getPdfInfo, getPdfMarkdownPreview, requestPdfParse } from '@/lib/api/pdf'
import { buildFileActionPrompt, type FileActionKey } from '@/lib/ai/file-actions'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/useI18n'
import { isImageMime, isTextMime, IMAGE_PREVIEW_MAX_BYTES, TEXT_PREVIEW_MAX_BYTES } from '@/lib/plugins/cli/lib/file-utils'
import { FileIcon } from '@/components/file-tree/FileIcon'
import {
  COPILOT_ATTACHMENT_DRAG_TYPE,
  type CopilotAttachmentStatus,
} from '../lib/attachment-drawer'

export type CopilotAttachmentItem = {
  fileId: string
  filename: string
  alias?: string
  mimeType?: string | null
  size?: number | null
  status: CopilotAttachmentStatus
  selected: boolean
  hidden?: boolean
  filePath?: string | null
}

const STATUS_STYLES: Record<CopilotAttachmentStatus, string> = {
  uploaded: 'bg-[var(--fill-tsp-white-light)] text-[var(--text-tertiary)]',
  parsed: 'bg-[var(--fill-blue)] text-[var(--text-brand)]',
  indexed: 'bg-[var(--function-success-tsp)] text-[var(--function-success)]',
  error: 'bg-[var(--function-error-tsp)] text-[var(--function-error)]',
}

const TEXT_PREVIEW_CHARS = 420

type TextPreviewState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  content?: string
  truncated?: boolean
  error?: string
}

type PdfInfoState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  pageCount?: number | null
  parseStatus?: string | null
  error?: string
}

const getFileExtension = (name: string) => {
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex <= 0) return ''
  return name.slice(dotIndex).toLowerCase()
}

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx'])
const JSON_EXTENSIONS = new Set(['.json'])
const TEXT_EXTENSIONS = new Set(['.txt', '.csv', ...MARKDOWN_EXTENSIONS, ...JSON_EXTENSIONS])
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])

const resolveAttachmentMimeType = (item: CopilotAttachmentItem) => {
  return (item.mimeType || getMimeTypeFromExtension(item.filename) || '').toLowerCase()
}

const isPdfAttachment = (item: CopilotAttachmentItem) => {
  const mimeType = resolveAttachmentMimeType(item)
  return mimeType === 'application/pdf' || item.filename.toLowerCase().endsWith('.pdf')
}

const isMarkdownAttachment = (item: CopilotAttachmentItem) => {
  const ext = getFileExtension(item.filename)
  if (MARKDOWN_EXTENSIONS.has(ext)) return true
  const mimeType = resolveAttachmentMimeType(item)
  return mimeType === 'text/markdown'
}

const isJsonAttachment = (item: CopilotAttachmentItem) => {
  const ext = getFileExtension(item.filename)
  if (JSON_EXTENSIONS.has(ext)) return true
  const mimeType = resolveAttachmentMimeType(item)
  return mimeType === 'application/json'
}

const isTextAttachment = (item: CopilotAttachmentItem) => {
  const ext = getFileExtension(item.filename)
  if (TEXT_EXTENSIONS.has(ext)) return true
  return isTextMime(resolveAttachmentMimeType(item))
}

const isImageAttachment = (item: CopilotAttachmentItem) => {
  const ext = getFileExtension(item.filename)
  if (IMAGE_EXTENSIONS.has(ext)) return true
  return isImageMime(resolveAttachmentMimeType(item))
}

export function CopilotAttachmentsDrawer({
  id,
  projectId,
  open,
  loading,
  items,
  onToggleSelected,
  onRename,
  onRemove,
  onPreview,
  onDownload,
  onRequestClose,
}: {
  id?: string
  projectId?: string | null
  open: boolean
  loading?: boolean
  items: CopilotAttachmentItem[]
  onToggleSelected: (fileId: string, selected: boolean) => void
  onRename: (fileId: string, nextName: string) => void
  onRemove: (fileId: string) => void
  onPreview?: (fileId: string) => void
  onDownload?: (fileId: string, name: string) => void
  onRequestClose?: () => void
}) {
  const { addToast } = useToast()
  const { t } = useI18n('ai_manus')
  const { openFileInTab } = useOpenFile()
  const findNode = useFileTreeStore((state) => state.findNode)
  const nodes = useFileTreeStore((state) => state.nodes)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [activeFileId, setActiveFileId] = useState<string | null>(null)
  const [claim, setClaim] = useState('')
  const [textPreviews, setTextPreviews] = useState<Record<string, TextPreviewState>>({})
  const [pdfInfos, setPdfInfos] = useState<Record<string, PdfInfoState>>({})
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [imageDialogId, setImageDialogId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const imageUrlsRef = useRef<Record<string, string>>({})
  const editingItem = useMemo(
    () => items.find((item) => item.fileId === editingId) ?? null,
    [editingId, items]
  )
  const visibleItems = useMemo(
    () => items.filter((item) => !item.hidden),
    [items]
  )
  const activeItem = useMemo(() => {
    if (!activeFileId) return null
    return visibleItems.find((item) => item.fileId === activeFileId) ?? null
  }, [activeFileId, visibleItems])
  const selectedCount = useMemo(
    () => visibleItems.filter((item) => item.selected).length,
    [visibleItems]
  )
  const activeNode = useMemo(
    () => (activeItem ? findNode(activeItem.fileId) : null),
    [activeItem, findNode]
  )
  const activeFilePath = useMemo(() => {
    if (!activeItem) return ''
    if (activeItem.filePath) return activeItem.filePath
    if (activeNode?.path) return activeNode.path
    if (activeNode) return getNodePath(nodes, activeNode.id)
    return ''
  }, [activeItem, activeNode, nodes])
  const activeMimeType = useMemo(
    () => (activeItem ? resolveAttachmentMimeType(activeItem) : ''),
    [activeItem]
  )
  const activeIsPdf = useMemo(
    () => (activeItem ? isPdfAttachment(activeItem) : false),
    [activeItem]
  )
  const activeIsImage = useMemo(
    () => (activeItem ? isImageAttachment(activeItem) : false),
    [activeItem]
  )
  const activeIsText = useMemo(
    () => (activeItem ? isTextAttachment(activeItem) : false),
    [activeItem]
  )
  const canAnalyze = Boolean(activeItem && (activeIsPdf || activeIsText))
  const activeTextPreview = activeItem ? textPreviews[activeItem.fileId] : undefined
  const activePdfInfo = activeItem ? pdfInfos[activeItem.fileId] : undefined
  const activeImageUrl = activeItem ? imageUrls[activeItem.fileId] : null
  const dialogItem = useMemo(() => {
    if (!imageDialogId) return null
    return visibleItems.find((item) => item.fileId === imageDialogId) ?? null
  }, [imageDialogId, visibleItems])
  const dialogImageUrl = imageDialogId ? imageUrls[imageDialogId] : null

  useEffect(() => {
    if (!editingItem) return
    setDraftName(editingItem.alias ?? editingItem.filename)
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [editingItem])

  useEffect(() => {
    if (!visibleItems.length) {
      setActiveFileId(null)
      return
    }
    if (activeFileId && visibleItems.some((item) => item.fileId === activeFileId)) return
    setActiveFileId(visibleItems[0].fileId)
  }, [activeFileId, visibleItems])

  useEffect(() => {
    setClaim('')
  }, [activeFileId])

  useEffect(() => {
    if (!imageDialogId) return
    if (visibleItems.some((item) => item.fileId === imageDialogId)) return
    setImageDialogId(null)
  }, [imageDialogId, visibleItems])

  useEffect(() => {
    imageUrlsRef.current = imageUrls
  }, [imageUrls])

  useEffect(() => {
    const activeIds = new Set(visibleItems.map((item) => item.fileId))
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
  }, [visibleItems])

  useEffect(() => {
    return () => {
      Object.values(imageUrlsRef.current).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  useEffect(() => {
    if (!activeItem) return
    if (!activeIsText) return
    if (activeItem.size && activeItem.size > TEXT_PREVIEW_MAX_BYTES) {
      setTextPreviews((prev) => ({
        ...prev,
        [activeItem.fileId]: {
          status: 'error',
          error: t('preview_disabled_large_file'),
        },
      }))
      return
    }
    const existing = textPreviews[activeItem.fileId]
    if (existing && (existing.status === 'loading' || existing.status === 'ready' || existing.status === 'error')) {
      return
    }
    let active = true
    setTextPreviews((prev) => ({
      ...prev,
      [activeItem.fileId]: { status: 'loading' },
    }))
    getFileTextPreview(activeItem.fileId, {
      maxChars: TEXT_PREVIEW_CHARS,
      maxBytes: TEXT_PREVIEW_MAX_BYTES,
    })
      .then((preview) => {
        if (!active) return
        setTextPreviews((prev) => ({
          ...prev,
          [activeItem.fileId]: {
            status: 'ready',
            content: preview.content,
            truncated: preview.truncated,
          },
        }))
      })
      .catch(() => {
        if (!active) return
        setTextPreviews((prev) => ({
          ...prev,
          [activeItem.fileId]: {
            status: 'error',
            error: 'Failed to load preview text.',
          },
        }))
      })
    return () => {
      active = false
    }
  }, [activeIsText, activeItem, t, textPreviews])

  useEffect(() => {
    if (!activeItem) return
    if (!activeIsImage) return
    if (activeItem.size && activeItem.size > IMAGE_PREVIEW_MAX_BYTES) return
    if (imageUrlsRef.current[activeItem.fileId]) return
    let active = true
    createFileObjectUrl(activeItem.fileId)
      .then((url) => {
        if (!active) return
        setImageUrls((prev) => ({
          ...prev,
          [activeItem.fileId]: url,
        }))
      })
      .catch(() => {
        if (!active) return
        setImageUrls((prev) => ({
          ...prev,
          [activeItem.fileId]: '',
        }))
      })
    return () => {
      active = false
    }
  }, [activeIsImage, activeItem])

  useEffect(() => {
    if (!activeItem) return
    if (!activeIsPdf) return
    const existing = pdfInfos[activeItem.fileId]
    if (
      existing &&
      (existing.status === 'ready' || existing.status === 'loading' || existing.status === 'error')
    ) {
      return
    }
    let active = true
    setPdfInfos((prev) => ({
      ...prev,
      [activeItem.fileId]: { status: 'loading' },
    }))
    getPdfInfo(activeItem.fileId)
      .then((info) => {
        if (!active) return
        setPdfInfos((prev) => ({
          ...prev,
          [activeItem.fileId]: {
            status: 'ready',
            pageCount: info.page_count ?? null,
            parseStatus: info.parse_status ?? null,
          },
        }))
      })
      .catch(() => {
        if (!active) return
        setPdfInfos((prev) => ({
          ...prev,
          [activeItem.fileId]: {
            status: 'error',
            error: 'Failed to load PDF info.',
          },
        }))
      })
    return () => {
      active = false
    }
  }, [activeIsPdf, activeItem, pdfInfos])

  const commitRename = () => {
    if (!editingItem) return
    onRename(editingItem.fileId, draftName.trim())
    setEditingId(null)
  }

  const cancelRename = () => {
    setEditingId(null)
  }

  const handleCopyPreview = useCallback(async () => {
    if (!activeItem || !activeTextPreview?.content) return
    const payload = activeTextPreview.content
    const success = await copyToClipboard(payload)
    addToast({
      type: success ? 'success' : 'error',
      title: success ? t('copied_preview_title') : t('copy_failed_title'),
      description: success ? activeItem.filename : t('try_again'),
      duration: 1400,
    })
  }, [activeItem, activeTextPreview?.content, addToast, t])

  const handleExtractPdfText = useCallback(async () => {
    if (!activeItem) return
    try {
      const markdown = await getPdfMarkdownPreview(activeItem.fileId)
      const success = await copyToClipboard(markdown)
      addToast({
        type: success ? 'success' : 'error',
        title: success ? t('extracted_text_copied_title') : t('copy_failed_title'),
        description: success ? activeItem.filename : t('try_again'),
        duration: 1600,
      })
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status
      if (status === 409) {
        try {
          await requestPdfParse(activeItem.fileId)
        } catch {
          // ignore parse retry errors
        }
        addToast({
          type: 'info',
          title: t('parsing_pdf_title'),
          description: t('parsing_pdf_desc'),
          duration: 2000,
        })
        return
      }
      addToast({
        type: 'error',
        title: t('extract_failed_title'),
        description: t('extract_failed_desc'),
        duration: 1600,
      })
    }
  }, [activeItem, addToast, t])

  const handleOpenMarkdown = useCallback(async () => {
    if (!activeItem) return
    const node = findNode(activeItem.fileId)
    if (!node) {
      addToast({
        type: 'error',
        title: t('file_not_found_title'),
        description: t('file_not_found_desc'),
      })
      return
    }
    await openFileInTab(node, {
      pluginId: BUILTIN_PLUGINS.PDF_MARKDOWN,
      customData: projectId ? { projectId } : undefined,
    })
  }, [activeItem, addToast, findNode, openFileInTab, projectId, t])

  const runAction = useCallback(
    (action: FileActionKey) => {
      if (!activeItem) return
      if (action === 'evidence' && !claim.trim()) {
        addToast({
          type: 'warning',
          title: t('claim_required_title'),
          description: t('claim_required_desc'),
          duration: 1600,
        })
        return
      }
      if (!canAnalyze) {
        addToast({
          type: 'warning',
          title: t('unsupported_file_title'),
          description: t('unsupported_file_desc'),
          duration: 1600,
        })
        return
      }
      const prompt = buildFileActionPrompt(
        action,
        {
          fileId: activeItem.fileId,
          fileName: activeItem.filename,
          filePath: activeFilePath,
          mimeType: activeMimeType || undefined,
          isPdf: activeIsPdf,
        },
        claim
      )
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('ds:copilot:run', {
            detail: {
              text: prompt,
              focus: true,
              submit: true,
            },
          })
        )
      }
    },
    [
      activeFilePath,
      activeIsPdf,
      activeItem,
      activeMimeType,
      addToast,
      canAnalyze,
      claim,
      t,
    ]
  )

  return (
    <div
      id={id}
      aria-hidden={!open}
      className={cn(
        'ai-manus-attachment-drawer',
        open ? 'is-open' : 'is-closed'
      )}
    >
      <div className="ai-manus-attachment-drawer-inner">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-light)] px-3 py-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[var(--text-primary)]">
              {t('knowledge')}
            </div>
            <div className="text-[9px] text-[var(--text-tertiary)]">
              {t('files_selected', { files: visibleItems.length, selected: selectedCount })}
            </div>
          </div>
          {onRequestClose ? (
            <button
              type="button"
              onClick={onRequestClose}
              className="rounded-md border border-[var(--border-light)] px-2 py-1 text-[9px] text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-white-light)]"
            >
              {t('close')}
            </button>
          ) : null}
        </div>
        <div className="ai-manus-scrollbar flex-1 overflow-y-auto px-3 py-2">
          {loading ? (
            <div className="text-[10px] text-[var(--text-tertiary)]">{t('loading_files')}</div>
          ) : visibleItems.length === 0 ? (
            <div className="text-[10px] text-[var(--text-tertiary)]">
              {t('empty_files')}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                {visibleItems.map((item) => {
                  const displayName = item.alias ?? item.filename
                  const sizeLabel = formatFileSize(item.size ?? undefined) || t('unknown')
                  const mimeLabel = resolveAttachmentMimeType(item) || t('unknown')
                  const statusTone = STATUS_STYLES[item.status]
                  const isEditing = editingId === item.fileId
                  const isActive = item.fileId === activeFileId
                  return (
                    <div
                      key={item.fileId}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer?.setData(COPILOT_ATTACHMENT_DRAG_TYPE, item.fileId)
                        event.dataTransfer?.setData('text/plain', item.fileId)
                        event.dataTransfer.effectAllowed = 'copy'
                      }}
                      onClick={() => setActiveFileId(item.fileId)}
                      className={cn(
                        'group flex items-start gap-2 rounded-[10px] border px-2 py-2',
                        item.selected
                          ? 'border-[var(--border-input-active)] bg-[var(--fill-blue)]'
                          : 'border-[var(--border-light)] bg-[var(--fill-tsp-white-light)]',
                        isActive && 'ring-1 ring-[var(--border-input-active)]',
                        'cursor-pointer'
                      )}
                    >
                      <FileIcon
                        type="file"
                        name={item.filename}
                        mimeType={item.mimeType ?? undefined}
                        className="h-4 w-4 shrink-0 text-[var(--icon-secondary)]"
                      />
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            value={draftName}
                            onChange={(event) => setDraftName(event.target.value)}
                            onBlur={commitRename}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                commitRename()
                              }
                              if (event.key === 'Escape') {
                                event.preventDefault()
                                cancelRename()
                              }
                            }}
                            className="w-full rounded-[6px] border border-[var(--border-light)] bg-[var(--background-white-main)] px-1.5 py-1 text-[10px] text-[var(--text-primary)] outline-none focus:border-[var(--border-input-active)]"
                          />
                        ) : (
                          <div className="truncate text-[11px] font-medium text-[var(--text-primary)]">
                            {displayName}
                          </div>
                        )}
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[9px] text-[var(--text-tertiary)]">
                          <span>{mimeLabel}</span>
                          <span>{sizeLabel}</span>
                          <span className={cn('rounded-full px-2 py-0.5 font-medium', statusTone)}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <label className="flex items-center gap-1 text-[9px] text-[var(--text-tertiary)]">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={(event) => onToggleSelected(item.fileId, event.target.checked)}
                            aria-label={t('include_in_context', { name: displayName })}
                            className="h-3 w-3 rounded border border-[var(--border-light)] text-[var(--text-brand)]"
                          />
                          <span>{t('context')}</span>
                        </label>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {onPreview ? (
                            <button
                              type="button"
                              onClick={() => onPreview(item.fileId)}
                              className="rounded-[6px] border border-[var(--border-light)] p-1 text-[var(--text-tertiary)] hover:bg-[var(--fill-tsp-white-light)] hover:text-[var(--text-primary)]"
                              aria-label={`${t('open')} ${displayName}`}
                            >
                              <Eye size={12} />
                            </button>
                          ) : null}
                          {onDownload ? (
                            <button
                              type="button"
                              onClick={() => onDownload(item.fileId, displayName)}
                              className="rounded-[6px] border border-[var(--border-light)] p-1 text-[var(--text-tertiary)] hover:bg-[var(--fill-tsp-white-light)] hover:text-[var(--text-primary)]"
                              aria-label={`${t('download')} ${displayName}`}
                            >
                              <Download size={12} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setEditingId(item.fileId)}
                            className="rounded-[6px] border border-[var(--border-light)] p-1 text-[var(--text-tertiary)] hover:bg-[var(--fill-tsp-white-light)] hover:text-[var(--text-primary)]"
                            aria-label={`${t('rename')} ${displayName}`}
                          >
                            <PencilLine size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemove(item.fileId)}
                            className="rounded-[6px] border border-[var(--border-light)] p-1 text-[var(--text-tertiary)] hover:bg-[var(--fill-tsp-white-light)] hover:text-[var(--text-primary)]"
                            aria-label={`${t('remove')} ${displayName}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {activeItem ? (
                <div className="space-y-3">
                  <div className="rounded-[10px] border border-[var(--border-light)] bg-[var(--fill-tsp-white-light)] p-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        {t('preview')}
                        </div>
                      {onPreview ? (
                        <button
                          type="button"
                          onClick={() => onPreview(activeItem.fileId)}
                          className="rounded-md border border-[var(--border-light)] px-2 py-1 text-[9px] text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-white-light)]"
                        >
                          {t('open')}
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-2 text-[10px] text-[var(--text-secondary)]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{activeItem.alias ?? activeItem.filename}</span>
                        <span className="text-[9px] text-[var(--text-tertiary)]">
                          {formatFileSize(activeItem.size ?? undefined) || t('n_a')}
                        </span>
                      </div>
                      <div className="mt-1 text-[9px] text-[var(--text-tertiary)]">
                        {activeMimeType || t('unknown')}
                      </div>
                    </div>
                    <div className="mt-2">
                      {activeItem.status === 'error' ? (
                        <div className="text-[10px] text-[var(--function-error)]">
                          {t('file_unavailable')}
                        </div>
                      ) : activeIsText ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[9px] uppercase tracking-wide text-[var(--text-tertiary)]">
                              {isMarkdownAttachment(activeItem)
                                ? t('markdown_file')
                                : isJsonAttachment(activeItem)
                                  ? t('json_file')
                                  : t('text_file')}
                            </div>
                            <button
                              type="button"
                              onClick={handleCopyPreview}
                              className="inline-flex items-center gap-1 rounded-md border border-[var(--border-light)] px-2 py-1 text-[9px] text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-white-light)]"
                            >
                              <Copy size={10} />
                              {t('copy')}
                            </button>
                          </div>
                          {activeTextPreview?.status === 'loading' ? (
                            <div className="text-[10px] text-[var(--text-tertiary)]">
                              {t('loading_preview')}
                            </div>
                          ) : activeTextPreview?.status === 'error' ? (
                            <div className="text-[10px] text-[var(--text-tertiary)]">
                              {activeTextPreview.error || t('preview_unavailable')}
                            </div>
                          ) : (
                            <pre className="max-h-40 whitespace-pre-wrap break-words rounded-md border border-[var(--border-light)] bg-[var(--fill-tsp-white-main)] p-2 text-[10px] text-[var(--text-primary)]">
                              {activeTextPreview?.content
                                ? activeTextPreview.truncated
                                  ? `${activeTextPreview.content}...`
                                  : activeTextPreview.content
                                : t('no_preview_available')}
                            </pre>
                          )}
                        </div>
                      ) : activeIsImage ? (
                        activeItem.size && activeItem.size > IMAGE_PREVIEW_MAX_BYTES ? (
                          <div className="text-[10px] text-[var(--text-tertiary)]">
                            {t('preview_disabled_large_image')}
                          </div>
                        ) : activeImageUrl ? (
                          <button
                            type="button"
                            onClick={() => setImageDialogId(activeItem.fileId)}
                            className="group relative w-full overflow-hidden rounded-md border border-[var(--border-light)] bg-[var(--fill-tsp-white-main)]"
                          >
                            <img
                              src={activeImageUrl}
                              alt={activeItem.filename}
                              className="h-32 w-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                            />
                            <span className="absolute bottom-1 right-1 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[9px] text-white">
                              <ZoomIn className="h-3 w-3" />
                              {t('zoom')}
                            </span>
                          </button>
                        ) : (
                          <div className="text-[10px] text-[var(--text-tertiary)]">
                            {t('image_preview_unavailable')}
                          </div>
                        )
                      ) : activeIsPdf ? (
                        <div className="space-y-2 text-[10px] text-[var(--text-secondary)]">
                          <div className="rounded-md border border-[var(--border-light)] bg-[var(--fill-tsp-white-main)] p-2">
                            <div className="flex items-center justify-between">
                              <span>{t('pages')}</span>
                              <span className="font-semibold">
                                {activePdfInfo?.pageCount ?? t('n_a')}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[9px] text-[var(--text-tertiary)]">
                              <span>{t('size')}</span>
                              <span>{formatFileSize(activeItem.size ?? undefined) || t('n_a')}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={handleExtractPdfText}
                              className="rounded-md border border-[var(--border-light)] bg-[var(--fill-tsp-white-main)] px-2 py-1 text-[9px] text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-white-light)]"
                            >
                              {t('extract_text')}
                            </button>
                            <button
                              type="button"
                              onClick={handleOpenMarkdown}
                              className="rounded-md border border-[var(--border-light)] bg-[var(--fill-tsp-white-main)] px-2 py-1 text-[9px] text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-white-light)]"
                            >
                              {t('to_markdown')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-[var(--text-tertiary)]">
                          {t('no_preview_for_type')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-[10px] border border-[var(--border-light)] bg-[var(--fill-tsp-white-light)] p-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      {t('actions')}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => runAction('summarize')}
                        className="flex items-center gap-2 rounded-md border border-[var(--border-light)] bg-[var(--fill-tsp-white-main)] px-2 py-1 text-[9px] text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-white-light)]"
                      >
                        <Sparkles className="h-3 w-3" />
                        {t('summarize')}
                      </button>
                      <button
                        type="button"
                        onClick={() => runAction('keyPoints')}
                        className="flex items-center gap-2 rounded-md border border-[var(--border-light)] bg-[var(--fill-tsp-white-main)] px-2 py-1 text-[9px] text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-white-light)]"
                      >
                        <ListChecks className="h-3 w-3" />
                        {t('key_points')}
                      </button>
                      <button
                        type="button"
                        onClick={() => runAction('questions')}
                        className="flex items-center gap-2 rounded-md border border-[var(--border-light)] bg-[var(--fill-tsp-white-main)] px-2 py-1 text-[9px] text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-white-light)]"
                      >
                        <HelpCircle className="h-3 w-3" />
                        {t('questions')}
                      </button>
                      <button
                        type="button"
                        onClick={() => runAction('evidence')}
                        className="flex items-center gap-2 rounded-md border border-[var(--border-light)] bg-[var(--fill-tsp-white-main)] px-2 py-1 text-[9px] text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-white-light)]"
                      >
                        <FileSearch className="h-3 w-3" />
                        {t('evidence')}
                      </button>
                    </div>
                    <div className="mt-2">
                      <input
                        value={claim}
                        onChange={(event) => setClaim(event.target.value)}
                        placeholder={t('claim_placeholder')}
                        className="w-full rounded-md border border-[var(--border-light)] bg-[var(--fill-tsp-white-main)] px-2 py-1 text-[9px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-input-active)]"
                      />
                    </div>
                    {!canAnalyze ? (
                      <div className="mt-2 text-[9px] text-[var(--text-tertiary)]">
                        {t('actions_text_pdf_only')}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
        <div className="border-t border-[var(--border-light)] px-3 py-2 text-[9px] text-[var(--text-tertiary)]">
          Drag a file into the composer to include it in the next response.
        </div>
      </div>
      <Dialog
        open={Boolean(imageDialogId)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setImageDialogId(null)
          }
        }}
      >
        <DialogContent className="max-w-3xl bg-black/90 text-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">
              {dialogItem?.alias ?? dialogItem?.filename ?? t('preview_title')}
            </DialogTitle>
          </DialogHeader>
          {dialogImageUrl ? (
            <img
              src={dialogImageUrl}
              alt={dialogItem?.filename ?? t('preview_title')}
              className="h-auto w-full"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CopilotAttachmentsDrawer
