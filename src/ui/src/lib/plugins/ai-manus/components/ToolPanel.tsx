'use client'

import { useEffect } from 'react'
import type { ToolContent } from '../types'
import type { ExecutionTarget } from '@/lib/types/chat-events'
import { ToolPanelContent } from './ToolPanelContent'

export function ToolPanel({
  open,
  toolContent,
  live,
  sessionId,
  realTime,
  isShare,
  projectId,
  executionTarget,
  cliServerId,
  readOnly,
  viewMode,
  onViewModeChange,
  onClose,
  onJumpToRealTime,
  variant = 'floating',
  hideClose,
}: {
  open: boolean
  toolContent?: ToolContent | null
  live: boolean
  sessionId?: string
  realTime: boolean
  isShare?: boolean
  projectId?: string
  executionTarget?: ExecutionTarget
  cliServerId?: string | null
  readOnly?: boolean
  viewMode?: 'tool' | 'terminal'
  onViewModeChange?: (mode: 'tool' | 'terminal') => void
  onClose: () => void
  onJumpToRealTime: () => void
  variant?: 'floating' | 'docked'
  hideClose?: boolean
}) {
  useEffect(() => {
    if (!open || hideClose) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hideClose, onClose, open])

  if (!open || !toolContent) return null

  if (variant === 'docked') {
    return (
      <ToolPanelContent
        sessionId={sessionId}
        toolContent={toolContent}
        live={live}
        realTime={realTime}
        isShare={isShare}
        projectId={projectId}
        executionTarget={executionTarget}
        cliServerId={cliServerId}
        readOnly={readOnly}
        active={open}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        onHide={onClose}
        onJumpToRealTime={onJumpToRealTime}
        hideClose={hideClose}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 sm:inset-auto sm:bottom-6 sm:right-4 sm:top-[72px] sm:w-[min(540px,45vw)]">
      <div
        className="absolute inset-0 bg-[var(--background-mask)] sm:hidden"
        role="button"
        tabIndex={-1}
        onClick={onClose}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onClose()
        }}
      />
      <div className="relative h-full w-full p-4 sm:p-0">
        <ToolPanelContent
          sessionId={sessionId}
          toolContent={toolContent}
          live={live}
          realTime={realTime}
          isShare={isShare}
          projectId={projectId}
          executionTarget={executionTarget}
          cliServerId={cliServerId}
          readOnly={readOnly}
          active={open}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          onHide={onClose}
          onJumpToRealTime={onJumpToRealTime}
          hideClose={hideClose}
        />
      </div>
    </div>
  )
}

export default ToolPanel
