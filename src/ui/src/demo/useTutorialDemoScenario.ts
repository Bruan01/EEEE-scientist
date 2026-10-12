import * as React from 'react'

import type { FeedItem, QuestSummary } from '@/types'

import { getDemoTimelineState, resetDemoRuntime, useDemoRuntimeTick } from '@/demo/runtime'
import type { TutorialDemoLocale, TutorialDemoScenario } from '@/demo/types'

function buildFallbackStage(): TutorialDemoScenario['stages'][number] {
  return {
    id: 'idle',
    label: { en: 'Idle', zh: '空闲' },
    description: { en: 'No demo scenario is active.', zh: '当前没有激活的 demo 场景。' },
    guideMarkdown: { en: '', zh: '' },
    statusLine: { en: 'No guided workspace is active.', zh: '当前没有激活的引导工作区。' },
    recommendedActions: { en: [], zh: [] },
    visibleNodeIds: [],
    anchor: 'baseline',
    latestMetricValue: 0,
    latestMetricDelta: 0,
    activeToolCount: 0,
    currentNodeId: '',
    graphNodes: [],
    bashExec: {
      cwd: '.',
      command: 'echo no-demo',
      outputLines: ['no demo scenario'],
      status: 'completed',
    },
    feed: [],
    metricCards: [],
    detailFacts: [],
    bestTaskDeltas: [],
    riskTaskDeltas: [],
    connectorSummary: {
      bindingLabel: '',
      targetLabel: '',
      latestStatus: 'idle',
      latestMessage: '',
    },
    chatSuggestions: [],
  }
}

function buildStageReply(locale: TutorialDemoLocale, stageLabel: string) {
  if (locale === 'zh') {
    return `当前工作区位于「${stageLabel}」阶段。你可以继续查看 Canvas、Details、Memory 和 Studio 是如何一起变化的。`
  }
  return `The workspace is currently in the "${stageLabel}" stage. Keep inspecting how Canvas, Details, Memory, and Studio change together.`
}

function sortFeed(items: FeedItem[]) {
  return [...items].sort((left, right) =>
    String(left.createdAt || '').localeCompare(String(right.createdAt || ''))
  )
}

function buildSnapshot(
  scenario: TutorialDemoScenario,
  locale: TutorialDemoLocale,
  stageIndex: number
): QuestSummary {
  const stage = scenario.stages[stageIndex] ?? scenario.stages[0] ?? buildFallbackStage()
  const visibleArtifacts = scenario.stages
    .slice(0, stageIndex + 1)
    .flatMap((item) => item.feed)
    .filter((item): item is Extract<FeedItem, { type: 'artifact' }> => item.type === 'artifact')
    .slice(-6)
    .reverse()
  const displayStatus = stage.id === 'write' ? 'decision' : 'running'
  return {
    ...scenario.snapshotBase,
    active_anchor: stage.anchor,
    status: displayStatus,
    runtime_status: displayStatus,
    display_status: displayStatus,
    updated_at: new Date().toISOString(),
    summary: {
      ...(scenario.snapshotBase.summary || {}),
      status_line: stage.statusLine[locale],
      latest_metric: {
        key: 'maximal_reality_shift_rate',
        value: stage.latestMetricValue,
        delta_vs_baseline: stage.latestMetricDelta,
        label: 'maximal_reality_shift_rate',
        direction: 'minimize',
      },
      latest_bash_session: {
        bash_id: `guide-bash-${stage.id}`,
        command: stage.bashExec.command,
        workdir: stage.bashExec.cwd,
        status: stage.bashExec.status,
        exit_code: stage.bashExec.status === 'completed' ? 0 : null,
      },
    },
    counts: {
      ...(scenario.snapshotBase.counts || {}),
      bash_running_count: stage.activeToolCount,
    },
    recent_artifacts: visibleArtifacts.map((item, index) => ({
      kind: item.kind,
      path:
        item.kind === 'milestone'
          ? 'artifacts/progress/latest_delivery.md'
          : item.kind === 'analysis'
            ? 'memory/knowledge/claim-boundary.md'
            : 'memory/decisions/route-decision.md',
      payload: {
        summary: item.content,
        status: item.status || null,
        artifact_id: `${item.kind}:${index}`,
      },
    })),
    recent_runs:
      stageIndex >= 2
        ? [
            {
              run_id: 'run-pilot',
              skill_id: 'experiment',
              status: stageIndex >= 2 ? 'completed' : 'queued',
              summary: 'Pilot evaluation on the selected idea branch.',
              model: 'gpt-5.4',
              output_path: 'experiments/pilot/run-0c3e/RESULT.json',
              created_at: '2026-03-22T14:28:00Z',
              updated_at: '2026-03-22T14:31:00Z',
            },
            ...(stageIndex >= 3
              ? [
                  {
                    run_id: 'run-3f9c5860',
                    skill_id: 'experiment',
                    status: 'completed',
                    summary: 'Full MANBENCH sweep on the main branch.',
                    model: 'gpt-5.4',
                    output_path: 'experiments/main/run-3f9c5860/RESULT.json',
                    created_at: '2026-03-22T14:50:00Z',
                    updated_at: '2026-03-22T15:06:00Z',
                  },
                ]
              : []),
          ]
        : [],
    pending_decisions:
      stage.id === 'write'
        ? ['Choose whether to deepen analysis or move directly into drafting.']
        : [],
  }
}

