'use client'

import * as React from 'react'
import {
  Activity,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Database,
  FileCheck2,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { useI18n } from '@/lib/i18n/useI18n'
import {
  buildRuntimeActivities,
  runtimeActivityLatestStatus,
  runtimeActivityQuestRoot,
  runtimeActivityStatusIsActive,
  type RuntimeActivity,
  type RuntimeActivityLabel,
  type RuntimeActivityStatus,
} from '@/lib/runtimeActivity'
import { cn } from '@/lib/utils'
import type { FeedItem, QuestSummary } from '@/types'

type RuntimeActivityTimelineProps = {
  feed: FeedItem[]
  snapshot?: QuestSummary | null
  limit?: number
  compact?: boolean
  includeGenericTools?: boolean
  defaultCollapsed?: boolean
}

const activityTitleKeys: Record<RuntimeActivityLabel, string> = {
  request_received: 'runtime_activity_request_received',
  run_created: 'runtime_activity_run_created',
  run_completed: 'runtime_activity_run_completed',
  run_failed: 'runtime_activity_run_failed',
  retrying: 'runtime_activity_retrying',
  memory_list: 'runtime_activity_memory_list',
  memory_search: 'runtime_activity_memory_search',
  memory_read: 'runtime_activity_memory_read',
  memory_write: 'runtime_activity_memory_write',
  memory_promote: 'runtime_activity_memory_promote',
  artifact_recorded: 'runtime_activity_artifact_recorded',
  tool_running: 'runtime_activity_tool_running',
  tool_completed: 'runtime_activity_tool_completed',
  tool_failed: 'runtime_activity_tool_failed',
  runtime_event: 'runtime_activity_runtime_event',
}

const activityStatusKeys: Record<RuntimeActivityStatus, string> = {
  queued: 'runtime_activity_status_queued',
  running: 'runtime_status_running',
  completed: 'runtime_status_completed',
  failed: 'runtime_status_error',
  retrying: 'runtime_status_retrying',
}

function formatTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function iconForActivity(activity: RuntimeActivity): LucideIcon {
  if (activity.status === 'failed') return CircleAlert
  if (activity.status === 'retrying') return RefreshCw
  if (activity.status === 'running' || activity.status === 'queued') return Loader2
  if (activity.kind === 'request') return MessageSquareText
  if (activity.kind === 'memory') return Database
  if (activity.kind === 'artifact') return FileCheck2
  if (activity.kind === 'run') return BookOpen
  return Wrench
}

function statusTone(status: RuntimeActivityStatus) {
  switch (status) {
    case 'failed':
      return 'text-rose-600 dark:text-rose-300'
    case 'retrying':
      return 'text-amber-600 dark:text-amber-300'
    case 'running':
    case 'queued':
      return 'text-sky-600 dark:text-sky-300'
    default:
      return 'text-emerald-600 dark:text-emerald-300'
  }
}

function ActivityRow({ activity }: { activity: RuntimeActivity }) {
  const { t } = useI18n('workspace')
  const Icon = iconForActivity(activity)
  const isActive = runtimeActivityStatusIsActive(activity.status)
  const technicalEntries = Object.entries(activity.technical ?? {})

  return (
    <div
      className={cn(
        'min-w-0 rounded-lg border px-2.5 py-2 transition-colors',
        isActive
          ? 'border-sky-500/25 bg-sky-500/[0.06] dark:border-sky-300/20 dark:bg-sky-300/[0.07]'
          : 'border-black/[0.05] bg-white/35 dark:border-white/[0.07] dark:bg-white/[0.025]'
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Icon
          className={cn(
            'mt-0.5 h-3.5 w-3.5 shrink-0',
            statusTone(activity.status),
            isActive && activity.status !== 'retrying' ? 'animate-spin' : ''
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2 text-[11px] leading-4">
            <span className="truncate font-medium text-foreground">
              {t(activityTitleKeys[activity.label])}
            </span>
            <span className={cn('shrink-0 text-[10px]', statusTone(activity.status))}>
              {t(activityStatusKeys[activity.status])}
            </span>
            {activity.createdAt ? (
              <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                {formatTime(activity.createdAt)}
              </span>
            ) : null}
          </div>
          {activity.detail ? (
            <div className="mt-0.5 break-words text-[11px] leading-4 text-muted-foreground [overflow-wrap:anywhere]">
              {activity.detail}
            </div>
          ) : null}
        </div>
      </div>

      {technicalEntries.length > 0 ? (
        <details className="mt-1.5 pl-5 text-[10px] text-muted-foreground">
          <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
            <span className="underline decoration-dotted underline-offset-2">
              {t('runtime_activity_details')}
            </span>
          </summary>
          <div className="mt-1 space-y-0.5 border-l border-black/[0.08] pl-2 dark:border-white/[0.10]">
            {technicalEntries.map(([key, value]) => (
              <div key={key} className="break-words [overflow-wrap:anywhere]">
                <span className="font-medium text-foreground">{key}:</span> {value}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  )
}

export function RuntimeActivityTimeline({
  feed,
  snapshot = null,
  limit = 50,
  compact = false,
  includeGenericTools = true,
  defaultCollapsed = true,
}: RuntimeActivityTimelineProps) {
  const { t } = useI18n('workspace')
  const activities = React.useMemo(
    () =>
      buildRuntimeActivities(feed, {
        questRoot: runtimeActivityQuestRoot(snapshot),
        limit,
        includeGenericTools,
      }),
    [feed, includeGenericTools, limit, snapshot]
  )
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed)
  const activityListId = React.useId()
  const activityViewportRef = React.useRef<HTMLDivElement | null>(null)
  const activityStickToBottomRef = React.useRef(true)

  const handleActivityScroll = React.useCallback(() => {
    const viewport = activityViewportRef.current
    if (!viewport) return
    activityStickToBottomRef.current =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 32
  }, [])

  React.useLayoutEffect(() => {
    const viewport = activityViewportRef.current
    if (!viewport || collapsed) return

    // Opening the panel should always reveal the newest activity. Once the
    // user scrolls up, keep their position while new events arrive.
    if (activityStickToBottomRef.current) {
      viewport.scrollTop = viewport.scrollHeight
    }
  }, [activities.length, collapsed])

  if (activities.length === 0) return null

  const latestStatus = runtimeActivityLatestStatus(activities)
  const currentActivity =
    [...activities].reverse().find((activity) => runtimeActivityStatusIsActive(activity.status)) ||
    activities[activities.length - 1]
  const CollapseIcon = collapsed ? ChevronDown : ChevronUp

  return (
    <section
      aria-label={t('runtime_activity_title')}
      data-runtime-activity="true"
      className={cn(
        'min-w-0 rounded-xl border border-black/[0.07] bg-white/[0.62] p-2.5 shadow-[0_10px_24px_rgba(85,75,65,0.06)] dark:border-white/[0.09] dark:bg-white/[0.035]',
        compact ? 'mx-4 mb-2' : 'mb-2'
      )}
    >
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-2 px-0.5 text-left"
        aria-expanded={!collapsed}
        aria-controls={activityListId}
        aria-label={
          collapsed
            ? t('runtime_activity_expand', undefined, 'Expand runtime activity')
            : t('runtime_activity_collapse', undefined, 'Collapse runtime activity')
        }
        onClick={() => setCollapsed((current) => !current)}
      >
        <Activity className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
          {t('runtime_activity_title')}
        </span>
        <span className="truncate text-[10px] text-muted-foreground">
          {t(activityTitleKeys[currentActivity.label])}
        </span>
        {latestStatus ? (
          <span className={cn('ml-auto shrink-0 text-[10px]', statusTone(latestStatus))}>
            {t(activityStatusKeys[latestStatus])}
          </span>
        ) : null}
        <span className="shrink-0 text-[10px] text-muted-foreground">{activities.length}</span>
        <CollapseIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      {!collapsed ? (
        <div
          id={activityListId}
          ref={activityViewportRef}
          onScroll={handleActivityScroll}
          className="mt-2 max-h-[28rem] space-y-1.5 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]"
          aria-label={t('runtime_activity_list', undefined, 'Runtime activity events')}
        >
          {activities.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

export default RuntimeActivityTimeline
