'use client'

import { useCallback, useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  extractMcpErrorMessage,
  extractMcpListResult,
  extractMcpReadFileResult,
  getMcpToolKind,
  getMcpToolPath,
} from '@/lib/plugins/ai-manus/lib/mcp-tools'
import { BASH_CARRIAGE_RETURN_PREFIX } from '@/lib/utils/bash-log'
import { PatchPreviewPanel } from '@/components/ui/patch-preview-panel'
import { openFile } from '@/lib/plugin/open-file'
import { useFileTreeStore } from '@/lib/stores/file-tree'
import type { ToolViewProps } from './types'
import { McpMemoryToolView } from './McpMemoryToolView'
import { McpArtifactToolView } from './McpArtifactToolView'

const detailTextClass =
  'mt-1 max-w-full break-words [overflow-wrap:anywhere] text-xs text-[var(--text-secondary)]'
const detailPreClass =
  'mt-2 max-w-full overflow-x-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-lg bg-[var(--fill-tsp-gray-main)] p-3 text-xs'

export function McpToolView({ toolContent, panelMode }: ToolViewProps) {
  const showHeader = panelMode == null
  const findNodeByPath = useFileTreeStore((state) => state.findNodeByPath)
  const metadata =
    toolContent.metadata && typeof toolContent.metadata === 'object' && !Array.isArray(toolContent.metadata)
      ? (toolContent.metadata as Record<string, unknown>)
      : {}
  const rawFunction = (toolContent.function || '').trim().toLowerCase()
  const parsedInvocation = rawFunction.startsWith('mcp__') ? rawFunction.split('__').filter(Boolean) : []
  const mcpServer =
    (typeof metadata.mcp_server === 'string' && metadata.mcp_server.trim()) ||
    parsedInvocation[1] ||
    ''
  const mcpTool =
    (typeof metadata.mcp_tool === 'string' && metadata.mcp_tool.trim()) ||
    parsedInvocation[2] ||
    ''

  if (mcpServer === 'memory') {
    return <McpMemoryToolView toolContent={toolContent} panelMode={panelMode} live={toolContent.status === 'calling'} />
  }
  if (mcpServer === 'artifact') {
    return <McpArtifactToolView toolContent={toolContent} panelMode={panelMode} live={toolContent.status === 'calling'} />
  }

  const args =
    toolContent.args && typeof toolContent.args === 'object' && !Array.isArray(toolContent.args)
      ? (toolContent.args as Record<string, unknown>)
      : {}
  const hasArgs = Object.keys(args).length > 0
  const result = toolContent.content?.result
  const error = toolContent.content?.error as string | undefined
  const stringifyValue = (value: unknown) => {
    if (value == null) return ''
    if (typeof value === 'string') return value
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  const formatListLines = (lines: string[], limit = 50) => {
    if (lines.length === 0) return ''
    const trimmed = lines.slice(0, limit)
    const suffix = lines.length > limit ? `\n... (${lines.length - limit} more)` : ''
    return trimmed.join('\n') + suffix
  }
  const mcpKind = getMcpToolKind(toolContent.function)
  const isMcpReadFile = mcpKind === 'read_file'
  const isMcpAppendFile = mcpKind === 'append_file'
  const isMcpTaskPlan = mcpKind === 'write_task_plan'
  const isMcpPullFile = mcpKind === 'pull_file'
  const isMcpListFile = mcpKind === 'list_file'
  const isMcpListDir = mcpKind === 'list_dir'
  const isMcpGrepText = mcpKind === 'grep_text'
  const isMcpGrepFiles = mcpKind === 'grep_files'
  const isMcpGlobFiles = mcpKind === 'glob_files'
  const isMcpWriteMemory = mcpKind === 'write_memory'
  const isMcpRequestPatch = mcpKind === 'request_patch'
  const isMcpBashExec = mcpKind === 'bash_exec'
  const mcpPath = getMcpToolPath(args)
  const mcpTitle = mcpPath || 'a file'
  const mcpDetailTitle = mcpPath || 'Unknown file'
  const mcpReason = typeof args.reason === 'string' ? args.reason : ''
  const mcpContent = stringifyValue(args.content)
  const mcpResultValue = toolContent.content?.result
  const mcpResultRecord =
    mcpResultValue && typeof mcpResultValue === 'object' && !Array.isArray(mcpResultValue)
      ? (mcpResultValue as Record<string, unknown>)
      : null
  const mcpReadResult = extractMcpReadFileResult(mcpResultValue ?? toolContent.content)
  const mcpReadText = mcpReadResult.text
  const mcpReadMessage = mcpReadResult.message
  const mcpAppendMessage =
    mcpResultRecord && typeof mcpResultRecord.message === 'string' ? mcpResultRecord.message : ''
  const mcpReadError = mcpReadMessage || error
  const mcpAppendError = mcpAppendMessage || error
  const mcpErrorMessage = extractMcpErrorMessage(mcpResultRecord ?? mcpResultValue) || error
  const mcpPullContent =
    typeof mcpResultValue === 'string'
      ? mcpResultValue
      : mcpResultRecord && typeof mcpResultRecord.content === 'string'
        ? mcpResultRecord.content
        : ''
  const mcpListResult = extractMcpListResult(mcpResultValue ?? toolContent.content)
  const mcpListItems = mcpListResult.items
  const mcpListLines = formatListLines(
    mcpListItems.map((item) => {
      if (!item || typeof item !== 'object') return String(item)
      const record = item as Record<string, unknown>
      const itemPath =
        typeof record.path === 'string'
          ? record.path
          : typeof record.name === 'string'
            ? record.name
            : 'Unknown'
      const itemType = typeof record.type === 'string' ? record.type : ''
      const itemSize = typeof record.size === 'number' ? `${record.size}b` : ''
      const extra = [itemType, itemSize].filter(Boolean).join(' · ')
      return extra ? `${itemPath} (${extra})` : itemPath
    })
  )
  const mcpListContent = mcpListResult.content
  const mcpListTruncated = mcpListResult.truncated
  const mcpSearchQuery =
    typeof args.query === 'string'
      ? args.query
      : mcpResultRecord && typeof mcpResultRecord.query === 'string'
        ? mcpResultRecord.query
        : ''
  const mcpSearchPattern =
    typeof args.pattern === 'string'
      ? args.pattern
      : mcpResultRecord && typeof mcpResultRecord.pattern === 'string'
        ? mcpResultRecord.pattern
        : ''
  const mcpSearchMatches = Array.isArray(mcpResultRecord?.matches) ? (mcpResultRecord?.matches as unknown[]) : []
  const mcpGrepFilesContent =
    mcpResultRecord && typeof mcpResultRecord.content === 'string'
      ? mcpResultRecord.content
      : typeof mcpResultValue === 'string'
        ? mcpResultValue
        : ''
  const mcpGrepFilesLines = formatListLines(
    mcpGrepFilesContent
      ? mcpGrepFilesContent.split(/\r?\n/).filter(Boolean)
      : []
  )
  const mcpSearchLines = formatListLines(
    mcpSearchMatches.map((match) => {
      if (!match || typeof match !== 'object') return String(match)
      const record = match as Record<string, unknown>
      const filePath = typeof record.file_path === 'string' ? record.file_path : 'Unknown'
      const lineNumber = typeof record.line === 'number' ? record.line : undefined
      const text = typeof record.text === 'string' ? record.text : ''
      const head = lineNumber ? `${filePath}:${lineNumber}` : filePath
      return text ? `${head} ${text}` : head
    })
  )
  const mcpSearchFileLines = formatListLines(
    mcpSearchMatches.map((match) => {
      if (!match || typeof match !== 'object') return String(match)
      const record = match as Record<string, unknown>
      const path =
        typeof record.path === 'string'
          ? record.path
          : typeof record.file_path === 'string'
            ? record.file_path
            : 'Unknown'
      const scoreValue =
        typeof record.score === 'number' || typeof record.score === 'string' ? String(record.score) : ''
      const score = scoreValue ? `score ${scoreValue}` : ''
      const size = typeof record.size === 'number' ? `${record.size}b` : ''
      const extra = [score, size].filter(Boolean).join(' · ')
      return extra ? `${path} (${extra})` : path
    })
  )
  const mcpSearchTruncated = Boolean(mcpResultRecord?.truncated)
  const mcpMemoryTitle = typeof args.title === 'string' ? args.title : ''
  const mcpMemoryKind =
    typeof args.kind === 'string'
      ? args.kind
      : mcpResultRecord && typeof mcpResultRecord.kind === 'string'
        ? mcpResultRecord.kind
        : ''
  const mcpMemoryTags = Array.isArray(args.tags) ? args.tags.map((tag) => String(tag)) : []
  const mcpMemoryConfidence = typeof args.confidence === 'number' ? args.confidence : undefined
  const mcpMemoryId = mcpResultRecord && typeof mcpResultRecord.id === 'string' ? mcpResultRecord.id : ''
  const mcpMemoryPath =
    mcpResultRecord && typeof mcpResultRecord.path === 'string' ? mcpResultRecord.path : ''
  const mcpMemoryIndexPath =
    mcpResultRecord && typeof mcpResultRecord.index_path === 'string' ? mcpResultRecord.index_path : ''
  const mcpMemoryWarnings = Array.isArray(mcpResultRecord?.warnings)
    ? (mcpResultRecord?.warnings as unknown[]).map((item) => String(item))
    : []
  const mcpMemoryErrors = Array.isArray(mcpResultRecord?.errors)
    ? (mcpResultRecord?.errors as unknown[]).map((item) => String(item))
    : []
  const mcpPatchTarget =
    typeof args.target_path === 'string' ? args.target_path : mcpPath || 'Unknown target'
  const mcpPatchRationale = typeof args.rationale === 'string' ? args.rationale : ''
  const mcpPatchBody = typeof args.patch === 'string' ? args.patch : ''
  const mcpPatchEvidence = Array.isArray(args.evidence_refs)
    ? args.evidence_refs.map((item) => String(item))
    : []
  const mcpPatchApplied = Array.isArray(mcpResultRecord?.applied)
    ? (mcpResultRecord?.applied as unknown[]).map((item) => String(item))
    : []
  const mcpPatchAppliedLines = formatListLines(mcpPatchApplied)
  const mcpBashCommand =
    typeof args.command === 'string'
      ? args.command
      : typeof args.cmd === 'string'
        ? args.cmd
        : ''
  const mcpBashWorkdir = typeof args.workdir === 'string' ? args.workdir : ''
  const mcpBashModeFromArgs =
    typeof args.mode === 'string' ? args.mode.trim().toLowerCase() : ''
  const mcpBashTimeout =
    typeof args.timeout_seconds === 'number'
      ? `${args.timeout_seconds}s`
      : typeof args.timeout === 'number'
        ? `${args.timeout}ms`
        : ''
  const mcpBashResult = useMemo(() => {
    if (!isMcpBashExec) return null
    const payload = mcpResultRecord ?? mcpResultValue ?? toolContent.content
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
    const record = payload as Record<string, unknown>
    const isWrapper = typeof record.success === 'boolean' || typeof record.error === 'string'
    if (isWrapper) {
      const inner =
        record.result && typeof record.result === 'object' && !Array.isArray(record.result)
          ? (record.result as Record<string, unknown>)
          : record.data && typeof record.data === 'object' && !Array.isArray(record.data)
            ? (record.data as Record<string, unknown>)
            : null
      if (inner) return inner
    }
    return record
  }, [isMcpBashExec, mcpResultRecord, mcpResultValue, toolContent.content])
  const mcpBashLog =
    mcpBashResult && typeof mcpBashResult.log === 'string'
      ? mcpBashResult.log
      : mcpBashResult && typeof mcpBashResult.output === 'string'
        ? String(mcpBashResult.output)
        : mcpBashResult && typeof mcpBashResult.content === 'string'
          ? String(mcpBashResult.content)
          : typeof mcpResultValue === 'string'
            ? mcpResultValue
            : ''
  const mcpBashMode =
    mcpBashModeFromArgs ||
    (mcpBashResult && typeof mcpBashResult.mode === 'string'
      ? mcpBashResult.mode.trim().toLowerCase()
      : '')
  const mcpBashStatus =
    mcpBashResult && typeof mcpBashResult.status === 'string' ? mcpBashResult.status : ''
  const filterBashLog = (value: string) =>
    value
      .split(/\r?\n/)
      .filter(
        (line) =>
          !line.startsWith('__DS_PROGRESS__') &&
          !line.startsWith('__DS_BASH_STATUS__') &&
          !line.startsWith(BASH_CARRIAGE_RETURN_PREFIX)
      )
      .join('\n')
  const sanitizedBashLog = mcpBashLog ? filterBashLog(mcpBashLog) : ''

  const mcpResultFileId =
    mcpResultRecord && typeof mcpResultRecord.file_id === 'string'
      ? mcpResultRecord.file_id
      : mcpResultRecord && typeof mcpResultRecord.fileId === 'string'
        ? mcpResultRecord.fileId
        : toolContent.content && typeof toolContent.content.file_id === 'string'
          ? (toolContent.content.file_id as string)
          : toolContent.content && typeof toolContent.content.fileId === 'string'
            ? (toolContent.content.fileId as string)
            : null
  const resolvedFileNode = useMemo(() => {
    if (!mcpPath) return null
    return findNodeByPath(mcpPath)
  }, [mcpPath, findNodeByPath])
  const resolvedFileId = mcpResultFileId ?? resolvedFileNode?.id ?? null
  const resolvedFileName =
    resolvedFileNode?.name || (mcpPath ? mcpPath.split('/').pop() : 'File') || 'File'
  const resolvedFilePath = resolvedFileNode?.path || mcpPath
  const showOpenAction =
    Boolean(resolvedFileId) &&
    (isMcpReadFile ||
      isMcpAppendFile ||
      isMcpPullFile ||
      isMcpListFile ||
      isMcpRequestPatch)
  const handleOpenFile = useCallback(() => {
    if (!resolvedFileId) return
    openFile({
      file: {
        id: resolvedFileId,
        name: resolvedFileName,
        path: resolvedFilePath || undefined,
      },
    })
    useFileTreeStore.getState().expandToFile(resolvedFileId)
    useFileTreeStore.getState().select(resolvedFileId)
  }, [resolvedFileId, resolvedFileName, resolvedFilePath])

  if (
    isMcpReadFile ||
    isMcpAppendFile ||
    isMcpTaskPlan ||
    isMcpPullFile ||
    isMcpListFile ||
    isMcpListDir ||
    isMcpGrepText ||
    isMcpGrepFiles ||
    isMcpGlobFiles ||
    isMcpWriteMemory ||
    isMcpRequestPatch ||
    isMcpBashExec
  ) {
    const label = isMcpReadFile
      ? `DeepScientist is reading ${mcpTitle}...`
      : isMcpAppendFile
        ? `DeepScientist is writing ${mcpTitle}`
        : isMcpPullFile
          ? `DeepScientist is pulling ${mcpTitle}...`
          : isMcpListFile || isMcpListDir
            ? `DeepScientist is listing ${mcpTitle}...`
            : isMcpGrepText
              ? `DeepScientist is grepping for "${mcpSearchQuery || '...'}"...`
              : isMcpGrepFiles
                ? `DeepScientist is finding files for "${mcpSearchPattern || '...'}"...`
                : isMcpGlobFiles
                  ? `DeepScientist is matching files for "${mcpSearchPattern || '...'}"...`
                  : isMcpWriteMemory
                    ? `DeepScientist is saving memory "${mcpMemoryTitle || 'Untitled'}"...`
                    : isMcpRequestPatch
                      ? `DeepScientist is applying a patch to ${mcpPatchTarget}...`
                      : isMcpBashExec
                        ? 'DeepScientist is executing a bash command...'
                        : 'DeepScientist is planning...'

    return (
      <div className="flex h-full min-h-0 flex-col">
        {showHeader ? (
          <div className="flex h-[36px] items-center border-b border-[var(--border-main)] bg-[var(--background-gray-main)] px-3 shadow-[inset_0px_1px_0px_0px_#FFFFFF]">
            <div className="flex-1 text-center text-xs font-medium text-[var(--text-tertiary)]">
              MCP Tool
            </div>
            {showOpenAction ? (
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
        <div className="relative flex-1 overflow-x-hidden overflow-y-auto">
          <div className="mx-auto flex min-w-0 max-w-[640px] flex-col gap-4 px-4 py-3 text-xs text-[var(--text-secondary)]">
            <div className="text-xs font-medium text-[var(--text-primary)]">{label}</div>
            {isMcpReadFile || isMcpAppendFile || isMcpPullFile || isMcpListFile || isMcpListDir ? (
              <div>
                <div className="text-xs font-medium text-[var(--text-primary)]">Title</div>
                <div className={detailTextClass}>{mcpDetailTitle}</div>
              </div>
            ) : null}
            {isMcpGrepText ? (
              <div>
                <div className="text-xs font-medium text-[var(--text-primary)]">Query</div>
                <div className={detailTextClass}>
                  {mcpSearchQuery || '—'}
                </div>
              </div>
            ) : null}
            {isMcpGlobFiles || isMcpGrepFiles ? (
              <div>
                <div className="text-xs font-medium text-[var(--text-primary)]">Pattern</div>
                <div className={detailTextClass}>
                  {mcpSearchPattern || '—'}
                </div>
              </div>
            ) : null}
            {isMcpWriteMemory ? (
              <div>
                <div className="text-xs font-medium text-[var(--text-primary)]">Memory title</div>
                <div className={detailTextClass}>
                  {mcpMemoryTitle || '—'}
                </div>
              </div>
            ) : null}
            {isMcpRequestPatch ? (
              <div>
                <div className="text-xs font-medium text-[var(--text-primary)]">Target path</div>
                <div className={detailTextClass}>{mcpPatchTarget}</div>
              </div>
            ) : null}
            {isMcpBashExec ? (
              <div>
                <div className="text-xs font-medium text-[var(--text-primary)]">Command</div>
                <pre className={detailPreClass}>
                  {mcpBashCommand || '—'}
                </pre>
              </div>
            ) : null}
            {isMcpBashExec && mcpBashWorkdir ? (
              <div>
                <div className="text-xs font-medium text-[var(--text-primary)]">Workdir</div>
                <div className={detailTextClass}>{mcpBashWorkdir}</div>
              </div>
            ) : null}
            {isMcpBashExec && mcpBashMode ? (
              <div>
                <div className="text-xs font-medium text-[var(--text-primary)]">Mode</div>
                <div className={detailTextClass}>{mcpBashMode}</div>
              </div>
            ) : null}
            {isMcpBashExec && mcpBashTimeout ? (
              <div>
                <div className="text-xs font-medium text-[var(--text-primary)]">Timeout</div>
                <div className={detailTextClass}>{mcpBashTimeout}</div>
              </div>
            ) : null}
            {isMcpBashExec && mcpBashMode === 'read' ? (
              <div>
                <div className="text-xs font-medium text-[var(--text-primary)]">Log</div>
                <pre className={detailPreClass}>
                  {sanitizedBashLog || 'No log output returned.'}
                </pre>
              </div>
            ) : null}
            {isMcpBashExec && mcpBashMode === 'kill' ? (
              <div>
                <div className="text-xs font-medium text-[var(--text-primary)]">Status</div>
                <div className={detailTextClass}>
                  {mcpBashStatus || (toolContent.status === 'calling' ? 'Terminating…' : 'Termination requested.')}
                </div>
              </div>
            ) : null}
            {isMcpReadFile ? (
              mcpReadError ? (
                <div className="ds-tool-error-banner" role="status">
                  <AlertTriangle className="ds-tool-error-icon" />
                  <span>{mcpReadError}</span>
                </div>
              ) : (
                <div>
                  <div className="text-xs font-medium text-[var(--text-primary)]">Content</div>
                  <pre className={detailPreClass}>
                    {mcpReadText}
                  </pre>
                </div>
              )
            ) : null}
            {isMcpAppendFile ? (
              <>
                {mcpAppendError ? (
                  <div className="ds-tool-error-banner" role="status">
                    <AlertTriangle className="ds-tool-error-icon" />
                    <span>{mcpAppendError}</span>
                  </div>
                ) : null}
                <div>
                  <div className="text-xs font-medium text-[var(--text-primary)]">Reason</div>
                  <pre className={detailPreClass}>
                    {mcpReason}
                  </pre>
                </div>
                <div>
                  <div className="text-xs font-medium text-[var(--text-primary)]">Content</div>
                  <pre className={detailPreClass}>
                    {mcpContent}
                  </pre>
                </div>
              </>
            ) : null}
            {isMcpPullFile ? (
              mcpErrorMessage ? (
                <div className="ds-tool-error-banner" role="status">
                  <AlertTriangle className="ds-tool-error-icon" />
                  <span>{mcpErrorMessage}</span>
                </div>
              ) : (
                <div>
                  <div className="text-xs font-medium text-[var(--text-primary)]">Content</div>
                  <pre className={detailPreClass}>
                    {mcpPullContent}
                  </pre>
                </div>
              )
            ) : null}
            {isMcpListFile || isMcpListDir ? (
              <>
                {mcpErrorMessage ? (
                  <div className="ds-tool-error-banner" role="status">
                    <AlertTriangle className="ds-tool-error-icon" />
                    <span>{mcpErrorMessage}</span>
                  </div>
                ) : null}
                <div>
                  <div className="text-xs font-medium text-[var(--text-primary)]">Items</div>
                  <pre className={detailPreClass}>
                    {mcpListContent || mcpListLines || 'No items returned.'}
                  </pre>
                </div>
                {mcpListTruncated ? (
                  <div className="text-xs text-[var(--text-tertiary)]">Truncated results.</div>
                ) : null}
              </>
            ) : null}
            {isMcpGrepText || isMcpGrepFiles || isMcpGlobFiles ? (
              <>
                {mcpErrorMessage ? (
                  <div className="ds-tool-error-banner" role="status">
                    <AlertTriangle className="ds-tool-error-icon" />
                    <span>{mcpErrorMessage}</span>
                  </div>
                ) : null}
                <div>
                  <div className="text-xs font-medium text-[var(--text-primary)]">Matches</div>
                  <pre className={detailPreClass}>
                    {(isMcpGrepText
                      ? mcpSearchLines
                      : isMcpGrepFiles
                        ? mcpGrepFilesLines
                        : mcpSearchFileLines) || 'No matches returned.'}
                  </pre>
                </div>
                {mcpSearchTruncated ? (
                  <div className="text-xs text-[var(--text-tertiary)]">Truncated results.</div>
                ) : null}
              </>
            ) : null}
            {isMcpWriteMemory ? (
              <>
                {mcpErrorMessage ? (
                  <div className="ds-tool-error-banner" role="status">
                    <AlertTriangle className="ds-tool-error-icon" />
                    <span>{mcpErrorMessage}</span>
                  </div>
                ) : null}
                {mcpMemoryKind ? (
                  <div>
                    <div className="text-xs font-medium text-[var(--text-primary)]">Kind</div>
                    <div className={detailTextClass}>{mcpMemoryKind}</div>
                  </div>
                ) : null}
                {mcpMemoryTags.length > 0 ? (
                  <div>
                    <div className="text-xs font-medium text-[var(--text-primary)]">Tags</div>
                    <pre className={detailPreClass}>
                      {mcpMemoryTags.join(', ')}
                    </pre>
                  </div>
                ) : null}
                {mcpMemoryConfidence != null ? (
                  <div>
                    <div className="text-xs font-medium text-[var(--text-primary)]">Confidence</div>
                    <div className={detailTextClass}>
                      {mcpMemoryConfidence}
                    </div>
                  </div>
                ) : null}
                {mcpMemoryId ? (
                  <div>
                    <div className="text-xs font-medium text-[var(--text-primary)]">Memory ID</div>
                    <div className={detailTextClass}>{mcpMemoryId}</div>
                  </div>
                ) : null}
                {mcpMemoryPath ? (
                  <div>
                    <div className="text-xs font-medium text-[var(--text-primary)]">Path</div>
                    <div className={detailTextClass}>{mcpMemoryPath}</div>
                  </div>
                ) : null}
                {mcpMemoryIndexPath ? (
                  <div>
                    <div className="text-xs font-medium text-[var(--text-primary)]">Index path</div>
                    <div className={detailTextClass}>{mcpMemoryIndexPath}</div>
                  </div>
                ) : null}
                {mcpMemoryWarnings.length > 0 ? (
                  <div>
                    <div className="text-xs font-medium text-[var(--text-primary)]">Warnings</div>
                    <pre className={detailPreClass}>
                      {mcpMemoryWarnings.join(', ')}
                    </pre>
                  </div>
                ) : null}
                {mcpMemoryErrors.length > 0 ? (
                  <div>
                    <div className="text-xs font-medium text-[var(--text-primary)]">Errors</div>
                    <pre className={detailPreClass}>
                      {mcpMemoryErrors.join(', ')}
                    </pre>
                  </div>
                ) : null}
              </>
            ) : null}
            {isMcpRequestPatch ? (
              <>
                {mcpErrorMessage ? (
                  <div className="ds-tool-error-banner" role="status">
                    <AlertTriangle className="ds-tool-error-icon" />
                    <span>{mcpErrorMessage}</span>
                  </div>
                ) : null}
                {mcpPatchRationale ? (
                  <div>
                    <div className="text-xs font-medium text-[var(--text-primary)]">Rationale</div>
                    <pre className={detailPreClass}>
                      {mcpPatchRationale}
                    </pre>
                  </div>
                ) : null}
                {mcpPatchBody ? (
                  <div>
                    <div className="text-xs font-medium text-[var(--text-primary)]">Patch</div>
                    <PatchPreviewPanel patch={mcpPatchBody} showHeader={false} className="mt-2" />
                  </div>
                ) : null}
                {mcpPatchEvidence.length > 0 ? (
                  <div>
                    <div className="text-xs font-medium text-[var(--text-primary)]">Evidence refs</div>
                    <pre className={detailPreClass}>
                      {mcpPatchEvidence.join(', ')}
                    </pre>
                  </div>
                ) : null}
                {mcpPatchAppliedLines ? (
                  <div>
                    <div className="text-xs font-medium text-[var(--text-primary)]">Applied</div>
                    <pre className={detailPreClass}>
                      {mcpPatchAppliedLines}
                    </pre>
                  </div>
                ) : null}
              </>
            ) : null}
            {isMcpBashExec && mcpErrorMessage ? (
              <div className="ds-tool-error-banner" role="status">
                <AlertTriangle className="ds-tool-error-icon" />
                <span>{mcpErrorMessage}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showHeader ? (
        <div className="flex h-[36px] items-center border-b border-[var(--border-main)] bg-[var(--background-gray-main)] px-3 shadow-[inset_0px_1px_0px_0px_#FFFFFF]">
          <div className="flex-1 text-center text-xs font-medium text-[var(--text-tertiary)]">
            MCP Tool
          </div>
        </div>
      ) : null}
      <div className="relative flex-1 overflow-x-hidden overflow-y-auto">
        <div className="mx-auto flex min-w-0 max-w-[640px] flex-col gap-4 px-4 py-3 text-xs text-[var(--text-secondary)]">
          <div>
            <div className="text-xs font-medium text-[var(--text-primary)]">Tool</div>
            <div className={detailTextClass}>{toolContent.function}</div>
          </div>
          {hasArgs ? (
            <div>
              <div className="text-xs font-medium text-[var(--text-primary)]">Arguments</div>
              <pre className={detailPreClass}>
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          ) : null}
          {result ? (
            <div>
              <div className="text-xs font-medium text-[var(--text-primary)]">Result</div>
              <div className={detailPreClass}>
                {String(result)}
              </div>
            </div>
          ) : error ? (
            <div className="ds-tool-error-banner" role="status">
              <AlertTriangle className="ds-tool-error-icon" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="text-xs text-[var(--text-tertiary)]">
              {toolContent.status === 'calling' ? 'Tool is executing…' : 'Waiting for result…'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default McpToolView