export function useTutorialDemoScenario(
  scenario: TutorialDemoScenario,
  locale: TutorialDemoLocale,
  projectId = 'demo-memory'
) {
  const [chatFeed, setChatFeed] = React.useState<FeedItem[]>([])
  const tick = useDemoRuntimeTick(projectId)
  const timeline = React.useMemo(
    () => getDemoTimelineState(projectId, scenario, tick),
    [projectId, scenario, tick]
  )
  const stageIndex = timeline.stageIndex
  const revealedCurrentStageFeedCount = timeline.revealedCurrentStageFeedCount
  const stage = timeline.currentStage
  const autoPlay = scenario.stages.length > 0 && stageIndex < scenario.stages.length - 1

  const scenarioFeed = React.useMemo(
    () =>
      sortFeed([
        ...scenario.stages.slice(0, stageIndex).flatMap((item) => item.feed),
        ...(stage.feed || []).slice(0, revealedCurrentStageFeedCount),
      ]),
    [revealedCurrentStageFeedCount, scenario.stages, stage, stageIndex]
  )

  const feed = React.useMemo(
    () => sortFeed([...scenarioFeed, ...chatFeed]),
    [chatFeed, scenarioFeed]
  )

  const chatMessages = React.useMemo(
    () =>
      [
        ...scenario.openingChat.map((item) => ({
          id: item.id,
          role: item.role,
          content: item.content[locale],
        })),
        ...feed
          .filter((item) => item.type === 'message')
          .map((item) => ({
            id: item.id,
            role: item.role,
            content: item.content,
          })),
      ].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index),
    [feed, locale, scenario.openingChat]
  )

  const snapshot = React.useMemo(
    () => buildSnapshot(scenario, locale, stageIndex),
    [locale, scenario, stageIndex]
  )

  const sendMessage = React.useCallback(
    async (message: string) => {
      const trimmed = message.trim()
      if (!trimmed) return
      const userId = `guide-user-${Date.now()}`
      const assistantId = `guide-assistant-${Date.now() + 1}`
      const now = new Date()
      const replyAt = new Date(now.getTime() + 900)
      setChatFeed((current) =>
        sortFeed([
          ...current,
          {
            id: userId,
            type: 'message',
            role: 'user',
            content: trimmed,
            createdAt: now.toISOString(),
          },
        ])
      )
      window.setTimeout(() => {
        setChatFeed((current) =>
          sortFeed([
            ...current,
            {
              id: assistantId,
              type: 'message',
              role: 'assistant',
              content: buildStageReply(locale, stage.label[locale]),
              createdAt: replyAt.toISOString(),
            },
          ])
        )
      }, 900)
    },
    [locale, stage.label]
  )

  const setAutoPlay = React.useCallback(() => undefined, [])
  const setStageIndex = React.useCallback(() => undefined, [])
  const reset = React.useCallback(() => {
    resetDemoRuntime(projectId)
    setChatFeed([])
  }, [projectId])

  return {
    stage,
    stageIndex,
    totalStages: timeline.totalStages,
    autoPlay,
    setAutoPlay,
    setStageIndex,
    reset,
    feed,
    chatMessages,
    snapshot,
    sendMessage,
  }
}

export default useTutorialDemoScenario
