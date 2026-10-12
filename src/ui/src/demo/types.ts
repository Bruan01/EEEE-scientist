import type { FeedItem, MemoryCard, QuestSummary } from '@/types'

export type TutorialDemoLocale = 'en' | 'zh'
export type TutorialDemoCopilotMode = 'studio' | 'chat'

export type TutorialDemoGraphNodeKind =
  | 'baseline'
  | 'idea'
  | 'experiment'
  | 'analysis'
  | 'writing'
  | 'decision'

export type TutorialDemoGraphNodeState = 'done' | 'current' | 'pending' | 'failed'

export type TutorialDemoGraphNode = {
  id: string
  title: string
  subtitle: string
  kind: TutorialDemoGraphNodeKind
  x: number
  y: number
  state: TutorialDemoGraphNodeState
  metric?: string | null
  note?: string | null
  detailMarkdown?: string | null
  relatedFileId?: string | null
  diffId?: string | null
}

export type TutorialDemoGraphEdge = {
  from: string
  to: string
  label?: string | null
}

export type TutorialDemoExplorerFile = {
  id: string
  name: string
  path: string
  group: string
  content: string
}

export type TutorialDemoDiffEntry = {
  id: string
  title: string
  summary: string
  leftLabel: string
  rightLabel: string
  patch: string
}

export type TutorialDemoMemoryEntry = MemoryCard & {
  body: string
}

export type TutorialDemoBashExecSample = {
  cwd: string
  command: string
  outputLines: string[]
  status: 'completed' | 'running'
}

export type TutorialDemoMetricCard = {
  label: string
  value: string
  delta?: string | null
  tone?: 'good' | 'neutral' | 'bad'
}

export type TutorialDemoDetailFact = {
  label: string
  value: string
}

export type TutorialDemoTaskDelta = {
  task: string
  before: string
  after: string
  delta: string
  tone: 'good' | 'neutral' | 'bad'
}

export type TutorialDemoConnectorSummary = {
  bindingLabel: string
  targetLabel: string
  latestStatus: string
  latestMessage: string
}

export type TutorialDemoStage = {
  id: string
  label: Record<TutorialDemoLocale, string>
  description: Record<TutorialDemoLocale, string>
  guideMarkdown: Record<TutorialDemoLocale, string>
  statusLine: Record<TutorialDemoLocale, string>
  recommendedActions: Record<TutorialDemoLocale, string[]>
  visibleNodeIds: string[]
  anchor: string
  latestMetricValue: number
  latestMetricDelta: number
  activeToolCount: number
  currentNodeId: string
  graphNodes: TutorialDemoGraphNode[]
  bashExec: TutorialDemoBashExecSample
  feed: FeedItem[]
  metricCards: TutorialDemoMetricCard[]
  detailFacts: TutorialDemoDetailFact[]
  bestTaskDeltas: TutorialDemoTaskDelta[]
  riskTaskDeltas: TutorialDemoTaskDelta[]
  connectorSummary: TutorialDemoConnectorSummary
  chatSuggestions?: Array<Record<TutorialDemoLocale, string>>
}

export type TutorialDemoScenario = {
  id: string
  questId: string
  title: string
  subtitle: Record<TutorialDemoLocale, string>
  branch: string
  baselineLabel: string
  projectRoot: string
  snapshotBase: QuestSummary
  explorerFiles: TutorialDemoExplorerFile[]
  diffs: TutorialDemoDiffEntry[]
  memoryEntries: TutorialDemoMemoryEntry[]
  graphEdges: TutorialDemoGraphEdge[]
  stages: TutorialDemoStage[]
  openingChat: Array<{
    id: string
    role: 'user' | 'assistant'
    content: Record<TutorialDemoLocale, string>
  }>
}
