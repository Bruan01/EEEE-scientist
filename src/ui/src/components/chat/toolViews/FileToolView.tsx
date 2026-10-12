'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { viewFile } from '@/lib/api/sessions'
import { previewPdfToolEffect } from '@/lib/ai/effect-dispatcher'
import { useFileTreeStore } from '@/lib/stores/file-tree'
import { openFile } from '@/lib/plugin/open-file'
import FileDiffPanel from '@/components/ui/file-diff-panel'
import type { FileDiffPayload } from '@/lib/types/ui-effects'
import type { ToolViewProps } from './types'

type FileDiffListItem = {
  path?: string
  changeType?: 'create' | 'update' | 'delete'
  diff?: FileDiffPayload
}

type FileAnchorItem = {
  key: string
  label: string
  line?: number
  page?: number
  text?: string
  fileId?: string
  filePath?: string
}

const CHANGE_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
}

export function FileToolView({ sessionId, toolContent, live, panelMode }: ToolViewProps) {
  const [content, setContent] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const stopPollingRef = useRef(false)
  const findNodeByPath = useFileTreeStore((state) => state.findNodeByPath)

  const filePath = useMemo(() => {
    const args = toolContent.args as Record<string, unknown>
    if (typeof args?.file === 'string') return args.file
    if (typeof args?.path === 'string') return args.path
    if (typeof toolContent.content?.file === 'string') return toolContent.content.file
    if (typeof toolContent.content?.file_path === 'string') return toolContent.content.file_path
    return ''
  }, [toolContent])

  const isCopilotAttachment = filePath.startsWith('/FILES/Copilot/')
  const isProjectFile = filePath.startsWith('/FILES/') && !isCopilotAttachment

  const fileName = useMemo(() => {
    if (!filePath) return 'File'
    const parts = filePath.split('/')
    return parts[parts.length - 1] || filePath
  }, [filePath])

  const toolArgs = useMemo(
    () => (toolContent.args as Record<string, unknown>) ?? {},
    [toolContent.args]
  )

  const toolFileId = useMemo(() => {
    const content = toolContent.content as Record<string, unknown> | undefined
    const argId =
      typeof toolArgs.file_id === 'string'
        ? toolArgs.file_id
        : typeof toolArgs.fileId === 'string'
          ? toolArgs.fileId
          : null
    if (argId) return argId
    if (content) {
      if (typeof content.file_id === 'string') return content.file_id
      if (typeof content.fileId === 'string') return content.fileId
    }
    return null
  }, [toolArgs, toolContent.content])

  const resolvedFileNode = useMemo(() => {
    if (!filePath) return null
    return findNodeByPath(filePath)
  }, [filePath, findNodeByPath])

  const resolvedFileId = toolFileId ?? resolvedFileNode?.id ?? null
  const resolvedFileName = resolvedFileNode?.name || fileName
  const resolvedFilePath = resolvedFileNode?.path || filePath

  const handleOpenFile = useCallback(() => {
    if (!resolvedFileId) return
    openFile({
      file: {
        id: resolvedFileId,
        name: resolvedFileName || 'File',
        path: resolvedFilePath || undefined,
      },
    })
    useFileTreeStore.getState().expandToFile(resolvedFileId)
    useFileTreeStore.getState().select(resolvedFileId)
  }, [resolvedFileId, resolvedFileName, resolvedFilePath])

  const diffPayload = useMemo(() => {
    const raw = toolContent.content?.diff
    if (!raw || typeof raw !== 'object') return null
    const lines = (raw as FileDiffPayload).lines
    if (!Array.isArray(lines)) return null
    return raw as FileDiffPayload
  }, [toolContent])

  const inlineContent = useMemo(() => {
    if (typeof toolContent.content?.content === 'string') return toolContent.content.content
    if (typeof toolContent.content?.text === 'string') return toolContent.content.text
    return undefined
  }, [toolContent])

  const hasInlineContent = typeof inlineContent === 'string'

  const changeType =
    typeof toolContent.content?.changeType === 'string'
      ? (toolContent.content.changeType as 'create' | 'update' | 'delete')
      : undefined

  const diffList = useMemo(() => {
    const raw = toolContent.content?.diffs
    if (!Array.isArray(raw)) return null
    const parsed = raw
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const diff = (item as FileDiffListItem).diff
        if (!diff || !Array.isArray(diff.lines)) return null
        return {
          path: (item as FileDiffListItem).path,
          changeType: (item as FileDiffListItem).changeType,
          diff,
        }
      })
      .filter(Boolean) as FileDiffListItem[]
    return parsed.length > 0 ? parsed : null
  }, [toolContent])

  const hasDiff = Boolean(diffPayload || diffList)
  const showHeader = panelMode == null || hasDiff
  const canOpenFile = Boolean(resolvedFileId)

  const rawAnchors = useMemo(() => {
    const content = toolContent.content as Record<string, unknown> | undefined
    const lines = Array.isArray(content?.lines) ? (content?.lines as Record<string, unknown>[]) : null
    const matches = Array.isArray(content?.matches)
      ? (content?.matches as Record<string, unknown>[])
      : null
    const results = Array.isArray(content?.results)
      ? (content?.results as Record<string, unknown>[])
      : null

    if (lines || matches || results) {
      return { lines, matches, results, page: content?.page }
    }

    const fn = (toolContent.function || '').toLowerCase()
    const parseAllowed = new Set([
      'file_grep',
      'pdf_search',
      'pdf_read_lines',
      'rebuttal_pdf_search',
      'rebuttal_pdf_read_lines',
      'file_read_lines',
    ])
    if (!parseAllowed.has(fn)) return { lines: null, matches: null, results: null, page: null }

    const raw = typeof content?.content === 'string' ? content.content.trim() : ''
    if (!raw || (!raw.startsWith('{') && !raw.startsWith('['))) {
      return { lines: null, matches: null, results: null, page: null }
    }

    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return { lines: null, matches: null, results: parsed, page: null }
      }
      if (parsed && typeof parsed === 'object') {
        return {
          lines: Array.isArray((parsed as Record<string, unknown>).lines)
            ? ((parsed as Record<string, unknown>).lines as Record<string, unknown>[])
            : null,
          matches: Array.isArray((parsed as Record<string, unknown>).matches)
            ? ((parsed as Record<string, unknown>).matches as Record<string, unknown>[])
            : null,
          results: Array.isArray((parsed as Record<string, unknown>).results)
            ? ((parsed as Record<string, unknown>).results as Record<string, unknown>[])
            : null,
          page: (parsed as Record<string, unknown>).page ?? null,
        }
      }
    } catch {
      return { lines: null, matches: null, results: null, page: null }
    }

    return { lines: null, matches: null, results: null, page: null }
  }, [toolContent])

  const anchorItems = useMemo(() => {
    const items: FileAnchorItem[] = []

    if (rawAnchors.lines) {
      rawAnchors.lines.forEach((entry, index) => {
        const line = typeof entry.line === 'number' ? entry.line : null
        const text = typeof entry.text === 'string' ? entry.text : ''
        const page =
          typeof entry.page === 'number' ? entry.page : typeof rawAnchors.page === 'number' ? rawAnchors.page : null
        if (!line && !page) return
        items.push({
          key: `line-${line ?? index}`,
          label: page ? `p${page} l${line ?? '-'}` : `l${line ?? '-'}`,
          line: line ?? undefined,
          page: page ?? undefined,
          text,
          fileId: toolFileId ?? undefined,
          filePath,
        })
      })
    }

    if (rawAnchors.matches) {
      rawAnchors.matches.forEach((entry, index) => {
        const line = typeof entry.line === 'number' ? entry.line : null
        const text = typeof entry.text === 'string' ? entry.text : ''
        const fileId = typeof entry.file_id === 'string' ? entry.file_id : toolFileId
        const filePathValue =
          typeof entry.file_path === 'string'
            ? entry.file_path
            : typeof entry.path === 'string'
              ? entry.path
              : filePath
        if (!line && !text) return
        items.push({
          key: `match-${line ?? index}`,
          label: line ? `l${line}` : 'match',
          line: line ?? undefined,
          text,
          fileId: fileId ?? undefined,
          filePath: filePathValue,
        })
      })
    }

    if (rawAnchors.results) {
      rawAnchors.results.forEach((entry, index) => {
        const page = typeof entry.page === 'number' ? entry.page : null
        const line = typeof entry.line === 'number' ? entry.line : null
        const text = typeof entry.text === 'string' ? entry.text : ''
        if (!page && !line) return
        items.push({
          key: `result-${page ?? line ?? index}`,
          label: page ? `p${page} l${line ?? '-'}` : `l${line ?? '-'}`,
          line: line ?? undefined,
          page: page ?? undefined,
          text,
          fileId: toolFileId ?? undefined,
          filePath,
        })
      })
    }

    return items.slice(0, 40)
  }, [filePath, rawAnchors, toolFileId])

  const handleAnchorClick = useCallback(
    (anchor: FileAnchorItem) => {
      const targetFileId = anchor.fileId ?? toolFileId ?? undefined
      if (anchor.page && targetFileId) {
        previewPdfToolEffect({ fileId: targetFileId, page: anchor.page })
        return
      }
      if (!targetFileId || !anchor.line) return
      useFileTreeStore.getState().expandToFile(targetFileId)
      useFileTreeStore.getState().select(targetFileId)
      window.dispatchEvent(
        new CustomEvent('ds:file-preview:jump', {
          detail: { fileId: targetFileId, line: anchor.line },
        })
      )
    },
    [toolFileId]
  )

  const headerTitle = useMemo(() => {
    if (!hasDiff) return fileName
    if (diffList) return 'File changes'
    if (filePath) return `File changes · ${fileName}`
    return 'File changes'
  }, [diffList, fileName, filePath, hasDiff])

  const headerBadge = useMemo(() => {
    if (!hasDiff) return null
    const labels = new Set<string>()
    if (changeType) labels.add(changeType)
    if (diffList) {
      diffList.forEach((item) => {
        if (item.changeType) labels.add(item.changeType)
      })
    }
    if (labels.size === 1) {
      const only = Array.from(labels)[0]
      return CHANGE_LABELS[only] ?? 'Updated'
    }
    return 'Updated'
  }, [changeType, diffList, hasDiff])

  useEffect(() => {
    let active = true
    stopPollingRef.current = false

    const applyContent = (next: string) => {
      if (!active) return
      setContent(next)
      setFileError(null)
    }

    const load = async () => {
      if (stopPollingRef.current) return
      if (diffPayload || diffList) {
        applyContent('')
        return
      }
      if (hasInlineContent) {
        applyContent(inlineContent ?? '')
        return
      }
      if (changeType === 'delete') {
        applyContent('File deleted.')
        return
      }
      if (isProjectFile) {
        applyContent('')
        return
      }
      if (!live) {
        applyContent('')
        return
      }

      if (!sessionId || !filePath) return

      try {
        const response = await viewFile(sessionId, filePath)
        applyContent(response.content ?? '')
      } catch (error) {
        const status = (error as { response?: { status?: number } }).response?.status
        const message =
          typeof error === 'string'
            ? error
            : (error as { message?: string }).message ?? 'Failed to load file content.'
        if (active) {
          setFileError(message)
        }
        if (status === 400 || status === 404) {
          stopPollingRef.current = true
          return
        }
        console.error('[FileToolView] Failed to load file', error)
      }
    }

    void load()

    if (!live || !sessionId || !filePath) return () => {
      active = false
    }

    const timer = window.setInterval(load, 5000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [changeType, diffList, diffPayload, filePath, hasInlineContent, inlineContent, live, sessionId, toolContent])

  const showFileError = Boolean(fileError && !diffPayload && !diffList)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showHeader ? (
        <div className="flex h-[36px] items-center border-b border-[var(--border-main)] bg-[var(--background-gray-main)] px-3 shadow-[inset_0px_1px_0px_0px_#FFFFFF]">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="truncate text-xs font-medium text-[var(--text-tertiary)]">
              {headerTitle}
            </div>
            {headerBadge ? (
              <span className="rounded-full border border-[var(--border-light)] bg-[var(--fill-tsp-gray-main)] px-2 py-[2px] text-[10px] font-semibold text-[var(--text-secondary)]">
                {headerBadge}
              </span>
            ) : null}
          </div>
          {canOpenFile ? (
            <button
              type="button"
              onClick={handleOpenFile}
              className="inline-flex items-center rounded-md border border-[var(--border-light)] bg-[var(--background-white-main)] px-2 py-[2px] text-[10px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-white-light)]"
            >
              Open file
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="relative flex-1 min-h-0">
        <div className="flex h-full min-h-0 flex-col gap-2 overflow-auto px-3 py-2">
          {anchorItems.length ? (
            <div className="rounded-lg border border-[var(--border-light)] bg-[var(--fill-tsp-white-light)] p-2">
              <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
                Evidence anchors
              </div>
              <div className="mt-2 flex flex-col gap-1">
                {anchorItems.map((anchor) => (
                  <button
                    key={anchor.key}
                    type="button"
                    onClick={() => handleAnchorClick(anchor)}
                    className="flex items-start gap-2 rounded-md border border-transparent px-2 py-1 text-left text-[11px] text-[var(--text-secondary)] hover:border-[var(--border-light)] hover:bg-[var(--fill-tsp-gray-main)]"
                  >
                    <span className="shrink-0 rounded-full border border-[var(--border-light)] bg-[var(--fill-tsp-gray-main)] px-2 py-[2px] text-[10px] font-semibold text-[var(--text-tertiary)]">
                      {anchor.label}
                    </span>
                    <span className="line-clamp-2">{anchor.text || anchor.filePath || 'Open location'}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {diffList
            ? diffList.map((item, index) => (
                <FileDiffPanel
                  key={`${item.path ?? index}`}
                  diff={item.diff as FileDiffPayload}
                  changeType={item.changeType}
                  title={item.path ?? 'File changes'}
                  compact
                  showHeader={false}
                />
              ))
            : diffPayload
              ? (
                  <FileDiffPanel
                    diff={diffPayload}
                    changeType={changeType}
                    title="File changes"
                    compact
                    className="ai-manus-file-diff-full"
                    showHeader={false}
                  />
                )
              : null}
          {!diffPayload && !diffList ? (
            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--text-primary)]">
              {content || 'No content available.'}
            </pre>
          ) : null}
        </div>
        {showFileError ? (
          <div className="ds-tool-error-banner" role="status">
            <AlertTriangle className="ds-tool-error-icon" />
            <span>{fileError}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default FileToolView
