/**
 * PDF Markdown Viewer Plugin
 *
 * @ds/plugin-pdf-markdown
 *
 * Renders MinerU `full.md` with Novel in read-only mode.
 */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PluginComponentProps } from '@/lib/types/plugin'
import { apiClient } from '@/lib/api/client'
import { FileText, RefreshCw } from 'lucide-react'
import { EditorContent, EditorRoot, type EditorInstance } from 'novel'
import { defaultExtensions } from '@/lib/plugins/notebook/lib/novel-extensions'
import { resolveNotebookAssetUrl } from '@/lib/plugins/notebook/lib/novel-asset-upload'
import { setEditorMarkdown } from '@/lib/plugins/notebook/lib/markdown-utils'
import MarkdownRenderer from '@/lib/plugins/markdown-viewer/components/MarkdownRenderer'
import { cn } from '@/lib/utils'
import { useTabsStore } from '@/lib/stores/tabs'
import { BUILTIN_PLUGINS } from '@/lib/types/plugin'
import { useArxivStore } from '@/lib/stores/arxiv-store'
import type { ArxivPaper } from '@/lib/types/arxiv'
import { buildArxivSummaryMarkdown } from '@/lib/arxiv-summary'
import { copyToClipboard } from '@/lib/clipboard'
import { generateBibTeX } from '@/lib/utils/bibtex'
import { useToast } from '@/components/ui/toast'
import { ArxivInfoModal } from '@/components/arxiv/ArxivInfoModal'
import { InfoTriangleIcon } from '@/components/ui/info-triangle-icon'
import { useWorkspaceSurfaceStore } from '@/lib/stores/workspace-surface'
import '@/lib/plugins/notebook/NotebookEditor.css'

type LoadState = 'idle' | 'loading' | 'processing' | 'ready' | 'error'
type RenderMode = 'novel' | 'markdown'

function rewriteMarkdownImages(markdown: string, fileId: string): string {
  if (!markdown) return markdown
  const prefix = `/api/v1/pdf/markdown/${fileId}/assets/`
  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
    const trimmed = String(url || '').trim()
    if (!trimmed) return match
    if (trimmed.startsWith('http') || trimmed.startsWith('data:') || trimmed.startsWith('/api/')) {
      return match
    }
    const cleaned = trimmed.replace(/^\.?\//, '')
    return `![${alt}](${prefix}${cleaned})`
  })
}

function appendTokenToMarkdownImages(markdown: string): string {
  if (!markdown) return markdown
  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
    const trimmed = String(url || '').trim()
    if (!trimmed) return match
    const resolved = resolveNotebookAssetUrl(trimmed)
    if (!resolved) return match
    return `![${alt}](${resolved})`
  })
}

