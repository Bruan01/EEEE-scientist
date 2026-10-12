'use client'

import * as React from 'react'
import {
  Copy,
  FileSearch,
  HelpCircle,
  ListChecks,
  Sparkles,
  ZoomIn,
} from 'lucide-react'
import { useFileTreeStore } from '@/lib/stores/file-tree'
import type { FileNode } from '@/lib/types/file'
import { formatFileSize, getNodePath } from '@/lib/types/file'
import { getFileContent, createFileObjectUrl } from '@/lib/api/files'
import { getPdfInfo } from '@/lib/api/pdf'
import { apiClient } from '@/lib/api/client'
import { copyToClipboard } from '@/lib/clipboard'
import { useToast } from '@/components/ui/toast'
import { useOpenFile } from '@/hooks/useOpenFile'
import { BUILTIN_PLUGINS } from '@/lib/types/plugin'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { buildFileActionPrompt, type FileActionKey } from '@/lib/ai/file-actions'
import {
  IMAGE_PREVIEW_MAX_BYTES,
  TEXT_PREVIEW_MAX_BYTES,
  isImageMime,
  isTextMime,
} from '@/lib/plugins/cli/lib/file-utils'

const TEXT_PREVIEW_CHARS = 420

type FilePreviewJump = {
  fileId: string
  line?: number
}

function isPdfFile(file?: FileNode | null) {
  if (!file) return false
  const name = file.name.toLowerCase()
  return file.mimeType === 'application/pdf' || name.endsWith('.pdf')
}

function isMarkdownFile(file?: FileNode | null) {
  if (!file) return false
  const name = file.name.toLowerCase()
  return name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.mdx')
}

function isJsonFile(file?: FileNode | null) {
  if (!file) return false
  const name = file.name.toLowerCase()
  return file.mimeType === 'application/json' || name.endsWith('.json')
}

function isTextFile(file?: FileNode | null) {
  if (!file) return false
  if (isTextMime(file.mimeType)) return true
  return isMarkdownFile(file) || isJsonFile(file) || file.name.toLowerCase().endsWith('.txt')
}


export interface FilePreviewPanelProps {
  projectId: string
  className?: string
}

