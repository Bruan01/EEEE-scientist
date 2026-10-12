'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Bot, GitBranch, RefreshCw, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getLabQuest,
  getLabQuestEventPayload,
  getLabQuestNodeTrace,
  getLabQuestSummary,
  type LabQuestSelectionContext,
  type LabAgentInstance,
  type LabOverview,
  type LabQuest,
  type LabTemplate,
} from '@/lib/api/lab'
import { useI18n } from '@/lib/i18n/useI18n'
import { useLabCopilotStore } from '@/lib/stores/lab-copilot'
import { useLabGraphSelectionStore } from '@/lib/stores/lab-graph-selection'
import { cn } from '@/lib/utils'
import {
  formatRelativeTime,
  pickAvatarFrameColor,
  resolveAgentDisplayName,
  resolveAgentLogo,
} from './lab-helpers'
import LabNodeTraceDetail from './LabNodeTraceDetail'
import LabOverviewCanvas from './LabOverviewCanvas'
import LabQuestGraphCanvas from './LabQuestGraphCanvas'
import { LAB_FOCUS_EVENT, type LabFocusPayload } from './lab-focus'
import type { LabProjectStreamState } from './useLabProjectStream'
import {
  LAB_CANVAS_SEMANTIC_TONE_META,
  resolveLabCanvasSelectionSemantic,
} from './lab-semantics'

type LabCanvasStudioProps = {
  projectId: string
  readOnly: boolean
  onRefresh?: () => Promise<void> | void
  onOpenStageSelection?: (selection: LabQuestSelectionContext & { label?: string | null; summary?: string | null }) => void
  cliStatus: 'online' | 'offline' | 'unbound'
  labStream?: LabProjectStreamState | null
  projectName?: string | null
  templates: LabTemplate[]
  agents: LabAgentInstance[]
  quests: LabQuest[]
  overview: LabOverview
  isLoading: {
    agents: boolean
    quests: boolean
    overview: boolean
  }
  lockedQuestId?: string | null
  immersiveLockedQuest?: boolean
}

const formatStateLabel = (value?: string | null) => {
  const normalized = String(value || '')
    .trim()
    .replace(/[_-]+/g, ' ')
  if (!normalized) return 'N/A'
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase())
}

function LabStatusPill({
  children,
  mono = false,
}: {
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full border border-[var(--lab-border)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lab-text-secondary)]',
        mono && 'font-mono normal-case tracking-[0.02em]'
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  )
}

function LabDetailSection({
  title,
  hint,
  actions,
  children,
  first = false,
}: {
  title: string
  hint?: string | null
  actions?: React.ReactNode
  children: React.ReactNode
  first?: boolean
}) {
  return (
    <section
      className={cn(
        'py-5',
        first ? 'pt-0' : 'border-t border-dashed border-[var(--lab-border)]'
      )}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--lab-text-secondary)]">
            {title}
          </div>
          {hint ? (
            <div className="mt-2 text-sm leading-7 text-[var(--lab-text-secondary)]">
              {hint}
            </div>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

function LabOverviewMetric({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  hint?: string | null
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--lab-text-secondary)]">
        <span className="shrink-0">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-2 break-words text-[15px] font-semibold leading-6 text-[var(--lab-text-primary)]">
        {value}
      </div>
      {hint ? (
        <div className="mt-2 break-words text-sm leading-6 text-[var(--lab-text-secondary)]">
          {hint}
        </div>
      ) : null}
    </div>
  )
}

function LabFactRows({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>
}) {
  return (
    <div className="divide-y divide-dashed divide-[var(--lab-border)]">
      {items.map((item) => (
        <div key={item.label} className="grid gap-2 py-3 sm:grid-cols-[130px_minmax(0,1fr)]">
          <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--lab-text-secondary)]">
            {item.label}
          </div>
          <div className="break-words text-sm leading-7 text-[var(--lab-text-primary)]">{item.value}</div>
        </div>
      ))}
    </div>
  )
}

