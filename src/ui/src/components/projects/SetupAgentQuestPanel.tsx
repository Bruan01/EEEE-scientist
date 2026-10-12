import * as React from 'react'
import { Sparkles } from 'lucide-react'

import { QuestCopilotDockPanel } from '@/components/workspace/QuestCopilotDockPanel'
import { useQuestWorkspace } from '@/lib/acp'
import type { FeedItem } from '@/types'

function sanitizeSetupAgentVisibleText(value: string) {
  return String(value || '')
    .replace(/```start_setup_patch\s*[\s\S]*?```/gi, '')
    .replace(/```json\s*[\s\S]*?"(?:form_patch|session_patch|preview_plan|launch_readiness)"[\s\S]*?```/gi, '')
    .replace(/^.*(?:结构化启动草案|启动草案|表单草案).*$/gim, '')
    .replace(/我已经先帮你(?:把|整理出)[\s\S]*?(?=\n\s*(?:现在还差|还差|请|如果|$))/g, '')
    .replace(/我已经(?:帮你|先帮你)[\s\S]*?(?=\n\s*(?:现在还差|还差|请|如果|$))/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function sanitizeSetupAgentUserText(value: string) {
  const source = String(value || '')
  const followup = source.match(/<user_followup>\s*([\s\S]*?)\s*<\/user_followup>/i)
  if (followup) {
    return followup[1].trim()
  }
  return source
    .replace(/请基于下面这份“当前启动规划上下文”继续回答。[\s\S]*?(?=<current_start_setup_context>)/g, '')
    .replace(/Continue from the current launch-planning context below\.[\s\S]*?(?=<current_start_setup_context>)/g, '')
    .replace(/<current_start_setup_context>[\s\S]*?<\/current_start_setup_context>/gi, '')
    .replace(/<user_followup>|<\/user_followup>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function sanitizeSetupAgentFeed(feed: FeedItem[]): FeedItem[] {
  return feed.map((item) => {
    if (item.type !== 'message') return item
    const content = item.role === 'assistant'
      ? sanitizeSetupAgentVisibleText(item.content)
      : item.role === 'user'
        ? sanitizeSetupAgentUserText(item.content)
        : item.content
    return content === item.content ? item : { ...item, content }
  })
}

function resolveSetupAgentBadge(args: {
  locale: 'en' | 'zh'
  loading: boolean
  hasLiveRun: boolean
  streaming: boolean
  activeToolCount: number
  runtimeStatus?: string | null
  hasSuggestedForm: boolean
}) {
  const { locale, loading, hasLiveRun, streaming, activeToolCount, runtimeStatus, hasSuggestedForm } = args
  const normalizedStatus = String(runtimeStatus || '').trim().toLowerCase()
  if (loading) return locale === 'zh' ? '加载中' : 'Loading'
  if (hasLiveRun || streaming || activeToolCount > 0 || normalizedStatus === 'running' || normalizedStatus === 'retrying') {
    return locale === 'zh' ? '运行中' : 'Running'
  }
  if (normalizedStatus === 'waiting_for_user' || normalizedStatus === 'waiting' || normalizedStatus === 'paused') {
    return locale === 'zh' ? '等待确认' : 'Waiting'
  }
  if (hasSuggestedForm) {
    return locale === 'zh' ? '可创建' : 'Ready'
  }
  return locale === 'zh' ? '已停驻' : 'Idle'
}

export function SetupAgentQuestPanel({
  questId,
  locale,
  transformSubmitMessage,
  children,
}: {
  questId: string
  locale: 'en' | 'zh'
  transformSubmitMessage?: (message: string) => string
  children?: React.ReactNode
}) {
  const workspace = useQuestWorkspace(questId)
  const sanitizedWorkspace = React.useMemo(
    () => ({ ...workspace, feed: sanitizeSetupAgentFeed(workspace.feed) }),
    [workspace]
  )
  const suggestedForm =
    workspace.snapshot?.startup_contract &&
    typeof workspace.snapshot.startup_contract === 'object' &&
    !Array.isArray(workspace.snapshot.startup_contract) &&
    (workspace.snapshot.startup_contract as Record<string, unknown>).start_setup_session &&
    typeof (workspace.snapshot.startup_contract as Record<string, unknown>).start_setup_session === 'object' &&
    !Array.isArray((workspace.snapshot.startup_contract as Record<string, unknown>).start_setup_session) &&
    ((workspace.snapshot.startup_contract as Record<string, unknown>).start_setup_session as Record<string, unknown>)
      .suggested_form &&
    typeof ((workspace.snapshot.startup_contract as Record<string, unknown>).start_setup_session as Record<string, unknown>)
      .suggested_form === 'object' &&
    !Array.isArray(
      ((workspace.snapshot.startup_contract as Record<string, unknown>).start_setup_session as Record<string, unknown>)
        .suggested_form
    )
      ? (((workspace.snapshot.startup_contract as Record<string, unknown>).start_setup_session as Record<string, unknown>)
          .suggested_form as Record<string, unknown>)
      : null
  const badge = resolveSetupAgentBadge({
    locale,
    loading: workspace.loading,
    hasLiveRun: workspace.hasLiveRun,
    streaming: workspace.streaming,
    activeToolCount: workspace.activeToolCount,
    runtimeStatus: String(workspace.snapshot?.runtime_status || workspace.snapshot?.status || ''),
    hasSuggestedForm: Boolean(suggestedForm && Object.keys(suggestedForm).length > 0),
  })

  return (
    <div className="ai-manus-root ai-manus-copilot ai-manus-embedded flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--border-light)] bg-[var(--background-surface-strong)] shadow-[0_24px_70px_-54px_var(--shadow-M)] backdrop-blur-xl">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-light)] px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">SetupAgent</div>
          <div className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
            {locale === 'zh'
              ? '这个 Agent 可以帮助你更好地建立一个任务表单。你有任务启动配置的问题都可以询问；当表单顺利建立之后，可以点击创建项目启动 DeepScientist。'
              : 'This agent helps you build a better task form. Ask it about launch and configuration questions. Once the form is ready, click Create Project to start DeepScientist.'}
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-light)] bg-[var(--fill-tsp-white-light)] px-3 py-1 text-[11px] text-[var(--text-secondary)]">
          <Sparkles className="h-3.5 w-3.5" />
          {badge}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <QuestCopilotDockPanel
          questId={questId}
          title="SetupAgent"
          workspace={sanitizedWorkspace}
          transformSubmitMessage={transformSubmitMessage}
          beforeFeed={children}
        />
      </div>
    </div>
  )
}

export default SetupAgentQuestPanel
