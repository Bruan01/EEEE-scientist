'use client'

import * as React from 'react'
import { AlertTriangle, CheckCircle2, Circle, Link2, MessageSquare, UserRound } from 'lucide-react'

import { useI18n } from '@/lib/i18n/useI18n'
import { connectorLifecycle } from '@/lib/connectors'
import { cn } from '@/lib/utils'
import type { ConnectorLifecycleStage, ConnectorLifecycleStepStatus, ConnectorSnapshot } from '@/types'

type ConnectorLifecycleStepsProps = {
  snapshot: ConnectorSnapshot
  compact?: boolean
  className?: string
}

const STAGE_ICONS: Record<ConnectorLifecycleStage, React.ComponentType<{ className?: string }>> = {
  account_connected: UserRound,
  session_discovered: MessageSquare,
  project_bound: Link2,
}

type ConnectorLifecycleCopy = {
  [key in ConnectorLifecycleStage]: {
    label: string
    detail: string
  }
} & {
  next: string
  complete: string
  waiting: string
  blocked: string
  notApplicable: string
  actions: Record<'connect_account' | 'discover_session' | 'bind_project' | 'done', string>
}

const STAGE_COPY: Record<'en' | 'zh', ConnectorLifecycleCopy> = {
  en: {
    account_connected: {
      label: 'Account connected',
      detail: 'Credentials are valid and the runtime is online.',
    },
    session_discovered: {
      label: 'Session discovered',
      detail: 'A conversation target is available to select.',
    },
    project_bound: {
      label: 'Project bound',
      detail: 'This connector session is routed to a project.',
    },
    next: 'Next',
    complete: 'Complete',
    waiting: 'Waiting',
    blocked: 'Needs attention',
    notApplicable: 'Local-only connector',
    actions: {
      connect_account: 'Connect or re-authenticate the account.',
      discover_session: 'Send one message from the account to discover a session.',
      bind_project: 'Select a session in this project and save the binding.',
      done: 'No further connector setup is required.',
    },
  },
  zh: {
    account_connected: {
      label: '账号已连接',
      detail: '凭证有效，连接器运行时在线。',
    },
    session_discovered: {
      label: '已发现会话',
      detail: '已经有可供选择的会话目标。',
    },
    project_bound: {
      label: '已绑定项目',
      detail: '该连接器会话已经路由到项目。',
    },
    next: '下一步',
    complete: '已完成',
    waiting: '等待中',
    blocked: '需要处理',
    notApplicable: '仅本地连接器',
    actions: {
      connect_account: '先连接账号或重新完成认证。',
      discover_session: '从该账号发送一条消息，用来发现会话。',
      bind_project: '在当前项目选择会话并保存绑定。',
      done: '连接器配置已经完成。',
    },
  },
}

function stageLabel(stage: ConnectorLifecycleStage | null | undefined, copy: ConnectorLifecycleCopy) {
  return stage ? copy[stage].label : copy.actions.connect_account
}

function statusLabel(status: ConnectorLifecycleStepStatus, copy: ConnectorLifecycleCopy) {
  if (status === 'complete') return copy.complete
  if (status === 'blocked') return copy.blocked
  if (status === 'not_applicable') return copy.notApplicable
  return copy.waiting
}

function statusClass(status: ConnectorLifecycleStepStatus) {
  if (status === 'complete') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (status === 'blocked') return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  if (status === 'current') return 'border-[var(--ds-brand)]/35 bg-[var(--ds-brand)]/10 text-[var(--ds-brand)]'
  if (status === 'not_applicable') return 'border-border/50 bg-muted/30 text-muted-foreground'
  return 'border-border/50 bg-background/30 text-muted-foreground'
}

function StepIcon({ status, stage }: { status: ConnectorLifecycleStepStatus; stage: ConnectorLifecycleStage }) {
  if (status === 'complete') return <CheckCircle2 className="h-4 w-4" />
  if (status === 'blocked') return <AlertTriangle className="h-4 w-4" />
  if (status === 'not_applicable') return <Circle className="h-4 w-4" />
  const Icon = STAGE_ICONS[stage]
  return <Icon className="h-4 w-4" />
}

export function ConnectorLifecycleSteps({ snapshot, compact = false, className }: ConnectorLifecycleStepsProps) {
  const { language } = useI18n('admin')
  const copy = language === 'zh-CN' ? STAGE_COPY.zh : STAGE_COPY.en
  const lifecycle = connectorLifecycle(snapshot)
  const steps = lifecycle.steps || []
  const stepStatus = new Map(steps.map((step) => [step.key, step.status]))
  const stageIndex = Math.max(0, Math.min(3, Number(lifecycle.stage_index || 0)))
  const currentStage = lifecycle.stage || null
  const nextAction = lifecycle.next_action || null
  const nextCopy = nextAction && nextAction in copy.actions ? copy.actions[nextAction as keyof typeof copy.actions] : copy.actions.done

  if (String(snapshot.name || '').trim().toLowerCase() === 'local') return null

  if (compact) {
    const compactStatus = stageIndex === 3 ? 'complete' : stageIndex === 0 ? 'blocked' : 'current'
    return (
      <div className={cn('flex min-w-[180px] items-center gap-2', className)} title={nextCopy}>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium', statusClass(compactStatus))}>
          {stageIndex}/3
        </span>
        <span className="truncate text-xs text-foreground">{stageLabel(currentStage, copy)}</span>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border border-border/50 bg-background/25 px-3 py-3', className)} data-testid={`connector-lifecycle-${snapshot.name}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-foreground">
            {snapshot.name === 'qq' ? 'QQ' : `${String(snapshot.name || '').slice(0, 1).toUpperCase()}${String(snapshot.name || '').slice(1)}`}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">{stageLabel(currentStage, copy)}</div>
        </div>
        <span className={cn('rounded-full border px-2 py-1 text-[10px] font-medium', statusClass(stageIndex === 3 ? 'complete' : stageIndex === 0 ? 'blocked' : 'current'))}>
          {stageIndex}/3
        </span>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {(['account_connected', 'session_discovered', 'project_bound'] as ConnectorLifecycleStage[]).map((stage) => {
          const status = stepStatus.get(stage) || 'pending'
          return (
            <div key={stage} className={cn('min-w-0 rounded-lg border px-2.5 py-2', statusClass(status))}>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                <StepIcon status={status} stage={stage} />
                <span className="truncate">{copy[stage].label}</span>
              </div>
              <div className="mt-1 text-[10px] opacity-80">{statusLabel(status, copy)}</div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 border-t border-dashed border-border/50 pt-2 text-[11px] leading-5 text-muted-foreground">
        <span className="font-medium text-foreground">{copy.next}:</span> {nextCopy}
      </div>
    </div>
  )
}