export default function PdfMarkdownPlugin({
  context,
  tabId,
  setTitle,
}: PluginComponentProps) {
  const rawFileId =
    context.resourceId ??
    (typeof context.customData?.fileId === 'string' ? context.customData.fileId : null)
  const fileId = rawFileId ? String(rawFileId) : ''
  const fileName = context.resourceName || 'PDF Markdown'
  const updateTabPlugin = useTabsStore((state) => state.updateTabPlugin)
  const updateWorkspaceTabState = useWorkspaceSurfaceStore((state) => state.updateTabState)
  const { addToast } = useToast()
  const arxivItems = useArxivStore((state) => state.items)
  const arxivErrors = useArxivStore((state) => state.errors)

  const [editor, setEditor] = useState<EditorInstance | null>(null)
  const [markdown, setMarkdown] = useState('')
  const [state, setState] = useState<LoadState>('idle')
  const [renderMode, setRenderMode] = useState<RenderMode>('novel')
  const [parseError, setParseError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const parseRequestedRef = useRef(false)

  const extensions = useMemo(() => [...defaultExtensions] as any[], [])

  const arxivFromContext = useMemo(() => {
    const customData = context.customData as { arxiv?: ArxivPaper } | undefined
    return customData?.arxiv ?? null
  }, [context.customData])

  const arxivPaper = useMemo(() => {
    if (arxivFromContext) return arxivFromContext
    if (!fileId) return null
    return arxivItems.find((item) => item.fileId === fileId) || null
  }, [arxivFromContext, arxivItems, fileId])

  const arxivError = arxivPaper ? arxivErrors[arxivPaper.arxivId] : undefined
  const isArxivPdf = Boolean(arxivPaper)
  const arxivSummaryMarkdown = useMemo(() => buildArxivSummaryMarkdown(arxivPaper), [arxivPaper])

  const handleCopyBibtex = useCallback(async () => {
    if (!arxivPaper) return
    const bibtex = generateBibTeX(arxivPaper)
    const success = await copyToClipboard(bibtex)
    addToast({
      type: success ? 'success' : 'error',
      title: success ? 'BibTeX copied' : 'Copy failed',
      description: success ? arxivPaper.title || arxivPaper.arxivId : 'Please try again.',
      duration: 1800,
    })
  }, [addToast, arxivPaper])

  const handleOpenArxiv = useCallback(() => {
    if (!arxivPaper?.arxivId) return
    window.open(`https://arxiv.org/abs/${arxivPaper.arxivId}`, '_blank', 'noopener,noreferrer')
  }, [arxivPaper])

  useEffect(() => {
    setTitle(isArxivPdf ? `${fileName} Summary` : fileName)
  }, [fileName, isArxivPdf, setTitle])

  useEffect(() => {
    parseRequestedRef.current = false
    setRenderMode('novel')
    setParseError(null)
  }, [fileId])

  const triggerParse = useCallback(async (force = false) => {
    if (!fileId) return false
    setError(null)
    try {
      const suffix = force ? '?force=1' : ''
      await apiClient.post(`/api/v1/pdf/parse/${fileId}${suffix}`)
      setState('processing')
      return true
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to start MinerU parsing')
      setState('error')
      return false
    }
  }, [fileId])

  const loadMarkdown = useCallback(async () => {
    if (!fileId) return
    setState('loading')
    setError(null)
    try {
      const response = await apiClient.get(`/api/v1/pdf/markdown/${fileId}`, {
        responseType: 'text',
      })
      const raw = typeof response.data === 'string' ? response.data : String(response.data ?? '')
      const rewritten = rewriteMarkdownImages(raw, fileId)
      setMarkdown(rewritten)
      setRenderMode('novel')
      setParseError(null)
      setState('ready')
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 409) {
        setState('processing')
        if (!parseRequestedRef.current) {
          parseRequestedRef.current = true
          await triggerParse()
        }
        return
      }
      setError(err?.response?.data?.detail || err?.message || 'Failed to load PDF markdown')
      setState('error')
    }
  }, [fileId, triggerParse])

  const handleRetryParse = useCallback(async () => {
    if (!fileId || isRetrying) return
    setIsRetrying(true)
    parseRequestedRef.current = true
    const started = await triggerParse(true)
    if (started) {
      await loadMarkdown()
    }
    setIsRetrying(false)
  }, [fileId, isRetrying, loadMarkdown, triggerParse])

  useEffect(() => {
    if (isArxivPdf) {
      setState('idle')
      setMarkdown('')
      setError(null)
      return
    }
    if (!fileId) return
    void loadMarkdown()
  }, [fileId, isArxivPdf, loadMarkdown])

  useEffect(() => {
    updateWorkspaceTabState(tabId, {
      contentKind: 'pdf',
      documentMode: 'markdown',
      isReadOnly: true,
    })
  }, [tabId, updateWorkspaceTabState])

  useEffect(() => {
    if (state !== 'processing') return
    const timer = window.setTimeout(() => {
      void loadMarkdown()
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [state, loadMarkdown])

  useEffect(() => {
    if (!editor || state !== 'ready' || renderMode !== 'novel') return
    try {
      setEditorMarkdown(editor, markdown)
      editor.setEditable(false)
      const hasText = editor.state.doc.textContent.trim().length > 0
      if (!hasText && markdown.trim().length > 0) {
        setRenderMode('markdown')
      }
    } catch (err: any) {
      setParseError(err?.message || 'Markdown parse failed')
      setRenderMode('markdown')
    }
  }, [editor, markdown, renderMode, state])

  const fallbackMarkdown = useMemo(
    () => (renderMode === 'markdown' ? appendTokenToMarkdownImages(markdown) : markdown),
    [markdown, renderMode]
  )

  const handleBackToPdf = useCallback(() => {
    if (!fileId) return
    updateTabPlugin(tabId, BUILTIN_PLUGINS.PDF_VIEWER, {
      ...context,
      resourceId: context.resourceId ?? fileId,
      resourceName: context.resourceName ?? fileName,
      customData: {
        ...(context.customData || {}),
        pdfView: 'pdf',
        fileId,
      },
    })
  }, [context, fileId, fileName, tabId, updateTabPlugin])


  if (!fileId) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-3">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">
            Open a PDF to view Markdown
          </h2>
          <p className="text-sm text-muted-foreground">
            Select a PDF in the file tree or import one from arXiv, then open the
            Markdown view to see MinerU output.
          </p>
        </div>
      </div>
    )
  }

  if (isArxivPdf) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">{fileName}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase">
              Summary
            </span>
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full',
                'text-muted-foreground transition-colors',
                'hover:bg-muted hover:text-foreground'
              )}
              title="Paper info"
              aria-label="Paper info"
            >
              <InfoTriangleIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBackToPdf}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors text-sm',
                'bg-background hover:bg-muted/60 border-border'
              )}
              title="Back to PDF view"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex justify-center px-4 py-4 bg-muted/10">
          <div className="relative h-full w-[min(62.5vw,100%)] max-w-[70rem]">
            <div className="notebook-editor-container relative h-full overflow-hidden rounded-2xl border border-border bg-background shadow-soft-card">
              <div className="notebook-doc-editor relative h-full w-full overflow-y-auto p-8">
                <MarkdownRenderer
                  content={arxivSummaryMarkdown}
                  className="prose prose-lg dark:prose-invert max-w-full"
                />
              </div>
            </div>
          </div>
        </div>

        <ArxivInfoModal
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          paper={arxivPaper}
          errorCode={arxivError}
          onCopyBibtex={arxivPaper ? handleCopyBibtex : undefined}
          onOpenArxiv={arxivPaper ? handleOpenArxiv : undefined}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-foreground">{fileName}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase">
            Markdown
          </span>
          {arxivPaper ? (
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full',
                'text-muted-foreground transition-colors',
                'hover:bg-muted hover:text-foreground'
              )}
              title="Paper info"
              aria-label="Paper info"
            >
              <InfoTriangleIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {fileId ? (
            <button
              type="button"
              onClick={handleBackToPdf}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors text-sm',
                'bg-background hover:bg-muted/60 border-border'
              )}
              title="Back to PDF view"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          ) : null}
          {state === 'error' && (
            <button
              onClick={handleRetryParse}
              disabled={isRetrying}
              className={cn(
                'inline-flex items-center gap-2 text-xs transition-colors',
                'text-muted-foreground hover:text-foreground',
                isRetrying && 'opacity-60 cursor-not-allowed'
              )}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isRetrying && 'animate-spin')} />
              Retry parse
            </button>
          )}
          {state === 'processing' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Parsing...</span>
              <button
                onClick={handleRetryParse}
                disabled={isRetrying}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 transition-colors',
                  'border-border bg-background hover:bg-muted/60',
                  isRetrying && 'opacity-60 cursor-not-allowed'
                )}
              >
                <RefreshCw className={cn('h-3 w-3', isRetrying && 'animate-spin')} />
                Retry
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex justify-center px-4 py-4 bg-muted/10">
        <div className="relative h-full w-[min(62.5vw,100%)] max-w-[70rem]">
          <div
            className={cn(
              'notebook-editor-container relative h-full overflow-hidden rounded-2xl border border-border bg-background shadow-soft-card',
              state !== 'ready' && 'flex items-center justify-center'
            )}
          >
            {state === 'loading' && (
              <div className="text-sm text-muted-foreground">Loading Markdown...</div>
            )}
            {state === 'processing' && (
              <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                <span>MinerU parsing in progress...</span>
                <button
                  onClick={handleRetryParse}
                  disabled={isRetrying}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors',
                    'border-border bg-background hover:bg-muted/60',
                    isRetrying && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', isRetrying && 'animate-spin')} />
                  Retry MinerU
                </button>
              </div>
            )}
            {state === 'error' && (
              <div className="text-sm text-destructive px-6 text-center">
                {error || 'Failed to load PDF markdown'}
              </div>
            )}
            {state === 'ready' && renderMode === 'novel' && (
              <EditorRoot>
                <EditorContent
                  extensions={extensions}
                  className="notebook-doc-editor relative h-full w-full overflow-y-auto"
                  editorProps={{
                    attributes: {
                      class:
                        'prose prose-lg dark:prose-invert prose-headings:font-title font-default focus:outline-none max-w-full',
                    },
                  }}
                  onCreate={({ editor: instance }) => {
                    setEditor(instance)
                  }}
                />
              </EditorRoot>
            )}
            {state === 'ready' && renderMode === 'markdown' && (
              <div className="notebook-doc-editor relative h-full w-full overflow-y-auto p-8">
                {parseError ? (
                  <div className="text-xs text-muted-foreground mb-3">
                    {parseError}. Rendering with Markdown viewer.
                  </div>
                ) : null}
                <MarkdownRenderer
                  content={fallbackMarkdown}
                  className="prose prose-lg dark:prose-invert max-w-full"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <ArxivInfoModal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        paper={arxivPaper}
        errorCode={arxivError}
        onCopyBibtex={arxivPaper ? handleCopyBibtex : undefined}
        onOpenArxiv={arxivPaper ? handleOpenArxiv : undefined}
      />
    </div>
  )
}
