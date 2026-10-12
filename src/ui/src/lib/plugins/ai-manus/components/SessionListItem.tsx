'use client'

import { MoreHorizontal, PencilLine, Pin, PinOff, Server, Share2, Trash } from 'lucide-react'
import { type MouseEvent, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { SessionListItem as SessionListItemType } from '@/lib/api/sessions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatSessionTimestamp } from '../lib/time'
import { SpinningIcon } from './icons/SpinningIcon'

export function SessionListItem({
  session,
  active,
  highlight,
  condensed,
  pinned,
  displayTitle,
  onSelect,
  onDelete,
  onTogglePin,
  onRename,
  onShare,
  readOnly,
}: {
  session: SessionListItemType
  active?: boolean
  highlight?: boolean
  condensed?: boolean
  pinned?: boolean
  displayTitle?: string
  onSelect: (sessionId: string) => void
  onDelete?: (sessionId: string) => void
  onTogglePin?: (sessionId: string) => void
  onRename?: (sessionId: string) => void
  onShare?: (sessionId: string) => void
  readOnly?: boolean
}) {
  const timestamp = session.latest_message_at ?? session.updated_at
  const timeLabel = useMemo(() => (timestamp ? formatSessionTimestamp(timestamp) : ''), [timestamp])
  const isRunning =
    typeof session.is_active === 'boolean'
      ? session.is_active
      : session.status === 'running' || session.status === 'pending'
  const isCliSession = Boolean(
    (session.agent_engine && ['claude_code', 'codex'].includes(session.agent_engine)) ||
      (session.execution_target && session.execution_target === 'cli') ||
      session.cli_server_id
  )
  const isDraft = session.session_id.startsWith('draft-')
  const resolvedTitle =
    typeof displayTitle === 'string' && displayTitle.trim()
      ? displayTitle.trim()
      : session.title || 'New Chat'
  const condensedTitle = timeLabel ? `${resolvedTitle} · ${timeLabel}` : resolvedTitle
  const canDelete = Boolean(onDelete && !readOnly && !isDraft)
  const canTogglePin = Boolean(onTogglePin && !readOnly && !isDraft)
  const canRename = Boolean(onRename && !readOnly && !isDraft)
  const canShare = Boolean(onShare && !readOnly && !isDraft)
  const hasMenu = canDelete || canTogglePin || canRename || canShare

  const handleSelect = () => {
    onSelect(session.session_id)
  }

  const handleDelete = async (event: MouseEvent) => {
    event.stopPropagation()
    if (!canDelete || !onDelete) return
    onDelete(session.session_id)
  }

  const handleTogglePin = (event: MouseEvent) => {
    event.stopPropagation()
    if (!canTogglePin || !onTogglePin) return
    onTogglePin(session.session_id)
  }

  const handleRename = (event: MouseEvent) => {
    event.stopPropagation()
    if (!canRename || !onRename) return
    onRename(session.session_id)
  }

  const handleShare = (event: MouseEvent) => {
    event.stopPropagation()
    if (!canShare || !onShare) return
    onShare(session.session_id)
  }

  if (condensed) {
    return (
      <div className="px-1">
        <div
          role="button"
          tabIndex={0}
          onClick={handleSelect}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              handleSelect()
            }
          }}
          title={condensedTitle}
          aria-label={resolvedTitle}
          className={cn(
            'group flex h-12 flex-col items-center justify-center gap-1 rounded-[10px] px-1 py-1 transition-colors',
            active ? 'bg-[var(--background-white-main)]' : 'hover:bg-[var(--fill-tsp-gray-main)]',
            highlight && 'ai-manus-slide-in'
          )}
          >
          <div className="relative">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--fill-tsp-white-dark)]">
              <img
                alt="Session"
                className="h-4 w-4 object-cover opacity-80"
                src="/chatting.svg"
              />
            </div>
            {isRunning ? (
              <div className="absolute -left-[5px] -top-[3px] h-[calc(100%+8px)] w-[calc(100%+8px)]">
                <SpinningIcon className="h-full w-full" />
              </div>
            ) : null}
            {isCliSession ? (
              <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border-main)] bg-[var(--background-white-main)] text-[var(--text-secondary)] shadow-[0px_2px_6px_-4px_rgba(0,0,0,0.3)]">
                <Server size={10} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-2">
      <div
        role="button"
        tabIndex={0}
        onClick={handleSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handleSelect()
          }
        }}
        className={cn(
          'group flex h-14 items-center gap-2 rounded-[10px] px-2 transition-colors',
          active ? 'bg-[var(--background-white-main)]' : 'hover:bg-[var(--fill-tsp-gray-main)]',
          highlight && 'ai-manus-slide-in'
        )}
      >
        <div className="relative">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--fill-tsp-white-dark)]">
            <img
              alt="Session"
              className="h-4 w-4 object-cover opacity-80"
              src="/chatting.svg"
            />
          </div>
          {isRunning ? (
            <div className="absolute -left-[5px] -top-[3px] h-[calc(100%+8px)] w-[calc(100%+8px)]">
              <SpinningIcon className="h-full w-full" />
            </div>
          ) : null}
          {isCliSession ? (
            <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border-main)] bg-[var(--background-white-main)] text-[var(--text-secondary)] shadow-[0px_2px_6px_-4px_rgba(0,0,0,0.3)]">
              <Server size={10} />
            </div>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 overflow-hidden">
            <span
              className="flex-1 truncate text-sm font-medium text-[var(--text-primary)]"
              title={resolvedTitle}
            >
              {resolvedTitle}
            </span>
            {pinned ? (
              <Pin
                className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]"
                aria-label="Pinned"
              />
            ) : null}
            <span className="text-xs text-[var(--text-tertiary)]">{timeLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="flex-1 truncate text-xs text-[var(--text-tertiary)]"
              title={session.latest_message || ''}
            >
              {session.latest_message || ''}
            </span>
            {hasMenu ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-[6px] border border-[var(--border-main)]',
                      'bg-[var(--background-menu-white)] text-[var(--icon-secondary)]',
                      'opacity-0 transition-opacity group-hover:opacity-100'
                    )}
                    onClick={(event) => event.stopPropagation()}
                    aria-label="Session menu"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className={cn(
                    '!border-[var(--soft-border)] !bg-[var(--soft-bg-surface)] !text-[var(--soft-text-primary)]',
                    'shadow-[0px_16px_36px_-20px_rgba(0,0,0,0.2)]'
                  )}
                  align="end"
                  data-ai-manus-history-overlay="true"
                >
                  {canTogglePin ? (
                    <DropdownMenuItem
                      className="cursor-pointer !focus:bg-[var(--soft-bg-inset)]"
                      onClick={handleTogglePin}
                    >
                      {pinned ? (
                        <PinOff className="mr-2 h-3.5 w-3.5" />
                      ) : (
                        <Pin className="mr-2 h-3.5 w-3.5" />
                      )}
                      {pinned ? 'Unpin' : 'Pin to top'}
                    </DropdownMenuItem>
                  ) : null}
                  {canRename ? (
                    <DropdownMenuItem
                      className="cursor-pointer !focus:bg-[var(--soft-bg-inset)]"
                      onClick={handleRename}
                    >
                      <PencilLine className="mr-2 h-3.5 w-3.5" />
                      Rename
                    </DropdownMenuItem>
                  ) : null}
                  {canShare ? (
                    <DropdownMenuItem
                      className="cursor-pointer !focus:bg-[var(--soft-bg-inset)]"
                      onClick={handleShare}
                    >
                      <Share2 className="mr-2 h-3.5 w-3.5" />
                      Copy link
                    </DropdownMenuItem>
                  ) : null}
                  {canDelete && (canTogglePin || canRename || canShare) ? (
                    <DropdownMenuSeparator className="bg-[var(--soft-border)]" />
                  ) : null}
                  <DropdownMenuItem
                    className="cursor-pointer text-[hsl(var(--destructive))] !focus:bg-[hsl(var(--destructive)/0.12)]"
                    onClick={handleDelete}
                  >
                    <Trash className="mr-2 h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SessionListItem