export function FilePreviewPanel({ projectId, className }: FilePreviewPanelProps) {
  const { addToast } = useToast()
  const { openFileInTab } = useOpenFile()
  const selectedIds = useFileTreeStore((state) => state.selectedIds)
  const nodes = useFileTreeStore((state) => state.nodes)
  const findNode = useFileTreeStore((state) => state.findNode)

  const selectedId = React.useMemo(() => {
    if (selectedIds.size !== 1) return null
    return Array.from(selectedIds)[0]
  }, [selectedIds])

  const selectedNode = React.useMemo(() => {
    return selectedId ? findNode(selectedId) : null
  }, [findNode, selectedId])

  const selectedFile =
    selectedNode && (selectedNode.type === 'file' || selectedNode.type === 'notebook')
      ? selectedNode
      : null

  const filePath = React.useMemo(() => {
    if (!selectedFile) return ''
    return selectedFile.path || getNodePath(nodes, selectedFile.id)
  }, [nodes, selectedFile])

  const [textContent, setTextContent] = React.useState<string | null>(null)
  const [imageUrl, setImageUrl] = React.useState<string | null>(null)
  const [imageOpen, setImageOpen] = React.useState(false)
  const [pdfInfo, setPdfInfo] = React.useState<{ pageCount?: number | null }>({})
  const [previewError, setPreviewError] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState(false)
  const [claim, setClaim] = React.useState('')
  const [highlightLine, setHighlightLine] = React.useState<number | null>(null)
  const lineContainerRef = React.useRef<HTMLDivElement | null>(null)
  const pendingJumpRef = React.useRef<FilePreviewJump | null>(null)
  const highlightTimerRef = React.useRef<number | null>(null)

  const isPdf = isPdfFile(selectedFile)
  const isArxivPdf = isPdf && filePath.startsWith('literature/arxiv/pdfs/')
  const isImage = selectedFile ? isImageMime(selectedFile.mimeType) : false
  const isText = isTextFile(selectedFile)
  const canAnalyze = Boolean(selectedFile) && (isText || isPdf)

  const lines = React.useMemo(() => {
    if (!textContent) return []
    return textContent.split(/\r?\n/)
  }, [textContent])

  const previewText = React.useMemo(() => {
    if (!textContent) return ''
    if (textContent.length <= TEXT_PREVIEW_CHARS) return textContent
    return `${textContent.slice(0, TEXT_PREVIEW_CHARS).trimEnd()}...`
  }, [textContent])

  React.useEffect(() => {
    setTextContent(null)
    setImageUrl(null)
    setPdfInfo({})
    setPreviewError(null)
    setExpanded(false)
    setHighlightLine(null)

    if (!selectedFile) return

    let active = true

    const loadText = async () => {
      if (selectedFile.size && selectedFile.size > TEXT_PREVIEW_MAX_BYTES) {
        setPreviewError('Preview disabled for files larger than 1MB.')
        return
      }
      try {
        const content = await getFileContent(selectedFile.id)
        if (!active) return
        setTextContent(content)
      } catch (error) {
        if (!active) return
        setPreviewError('Failed to load preview text.')
      }
    }

    const loadImage = async () => {
      if (selectedFile.size && selectedFile.size > IMAGE_PREVIEW_MAX_BYTES) {
        setPreviewError('Preview disabled for images larger than 1MB.')
        return
      }
      try {
        const url = await createFileObjectUrl(selectedFile.id)
        if (!active) return
        setImageUrl(url)
      } catch (error) {
        if (!active) return
        setPreviewError('Failed to load preview image.')
      }
    }

    const loadPdfInfo = async () => {
      try {
        const info = await getPdfInfo(selectedFile.id)
        if (!active) return
        setPdfInfo({ pageCount: info.page_count ?? null })
      } catch (error) {
        if (!active) return
        setPdfInfo({ pageCount: null })
      }
    }

    if (isText) {
      void loadText()
    } else if (isImage) {
      void loadImage()
    } else if (isPdf) {
      void loadPdfInfo()
    }

    return () => {
      active = false
    }
  }, [isImage, isPdf, isText, selectedFile])

  React.useEffect(() => {
    if (!imageUrl) return
    return () => URL.revokeObjectURL(imageUrl)
  }, [imageUrl])

  const clearHighlightTimer = React.useCallback(() => {
    if (highlightTimerRef.current == null) return
    window.clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = null
  }, [])

  React.useEffect(() => clearHighlightTimer, [clearHighlightTimer])

  const scrollToLine = React.useCallback(
    (line: number) => {
      if (!lineContainerRef.current) return
      const target = lineContainerRef.current.querySelector<HTMLElement>(
        `[data-line="${line}"]`
      )
      if (target) {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    },
    []
  )

  const applyJump = React.useCallback(
    (jump: FilePreviewJump) => {
      if (typeof jump.line !== 'number' || !textContent) return
      const line = jump.line
      setExpanded(true)
      setHighlightLine(line)
      window.requestAnimationFrame(() => scrollToLine(line))
      clearHighlightTimer()
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightLine(null)
        highlightTimerRef.current = null
      }, 2400)
    },
    [clearHighlightTimer, scrollToLine, textContent]
  )

  React.useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<FilePreviewJump>).detail
      if (!detail || typeof detail.fileId !== 'string') return
      pendingJumpRef.current = detail
      if (selectedFile?.id && detail.fileId === selectedFile.id) {
        applyJump(detail)
        pendingJumpRef.current = null
        return
      }
      useFileTreeStore.getState().select(detail.fileId)
    }
    window.addEventListener('ds:file-preview:jump', handler as EventListener)
    return () => window.removeEventListener('ds:file-preview:jump', handler as EventListener)
  }, [applyJump, selectedFile?.id])

  React.useEffect(() => {
    if (!pendingJumpRef.current || !selectedFile?.id) return
    if (pendingJumpRef.current.fileId !== selectedFile.id) return
    if (!textContent) return
    applyJump(pendingJumpRef.current)
    pendingJumpRef.current = null
  }, [applyJump, selectedFile?.id, textContent])

  const handleCopyPreview = React.useCallback(async () => {
    if (!textContent) return
    const payload = expanded ? textContent : previewText
    const success = await copyToClipboard(payload)
    addToast({
      type: success ? 'success' : 'error',
      title: success ? 'Copied preview' : 'Copy failed',
      description: success ? selectedFile?.name ?? 'Preview text' : 'Please try again.',
      duration: 1400,
    })
  }, [addToast, expanded, previewText, selectedFile?.name, textContent])

  const handleExtractPdfText = React.useCallback(async () => {
    if (!selectedFile) return
    if (isArxivPdf) {
      addToast({
        type: 'info',
        title: 'Unavailable for arXiv PDFs',
        description: 'Use the arXiv panel summary or open the arXiv page directly.',
        duration: 1800,
      })
      return
    }
    try {
      const response = await apiClient.get(`/api/v1/pdf/markdown/${selectedFile.id}`, {
        responseType: 'text',
      })
      const markdown = typeof response.data === 'string' ? response.data : String(response.data ?? '')
      const success = await copyToClipboard(markdown)
      addToast({
        type: success ? 'success' : 'error',
        title: success ? 'Extracted text copied' : 'Copy failed',
        description: success ? selectedFile.name : 'Please try again.',
        duration: 1600,
      })
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status
      if (status === 409) {
        try {
          await apiClient.post(`/api/v1/pdf/parse/${selectedFile.id}`)
        } catch {
          // ignore parse retry errors
        }
        addToast({
          type: 'info',
          title: 'Parsing PDF',
          description: 'MinerU parsing started. Try extracting again in a moment.',
          duration: 2000,
        })
        return
      }
      addToast({
        type: 'error',
        title: 'Extract failed',
        description: 'Unable to extract text right now.',
        duration: 1600,
      })
    }
  }, [addToast, isArxivPdf, selectedFile])

  const handleOpenMarkdown = React.useCallback(() => {
    if (!selectedFile) return
    if (isArxivPdf) {
      addToast({
        type: 'info',
        title: 'Unavailable for arXiv PDFs',
        description: 'Use the arXiv panel summary or open the arXiv page directly.',
        duration: 1800,
      })
      return
    }
    void openFileInTab(selectedFile, {
      pluginId: BUILTIN_PLUGINS.PDF_MARKDOWN,
      customData: { projectId },
    })
  }, [addToast, isArxivPdf, openFileInTab, projectId, selectedFile])

  const runAction = React.useCallback(
    (action: FileActionKey) => {
      if (!selectedFile) return
      if (action === 'evidence' && !claim.trim()) {
        addToast({
          type: 'warning',
          title: 'Claim required',
          description: 'Enter a claim to find evidence.',
          duration: 1600,
        })
        return
      }
      if (!canAnalyze) {
        addToast({
          type: 'warning',
          title: 'Unsupported file',
          description: 'Actions currently support text or PDF files only.',
          duration: 1600,
        })
        return
      }
      const prompt = buildFileActionPrompt(
        action,
        {
          fileId: selectedFile.id,
          fileName: selectedFile.name,
          filePath,
          mimeType: selectedFile.mimeType,
          isPdf,
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
    [addToast, canAnalyze, claim, filePath, selectedFile]
  )

  const metaRows = React.useMemo(() => {
    if (!selectedFile) return []
    return [
      { label: 'Size', value: formatFileSize(selectedFile.size) || 'n/a' },
      { label: 'Path', value: filePath || 'n/a' },
      { label: 'Type', value: selectedFile.mimeType || 'n/a' },
    ]
  }, [filePath, selectedFile])

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="px-4 py-2 border-t border-[var(--border-dark)]">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted-on-dark)]">
          Preview
        </div>
        <div className="mt-1 text-sm text-[var(--text-on-dark)] truncate">
          {selectedFile?.name ?? 'No file selected'}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full flex-col">
          <div className="flex-1 min-h-0 overflow-auto px-4 py-3 text-[var(--text-muted-on-dark)]">
            {!selectedFile ? (
              <div className="text-xs text-[var(--text-muted-on-dark)]">
                Select a file to see preview and actions.
              </div>
            ) : previewError ? (
              <div className="text-xs text-[var(--text-muted-on-dark)]">{previewError}</div>
            ) : isText ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted-on-dark)]">
                    {isMarkdownFile(selectedFile) ? 'Markdown' : isJsonFile(selectedFile) ? 'JSON' : 'Text'}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPreview}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.06] px-2 py-1 text-[11px] text-[var(--text-on-dark)] hover:bg-white/[0.12]"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                </div>
                <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] p-2">
                  {expanded ? (
                    <div className="text-xs font-mono text-[var(--text-on-dark)]">
                      <div ref={lineContainerRef} className="space-y-0.5">
                        {lines.map((line, index) => {
                          const lineNumber = index + 1
                          return (
                            <div
                              key={`line-${lineNumber}`}
                              data-line={lineNumber}
                              className={cn(
                                'grid grid-cols-[auto,1fr] gap-3 rounded-md px-2 py-0.5',
                                highlightLine === lineNumber && 'bg-white/[0.12] ring-1 ring-white/20'
                              )}
                            >
                              <span className="text-[10px] text-white/40">{lineNumber}</span>
                              <span className="whitespace-pre-wrap break-words">{line || ' '}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap break-words text-xs text-[var(--text-on-dark)]">
                      {previewText || 'No preview available.'}
                    </pre>
                  )}
                </div>
                {textContent && textContent.length > TEXT_PREVIEW_CHARS ? (
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => !prev)}
                    className="mt-2 text-[11px] text-[var(--text-on-dark)] underline decoration-white/30 hover:decoration-white/70"
                  >
                    {expanded ? 'Collapse preview' : 'Expand preview'}
                  </button>
                ) : null}
              </>
            ) : isImage ? (
              <>
                {imageUrl ? (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setImageOpen(true)}
                      className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]"
                    >
                      <img
                        src={imageUrl}
                        alt={selectedFile.name}
                        className="h-40 w-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                      />
                      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white">
                        <ZoomIn className="h-3 w-3" />
                        Zoom
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-[var(--text-muted-on-dark)]">
                    Image preview unavailable.
                  </div>
                )}
              </>
            ) : isPdf ? (
              <div className="space-y-3 text-xs text-[var(--text-on-dark)]">
                <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-center justify-between">
                    <span>Pages</span>
                    <span className="font-semibold">
                      {pdfInfo.pageCount ?? 'n/a'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-white/60">
                    <span>Size</span>
                    <span>{formatFileSize(selectedFile.size) || 'n/a'}</span>
                  </div>
                </div>
                {isArxivPdf ? (
                  <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] text-white/70">
                    This PDF is managed by the arXiv library. Use the arXiv panel to view summary metadata or open the paper directly on arXiv.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleExtractPdfText}
                      className="rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1.5 text-[11px] text-[var(--text-on-dark)] hover:bg-white/[0.12]"
                    >
                      Extract text
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenMarkdown}
                      className="rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1.5 text-[11px] text-[var(--text-on-dark)] hover:bg-white/[0.12]"
                    >
                      To Markdown
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-[var(--text-muted-on-dark)]">
                No preview available for this file type.
              </div>
            )}
          </div>

          {selectedFile ? (
            <div className="border-t border-[var(--border-dark)] px-4 py-3 text-[var(--text-on-dark)]">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted-on-dark)]">
                Actions
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => runAction('summarize')}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1.5 text-[11px] text-[var(--text-on-dark)] hover:bg-white/[0.12]"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Summarize
                </button>
                <button
                  type="button"
                  onClick={() => runAction('keyPoints')}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1.5 text-[11px] text-[var(--text-on-dark)] hover:bg-white/[0.12]"
                >
                  <ListChecks className="h-3.5 w-3.5" />
                  Key points
                </button>
                <button
                  type="button"
                  onClick={() => runAction('questions')}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1.5 text-[11px] text-[var(--text-on-dark)] hover:bg-white/[0.12]"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Questions
                </button>
                <button
                  type="button"
                  onClick={() => runAction('evidence')}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1.5 text-[11px] text-[var(--text-on-dark)] hover:bg-white/[0.12]"
                >
                  <FileSearch className="h-3.5 w-3.5" />
                  Evidence
                </button>
              </div>
              <div className="mt-2">
                <input
                  value={claim}
                  onChange={(event) => setClaim(event.target.value)}
                  placeholder="Claim to verify..."
                  className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1.5 text-[11px] text-white/80 placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/30"
                />
              </div>
              {!canAnalyze ? (
                <div className="mt-2 text-[10px] text-white/40">
                  Actions currently support text and PDF files.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="max-w-3xl bg-black/90 text-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">{selectedFile?.name}</DialogTitle>
          </DialogHeader>
          {imageUrl ? (
            <img src={imageUrl} alt={selectedFile?.name ?? 'Preview'} className="w-full h-auto" />
          ) : null}
        </DialogContent>
      </Dialog>

      {selectedFile ? (
        <div className="border-t border-[var(--border-dark)] px-4 py-2 text-[11px] text-white/50">
          {metaRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <span>{row.label}</span>
              <span className="truncate text-white/70">{row.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default FilePreviewPanel
