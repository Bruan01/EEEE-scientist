'use client'

import * as React from 'react'
import { Bell, Check, ChevronDown, Loader2, X, XCircle } from 'lucide-react'
import dynamic from 'next/dynamic'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useToast, type Toast } from '@/components/ui/toast'
import { useUploadTasks, useFileTreeStore } from '@/lib/stores/file-tree'
import { formatFileSize } from '@/lib/types/file'
import { PngIcon } from '@/components/ui/png-icon'
import { useNotificationsStore } from '@/lib/stores/notifications'
import { usePremiumMessagesStore } from '@/lib/stores/premium-messages'
import { markPremiumMessageRead } from '@/lib/api/messages'
import { getFileContent } from '@/lib/api/files'
import { markAllNotificationsRead, markNotificationsRead } from '@/lib/api/notifications'
import { MARKDOWN_VIEWER_STYLES } from '@/lib/plugins/markdown-viewer/markdownStyles'
import type { SystemNotification } from '@/lib/types/notification'
import type { PremiumMessage } from '@/lib/types/messages'

const MarkdownRenderer = dynamic(
  () => import('@/lib/plugins/markdown-viewer/components/MarkdownRenderer'),
  {
    ssr: false,
    loading: () => (
      <div className="text-xs text-muted-foreground">Rendering…</div>
    ),
  }
)

