'use client'

import * as React from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CirclePause,
  CircleStop,
  Clock3,
  Loader2,
  RefreshCw,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'

import { useI18n } from '@/lib/i18n/useI18n'
import { cn } from '@/lib/utils'
import type { QuestSummary } from '@/types'

type RuntimeConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'error'

type RuntimeStatusKind =
  | 'normal'
  | 'running'
  | 'retrying'
  | 'reconnecting'
  | 'loading'
  | 'waiting'
  | 'paused'
  | 'stopped'
  | 'completed'
  | 'error'

type RuntimeStatusTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral'

type RuntimeStatusDescriptor = {
  kind: RuntimeStatusKind
  tone: RuntimeStatusTone
  label: string
  reason: string
  attemptLabel?: string
  icon: LucideIcon
}

type Translate = (
  key: string,
  variables?: Record<string, string | number>,
  fallback?: string
) => string

export type RuntimeStatusBannerProps = {
  snapshot?: QuestSummary | null
  connectionState: RuntimeConnectionState
  error?: string | null
  loading?: boolean
  restoring?: boolean
  stopping?: boolean
  liveRun?: boolean
  streaming?: boolean
  activeToolCount?: number
  className?: string
}

function normalize(value?: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function compactText(value?: unknown, limit = 220) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length <= limit ? text : `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = compactText(value)
    if (text) return text
  }
  return ''
}

function mapRuntimeReason(value: unknown, t: Translate) {
  const raw = compactText(value)
  if (!raw) return ''
  const normalized = raw.toLowerCase()

  if (
    normalized.includes('apply_patch verification failed') ||
    normalized.includes('patch verification failed')
  ) {
    return t(
      'runtime_status_reason_patch_context',
      undefined,
      'The local patch no longer matches the file; the agent will regenerate the patch context.'
    )
  }
  if (
    normalized.includes('503') ||
    normalized.includes('service unavailable') ||
    normalized.includes('at capacity') ||
    normalized.includes('high demand') ||
    normalized.includes('server overloaded') ||
    normalized.includes('429')
  ) {
    return t(
      'runtime_status_reason_upstream_capacity',
      undefined,
      'The upstream model service is temporarily unavailable or at capacity; retry backoff is active.'
    )
  }
  if (
    normalized.includes('connection refused') ||
    normalized.includes('connection reset') ||
    normalized.includes('network error') ||
    normalized.includes('websocket') ||
    normalized.includes('stream disconnected') ||
    normalized.includes('unknownissuer') ||
    normalized.includes('certificate') ||
    normalized.includes('tls') ||
    normalized.includes('dns')
  ) {
    return t(
      'runtime_status_reason_network',
      undefined,
      'The network, VPN/TUN route, or certificate chain is unavailable; the connection will be retried.'
    )
  }
  if (
    normalized.includes('401') ||
    normalized.includes('403') ||
    normalized.includes('unauthorized') ||
    normalized.includes('token expired') ||
    normalized.includes('token revoked') ||
    normalized.includes('authentication') ||
    normalized.includes('login')
  ) {
    return t(
      'runtime_status_reason_auth',
      undefined,
      'The Codex authentication session may have expired; sign in again if retries continue.'
    )
  }
  if (normalized.includes('timeout') || normalized.includes('timed out')) {
    return t(
      'runtime_status_reason_timeout',
      undefined,
      'The request timed out; the runner is waiting before trying again.'
    )
  }
  if (normalized.includes('non_retryable_runner_error')) {
    return t(
      'runtime_status_reason_non_retryable',
      undefined,
      'The previous runner error was marked non-retryable; the workspace is waiting for a new instruction.'
    )
  }
  if (normalized.includes('external_codex_upstream_provider_error')) {
    return t(
      'runtime_status_reason_upstream',
      undefined,
      'The upstream Codex provider returned an error; the runner is waiting for the next recovery step.'
    )
  }
  if (normalized.includes('background_external_progress_active')) {
    return t(
      'runtime_status_reason_external_progress',
      undefined,
      'The workspace is waiting for background external progress.'
    )
  }
  if (normalized === 'copilot_mode' || normalized === 'wait_for_user_or_resume') {
    return t(
      'runtime_status_reason_waiting_input',
      undefined,
      'The workspace is waiting for your next message.'
    )
  }
  return raw
}

function statusLabel(kind: RuntimeStatusKind, t: Translate) {
  const labels: Record<RuntimeStatusKind, string> = {
    normal: t('runtime_status_normal', undefined, 'Normal'),
    running: t('runtime_status_running', undefined, 'Running'),
    retrying: t('runtime_status_retrying', undefined, 'Retrying'),
    reconnecting: t('runtime_status_reconnecting', undefined, 'Reconnecting'),
    loading: t('runtime_status_loading', undefined, 'Restoring'),
    waiting: t('runtime_status_waiting', undefined, 'Waiting'),
    paused: t('runtime_status_paused', undefined, 'Paused'),
    stopped: t('runtime_status_stopped', undefined, 'Stopped'),
    completed: t('runtime_status_completed', undefined, 'Completed'),
    error: t('runtime_status_error', undefined, 'Error'),
  }
  return labels[kind]
}

function connectionLabel(state: RuntimeConnectionState, t: Translate) {
  switch (state) {
    case 'connecting':
      return t('runtime_connection_connecting', undefined, 'Event stream connecting')
    case 'reconnecting':
      return t('runtime_connection_reconnecting', undefined, 'Event stream reconnecting')
    case 'error':
      return t('runtime_connection_error', undefined, 'Event stream unavailable')
    default:
      return t('runtime_connection_connected', undefined, 'Event stream connected')
  }
}

function resolveRuntimeStatus(
  args: RuntimeStatusBannerProps & { t: Translate }
): RuntimeStatusDescriptor {
  const {
    snapshot,
    connectionState,
    error,
    loading,
    restoring,
    stopping,
    liveRun,
    streaming,
    activeToolCount = 0,
    t,
  } = args
  const displayStatus = normalize(snapshot?.display_status)
  const runtimeStatus = normalize(snapshot?.runtime_status || snapshot?.status)
  const waitingStatus = normalize(snapshot?.waiting_notice?.status)
  const retryState = snapshot?.retry_state
  const retryAttempt = Number(retryState?.attempt_index)
  const retryMax = Number(retryState?.max_attempts)
  const hasRetryState = Boolean(retryState && (retryState.last_error || retryState.attempt_index))
  const isRetrying =
    displayStatus === 'retrying' ||
    (hasRetryState && (runtimeStatus === 'running' || Boolean(snapshot?.active_run_id)))
  const isLive =
    typeof liveRun === 'boolean'
      ? Boolean(liveRun || streaming || snapshot?.active_run_id)
      : Boolean(streaming || snapshot?.active_run_id || runtimeStatus === 'running')

  let kind: RuntimeStatusKind
  if (stopping) {
    kind = 'stopped'
  } else if (loading || restoring) {
    kind = 'loading'
  } else if (isRetrying) {
    kind = 'retrying'
  } else if (waitingStatus === 'waiting' && !isLive) {
    kind = 'waiting'
  } else if (connectionState === 'reconnecting' || connectionState === 'connecting') {
    kind = connectionState === 'reconnecting' ? 'reconnecting' : 'loading'
  } else if (connectionState === 'error' || error) {
    kind = 'error'
  } else if (isLive) {
    kind = 'running'
  } else if (displayStatus === 'paused' || runtimeStatus === 'paused') {
    kind = 'paused'
  } else if (displayStatus === 'stopped' || runtimeStatus === 'stopped') {
    kind = 'stopped'
  } else if (displayStatus === 'completed' || runtimeStatus === 'completed') {
    kind = 'completed'
  } else if (displayStatus === 'error' || runtimeStatus === 'error' || runtimeStatus === 'failed') {
    kind = 'error'
  } else {
    kind = 'normal'
  }

  const tone: Record<RuntimeStatusKind, RuntimeStatusTone> = {
    normal: 'success',
    running: 'info',
    retrying: 'warning',
    reconnecting: 'warning',
    loading: 'neutral',
    waiting: 'neutral',
    paused: 'warning',
    stopped: 'neutral',
    completed: 'success',
    error: 'danger',
  }
  const icons: Record<RuntimeStatusKind, LucideIcon> = {
    normal: CheckCircle2,
    running: Loader2,
    retrying: RefreshCw,
    reconnecting: WifiOff,
    loading: Clock3,
    waiting: Clock3,
    paused: CirclePause,
    stopped: CircleStop,
    completed: CheckCircle2,
    error: AlertTriangle,
  }

  const retryReason = mapRuntimeReason(
    firstText(retryState?.last_error, snapshot?.continuation_reason, error),
    t
  )
  const waitingReason = mapRuntimeReason(
    firstText(
      snapshot?.waiting_notice?.message,
      snapshot?.waiting_notice?.reason,
      snapshot?.continuation_reason
    ),
    t
  )
  const errorReason = mapRuntimeReason(firstText(error, retryState?.last_error, snapshot?.stop_reason), t)
  const summaryReason = compactText(snapshot?.summary?.status_line)

  let reason = ''
  switch (kind) {
    case 'retrying':
      reason =
        retryReason ||
        t(
          'runtime_status_reason_retrying',
          undefined,
          'The runner is retrying automatically; no user action is required yet.'
        )
      break
    case 'reconnecting':
      reason =
        mapRuntimeReason(firstText(error, snapshot?.continuation_reason), t) ||
        t('runtime_status_reason_reconnecting', undefined, 'The event stream is reconnecting.')
      break
    case 'loading':
      reason = t('runtime_status_reason_loading', undefined, 'Refreshing the latest runtime state.')
      break
    case 'waiting':
      reason =
        waitingReason ||
        t('runtime_status_reason_waiting', undefined, 'The workspace is waiting for your next instruction.')
      break
    case 'running':
      reason = activeToolCount > 0
        ? t('runtime_status_reason_tools', { count: activeToolCount }, '{count} tools are currently active.')
        : streaming
          ? t('runtime_status_reason_streaming', undefined, 'The assistant is streaming a reply.')
          : t('runtime_status_reason_running', undefined, 'A run is currently active.')
      break
    case 'paused':
      reason =
        mapRuntimeReason(firstText(snapshot?.stop_reason, snapshot?.continuation_reason), t) ||
        t('runtime_status_reason_paused', undefined, 'Automatic execution is paused.')
      break
    case 'stopped':
      reason =
        mapRuntimeReason(firstText(snapshot?.stop_reason, error), t) ||
        t('runtime_status_reason_stopped', undefined, 'No run is currently active.')
      break
    case 'completed':
      reason = t('runtime_status_reason_completed', undefined, 'The latest run completed successfully.')
      break
    case 'error':
      reason = errorReason || t('runtime_status_reason_error', undefined, 'The runtime reported an error.')
      break
    default:
      reason =
        waitingStatus === 'auto_resumed'
          ? waitingReason || t('runtime_status_reason_auto_resumed', undefined, 'Automatic continuation resumed.')
          : snapshot?.workspace_mode === 'copilot' &&
              snapshot?.continuation_policy === 'wait_for_user_or_resume'
            ? t('runtime_status_reason_waiting_input', undefined, 'The workspace is waiting for your next message.')
            : summaryReason || t('runtime_status_reason_normal', undefined, 'The runtime is healthy and ready.')
  }

  const attemptLabel =
    kind === 'retrying' && Number.isFinite(retryAttempt) && retryAttempt > 0
      ? retryMax > 0
        ? t('runtime_status_retry_attempt', { attempt: retryAttempt, max: retryMax }, 'Attempt {attempt}/{max}')
        : t('runtime_status_retry_attempt_unknown_max', { attempt: retryAttempt }, 'Attempt {attempt}')
      : undefined

  return {
    kind,
    tone: tone[kind],
    label: statusLabel(kind, t),
    reason,
    attemptLabel,
    icon: icons[kind],
  }
}

const toneClasses: Record<RuntimeStatusTone, string> = {
  success:
    'border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-900 dark:border-emerald-300/20 dark:bg-emerald-300/[0.08] dark:text-emerald-100',
  info:
    'border-sky-500/25 bg-sky-500/[0.08] text-sky-950 dark:border-sky-300/20 dark:bg-sky-300/[0.08] dark:text-sky-100',
  warning:
    'border-amber-500/30 bg-amber-500/[0.10] text-amber-950 dark:border-amber-300/25 dark:bg-amber-300/[0.10] dark:text-amber-100',
  danger:
    'border-rose-500/30 bg-rose-500/[0.10] text-rose-950 dark:border-rose-300/25 dark:bg-rose-300/[0.10] dark:text-rose-100',
  neutral:
    'border-black/[0.08] bg-black/[0.03] text-foreground dark:border-white/[0.10] dark:bg-white/[0.05]',
}

export function RuntimeStatusBanner({
  snapshot,
  connectionState,
  error,
  loading = false,
  restoring = false,
  stopping = false,
  liveRun,
  streaming = false,
  activeToolCount = 0,
  className,
}: RuntimeStatusBannerProps) {
  const { t } = useI18n('workspace')
  const descriptor = resolveRuntimeStatus({
    snapshot,
    connectionState,
    error,
    loading,
    restoring,
    stopping,
    liveRun,
    streaming,
    activeToolCount,
    t,
  })
  const Icon = descriptor.icon
  const connectionText = connectionLabel(connectionState, t)

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="runtime-status-banner"
      data-runtime-status={descriptor.kind}
      className={cn(
        'rounded-xl border px-3 py-2 text-[12px] shadow-[0_10px_26px_rgba(85,75,65,0.06)]',
        toneClasses[descriptor.tone],
        className
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <Icon className={cn('h-3.5 w-3.5 shrink-0', descriptor.kind === 'running' && 'animate-pulse', descriptor.kind === 'retrying' && 'animate-spin')} />
        <span className="font-semibold">{t('runtime_status_label', undefined, 'Runtime')}</span>
        <span className="font-semibold">{descriptor.label}</span>
        {descriptor.attemptLabel ? (
          <span className="rounded-full bg-black/[0.07] px-1.5 py-0.5 text-[10px] font-medium dark:bg-white/[0.10]">
            {descriptor.attemptLabel}
          </span>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] opacity-70">
          {connectionState === 'connected' ? (
            <Wifi className="h-3 w-3" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          {connectionText}
        </span>
      </div>
      {descriptor.reason ? (
        <div className="mt-1 break-words leading-5 opacity-80">{descriptor.reason}</div>
      ) : null}
    </div>
  )
}

export default RuntimeStatusBanner
