'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Info, Minimize2, Play, Terminal } from 'lucide-react'
import type { ToolContent } from '../types'
import { getToolInfo, resolveToolActorLabel } from '../lib/tool-map'
import type { ExecutionTarget } from '@/lib/types/chat-events'
import { useI18n } from '@/lib/i18n/useI18n'
import { cn } from '@/lib/utils'
import { LoadingIndicator } from './LoadingIndicator'

export function ToolPanelContent({
  sessionId,
  toolContent,
  live,
  realTime,
  isShare,
  projectId,
  executionTarget,
  cliServerId,
  readOnly,
  active,
  viewMode,
  onViewModeChange,
  onHide,
  onJumpToRealTime,
  hideClose,
}: {
  sessionId?: string
  toolContent: ToolContent
  live: boolean
  realTime: boolean
  isShare?: boolean
  projectId?: string
  executionTarget?: ExecutionTarget
  cliServerId?: string | null
  readOnly?: boolean
  active?: boolean
  viewMode?: 'tool' | 'terminal'
  onViewModeChange?: (mode: 'tool' | 'terminal') => void
  onHide: () => void
  onJumpToRealTime: () => void
  hideClose?: boolean
}) {
  const { t } = useI18n('ai_manus')
  const toolInfo = useMemo(() => getToolInfo(toolContent), [toolContent])
  const actorLabel = useMemo(() => resolveToolActorLabel(toolContent), [toolContent])
  const View = toolInfo.view
  const Icon = toolInfo.icon
  const isTerminalTool = toolInfo.category === 'shell'
  const isTerminalView = viewMode === 'terminal'
  const isTerminalPanel = isTerminalTool && isTerminalView
  const runtimeLabel = useMemo(() => {
    if (executionTarget === 'cli') {
      return cliServerId ? `CLI ${cliServerId.slice(0, 6)}` : 'CLI'
    }
    if (executionTarget === 'sandbox') return 'Sandbox'
    return 'Runtime'
  }, [cliServerId, executionTarget])
  const statusLabel = toolContent.status === 'calling' ? t('running') : t('succeeded')
  const showActorLabel = toolInfo.category === 'file'
  const actionLabel = toolInfo.functionArg
    ? `${toolInfo.function}: ${toolInfo.functionArg}`
    : toolInfo.function
  const taskLabel = showActorLabel ? `${actorLabel} ${actionLabel}` : actionLabel
  const [aboutOpen, setAboutOpen] = useState(false)
  const aboutRef = useRef<HTMLDivElement | null>(null)
  const shellSessionId = useMemo(() => {
    const args = toolContent.args as Record<string, unknown>
    if (typeof args?.id === 'string') return args.id
    if (typeof toolContent.content?.session_id === 'string') return toolContent.content.session_id
    if (typeof toolContent.content?.shell_session_id === 'string') {
      return toolContent.content.shell_session_id
    }
    return ''
  }, [toolContent])
  const terminalStatusLabel =
    executionTarget === 'sandbox'
      ? 'Terminal Sandbox (view-only)'
      : executionTarget === 'cli'
        ? 'Terminal CLI (interactive)'
        : 'Terminal Ready'

  useEffect(() => {
    if (!aboutOpen) return
    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target || !aboutRef.current) return
      if (!aboutRef.current.contains(target)) {
        setAboutOpen(false)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [aboutOpen])

  return (
    <div
      className={cn(
        'ai-manus-tool-panel flex h-full min-w-0 w-full flex-col overflow-hidden rounded-[10px] border border-[var(--border-light)] shadow-[0px_0px_1px_0px_var(--shadow-XS),0px_16px_32px_-24px_var(--shadow-S)]',
        isTerminalPanel && 'is-terminal'
      )}
    >
      <div className="ai-manus-tool-header relative flex items-center gap-2 border-b border-[var(--border-light)] px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-[8px] border border-[var(--border-light)] bg-[var(--fill-tsp-gray-main)]">
            <Icon className="h-4 w-4 text-[var(--icon-primary)]" />
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-[var(--text-primary)]">
              {isTerminalPanel ? 'Terminal' : 'Tool Panel'}
            </div>
            {isTerminalPanel ? (
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
                <span className="truncate">{runtimeLabel}</span>
                <span className="text-[10px] text-[var(--text-disable)]">•</span>
                <span className="truncate">{statusLabel}</span>
              </div>
            ) : null}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isTerminalPanel ? (
            <div ref={aboutRef} className="relative">
              <button
                type="button"
                onClick={() => setAboutOpen((value) => !value)}
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent transition',
                  aboutOpen
                    ? 'border-[var(--border-light)] bg-[var(--fill-tsp-white-light)] text-[var(--icon-primary)]'
                    : 'text-[var(--icon-tertiary)] hover:bg-[var(--fill-tsp-gray-main)]'
                )}
                aria-label={t('about_terminal_session')}
                title={t('about_terminal_session')}
              >
                <Info className="h-4 w-4" />
              </button>
              {aboutOpen ? (
                <div className="ds-tool-about-panel">
                  <div className="text-[12px] font-semibold text-[var(--text-primary)]">
                    {terminalStatusLabel}
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                    {t('session')}: {shellSessionId || t('unknown')}
                  </div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">
                    {t('tool_call')}: {toolContent.tool_call_id || t('unknown')}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {onViewModeChange ? (
            <button
              type="button"
              onClick={() => {
                if (isTerminalView) {
                  onViewModeChange('tool')
                  return
                }
                onViewModeChange('terminal')
              }}
              aria-pressed={isTerminalView}
              aria-label={isTerminalView ? t('show_tool_output') : t('open_terminal')}
              title={isTerminalView ? t('show_tool_output') : t('open_terminal')}
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent transition',
                isTerminalView
                  ? 'border-[var(--border-light)] bg-[var(--fill-tsp-white-light)] text-[var(--icon-primary)]'
                  : 'text-[var(--icon-tertiary)] hover:bg-[var(--fill-tsp-gray-main)]'
              )}
            >
              <Terminal className="h-4 w-4" />
            </button>
          ) : null}
          {!hideClose ? (
            <button
              type="button"
              onClick={onHide}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-[var(--fill-tsp-gray-main)]"
            >
              <Minimize2 className="h-4 w-4 text-[var(--icon-tertiary)]" />
            </button>
          ) : null}
        </div>
      </div>

      {!isTerminalPanel ? (
        <div className="ai-manus-tool-meta flex items-center justify-between gap-3 px-4 py-2">
          <div className="flex min-w-0 items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
            <span className="truncate text-[12px] font-medium text-[var(--text-secondary)]">
              {showActorLabel ? actorLabel : toolInfo.name}
            </span>
            <span className="text-[10px] text-[var(--text-disable)]">•</span>
            <span className="truncate">{runtimeLabel}</span>
            <span className="text-[10px] text-[var(--text-disable)]">•</span>
            <span className="truncate">{statusLabel}</span>
          </div>
          {toolContent.status === 'calling' ? <LoadingIndicator text={t('running')} compact /> : null}
        </div>
      ) : null}

      <div className="ai-manus-tool-view flex-1 min-h-0 overflow-hidden rounded-[8px]">
        {View ? (
          <View
            sessionId={sessionId}
            toolContent={toolContent}
            live={live}
            isShare={isShare}
            projectId={projectId}
            executionTarget={executionTarget}
            cliServerId={cliServerId}
            readOnly={readOnly}
            active={active}
            panelMode={viewMode}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--text-tertiary)]">
            {t('tool_output_unavailable')}
          </div>
        )}
      </div>

      {!isTerminalPanel ? (
        <div className="ai-manus-tool-footer flex items-center gap-2 border-t border-[var(--border-light)] px-4 py-2 text-[11px] text-[var(--text-tertiary)]">
          <span className="shrink-0 text-[11px] text-[var(--text-disable)]">{t('task')}</span>
          <span className="truncate text-[11px] text-[var(--text-secondary)]" title={taskLabel}>
            {taskLabel}
          </span>
        </div>
      ) : null}

      {!realTime ? (
        <div className="relative flex w-full items-center gap-2 px-4 pb-4 pt-3">
          <button
            type="button"
            onClick={onJumpToRealTime}
            className="absolute left-1/2 top-[-44px] flex h-10 -translate-x-1/2 items-center gap-1 rounded-[10px] border border-[var(--border-main)] bg-[var(--background-white-main)] px-3 shadow-[0px_5px_16px_0px_var(--shadow-S),0px_0px_1.25px_0px_var(--shadow-S)] hover:bg-[var(--background-gray-main)]"
          >
            <Play size={16} />
            <span className="text-sm font-medium text-[var(--text-primary)]">{t('jump_to_live')}</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default ToolPanelContent