function formatTime(ts?: number | string | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1 w-full rounded-full overflow-hidden bg-black/10 dark:bg-white/10">
      <div
        className="h-full bg-[#8FA3B8]/80 transition-[width] duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export function NotificationBell({
  className,
  buttonClassName,
  size = 'md',
  variant = 'default',
  enabled = true,
}: {
  className?: string
  buttonClassName?: string
  size?: 'sm' | 'md'
  variant?: 'default' | 'workspace'
  enabled?: boolean
}) {
  const { toasts, markToastRead, markAllRead, removeToast, clearToasts } = useToast()
  const systemNotifications = useNotificationsStore((state) => state.items)
  const systemProjectId = useNotificationsStore((state) => state.projectId)
  const markSystemReadLocal = useNotificationsStore((state) => state.markRead)
  const markSystemAllReadLocal = useNotificationsStore((state) => state.markAllRead)
  const premiumMessages = usePremiumMessagesStore((state) => state.items)
  const markPremiumReadLocal = usePremiumMessagesStore((state) => state.markRead)
  const uploadTasks = useUploadTasks()
  const { cancelUpload, clearCompletedUploads } = useFileTreeStore()
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [premiumContentById, setPremiumContentById] = React.useState<
    Record<string, { status: 'loading' | 'loaded' | 'error'; content: string }>
  >({})

  React.useEffect(() => {
    if (!enabled) return
    if (!expandedId?.startsWith('premium:')) return
    const premiumId = expandedId.slice('premium:'.length)
    if (!premiumId) return

    const existing = premiumContentById[premiumId]
    if (existing?.status === 'loading' || existing?.status === 'loaded') return

    const message = premiumMessages.find((item) => item.id === premiumId)
    if (!message) return

    if (message.content_markdown) {
      setPremiumContentById((prev) => ({
        ...prev,
        [premiumId]: { status: 'loaded', content: message.content_markdown || '' },
      }))
      return
    }

    if (!message.content_file_id) {
      setPremiumContentById((prev) => ({
        ...prev,
        [premiumId]: { status: 'loaded', content: message.message || '' },
      }))
      return
    }

    let cancelled = false
    setPremiumContentById((prev) => ({
      ...prev,
      [premiumId]: { status: 'loading', content: prev[premiumId]?.content || '' },
    }))

    ;(async () => {
      try {
        const text = await getFileContent(message.content_file_id || '')
        if (cancelled) return
        setPremiumContentById((prev) => ({
          ...prev,
          [premiumId]: { status: 'loaded', content: text || '' },
        }))
      } catch {
        if (cancelled) return
        setPremiumContentById((prev) => ({
          ...prev,
          [premiumId]: { status: 'error', content: message.message || '' },
        }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, expandedId, premiumContentById, premiumMessages])

  const frontendUnread = React.useMemo(() => toasts.filter((t) => !t.read).length, [toasts])
  const systemUnread = React.useMemo(
    () => systemNotifications.filter((t) => !t.read_at).length,
    [systemNotifications]
  )
  const premiumUnread = React.useMemo(
    () => premiumMessages.filter((t) => !t.state?.read_at).length,
    [premiumMessages]
  )
  const sorted = React.useMemo(
    () => [...toasts].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [toasts]
  )
  const sortedSystem = React.useMemo(
    () =>
      [...systemNotifications].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [systemNotifications]
  )
  const unreadTotal = frontendUnread + systemUnread + premiumUnread

  const iconSize = size === 'sm' ? 18 : 20
  const uploads = React.useMemo(() => {
    const visible = uploadTasks.filter((t) => t.status !== 'cancelled')
    const active = visible.filter((t) => t.status === 'uploading' || t.status === 'pending')
    const completed = visible.filter((t) => t.status === 'completed' || t.status === 'error')
    return { visible, active, completed }
  }, [uploadTasks])
  const badgeCount = frontendUnread + systemUnread + premiumUnread + uploads.active.length
  const hasPremium = premiumMessages.length > 0
  const hasSystem = sortedSystem.length > 0
  const hasFrontend = sorted.length > 0
  const hasUploads = uploads.visible.length > 0
  const showEmptyState = !hasPremium && !hasSystem && !hasFrontend && !hasUploads

  const markSystemRead = React.useCallback(
    async (ids: string[]) => {
      if (!ids.length) return
      markSystemReadLocal(ids)
      try {
        await markNotificationsRead(ids)
      } catch {
        // best-effort
      }
    },
    [markSystemReadLocal]
  )
  const markPremiumRead = React.useCallback(
    async (id: string) => {
      if (!id) return
      markPremiumReadLocal(id)
      try {
        const res = await markPremiumMessageRead(id)
        if (res?.read_at) {
          markPremiumReadLocal(id, res.read_at)
        }
      } catch {
        // best-effort
      }
    },
    [markPremiumReadLocal]
  )

  const markSystemAllRead = React.useCallback(async () => {
    if (!systemProjectId || systemNotifications.length === 0) return
    markSystemAllReadLocal()
    try {
      await markAllNotificationsRead(systemProjectId)
    } catch {
      // best-effort
    }
  }, [markSystemAllReadLocal, systemNotifications.length, systemProjectId])

  if (!enabled) {
    return null
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!enabled) return
        if (!open) {
          setExpandedId(null)
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            variant === 'workspace'
              ? 'ghost-btn relative'
	              : cn(
	                  'relative inline-flex items-center justify-center transition-colors',
	                  size === 'sm' ? 'h-9 w-9 rounded-full' : 'h-10 w-10 rounded-full',
	                  'text-muted-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
	                ),
            buttonClassName
          )}
          title="Notifications"
        >
          <PngIcon
            name="Bell"
            size={iconSize}
            className="text-current"
            fallback={<Bell className="text-current" size={iconSize} />}
          />
          {premiumUnread > 0 ? (
            <span
              className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[var(--brand)]/40 animate-ping"
              aria-hidden
            />
          ) : null}
          {badgeCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--brand)] text-white text-[11px] leading-[18px] text-center">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(
          'w-[94vw] max-w-[760px] p-0 overflow-visible bg-transparent border-none shadow-none',
          className
        )}
      >
        <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-white/95 text-[#111111] shadow-[0_18px_45px_rgba(0,0,0,0.18)] dark:border-white/15 dark:bg-[#0D0D0D]/95 dark:text-[#F3F3F3]">
          <style dangerouslySetInnerHTML={{ __html: MARKDOWN_VIEWER_STYLES }} />

          <div className="px-4 py-3 border-b border-black/10 bg-white/55 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold tracking-tight">Inbox</div>
                {unreadTotal > 0 ? (
                  <div className="text-[11px] text-black/60 dark:text-foreground/70 tabular-nums">
                    {unreadTotal} unread
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {unreadTotal > 0 ? (
                  <button
                    type="button"
                    className="ds-glare-sheen text-xs px-2 py-1 rounded-md border border-black/10 bg-white/70 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      markAllRead()
                      void markSystemAllRead()
                    }}
                  >
                    Mark all read
                  </button>
                ) : null}
                {uploads.completed.length > 0 && uploads.active.length === 0 ? (
                  <button
                    type="button"
                    className="ds-glare-sheen text-xs px-2 py-1 rounded-md border border-black/10 bg-white/70 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      clearCompletedUploads()
                    }}
                  >
                    Clear uploads
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ds-glare-sheen text-xs px-2 py-1 rounded-md border border-black/10 bg-white/70 hover:bg-white disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    clearToasts()
                  }}
                  disabled={toasts.length === 0}
                >
                  Clear all
                </button>
              </div>
            </div>
            <div className="mt-1 text-[11px] text-black/60 dark:text-foreground/70">
              Premium messages, system messages, frontend alerts, and upload status are stored here.
            </div>
          </div>

          <div className="max-h-[70vh] overflow-auto pb-3">
          {uploads.visible.length > 0 ? (
            <div className="border-b border-black/5 dark:border-white/10">
              <div className="px-4 pt-4 pb-2">
                <div className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                  Uploads
                </div>
              </div>

              <div className="px-2 pb-3 space-y-1">
                {uploads.visible.map((task) => {
                  const isActive = task.status === 'uploading' || task.status === 'pending'
                  const isError = task.status === 'error'
                  const isDone = task.status === 'completed'

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        'px-3 py-2 rounded-xl border transition-colors',
                        'border-black/5 dark:border-white/10',
                        'bg-white/50 hover:bg-white/70 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          {isActive ? (
                            <Loader2 className="h-4 w-4 animate-spin text-[#8FA3B8]" />
                          ) : isError ? (
                            <XCircle className="h-4 w-4 text-[#B7A59A]" />
                          ) : (
                            <Check className="h-4 w-4 text-[#9AA79A]" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-foreground truncate">
                              {task.fileName}
                            </div>
                            <div className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                              {isDone ? formatFileSize(task.fileSize) : `${task.progress}%`}
                            </div>
                          </div>

                          <div className="mt-2">
                            <ProgressBar value={task.progress} />
                          </div>

                          {task.error ? (
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {task.error}
                            </div>
                          ) : null}
                        </div>

                        <div className="shrink-0">
                          {isActive ? (
                            <button
                              type="button"
                              className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition-colors"
                              title="Cancel upload"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                cancelUpload(task.id)
                              }}
                            >
                              <X className="h-4 w-4 text-muted-foreground" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          {showEmptyState ? (
            <div className="p-6 text-sm text-black/60 dark:text-foreground/70">
              No notifications yet.
            </div>
          ) : (
            <div>
	              {hasPremium ? (
	                <>
	                  <div className="px-4 pt-4 pb-2">
	                    <div className="flex items-center justify-between">
	                      <div className="text-[11px] font-semibold tracking-wide text-black/60 dark:text-foreground/70">
	                        Premium Broadcasts
	                      </div>
	                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-black/10 dark:border-white/10 text-black/60 dark:text-foreground/70 bg-white/60 dark:bg-white/[0.04]">
	                        Popup
	                      </span>
	                    </div>
	                  </div>
	                  <div className="px-2 pb-3 space-y-1">
	                    {premiumMessages.map((t: PremiumMessage) => {
	                      const expandedKey = `premium:${t.id}`
	                      const isExpanded = expandedId === expandedKey
	                      const contentState = premiumContentById[t.id]
	                      const contentText = t.content_markdown || contentState?.content || ''
	                      const title = t.title || t.message
	                      const imageUrl = (t.image_url || '').trim() || null
	
	                      return (
	                        <div
	                          key={t.id}
	                          className={cn(
	                            'ds-glare-sheen group w-full text-left rounded-2xl px-4 py-3 transition-colors',
	                            isExpanded
	                              ? 'bg-white/70 dark:bg-white/[0.06] shadow-soft-card'
	                              : 'bg-white/40 hover:bg-white/60 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'
	                          )}
	                          role="button"
	                          tabIndex={0}
	                          onClick={(e) => {
	                            e.stopPropagation()
	                            void markPremiumRead(t.id)
	                            setExpandedId((prev) => (prev === expandedKey ? null : expandedKey))
	                          }}
	                          onKeyDown={(e) => {
	                            if (e.key !== 'Enter' && e.key !== ' ') return
	                            e.preventDefault()
	                            void markPremiumRead(t.id)
	                            setExpandedId((prev) => (prev === expandedKey ? null : expandedKey))
	                          }}
	                          aria-expanded={isExpanded}
	                        >
	                          <div className="flex items-start gap-4">
	                            <div className="relative w-3 shrink-0">
	                              <span
	                                className="absolute left-1.5 top-1 bottom-1 w-px bg-black/15 dark:bg-white/20"
	                                aria-hidden
	                              />
	                              {!t.state?.read_at ? (
	                                <span
	                                  className="absolute left-[5px] top-3 h-2 w-2 rounded-full bg-[#111111] dark:bg-white"
	                                  aria-hidden
	                                />
	                              ) : null}
	                            </div>
	
	                            <div className="min-w-0 flex-1">
	                              <div
	                                className={cn(
	                                  'text-sm font-semibold tracking-tight',
	                                  t.state?.read_at
	                                    ? 'text-black/55 dark:text-foreground/70'
	                                    : 'text-[#111111] dark:text-foreground',
	                                  isExpanded ? '' : 'line-clamp-2'
	                                )}
	                              >
	                                {title}
	                              </div>
	                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-black/55 dark:text-foreground/60">
	                                <span className="tabular-nums">{formatTime(t.created_at)}</span>
	                                {t.expires_at ? (
	                                  <span className="tabular-nums">Expires {formatTime(t.expires_at)}</span>
	                                ) : null}
	                              </div>
	
	                              {isExpanded ? (
	                                <div className="mt-3 space-y-2">
	                                  <div className="text-[10px] text-black/45 dark:text-foreground/40 font-mono tabular-nums truncate">
	                                    id: {t.id}
	                                  </div>
	                                  <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.03] px-3 py-3">
	                                    <ScrollArea className="max-h-48 text-xs leading-relaxed">
	                                      <div className="space-y-3 pr-1">
	                                        {imageUrl ? (
	                                          <img
	                                            src={imageUrl}
	                                            alt={title || 'Premium broadcast image'}
	                                            className="max-h-44 w-full rounded-lg object-contain bg-black/[0.03] dark:bg-white/[0.04]"
	                                            loading="lazy"
	                                          />
	                                        ) : null}
	                                        {contentState?.status === 'loading' ? (
	                                          <div className="text-black/60 dark:text-foreground/60">Loading…</div>
	                                        ) : contentState?.status === 'error' ? (
	                                          <div className="text-black/60 dark:text-foreground/60">
	                                            Failed to load content.
	                                          </div>
		                                        ) : (
		                                          <div
		                                            className="text-[#111111] dark:text-foreground"
		                                            style={{
		                                              ['--foreground' as any]: 'currentColor',
		                                              ['--border' as any]: 'rgba(127, 127, 127, 0.28)',
		                                              ['--muted' as any]: 'rgba(127, 127, 127, 0.14)',
		                                              ['--primary' as any]: '#1A1A1A',
		                                            }}
		                                          >
		                                            <MarkdownRenderer content={contentText || ''} />
		                                          </div>
		                                        )}
	                                      </div>
	                                    </ScrollArea>
	                                    {t.state?.dont_remind ? (
	                                      <div className="mt-2 text-[11px] text-black/55 dark:text-foreground/60">
	                                        Won&apos;t remind again
	                                      </div>
	                                    ) : null}
	                                  </div>
	                                </div>
	                              ) : null}
	                            </div>
	
	                            <ChevronDown
	                              className={cn(
	                                'mt-0.5 h-4 w-4 text-black/50 dark:text-foreground/60 transition-transform',
	                                isExpanded ? 'rotate-180' : ''
	                              )}
	                              aria-hidden
	                            />
	                          </div>
	                        </div>
	                      )
	                    })}
	                  </div>
	                </>
	              ) : null}

	              {hasSystem ? (
	                <>
	                  <div className="px-4 pt-4 pb-2">
	                    <div className="text-[11px] font-semibold tracking-wide text-black/60 dark:text-foreground/70">
	                      System
	                    </div>
	                  </div>
	                  <div className="px-2 pb-3 space-y-1">
	                    {sortedSystem.map((t: SystemNotification) => {
	                      const isExpanded = expandedId === t.id
	                      const title = t.title
	                      return (
	                        <div
	                          key={t.id}
	                          className={cn(
	                            'ds-glare-sheen group w-full text-left rounded-2xl px-4 py-3 transition-colors',
	                            isExpanded
	                              ? 'bg-white/70 dark:bg-white/[0.06] shadow-soft-card'
	                              : 'bg-white/40 hover:bg-white/60 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'
	                          )}
	                          role="button"
	                          tabIndex={0}
	                          onMouseEnter={() => {
                            if (!t.read_at) {
                              void markSystemRead([t.id])
                            }
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            void markSystemRead([t.id])
                            setExpandedId((prev) => (prev === t.id ? null : t.id))
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter' && e.key !== ' ') return
                            e.preventDefault()
                            void markSystemRead([t.id])
                            setExpandedId((prev) => (prev === t.id ? null : t.id))
	                          }}
	                          aria-expanded={isExpanded}
	                        >
	                          <div className="flex items-start gap-4">
	                            <div className="relative w-3 shrink-0">
	                              <span
	                                className="absolute left-1.5 top-1 bottom-1 w-px bg-black/15 dark:bg-white/20"
	                                aria-hidden
	                              />
	                              {!t.read_at ? (
	                                <span
	                                  className="absolute left-[5px] top-3 h-2 w-2 rounded-full bg-[#111111] dark:bg-white"
	                                  aria-hidden
	                                />
	                              ) : null}
	                            </div>

	                            <div className="min-w-0 flex-1">
	                              <div className="flex items-start justify-between gap-3">
	                                <div
	                                  className={cn(
	                                    'text-sm font-semibold tracking-tight',
	                                    t.read_at
	                                      ? 'text-black/55 dark:text-foreground/70'
	                                      : 'text-[#111111] dark:text-foreground',
	                                    isExpanded ? '' : 'line-clamp-2'
	                                  )}
	                                >
	                                  {title}
	                                </div>
	                                <div className="shrink-0 flex items-center gap-2">
	                                  <span className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-full border border-black/10 dark:border-white/10 text-black/60 dark:text-foreground/70 bg-white/60 dark:bg-white/[0.04]">
	                                    System
	                                  </span>
	                                  <div className="text-[11px] text-black/55 dark:text-foreground/60 tabular-nums">
	                                    {formatTime(t.created_at)}
	                                  </div>
	                                  <ChevronDown
	                                    className={cn(
	                                      'h-4 w-4 text-black/50 dark:text-foreground/60 transition-transform',
	                                      isExpanded ? 'rotate-180' : ''
	                                    )}
	                                    aria-hidden
	                                  />
	                                </div>
	                              </div>

	                              {t.description ? (
	                                <div
	                                  className={cn(
	                                    'mt-0.5 text-xs text-black/60 dark:text-foreground/70',
	                                    isExpanded ? '' : 'line-clamp-2'
	                                  )}
	                                >
	                                  {t.description}
	                                </div>
	                              ) : null}

	                              {isExpanded ? (
	                                <div className="mt-3 flex items-center justify-between gap-3">
	                                  <div className="text-[10px] text-black/45 dark:text-foreground/40 font-mono tabular-nums truncate">
	                                    id: {t.id}
	                                  </div>
	                                  {t.link ? (
	                                    <button
	                                      type="button"
	                                      className="ds-glare-sheen text-[11px] px-2 py-1 rounded-md border border-black/10 bg-white hover:bg-black/[0.03] dark:bg-white/[0.04] dark:border-white/10 dark:hover:bg-white/[0.07]"
	                                      onClick={(e) => {
	                                        e.preventDefault()
	                                        e.stopPropagation()
	                                        window.location.href = t.link || '#'
	                                      }}
	                                    >
	                                      Open
	                                    </button>
	                                  ) : null}
	                                </div>
	                              ) : null}
	                            </div>
	                          </div>
	                        </div>
	                      )
	                    })}
	                  </div>
                </>
              ) : null}

	              {hasFrontend ? (
	                <>
	                  <div className="px-4 pt-4 pb-2">
	                    <div className="text-[11px] font-semibold tracking-wide text-black/60 dark:text-foreground/70">
	                      Messages
	                    </div>
	                  </div>
	
	                  <div className="px-2 pb-3 space-y-1">
	                    {sorted.map((t: Toast) => {
	                      const isExpanded = expandedId === t.id
	                      const title = t.title
	                      return (
	                        <div
	                          key={t.id}
	                          className={cn(
	                            'ds-glare-sheen group w-full text-left rounded-2xl px-4 py-3 transition-colors',
	                            isExpanded
	                              ? 'bg-white/70 dark:bg-white/[0.06] shadow-soft-card'
	                              : 'bg-white/40 hover:bg-white/60 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'
	                          )}
	                          role="button"
	                          tabIndex={0}
	                          onMouseEnter={() => markToastRead(t.id)}
                          onClick={(e) => {
                            e.stopPropagation()
                            markToastRead(t.id)
                            setExpandedId((prev) => (prev === t.id ? null : t.id))
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter' && e.key !== ' ') return
                            e.preventDefault()
                            markToastRead(t.id)
                            setExpandedId((prev) => (prev === t.id ? null : t.id))
	                          }}
	                          aria-expanded={isExpanded}
	                        >
	                          <div className="flex items-start gap-4">
	                            <div className="relative w-3 shrink-0">
	                              <span
	                                className="absolute left-1.5 top-1 bottom-1 w-px bg-black/15 dark:bg-white/20"
	                                aria-hidden
	                              />
	                              {!t.read ? (
	                                <span
	                                  className="absolute left-[5px] top-3 h-2 w-2 rounded-full bg-[#111111] dark:bg-white"
	                                  aria-hidden
	                                />
	                              ) : null}
	                            </div>
	
	                            <div className="min-w-0 flex-1">
	                              <div className="flex items-start justify-between gap-3">
	                                <div
	                                  className={cn(
	                                    'text-sm font-semibold tracking-tight',
	                                    t.read ? 'text-black/55 dark:text-foreground/70' : 'text-[#111111] dark:text-foreground',
	                                    isExpanded ? '' : 'line-clamp-2'
	                                  )}
	                                >
	                                  {title}
	                                </div>
	                                <div className="shrink-0 flex items-center gap-2">
	                                  <span className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-full border border-black/10 dark:border-white/10 text-black/60 dark:text-foreground/70 bg-white/60 dark:bg-white/[0.04]">
	                                    Frontend
	                                  </span>
	                                  <div className="text-[11px] text-black/55 dark:text-foreground/60 tabular-nums">
	                                    {formatTime(t.createdAt)}
	                                  </div>
	                                  <ChevronDown
	                                    className={cn(
	                                      'h-4 w-4 text-black/50 dark:text-foreground/60 transition-transform',
	                                      isExpanded ? 'rotate-180' : ''
	                                    )}
	                                    aria-hidden
	                                  />
	                                </div>
	                              </div>
	
	                              {t.description ? (
	                                <div
	                                  className={cn(
	                                    'mt-0.5 text-xs text-black/60 dark:text-foreground/70',
	                                    isExpanded ? '' : 'line-clamp-2'
	                                  )}
	                                >
	                                  {t.description}
	                                </div>
	                              ) : null}
	
                              {isExpanded ? (
                                <div className="mt-3 flex items-center justify-between gap-3">
                                  <div className="text-[10px] text-black/45 dark:text-foreground/40 font-mono tabular-nums truncate">
                                    id: {t.id}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {t.action ? (
                                      <button
                                        type="button"
                                        className="ds-glare-sheen text-[11px] px-2 py-1 rounded-md border border-black/10 bg-white hover:bg-black/[0.03] dark:bg-white/[0.04] dark:border-white/10 dark:hover:bg-white/[0.07]"
                                        aria-label={t.action.ariaLabel || t.action.label}
                                        onClick={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          markToastRead(t.id)
                                          t.action?.onClick()
                                        }}
                                      >
                                        {t.action.label}
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      className="ds-glare-sheen text-[11px] px-2 py-1 rounded-md border border-black/10 bg-white hover:bg-black/[0.03] dark:bg-white/[0.04] dark:border-white/10 dark:hover:bg-white/[0.07]"
                                      onClick={(e) => {
                                        e.preventDefault()
	                                        e.stopPropagation()
	                                        removeToast(t.id)
	                                        setExpandedId((prev) => (prev === t.id ? null : prev))
	                                      }}
	                                    >
	                                      Archive
	                                    </button>
	                                  </div>
	                                </div>
	                              ) : null}
	                            </div>
	                          </div>
	                        </div>
	                      )
	                    })}
	                  </div>
                </>
              ) : null}
            </div>
          )}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