function semanticToneBadgeClass(tone: 'truth' | 'abstraction' | 'runtime' | 'overlay') {
  if (tone === 'truth') {
    return 'border-[rgba(64,113,175,0.24)] bg-[rgba(64,113,175,0.1)] text-[#315c97] dark:text-[#9ec5ff]'
  }
  if (tone === 'runtime') {
    return 'border-[rgba(99,102,241,0.24)] bg-[rgba(99,102,241,0.1)] text-[#4f46e5] dark:text-[#c7d2fe]'
  }
  if (tone === 'overlay') {
    return 'border-[rgba(83,176,174,0.26)] bg-[rgba(83,176,174,0.12)] text-[#0f766e] dark:text-[#8be4db]'
  }
  return 'border-[rgba(148,163,184,0.26)] bg-[rgba(148,163,184,0.12)] text-[var(--lab-text-secondary)]'
}

export default function LabCanvasStudio({
  projectId,
  readOnly,
  onRefresh,
  onOpenStageSelection,
  cliStatus,
  labStream,
  projectName,
  templates,
  agents,
  quests,
  overview,
  isLoading,
  lockedQuestId = null,
  immersiveLockedQuest = false,
}: LabCanvasStudioProps) {
  const { t } = useI18n('lab')
  const queryClient = useQueryClient()
  const setActiveQuest = useLabCopilotStore((state) => state.setActiveQuest)
  const selection = useLabGraphSelectionStore((state) => state.selection)
  const clearGraphSelection = useLabGraphSelectionStore((state) => state.clear)
  const [selectedQuestIdState, setSelectedQuestIdState] = React.useState<string | null>(null)
  const [selectedQuestBranch, setSelectedQuestBranch] = React.useState<string | null>(null)
  const [selectedQuestEventId, setSelectedQuestEventId] = React.useState<string | null>(null)
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(null)
  const selectedQuestId = lockedQuestId ?? selectedQuestIdState

  const templatesById = React.useMemo(
    () => new Map(templates.map((template) => [template.template_id, template])),
    [templates]
  )
  const selectedQuest = React.useMemo(
    () => quests.find((quest) => quest.quest_id === selectedQuestId) ?? null,
    [quests, selectedQuestId]
  )
  const selectedAgent = React.useMemo(
    () => agents.find((agent) => agent.instance_id === selectedAgentId) ?? null,
    [agents, selectedAgentId]
  )
  const piAgentInstance = React.useMemo(() => {
    const piTemplates = templates.filter((template) =>
      ['pi', 'principal-investigator'].includes(String(template.template_key || '').trim().toLowerCase())
    )
    if (piTemplates.length) {
      const fromTemplate =
        agents.find((agent) => piTemplates.some((template) => agent.template_id === template.template_id)) ?? null
      if (fromTemplate) return fromTemplate
    }
    return (
      agents.find((agent) => {
        const agentId = String(agent.agent_id || '').trim().toLowerCase()
        const mention = String(agent.mention_label || '').trim().replace(/^@/, '').toLowerCase()
        return (
          agentId === 'pi' ||
          mention === 'pi' ||
          agentId.endsWith(':pi') ||
          String(agent.template_id || '').trim().toLowerCase().includes('principal')
        )
      }) ?? null
    )
  }, [agents, templates])
  const piTemplate = piAgentInstance?.template_id
    ? templatesById.get(piAgentInstance.template_id) ?? null
    : null
  const piAgent = piAgentInstance
    ? {
        name: resolveAgentDisplayName(piAgentInstance),
        logo: resolveAgentLogo(piAgentInstance, piTemplate),
        frameColor:
          piAgentInstance.avatar_frame_color || pickAvatarFrameColor(piAgentInstance.instance_id, 0),
      }
    : null

  const pendingDecisionCount = React.useMemo(() => {
    const fromGraph = overview.graph_vm?.project?.pendingDecisionCount
    if (typeof fromGraph === 'number') return Math.max(0, fromGraph)
    return quests.reduce((sum, quest) => sum + Math.max(0, Number(quest.pending_question_count ?? 0)), 0)
  }, [overview.graph_vm?.project?.pendingDecisionCount, quests])

  React.useEffect(() => {
    if (lockedQuestId) {
      return
    }
    if (selectedQuestId && !selectedQuest && !isLoading.quests) {
      setSelectedQuestIdState(null)
      setSelectedQuestBranch(null)
      setSelectedQuestEventId(null)
      clearGraphSelection()
    }
  }, [clearGraphSelection, isLoading.quests, lockedQuestId, selectedQuest, selectedQuestId])

  React.useEffect(() => {
    if (!lockedQuestId) return
    setSelectedQuestBranch((current) => current ?? null)
    setSelectedQuestEventId((current) => current ?? null)
    setSelectedAgentId(null)
  }, [lockedQuestId])

  React.useEffect(() => {
    setActiveQuest(selectedQuestId)
  }, [selectedQuestId, setActiveQuest])

  React.useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<LabFocusPayload>).detail
      if (!detail) return
      if (detail.projectId && detail.projectId !== projectId) return

      if (detail.focusType === 'overview' || detail.focusType === 'canvas') {
        if (!lockedQuestId) {
          setSelectedQuestIdState(null)
        }
        setSelectedQuestBranch(null)
        setSelectedQuestEventId(null)
        setSelectedAgentId(null)
        clearGraphSelection()
        return
      }

      if (detail.focusType === 'agent') {
        setSelectedAgentId(detail.focusId ?? null)
        return
      }

      if (
        detail.focusType === 'quest' ||
        detail.focusType === 'quest-branch' ||
        detail.focusType === 'quest-event'
      ) {
        if (lockedQuestId && detail.focusId && detail.focusId !== lockedQuestId) {
          return
        }
        if (!lockedQuestId) {
          setSelectedQuestIdState(detail.focusId ?? null)
        }
        setSelectedQuestBranch(detail.branch ?? null)
        setSelectedQuestEventId(detail.eventId ?? null)
        setSelectedAgentId(null)
        clearGraphSelection()
      }
    }

    window.addEventListener(LAB_FOCUS_EVENT, handler)
    return () => window.removeEventListener(LAB_FOCUS_EVENT, handler)
  }, [clearGraphSelection, lockedQuestId, projectId])

  const selectedQuestDetailQuery = useQuery({
    queryKey: ['lab-quest-detail', projectId, selectedQuestId, 'canvas-studio'],
    queryFn: () => getLabQuest(projectId, selectedQuestId as string),
    enabled: Boolean(projectId && selectedQuestId),
    staleTime: 10000,
  })

  const selectedQuestSummaryQuery = useQuery({
    queryKey: ['lab-quest-summary', projectId, selectedQuestId, selectedQuestEventId ?? null, 'canvas-studio'],
    queryFn: () =>
      getLabQuestSummary(projectId, selectedQuestId as string, {
        atEventId: selectedQuestEventId,
      }),
    enabled: Boolean(projectId && selectedQuestId),
    staleTime: 10000,
  })

  const selectedEventPayloadQuery = useQuery({
    queryKey: [
      'lab-quest-event-payload',
      projectId,
      selectedQuestId,
      selection?.selection_type ?? null,
      selection?.selection_ref ?? null,
      'canvas-studio',
    ],
    queryFn: () =>
      getLabQuestEventPayload(projectId, selectedQuestId as string, selection?.selection_ref as string, {
        maxBytes: 100_000,
      }),
    enabled: Boolean(
      projectId &&
        selectedQuestId &&
        selection?.selection_type === 'event_node' &&
        selection?.selection_ref
    ),
    staleTime: 10000,
  })

  const selectedNodeTraceQuery = useQuery({
    queryKey: [
      'lab-quest-node-trace',
      projectId,
      selectedQuestId,
      selection?.selection_type ?? null,
      selection?.selection_ref ?? null,
      'canvas-studio',
    ],
    queryFn: () =>
      getLabQuestNodeTrace(projectId, selectedQuestId as string, selection?.selection_ref as string, {
        selectionType: selection?.selection_type ?? null,
      }),
    enabled: Boolean(
      projectId &&
        selectedQuestId &&
        selection?.selection_ref &&
        ['branch_node', 'event_node', 'stage_node'].includes(String(selection?.selection_type || ''))
    ),
    staleTime: 10000,
  })

  const selectionSemantic = React.useMemo(
    () =>
      resolveLabCanvasSelectionSemantic({
        selectionType: selection?.selection_type,
        edgeType: selection?.summary ?? selection?.selection_ref ?? null,
        hasActiveProposal: false,
      }),
    [selection?.selection_ref, selection?.selection_type, selection?.summary]
  )

  const handleRefresh = React.useCallback(() => {
    void Promise.resolve(onRefresh?.())
    queryClient.invalidateQueries({ queryKey: ['lab-agents', projectId] })
    queryClient.invalidateQueries({ queryKey: ['lab-quests', projectId] })
    queryClient.invalidateQueries({ queryKey: ['lab-overview', projectId] })
    if (selectedQuestId) {
      queryClient.invalidateQueries({ queryKey: ['lab-quest-detail', projectId, selectedQuestId] })
      queryClient.invalidateQueries({ queryKey: ['lab-quest-summary', projectId, selectedQuestId] })
      queryClient.invalidateQueries({ queryKey: ['lab-quest-graph', projectId, selectedQuestId] })
      queryClient.invalidateQueries({ queryKey: ['lab-quest-node-trace', projectId, selectedQuestId] })
    }
  }, [onRefresh, projectId, queryClient, selectedQuestId])

  const openQuestCanvas = React.useCallback(
    (questId: string, branch?: string | null, eventId?: string | null) => {
      if (lockedQuestId && questId !== lockedQuestId) {
        return
      }
      if (!lockedQuestId) {
        setSelectedQuestIdState(questId)
      }
      setSelectedQuestBranch(branch ?? null)
      setSelectedQuestEventId(eventId ?? null)
      setSelectedAgentId(null)
      clearGraphSelection()
    },
    [clearGraphSelection, lockedQuestId]
  )

  const closeQuestCanvas = React.useCallback(() => {
    if (!lockedQuestId) {
      setSelectedQuestIdState(null)
    }
    setSelectedQuestBranch(null)
    setSelectedQuestEventId(null)
    clearGraphSelection()
  }, [clearGraphSelection, lockedQuestId])

  const renderOverviewDetail = () => (
    <div className="space-y-0">
      {isLoading.quests || isLoading.agents || isLoading.overview ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-[18px]" />
          <Skeleton className="h-20 w-full rounded-[18px]" />
        </div>
      ) : null}
      <LabDetailSection
        first
        title="Overall"
        hint="Select a quest node to enter its canvas. After that, click a branch, event, or stage node to inspect its durable detail state here."
      >
        <div className="flex flex-wrap items-center gap-2">
          <LabStatusPill>Home</LabStatusPill>
          <LabStatusPill>{formatStateLabel(cliStatus)}</LabStatusPill>
          <LabStatusPill>{quests.length} quests</LabStatusPill>
          <LabStatusPill>{agents.length} agents</LabStatusPill>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#4071af]" />
          <div className="text-[22px] font-semibold tracking-[-0.03em] text-[var(--lab-text-primary)]">
            {projectName || t('plugin_home_title', undefined, 'Home')}
          </div>
        </div>
      </LabDetailSection>

      <LabDetailSection
        title="Operational Status"
        hint="Keep this panel focused on high-signal canvas state rather than dashboard clutter."
      >
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <LabOverviewMetric icon={<GitBranch className="h-4 w-4" />} label="Quests" value={quests.length} hint="Durable research repositories tracked in this project." />
          <LabOverviewMetric icon={<Bot className="h-4 w-4" />} label="Agents" value={agents.length} hint="Live agent instances visible to the Lab surface." />
          <LabOverviewMetric icon={<Sparkles className="h-4 w-4" />} label="Pending" value={pendingDecisionCount} hint="User decisions or unresolved blocking items." />
          <LabOverviewMetric icon={<RefreshCw className="h-4 w-4" />} label="CLI" value={formatStateLabel(cliStatus)} hint="Shared runtime binding for this project workspace." />
        </div>
      </LabDetailSection>

      <LabDetailSection
        title="Next Step"
        hint="The Lab plugin is now canvas-first. Explorer handles navigation, center tabs handle content, and this rail only summarizes context."
      >
        <LabFactRows
          items={[
            { label: 'Canvas', value: 'Open a quest node to switch from map view into its research graph.' },
            { label: 'Selection', value: 'Branch, event, and stage nodes expose stable detail summaries here.' },
            { label: 'Explorer', value: 'Changed files now open in center tabs instead of rendering inline in the navigator.' },
          ]}
        />
      </LabDetailSection>

      {selectedAgent ? renderAgentDetail(selectedAgent) : null}
    </div>
  )

  const renderAgentDetail = (agent: LabAgentInstance) => {
    const template = agent.template_id ? templatesById.get(agent.template_id) ?? null : null
    return (
      <LabDetailSection
        title="Agent"
        hint="Current agent focus selected from the overview canvas."
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--lab-border)] bg-[var(--lab-background)]"
            style={{
              boxShadow: `0 0 0 2px ${agent.avatar_frame_color || pickAvatarFrameColor(agent.instance_id)}`,
            }}
          >
            <Bot className="h-4 w-4 text-[var(--lab-text-primary)]" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--lab-text-primary)]">
              {resolveAgentDisplayName(agent)}
            </div>
            <div className="truncate text-xs text-[var(--lab-text-secondary)]">
              {template?.template_key || agent.agent_id}
            </div>
          </div>
        </div>
        <div className="mt-5">
          <LabFactRows
            items={[
              { label: 'Status', value: formatStateLabel(agent.status) },
              { label: 'Quest', value: agent.active_quest_id || 'Unassigned' },
              { label: 'Branch', value: agent.active_quest_branch || 'N/A' },
              { label: 'Stage', value: agent.active_quest_stage_key || 'N/A' },
            ]}
          />
        </div>
      </LabDetailSection>
    )
  }

  const renderQuestDetail = () => {
    if (!selectedQuestId) return null
    const questDetail = selectedQuestDetailQuery.data?.quest ?? selectedQuest
    const questSummary = selectedQuestSummaryQuery.data?.quest ?? null
    const questRuntime = questSummary?.runtime ?? null
    const questGovernance = questSummary?.governance ?? null
    const pushStatus =
      questGovernance?.lastPushStatus ||
      (typeof questDetail?.github_push?.status === 'string' ? questDetail.github_push.status : null) ||
      'N/A'

    if (selectedQuestDetailQuery.isLoading && !questDetail) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-[18px]" />
          <Skeleton className="h-20 w-full rounded-[18px]" />
          <Skeleton className="h-20 w-full rounded-[18px]" />
        </div>
      )
    }

    return (
      <div className="space-y-0">
        <LabDetailSection
          first
          title="Overall"
          hint={questDetail?.description?.trim() || questDetail?.summary?.trim() || 'No quest description yet.'}
        >
          <div className="flex flex-wrap items-center gap-2">
            <LabStatusPill>{formatStateLabel(questDetail?.status)}</LabStatusPill>
            <LabStatusPill>{questSummary?.topology?.headBranch || questDetail?.git_head_branch || 'main'}</LabStatusPill>
            <LabStatusPill mono>{selectedQuestId}</LabStatusPill>
            {selectedQuestBranch ? <LabStatusPill>{selectedQuestBranch}</LabStatusPill> : null}
          </div>
          <div className="mt-4 text-[22px] font-semibold tracking-[-0.03em] text-[var(--lab-text-primary)]">
            {questDetail?.title || selectedQuestId}
          </div>
          <div className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <LabOverviewMetric icon={<GitBranch className="h-4 w-4" />} label="Branches" value={questSummary?.topology?.branchCount ?? 0} hint={`Head ${questSummary?.topology?.headBranch || questDetail?.git_head_branch || 'main'}`} />
            <LabOverviewMetric icon={<Bot className="h-4 w-4" />} label="Running Agents" value={questRuntime?.runningAgents ?? 0} hint="Live agents attached to this quest." />
            <LabOverviewMetric icon={<Sparkles className="h-4 w-4" />} label="Pending Questions" value={Math.max(0, Number(questDetail?.pending_question_count ?? 0))} hint="Open decisions or direct user replies still waiting." />
            <LabOverviewMetric icon={<RefreshCw className="h-4 w-4" />} label="Push Status" value={pushStatus} hint={questDetail?.last_event_at ? `Last event ${formatRelativeTime(questDetail.last_event_at)}` : 'No event timestamp yet.'} />
          </div>
        </LabDetailSection>

        {selection ? (
          <>
            <LabDetailSection
              title="Selection"
              hint={selection.summary || 'No structured summary is attached to this node yet.'}
            >
              <div className="flex flex-wrap items-center gap-2">
                {selectionSemantic ? (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                      semanticToneBadgeClass(selectionSemantic.tone)
                    )}
                  >
                    {t(
                      LAB_CANVAS_SEMANTIC_TONE_META[selectionSemantic.tone].labelKey,
                      undefined,
                      LAB_CANVAS_SEMANTIC_TONE_META[selectionSemantic.tone].labelDefault
                    )}
                  </span>
                ) : null}
                <Badge variant="outline">{formatStateLabel(selection.selection_type)}</Badge>
              </div>
              <div className="mt-4 text-base font-semibold text-[var(--lab-text-primary)]">
                {selection.label || selection.selection_ref}
              </div>
              <div className="mt-5">
                <LabFactRows
                  items={[
                    { label: 'Ref', value: selection.selection_ref },
                    { label: 'Branch No', value: selection.branch_no || 'N/A' },
                    { label: 'Branch', value: selection.branch_name || 'N/A' },
                    { label: 'Parent', value: selection.parent_branch || 'N/A' },
                    { label: 'Foundation', value: selection.foundation_label || 'N/A' },
                    { label: 'Stage', value: selection.stage_key || 'N/A' },
                    { label: 'Worktree', value: selection.worktree_rel_path || 'N/A' },
                    { label: 'Agent', value: selection.agent_instance_id || 'N/A' },
                  ]}
                />
              </div>
            </LabDetailSection>

            <LabDetailSection
              title="Trace"
              hint="Durable actions, artifact payloads, and commit evidence attached to the selected node."
            >
              <LabNodeTraceDetail
                projectId={projectId}
                questId={selectedQuestId}
                trace={selectedNodeTraceQuery.data?.trace ?? null}
                isLoading={selectedNodeTraceQuery.isLoading}
                payloadJson={selectedEventPayloadQuery.data?.payload_json ?? null}
                payloadTruncated={selectedEventPayloadQuery.data?.truncated ?? null}
              />
            </LabDetailSection>
          </>
        ) : (
          <LabDetailSection
            title="Operational Status"
            hint="Quest-level runtime, topology, and governance signals."
          >
            <LabFactRows
              items={[
                { label: 'Head Branch', value: questSummary?.topology?.headBranch || questDetail?.git_head_branch || 'main' },
                { label: 'Pending Questions', value: Math.max(0, Number(questDetail?.pending_question_count ?? 0)) },
                { label: 'Branch Count', value: questSummary?.topology?.branchCount ?? 0 },
                { label: 'Running Agents', value: questRuntime?.runningAgents ?? 0 },
                { label: 'Push Status', value: pushStatus },
                { label: 'Last Event', value: questDetail?.last_event_at ? formatRelativeTime(questDetail.last_event_at) : 'N/A' },
                { label: 'Created', value: questDetail?.created_at ? formatRelativeTime(questDetail.created_at) : 'N/A' },
              ]}
            />
          </LabDetailSection>
        )}
      </div>
    )
  }

  const canvasTitle = selectedQuest
    ? selectedQuest.title || selectedQuest.quest_id
    : projectName || t('plugin_home_title', undefined, 'Home')
  const canvasSubtitle = selectedQuest
    ? lockedQuestId
      ? 'Research canvas'
      : 'Quest canvas'
    : 'Quest map'

  if (lockedQuestId && immersiveLockedQuest && selectedQuestId) {
    return (
      <div className="relative flex h-full min-h-0 w-full flex-1 overflow-hidden">
        <div className="absolute right-4 top-4 z-20">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 rounded-full border-[var(--lab-border)] bg-[rgba(255,255,255,0.94)] px-3 text-[11px] text-[var(--lab-text-primary)] shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur dark:bg-[rgba(28,29,34,0.94)]"
            onClick={handleRefresh}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        <div className="h-full min-h-0 w-full overflow-hidden">
          <LabQuestGraphCanvas
            projectId={projectId}
            questId={selectedQuestId}
            readOnly={readOnly}
            highlightBranch={selectedQuestBranch}
            atEventId={selectedQuestEventId}
            preferredViewMode={selectedQuestEventId ? 'event' : 'branch'}
            activeBranch={selectedQuestBranch}
            onBranchSelect={(branch) => {
              setSelectedQuestBranch(branch)
              setSelectedQuestEventId(null)
            }}
            onEventSelect={(eventId, branchName) => {
              setSelectedQuestEventId(eventId)
              if (branchName) {
                setSelectedQuestBranch(branchName)
              }
            }}
            showFloatingPanels={false}
            minimalChrome
            onStageOpen={onOpenStageSelection}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[var(--lab-border)] bg-[var(--lab-surface)] px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {selectedQuestId && !lockedQuestId ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2"
                onClick={closeQuestCanvas}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : null}
            <div className="truncate text-sm font-semibold text-[var(--lab-text-primary)]">{canvasTitle}</div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--lab-text-secondary)]">
            <span>{canvasSubtitle}</span>
            <span>·</span>
            <span>{quests.length} quests</span>
            <span>·</span>
            <span>{agents.length} agents</span>
            {labStream?.status && labStream.status !== 'idle' ? (
              <>
                <span>·</span>
                <span>stream {labStream.status}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedQuestBranch ? <Badge variant="outline">{selectedQuestBranch}</Badge> : null}
          <Badge variant="outline">{formatStateLabel(cliStatus)}</Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-3"
            onClick={handleRefresh}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-h-0 overflow-hidden rounded-[24px] border border-[var(--lab-border)] bg-[var(--lab-surface)]">
          {selectedQuestId ? (
            <LabQuestGraphCanvas
              projectId={projectId}
              questId={selectedQuestId}
              readOnly={readOnly}
              highlightBranch={selectedQuestBranch}
              atEventId={selectedQuestEventId}
              preferredViewMode={selectedQuestEventId ? 'event' : 'branch'}
              activeBranch={selectedQuestBranch}
              onBranchSelect={(branch) => {
                setSelectedQuestBranch(branch)
                setSelectedQuestEventId(null)
              }}
              onEventSelect={(eventId, branchName) => {
                setSelectedQuestEventId(eventId)
                if (branchName) {
                  setSelectedQuestBranch(branchName)
                }
              }}
              showFloatingPanels={false}
              onStageOpen={onOpenStageSelection}
            />
          ) : (
            <LabOverviewCanvas
              projectId={projectId}
              quests={quests}
              agents={agents}
              templates={templates}
              graphVm={overview.graph_vm ?? null}
              pendingDecisionCount={pendingDecisionCount}
              activeQuestId={selectedQuestId}
              hasPiAgent={Boolean(piAgent)}
              piAgent={piAgent}
              readOnly={readOnly}
              actionPanel={null}
              overviewPanel={null}
              showFloatingPanels={false}
              onOpenCanvas={openQuestCanvas}
              onSelectAgent={(agentId) => {
                setSelectedAgentId(agentId)
              }}
            />
          )}
        </div>

        <aside className="min-h-0 overflow-hidden rounded-[24px] border border-[var(--lab-border)] bg-[var(--lab-surface)]">
          <ScrollArea className="h-full">
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--lab-text-primary)]">Details</div>
                  <div className="mt-1 text-xs text-[var(--lab-text-secondary)]">
                    {selectedQuestId
                      ? 'Selected node and quest context.'
                      : 'Overview context and node guidance.'}
                  </div>
                </div>
                {selectedQuestId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-3"
                    onClick={() => {
                      clearGraphSelection()
                      setSelectedQuestEventId(null)
                    }}
                  >
                    Clear node
                  </Button>
                ) : null}
              </div>

              {selectedQuestId ? renderQuestDetail() : renderOverviewDetail()}
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  )
}
