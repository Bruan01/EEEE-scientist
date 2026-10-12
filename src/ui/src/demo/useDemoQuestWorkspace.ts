import * as React from 'react'

import type { FeedItem, MemoryCard, QuestDocument, SessionPayload, WorkflowPayload } from '@/types'
import type { QuestConnectionState } from '@/lib/acp'

import type { TutorialDemoLocale, TutorialDemoScenario } from './types'
import { useTutorialDemoScenario } from './useTutorialDemoScenario'

function buildMissingScenario(): TutorialDemoScenario {
  return {
    id: 'missing',
    questId: 'missing',
    title: 'Missing',
    subtitle: { en: '', zh: '' },
    branch: 'main',
    baselineLabel: '',
    projectRoot: '',
    snapshotBase: {
      quest_id: 'missing',
      title: 'Missing',
      status: 'idle',
      active_anchor: 'baseline',
    },
    explorerFiles: [],
    diffs: [],
    memoryEntries: [],
    graphEdges: [],
    stages: [
      {
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
      },
    ],
    openingChat: [],
  }
}

export function useDemoQuestWorkspace(
  projectId: string,
  scenario: TutorialDemoScenario | null,
  locale: TutorialDemoLocale
) {
  const safeScenario = scenario ?? buildMissingScenario()

  const demo = useTutorialDemoScenario(safeScenario, locale, projectId)

  const documents = React.useMemo<QuestDocument[]>(
    () =>
      [
        ...safeScenario.explorerFiles
          .map((file) => ({
            document_id: `demo-doc::${projectId}::${file.id}`,
            title: file.name,
            kind: file.name.endsWith('.md') ? 'markdown' : 'text',
            writable: false,
            path: file.path,
            source_scope: 'quest',
          })),
        ...safeScenario.memoryEntries.map((entry) => ({
          document_id: entry.document_id || `demo-doc::${projectId}::memory`,
          title: entry.title || 'Memory',
          kind: 'markdown',
          writable: false,
          path: entry.path,
          source_scope: 'memory',
        })),
      ],
    [projectId, safeScenario.explorerFiles, safeScenario.memoryEntries]
  )

  const memory = React.useMemo<MemoryCard[]>(
    () =>
      safeScenario.memoryEntries.map((entry, index) => ({
        id: `demo-memory:${projectId}:${index}`,
        document_id: entry.document_id,
        title: entry.title,
        excerpt: entry.excerpt,
        type: entry.type,
        path: entry.path,
        updated_at: entry.updated_at,
        writable: false,
      })),
    [projectId, safeScenario.memoryEntries]
  )

  const workflow = React.useMemo<WorkflowPayload>(
    () => ({
      quest_id: safeScenario.questId,
      quest_root: safeScenario.projectRoot,
      entries: demo.feed.map((item) => {
        if (item.type === 'operation') {
          return {
            id: item.id,
            kind: item.label === 'tool_call' ? 'tool_call' : 'tool_result',
            title: item.toolName || 'tool',
            summary: item.subject || item.content,
            tool_name: item.toolName,
            tool_call_id: item.toolCallId,
            status: item.status,
            created_at: item.createdAt,
            args: item.args,
            output: item.output,
          }
        }
        if (item.type === 'artifact') {
          return {
            id: item.id,
            kind: 'artifact',
            title: item.kind,
            summary: item.content,
            status: item.status,
            created_at: item.createdAt,
          }
        }
        return {
          id: item.id,
          kind: 'thought',
          title: item.type === 'message' ? item.role : 'event',
          summary: item.type === 'message' ? item.content : item.content,
          created_at: item.createdAt,
        }
      }),
      changed_files: [],
    }),
    [demo.feed, safeScenario.projectRoot, safeScenario.questId]
  )

  const snapshot = demo.snapshot
  const slashCommands = [
    { name: 'status', description: 'Summarize the current stage' },
    { name: 'next', description: 'Describe the next likely action' },
  ]

  const session = React.useMemo<SessionPayload>(
    () => ({
      ok: true,
      quest_id: safeScenario.questId,
      snapshot,
      acp_session: {
        session_id: `quest:${safeScenario.questId}`,
        slash_commands: slashCommands,
        meta: {
          quest_root: safeScenario.projectRoot,
          current_workspace_root: `${safeScenario.projectRoot}/.ds/worktrees/${safeScenario.branch}`,
          current_workspace_branch: safeScenario.branch,
          research_head_branch: safeScenario.branch,
          latest_metric: snapshot.summary?.latest_metric,
          pending_decisions: snapshot.pending_decisions || [],
          runtime_status: snapshot.runtime_status,
        },
      },
    }),
    [safeScenario.branch, safeScenario.projectRoot, safeScenario.questId, snapshot]
  )

  const history = React.useMemo<FeedItem[]>(() => demo.feed, [demo.feed])
  const pendingFeed = React.useMemo<FeedItem[]>(() => [], [])
  const connectionState = 'connected' as QuestConnectionState

  return {
    snapshot,
    session,
    memory,
    documents,
    graph: null,
    workflow,
    explorer: null,
    detailsLoading: false,
    detailsReady: true,
    feed: demo.feed,
    history,
    pendingFeed,
    loading: false,
    restoring: false,
    hasOlderHistory: false,
    loadingOlderHistory: false,
    oldestLoadedCursor: null,
    newestLoadedCursor: null,
    historyTruncated: false,
    historyLimit: history.length,
    historyExpanded: true,
    historyLoadingFull: false,
    hasLiveRun: demo.stage.activeToolCount > 0,
    streaming: demo.stage.activeToolCount > 0,
    activeToolCount: demo.stage.activeToolCount,
    connectionState,
    error: null,
    slashCommands,
    activeDocument: null,
    replyTargetId: null,
    setActiveDocument: () => undefined,
    refresh: async () => undefined,
    ensureViewData: async () => undefined,
    loadOlderHistory: async () => undefined,
    loadFullHistory: async () => undefined,
    submit: demo.sendMessage,
    readNow: async () => undefined,
    withdraw: async () => undefined,
    stopRun: async () => undefined,
  }
}

export default useDemoQuestWorkspace
