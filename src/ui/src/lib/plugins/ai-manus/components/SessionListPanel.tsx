'use client'

import { Command, GripVertical, MessageSquareDashed, Plus } from 'lucide-react'
import { motion, useDragControls } from 'framer-motion'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useI18n } from '@/lib/i18n/useI18n'
import { cn } from '@/lib/utils'
import type { SessionListItem as SessionListItemType } from '@/lib/api/sessions'
import { GlareHover, Noise, SpotlightCard } from '@/components/react-bits'
import { SessionListItem } from './SessionListItem'

export function SessionListPanel({
  open,
  sessions,
  activeSessionId,
  highlightSessionId,
  onToggle,
  onSelect,
  onNew,
  onDelete,
  onTogglePin,
  onRename,
  onShare,
  readOnly,
  floating,
  draggable,
  dragConstraintsRef,
  pinnedSessionIds,
  renamedSessions,
  panelId,
}: {
  open: boolean
  sessions: SessionListItemType[]
  activeSessionId?: string | null
  highlightSessionId?: string | null
  onToggle: (open: boolean) => void
  onSelect: (sessionId: string) => void
  onNew: () => void
  onDelete?: (sessionId: string) => void
  onTogglePin?: (sessionId: string) => void
  onRename?: (sessionId: string) => void
  onShare?: (sessionId: string) => void
  readOnly?: boolean
  floating?: boolean
  draggable?: boolean
  dragConstraintsRef?: RefObject<HTMLElement>
  pinnedSessionIds?: string[]
  renamedSessions?: Record<string, string>
  panelId?: string
}) {
  const { t } = useI18n('ai_manus')
  const dragControls = useDragControls()
  const isFloating = Boolean(floating)
  const isDraggable = Boolean(draggable)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const pinnedSet = useMemo(() => new Set(pinnedSessionIds ?? []), [pinnedSessionIds])
  const debugEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false
    return process.env.NODE_ENV !== 'production' || window.localStorage.getItem('ds_debug_copilot') === '1'
  }, [])

  useEffect(() => {
    if (!debugEnabled) return
    console.info('[AiManus][history:panel]', {
      open,
      floating: isFloating,
      draggable: isDraggable,
      panelId: panelId ?? null,
    })
  }, [debugEnabled, isDraggable, isFloating, open, panelId])

  useEffect(() => {
    if (!isFloating || !open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (typeof event.button === 'number' && event.button !== 0) return

      const target = event.target as Node | null
      const root = rootRef.current

      if (root && target && root.contains(target)) return

      const path = typeof event.composedPath === 'function' ? event.composedPath() : null
      if (path) {
        for (const node of path) {
          if (!(node instanceof Element)) continue
          if (node.hasAttribute('data-ai-manus-history-toggle')) return
          if (node.closest?.('[data-ai-manus-history-toggle]')) return
          if (node.hasAttribute('data-ai-manus-history-overlay')) return
          if (node.closest?.('[data-ai-manus-history-overlay]')) return
        }
      }

      onToggle(false)
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [isFloating, onToggle, open])

  if (!open) return null

  return (
    <motion.div
      ref={rootRef}
      id={panelId}
      role="region"
      aria-label={t('history')}
      data-ai-manus-history-overlay="true"
      drag={isDraggable}
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0.08}
      dragConstraints={isDraggable ? dragConstraintsRef : undefined}
      whileDrag={isDraggable ? { scale: 1.01 } : undefined}
      className={cn(
        'relative min-w-0 overflow-visible pointer-events-auto',
        isFloating ? 'm-3 h-[calc(100%-24px)] max-w-[calc(100%-24px)]' : 'h-full max-w-full',
        'w-[min(300px,100%)]'
      )}
    >
      <GlareHover className="ai-manus-session-glass relative flex h-full w-full rounded-[18px]" strength={0.28}>
        <SpotlightCard
          spotlightColor="rgba(159, 177, 194, 0.24)"
          hoverOnly
          className="flex h-full w-full flex-col bg-transparent"
        >
          <Noise size={240} className="ai-manus-session-noise opacity-[0.055]" />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center justify-between gap-2 px-3 py-3">
              <div className="h-7 w-7" aria-hidden />
              <div
                role={isDraggable ? 'button' : undefined}
                tabIndex={isDraggable ? 0 : undefined}
                aria-label={isDraggable ? t('drag_history_panel') : undefined}
                title={isDraggable ? t('drag_to_move') : undefined}
                onPointerDown={
                  isDraggable
                    ? (event) => {
                        event.preventDefault()
                        dragControls.start(event.nativeEvent)
                      }
                    : undefined
                }
                className={cn(
                  'flex min-w-0 flex-1 items-center justify-center gap-2 rounded-[999px] px-2 py-1 text-[11px] font-semibold text-[var(--text-tertiary)]',
                  isDraggable &&
                    'touch-none cursor-grab select-none border border-[var(--border-light)] bg-[var(--fill-tsp-white-light)]/70 active:cursor-grabbing'
                )}
              >
                <GripVertical className="h-4 w-4 shrink-0 opacity-70" />
                <span className="truncate">{t('history')}</span>
              </div>
              <div className="h-7 w-7" aria-hidden />
            </div>

            <div className="px-3 pb-2">
              <button
                type="button"
                onClick={onNew}
                disabled={readOnly}
                className={cn(
                  'flex h-9 w-full items-center justify-center gap-2 rounded-xl',
                  'bg-[var(--Button-primary-white)] text-sm font-medium text-[var(--text-primary)]',
                  'shadow-[0px_8px_28px_-24px_var(--shadow-L)] hover:bg-white/20',
                  'transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-[0.5px]',
                  readOnly && 'cursor-not-allowed opacity-50'
                )}
              >
                <Plus className="h-4 w-4 text-[var(--icon-primary)]" />
                <span className="truncate">{t('new_chat')}</span>
                <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-[6px] border border-[var(--border-light)] bg-[var(--fill-tsp-white-light)]">
                    <Command size={14} />
                  </span>
                  <span className="flex h-5 w-5 items-center justify-center rounded-[6px] border border-[var(--border-light)] bg-[var(--fill-tsp-white-light)] text-sm">
                    K
                  </span>
                </span>
              </button>
            </div>

            {sessions.length > 0 ? (
              <div className="ai-manus-scrollbar flex flex-1 flex-col overflow-y-auto pb-5">
                {sessions.map((session) => (
                  <SessionListItem
                    key={session.session_id}
                    session={session}
                    active={session.session_id === activeSessionId}
                    highlight={session.session_id === highlightSessionId}
                    pinned={pinnedSet.has(session.session_id)}
                    displayTitle={renamedSessions?.[session.session_id]}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onTogglePin={onTogglePin}
                    onRename={onRename}
                    onShare={onShare}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[var(--text-tertiary)]">
                <MessageSquareDashed size={36} />
                <span className="text-sm font-medium">{t('create_chat_to_get_started')}</span>
              </div>
            )}
          </div>
        </SpotlightCard>
      </GlareHover>
    </motion.div>
  )
}

export default SessionListPanel
