import type {
  BaselineComparePayload,
  ExplorerNode,
  ExplorerPayload,
  GitBranchesPayload,
  GitComparePayload,
  GitDiffPayload,
  MemoryCard,
  MetricsTimelinePayload,
  OpenDocumentPayload,
  QuestDocument,
  QuestStageField,
  QuestStageHistoryEntry,
  QuestStageViewPayload,
} from '@/types'
import type { FileAPIResponse, FileTreeResponse } from '@/lib/types/file'
import type {
  LabAgentInstance,
  LabListResponse,
  LabMemoryEntry,
  LabMemoryListResponse,
  LabPaper,
  LabQuestEventItem,
  LabQuestEventListResponse,
  LabQuestGraphResponse,
  LabQuestLayoutResponse,
} from '@/lib/api/lab'

import { getDemoTimelineState } from './runtime'
import { resolveDemoProject } from './projects'
import { tutorialDemoScenarios } from './scenarios/quickstart'

const DEMO_FILE_PREFIX = 'demo-file::'
const DEMO_DIR_PREFIX = 'demo-dir::'
const DEMO_DOC_PREFIX = 'demo-doc::'
const DEMO_LAYOUT_STORAGE_KEY = 'ds:demo-lab-layout:v1'
const PRIMARY_METRIC_ID = 'maximal_reality_shift_rate'

type DemoBranchMeta = {
  nodeId: string
  branchName: string
  parentBranch?: string | null
  branchClass: 'main' | 'idea' | 'experiment' | 'analysis' | 'paper'
  nodeKind?: 'baseline_root' | 'branch'
  stageKey: string
  stageTitle: string
  foundationLabel?: string | null
  foundationReason?: string | null
  worktreeRelPath?: string | null
  compareBase?: string | null
  compareHead?: string | null
  scopePaths?: string[]
  relatedFileIds?: string[]
  historyStageId: string
  metricValue?: number | null
  metricDelta?: number | null
  verdict?: string | null
  status?: string | null
}

type DemoCompareSpec = {
  base: string
  head: string
  path: string
  oldPath?: string | null
  status: 'modified' | 'added' | 'deleted' | 'renamed'
  added?: number
  removed?: number
  patch: string
  commitSubject: string
}

function basename(path: string) {
  const normalized = String(path || '').replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1] || normalized
}

function parentPath(path: string) {
  const normalized = String(path || '').replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length <= 1) return null
  return parts.slice(0, -1).join('/')
}

function mimeTypeForPath(path: string) {
  const lower = String(path || '').toLowerCase()
  if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.mdx')) return 'text/markdown'
  if (lower.endsWith('.json')) return 'application/json'
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'text/yaml'
  if (lower.endsWith('.py')) return 'text/x-python'
  if (lower.endsWith('.ts')) return 'text/typescript'
  if (lower.endsWith('.tsx')) return 'text/tsx'
  return 'text/plain'
}

function buildFileId(projectId: string, fileId: string) {
  return `${DEMO_FILE_PREFIX}${projectId}::${fileId}`
}

function buildDirId(projectId: string, path: string) {
  return `${DEMO_DIR_PREFIX}${projectId}::${encodeURIComponent(path)}`
}

function buildDocumentId(projectId: string, fileId: string) {
  return `${DEMO_DOC_PREFIX}${projectId}::${fileId}`
}

function nowIso() {
  return new Date().toISOString()
}

function mapDemoStateToStatus(value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'done') return 'completed'
  if (normalized === 'current') return 'active'
  if (normalized === 'failed') return 'failed'
  return 'pending'
}

function encodeDocumentPath(path: string) {
  return `questpath::${path}`
}

export function isDemoFileId(fileId: string | null | undefined) {
  return String(fileId || '').startsWith(DEMO_FILE_PREFIX)
}

export function isDemoDocumentId(documentId: string | null | undefined) {
  return String(documentId || '').startsWith(DEMO_DOC_PREFIX)
}

export function isDemoQuestPathDocumentId(documentId: string | null | undefined) {
  return String(documentId || '').startsWith('questpath::') || String(documentId || '').startsWith('path::')
}

export function resolveDemoScenario(projectId: string) {
  const project = resolveDemoProject(projectId)
  if (!project) return null
  return tutorialDemoScenarios[project.scenarioId as keyof typeof tutorialDemoScenarios] ?? null
}

function resolveDemoLocalePathTitle(path: string) {
  return basename(path)
}

function getScenarioFileById(projectId: string, fileId: string) {
  const scenario = resolveDemoScenario(projectId)
  if (!scenario) return null
  return scenario.explorerFiles.find((file) => file.id === fileId) ?? null
}

function getScenarioFileByPath(projectId: string, path: string) {
  const scenario = resolveDemoScenario(projectId)
  if (!scenario) return null
  const normalized = String(path || '').replace(/^\/+/, '')
  return scenario.explorerFiles.find((file) => file.path === normalized) ?? null
}

function buildDemoFileRecord(projectId: string, fileId: string, path: string, content: string, name?: string): FileAPIResponse {
  const normalizedPath = String(path || '').replace(/^\/+/, '')
  const parent = parentPath(normalizedPath)
  const timestamp = nowIso()
  return {
    id: buildFileId(projectId, fileId),
    name: name || basename(normalizedPath),
    type: 'file',
    mime_type: mimeTypeForPath(normalizedPath),
    size: content.length,
    parent_id: parent ? buildDirId(projectId, parent) : null,
    path: normalizedPath,
    project_id: projectId,
    created_at: timestamp,
    updated_at: timestamp,
  }
}

function readDemoLayoutMap(): Record<string, Record<string, unknown>> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(DEMO_LAYOUT_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeDemoLayoutMap(payload: Record<string, Record<string, unknown>>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DEMO_LAYOUT_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore layout persistence failures so demo mode keeps working.
  }
}

function getDemoBranchCatalog(projectId: string): DemoBranchMeta[] {
  const ideaBranch = (args: Omit<DemoBranchMeta, 'branchClass' | 'stageKey' | 'historyStageId'>): DemoBranchMeta => ({
    branchClass: 'idea',
    stageKey: 'idea',
    historyStageId: 'idea',
    ...args,
  })
  const experimentBranch = (
    args: Omit<DemoBranchMeta, 'branchClass' | 'stageKey'> & { historyStageId?: string }
  ): DemoBranchMeta => ({
    branchClass: 'experiment',
    stageKey: 'experiment',
    historyStageId: args.historyStageId ?? 'pilot',
    ...args,
  })
  const analysisBranch = (args: Omit<DemoBranchMeta, 'branchClass' | 'stageKey' | 'historyStageId'>): DemoBranchMeta => ({
    branchClass: 'analysis',
    stageKey: 'analysis-campaign',
    historyStageId: 'analysis',
    ...args,
  })
  const paperBranch = (args: Omit<DemoBranchMeta, 'branchClass' | 'stageKey' | 'historyStageId'>): DemoBranchMeta => ({
    branchClass: 'paper',
    stageKey: 'write',
    historyStageId: 'write',
    ...args,
  })

  return [
    {
      nodeId: 'baseline',
      branchName: 'main',
      branchClass: 'main',
      nodeKind: 'baseline_root',
      stageKey: 'baseline',
      stageTitle: 'Confirmed baseline',
      worktreeRelPath: '.',
      scopePaths: ['baselines/local/Mandela-Effect'],
      relatedFileIds: ['brief', 'plan', 'baseline-note', 'metric-contract', 'baseline-result'],
      historyStageId: 'baseline',
      metricValue: 0.5913,
      metricDelta: 0,
      verdict: 'trusted',
      status: 'baseline confirmed',
    },
    ideaBranch({
      nodeId: 'idea-a',
      branchName: 'idea/debate-only-safeguard',
      parentBranch: 'main',
      stageTitle: 'Rejected candidate idea',
      compareBase: 'main',
      compareHead: 'idea/debate-only-safeguard',
      worktreeRelPath: '.ds/worktrees/idea-debate-only-safeguard',
      scopePaths: ['artifacts/idea'],
      relatedFileIds: ['candidates', 'literature-notes'],
      verdict: 'rejected',
      status: 'closed quickly',
    }),
    ideaBranch({
      nodeId: 'idea-b',
      branchName: 'idea/self-knowledge-split',
      parentBranch: 'main',
      stageTitle: 'Partial-gain idea branch',
      compareBase: 'main',
      compareHead: 'idea/self-knowledge-split',
      worktreeRelPath: '.ds/worktrees/idea-self-knowledge-split',
      scopePaths: ['artifacts/idea'],
      relatedFileIds: ['candidates', 'literature-notes'],
      verdict: 'partial',
      status: 'partial gain',
    }),
    ideaBranch({
      nodeId: 'idea-c',
      branchName: 'idea/025-idea-969ae84f',
      parentBranch: 'main',
      stageTitle: 'Selected main idea',
      foundationLabel: 'Baseline-led selection',
      foundationReason: 'The branch best matches the observed failure surface while staying prompt-level and testable.',
      compareBase: 'main',
      compareHead: 'idea/025-idea-969ae84f',
      worktreeRelPath: '.ds/worktrees/idea-025-idea-969ae84f',
      scopePaths: ['artifacts/idea', 'memory/ideas/idea-969ae84f'],
      relatedFileIds: ['selected-idea', 'selection-rationale', 'literature-notes', 'idea'],
      verdict: 'selected',
      status: 'selected for experiment',
    }),
    ideaBranch({
      nodeId: 'idea-d',
      branchName: 'idea/evidence-type-retrieval-gate',
      parentBranch: 'main',
      stageTitle: 'Rigid retrieval gate branch',
      compareBase: 'main',
      compareHead: 'idea/evidence-type-retrieval-gate',
      worktreeRelPath: '.ds/worktrees/idea-evidence-type-retrieval-gate',
      scopePaths: ['artifacts/idea'],
      relatedFileIds: ['candidates', 'literature-notes', 'selected-idea'],
      verdict: 'mixed',
      status: 'useful but too rigid',
    }),
    ideaBranch({
      nodeId: 'idea-e',
      branchName: 'idea/contradiction-trace-buffer',
      parentBranch: 'main',
      stageTitle: 'Interpretability-heavy idea branch',
      compareBase: 'main',
      compareHead: 'idea/contradiction-trace-buffer',
      worktreeRelPath: '.ds/worktrees/idea-contradiction-trace-buffer',
      scopePaths: ['artifacts/idea'],
      relatedFileIds: ['candidates', 'literature-notes'],
      verdict: 'retired',
      status: 'too expensive as primary route',
    }),
    experimentBranch({
      nodeId: 'run-pilot',
      branchName: 'run/ccpm-pilot',
      parentBranch: 'idea/025-idea-969ae84f',
      stageTitle: 'Pilot run',
      compareBase: 'idea/025-idea-969ae84f',
      compareHead: 'run/ccpm-pilot',
      worktreeRelPath: '.ds/worktrees/run-ccpm-pilot',
      scopePaths: ['experiments/pilot/run-0c3e'],
      relatedFileIds: ['pilot-run', 'run-pilot-result', 'pilot-stdout'],
      metricValue: 0.4412,
      metricDelta: -0.1501,
      verdict: 'promising',
      status: 'pilot signal found',
    }),
    experimentBranch({
      nodeId: 'run-ood-scout',
      branchName: 'run/ood-scout',
      parentBranch: 'idea/evidence-type-retrieval-gate',
      stageTitle: 'OOD scout run',
      compareBase: 'idea/evidence-type-retrieval-gate',
      compareHead: 'run/ood-scout',
      worktreeRelPath: '.ds/worktrees/run-ood-scout',
      scopePaths: ['artifacts/reports'],
      relatedFileIds: ['comparison-report', 'analysis-claim-boundary'],
      metricValue: 0.3984,
      metricDelta: -0.1929,
      verdict: 'useful',
      status: 'transfer signal found',
    }),
    experimentBranch({
      nodeId: 'run-latency',
      branchName: 'run/latency-stress',
      parentBranch: 'idea/contradiction-trace-buffer',
      stageTitle: 'Latency stress test',
      compareBase: 'idea/contradiction-trace-buffer',
      compareHead: 'run/latency-stress',
      worktreeRelPath: '.ds/worktrees/run-latency-stress',
      scopePaths: ['artifacts/reports'],
      relatedFileIds: ['ablation-run', 'comparison-report'],
      metricValue: 0.463,
      metricDelta: -0.1283,
      verdict: 'failed',
      status: 'latency cost too high',
    }),
    experimentBranch({
      nodeId: 'run-ablation',
      branchName: 'ablation/write-only-memory',
      parentBranch: 'idea/025-idea-969ae84f',
      stageTitle: 'Failed ablation',
      compareBase: 'idea/025-idea-969ae84f',
      compareHead: 'ablation/write-only-memory',
      worktreeRelPath: '.ds/worktrees/ablation-write-only-memory',
      scopePaths: ['experiments/ablation/run-2f91'],
      relatedFileIds: ['ablation-run', 'run-ablation-result'],
      metricValue: 0.5098,
      metricDelta: -0.0815,
      verdict: 'failed',
      status: 'ablation failed',
    }),
    experimentBranch({
      nodeId: 'run-no-confidence',
      branchName: 'ablation/no-confidence-weighting',
      parentBranch: 'idea/025-idea-969ae84f',
      stageTitle: 'No-confidence ablation',
      compareBase: 'idea/025-idea-969ae84f',
      compareHead: 'ablation/no-confidence-weighting',
      worktreeRelPath: '.ds/worktrees/ablation-no-confidence-weighting',
      scopePaths: ['artifacts/reports'],
      relatedFileIds: ['comparison-report', 'ablation-run', 'run-ablation-result'],
      metricValue: 0.5341,
      metricDelta: -0.0572,
      verdict: 'failed',
      status: 'confidence weighting is necessary',
    }),
    experimentBranch({
      nodeId: 'run-no-source-tags',
      branchName: 'ablation/no-source-tags',
      parentBranch: 'idea/025-idea-969ae84f',
      stageTitle: 'No-source-tags ablation',
      compareBase: 'idea/025-idea-969ae84f',
      compareHead: 'ablation/no-source-tags',
      worktreeRelPath: '.ds/worktrees/ablation-no-source-tags',
      scopePaths: ['artifacts/reports'],
      relatedFileIds: ['comparison-report', 'ablation-run', 'run-ablation-result'],
      metricValue: 0.4877,
      metricDelta: -0.1036,
      verdict: 'weak',
      status: 'source identity still matters',
    }),
    experimentBranch({
      nodeId: 'run-main',
      branchName: 'run/ccpm-full-manbench',
      parentBranch: 'idea/025-idea-969ae84f',
      stageTitle: 'Main experiment',
      compareBase: 'main',
      compareHead: 'run/ccpm-full-manbench',
      worktreeRelPath: '.ds/worktrees/run-ccpm-full-manbench',
      scopePaths: ['experiments/main/run-3f9c5860', 'artifacts/reports'],
      relatedFileIds: ['run', 'result', 'task-breakdown', 'comparison-report'],
      historyStageId: 'main-run',
      metricValue: 0.1905,
      metricDelta: -0.4008,
      verdict: 'good',
      status: 'main result landed',
    }),
    experimentBranch({
      nodeId: 'run-memory-budget',
      branchName: 'run/memory-budget-sweep',
      parentBranch: 'idea/025-idea-969ae84f',
      stageTitle: 'Memory budget sweep',
      compareBase: 'idea/025-idea-969ae84f',
      compareHead: 'run/memory-budget-sweep',
      worktreeRelPath: '.ds/worktrees/run-memory-budget-sweep',
      scopePaths: ['artifacts/reports'],
      relatedFileIds: ['comparison-report', 'task-breakdown', 'result'],
      historyStageId: 'main-run',
      metricValue: 0.2318,
      metricDelta: -0.3595,
      verdict: 'useful',
      status: 'structure beats raw memory scale',
    }),
    analysisBranch({
      nodeId: 'analysis-cluster',
      branchName: 'analysis/error-clusters',
      parentBranch: 'run/ccpm-full-manbench',
      stageTitle: 'Error-cluster analysis',
      compareBase: 'run/ccpm-full-manbench',
      compareHead: 'analysis/error-clusters',
      worktreeRelPath: '.ds/worktrees/analysis-error-clusters',
      scopePaths: ['memory/knowledge', 'artifacts/reports'],
      relatedFileIds: ['error-cluster-map', 'failure-taxonomy', 'comparison-report'],
      metricValue: 0.1905,
      metricDelta: -0.4008,
      verdict: 'active',
      status: 'grouping failure clusters',
    }),
    analysisBranch({
      nodeId: 'analysis-ood',
      branchName: 'analysis/ood-boundary',
      parentBranch: 'run/ccpm-full-manbench',
      stageTitle: 'OOD boundary analysis',
      compareBase: 'run/ccpm-full-manbench',
      compareHead: 'analysis/ood-boundary',
      worktreeRelPath: '.ds/worktrees/analysis-ood-boundary',
      scopePaths: ['memory/knowledge', 'artifacts/reports'],
      relatedFileIds: ['analysis-claim-boundary', 'claim-boundary', 'comparison-report'],
      metricValue: 0.1905,
      metricDelta: -0.4008,
      verdict: 'bounded',
      status: 'narrowing OOD claims',
    }),
    analysisBranch({
      nodeId: 'analysis-boundary',
      branchName: 'analysis/claim-boundary',
      parentBranch: 'run/ccpm-full-manbench',
      stageTitle: 'Claim-boundary analysis',
      compareBase: 'run/ccpm-full-manbench',
      compareHead: 'analysis/claim-boundary',
      worktreeRelPath: '.ds/worktrees/analysis-claim-boundary',
      scopePaths: ['memory/knowledge', 'artifacts/reports'],
      relatedFileIds: ['claim-boundary', 'analysis-claim-boundary', 'error-cluster-map', 'route-decision'],
      metricValue: 0.1905,
      metricDelta: -0.4008,
      verdict: 'active',
      status: 'bounding the claim',
    }),
    paperBranch({
      nodeId: 'write-outline',
      branchName: 'paper/run-65c18082',
      parentBranch: 'run/ccpm-full-manbench',
      stageTitle: 'Paper outline branch',
      compareBase: 'run/ccpm-full-manbench',
      compareHead: 'paper/run-65c18082',
      worktreeRelPath: '.ds/worktrees/paper-run-65c18082',
      scopePaths: ['paper', 'artifacts/reports'],
      relatedFileIds: ['outline', 'intro-draft', 'claim-map', 'comparison-report'],
      metricValue: 0.1905,
      metricDelta: -0.4008,
      verdict: 'ready',
      status: 'outline ready',
    }),
    paperBranch({
      nodeId: 'write-figures',
      branchName: 'paper/figure-story-pass',
      parentBranch: 'analysis/error-clusters',
      stageTitle: 'Figure story pass',
      compareBase: 'analysis/error-clusters',
      compareHead: 'paper/figure-story-pass',
      worktreeRelPath: '.ds/worktrees/paper-figure-story-pass',
      scopePaths: ['paper', 'artifacts/reports'],
      relatedFileIds: ['figure-plan', 'figure-story', 'comparison-report', 'claim-map'],
      metricValue: 0.1905,
      metricDelta: -0.4008,
      verdict: 'ready',
      status: 'figure plan prepared',
    }),
    paperBranch({
      nodeId: 'write-rebuttal',
      branchName: 'paper/rebuttal-scaffold',
      parentBranch: 'decision/route-selection',
      stageTitle: 'Rebuttal scaffold',
      compareBase: 'decision/route-selection',
      compareHead: 'paper/rebuttal-scaffold',
      worktreeRelPath: '.ds/worktrees/paper-rebuttal-scaffold',
      scopePaths: ['paper', 'memory/decisions'],
      relatedFileIds: ['rebuttal-checklist', 'paper-risks', 'route-decision'],
      metricValue: 0.1905,
      metricDelta: -0.4008,
      verdict: 'ready',
      status: 'review-ready scaffold drafted',
    }),
    paperBranch({
      nodeId: 'decision-route',
      branchName: 'decision/route-selection',
      parentBranch: 'paper/run-65c18082',
      stageTitle: 'Route decision',
      compareBase: 'paper/run-65c18082',
      compareHead: 'decision/route-selection',
      worktreeRelPath: '.ds/worktrees/paper-run-65c18082',
      scopePaths: ['paper', 'memory/decisions'],
      relatedFileIds: ['route-decision', 'compute-allocation', 'outline', 'claim-map'],
      metricValue: 0.1905,
      metricDelta: -0.4008,
      verdict: 'pending',
      status: 'waiting for human route choice',
    }),
    paperBranch({
      nodeId: 'decision-figure',
      branchName: 'decision/figure-gate',
      parentBranch: 'paper/figure-story-pass',
      stageTitle: 'Figure gate',
      compareBase: 'paper/figure-story-pass',
      compareHead: 'decision/figure-gate',
      worktreeRelPath: '.ds/worktrees/paper-figure-story-pass',
      scopePaths: ['paper', 'memory/decisions'],
      relatedFileIds: ['figure-plan', 'figure-story', 'claim-map'],
      metricValue: 0.1905,
      metricDelta: -0.4008,
      verdict: 'pending',
      status: 'choose main-paper figures',
    }),
    paperBranch({
      nodeId: 'decision-submit',
      branchName: 'decision/submission-handoff',
      parentBranch: 'paper/rebuttal-scaffold',
      stageTitle: 'Submission handoff',
      compareBase: 'paper/rebuttal-scaffold',
      compareHead: 'decision/submission-handoff',
      worktreeRelPath: '.ds/worktrees/paper-rebuttal-scaffold',
      scopePaths: ['paper', 'memory/decisions'],
      relatedFileIds: ['route-decision', 'outline', 'claim-map', 'connector-thread-note'],
      metricValue: 0.1905,
      metricDelta: -0.4008,
      verdict: 'pending',
      status: 'package claims, figures, and rebuttal evidence',
    }),
  ]
}

function getBranchMetaByNodeId(projectId: string, nodeId: string) {
  return getDemoBranchCatalog(projectId).find((item) => item.nodeId === nodeId) ?? null
}

function getBranchMetaByBranchName(projectId: string, branchName: string | null | undefined) {
  const normalized = String(branchName || '').trim()
  if (!normalized) return null
  return getDemoBranchCatalog(projectId).find((item) => item.branchName === normalized) ?? null
}

function getDemoCompareCatalog(projectId: string): DemoCompareSpec[] {
  return [
    {
      base: 'main',
      head: 'idea/025-idea-969ae84f',
      path: 'artifacts/idea/selected_idea.md',
      oldPath: 'artifacts/idea/candidates.md',
      status: 'modified',
      added: 6,
      removed: 3,
      patch: `--- artifacts/idea/candidates.md
+++ artifacts/idea/selected_idea.md
@@
- Debate-only safeguard
- Reliability Ledger For Speakers
- Counterfactual Challenge Replay
+ Confidence-calibrated provenance memory
+
+ Why this route won:
+ - keeps social learning selective
+ - preserves source identity
+ - avoids blanket refusal
`,
      commitSubject: 'Select confidence-calibrated provenance memory as the main idea',
    },
    {
      base: 'idea/025-idea-969ae84f',
      head: 'run/ccpm-pilot',
      path: 'experiments/pilot/run-0c3e/RESULT.json',
      status: 'modified',
      added: 8,
      removed: 1,
      patch: `--- memory/ideas/idea-969ae84f/idea.md
+++ experiments/pilot/run-0c3e/RESULT.json
@@
- "status": "selected for experiment"
+ "metric": "maximal_reality_shift_rate"
+ "value": 0.4412
+ "baseline": 0.5913
+ "delta_vs_baseline": -0.1501
+ "verdict": "promising pilot signal"
`,
      commitSubject: 'Record pilot result for the selected idea branch',
    },
    {
      base: 'idea/025-idea-969ae84f',
      head: 'ablation/write-only-memory',
      path: 'experiments/ablation/run-2f91/RESULT.json',
      oldPath: 'experiments/pilot/run-0c3e/RESULT.json',
      status: 'modified',
      added: 5,
      removed: 5,
      patch: `--- experiments/pilot/run-0c3e/RESULT.json
+++ experiments/ablation/run-2f91/RESULT.json
@@
- "value": 0.4412
+ "value": 0.5098
@@
- "verdict": "promising pilot signal"
+ "verdict": "memory write alone is not enough; retrieval calibration matters"
`,
      commitSubject: 'Show that removing retrieval calibration erases most of the gain',
    },
    {
      base: 'main',
      head: 'run/ccpm-full-manbench',
      path: 'experiments/main/run-3f9c5860/RESULT.json',
      oldPath: 'baselines/local/Mandela-Effect/output/gpt_oss_120b_full/RESULT.json',
      status: 'modified',
      added: 5,
      removed: 5,
      patch: `--- baselines/local/Mandela-Effect/output/gpt_oss_120b_full/RESULT.json
+++ experiments/main/run-3f9c5860/RESULT.json
@@
- "maximal_reality_shift_rate": 0.5913
+ "maximal_reality_shift_rate": 0.1905
@@
- "verdict": "trusted baseline"
+ "verdict": "major aggregate improvement"
@@
- "next_route": "idea selection"
+ "next_route": "analysis or writing"
`,
      commitSubject: 'Land the full MANBENCH result against the confirmed baseline',
    },
    {
      base: 'run/ccpm-full-manbench',
      head: 'analysis/claim-boundary',
      path: 'memory/knowledge/claim-boundary.md',
      oldPath: 'experiments/main/run-3f9c5860/RUN.md',
      status: 'modified',
      added: 6,
      removed: 2,
      patch: `--- experiments/main/run-3f9c5860/RUN.md
+++ memory/knowledge/claim-boundary.md
@@
- The route clearly beats the baseline and should move forward.
+ The route clearly beats the baseline in aggregate,
+ but the final paper claim must still bound:
+ - causal_judgment
+ - known_unknowns
+ - language_identification
`,
      commitSubject: 'Write the claim boundary back into durable memory',
    },
    {
      base: 'run/ccpm-full-manbench',
      head: 'paper/run-65c18082',
      path: 'paper/outline.md',
      oldPath: 'status.md',
      status: 'modified',
      added: 6,
      removed: 1,
      patch: `--- status.md
+++ paper/outline.md
@@
- Next route: analysis or outline-first writing
+ 1. Failure surface of collaborative truth distortion
+ 2. Confidence-calibrated provenance memory
+ 3. Main MANBENCH result
+ 4. Claim boundary and regression clusters
+ 5. Writing plan and evidence map
`,
      commitSubject: 'Prepare the paper outline from durable experiment evidence',
    },
  ]
}

function findCompareSpec(projectId: string, base: string, head: string) {
  const explicit = getDemoCompareCatalog(projectId).find((item) => item.base === base && item.head === head)
  if (explicit) return explicit
  const branch = getBranchMetaByBranchName(projectId, head)
  if (!branch) return null
  const relatedFile =
    (branch.relatedFileIds || [])
      .map((fileId) => getScenarioFileById(projectId, fileId))
      .find((file): file is NonNullable<typeof file> => Boolean(file)) ?? null
  const parentBranch = getBranchMetaByBranchName(projectId, base)
  const parentFile =
    (parentBranch?.relatedFileIds || [])
      .map((fileId) => getScenarioFileById(projectId, fileId))
      .find((file): file is NonNullable<typeof file> => Boolean(file)) ?? null
  const path = relatedFile?.path || branch.scopePaths?.[0] || `artifacts/${branch.nodeId}.md`
  const oldPath = parentFile?.path || null
  return {
    base,
    head,
    path,
    oldPath,
    status: 'modified',
    added: 4,
    removed: 2,
    patch: `--- ${oldPath || path}
+++ ${path}
@@
- previous branch summary
+ ${branch.stageTitle}
+ ${branch.status || branch.verdict || 'demo branch update'}
+ ${branch.foundationReason || `Synthetic diff for ${branch.branchName}`}
`,
    commitSubject: branch.stageTitle,
  }
}

function buildMetricPayload(value: number, delta: number | null | undefined) {
  return {
    metric_rows: [
      {
        metric_id: PRIMARY_METRIC_ID,
        label: PRIMARY_METRIC_ID,
        numeric_value: value,
        direction: 'lower',
        decimals: 4,
      },
    ],
    baseline_comparisons: {
      items: [
        {
          metric_id: PRIMARY_METRIC_ID,
          label: PRIMARY_METRIC_ID,
          direction: 'lower',
          decimals: 4,
          baseline_value: 0.5913,
          delta: typeof delta === 'number' ? delta : null,
        },
      ],
    },
  }
}

function buildExplorerNodes(projectId: string, tree: FileTreeResponse, scenarioFiles: Array<{ id: string; path: string }>) {
  const grouped = new Map<string | null, FileAPIResponse[]>()
  tree.files.forEach((item) => {
    const key = item.parent_id ?? null
    const current = grouped.get(key) ?? []
    current.push(item)
    grouped.set(key, current)
  })

  const fileIdByPath = new Map(scenarioFiles.map((file) => [file.path, file.id]))

  const visit = (parentId: string | null): ExplorerNode[] =>
    (grouped.get(parentId) ?? [])
      .sort((left, right) => {
        if (left.type !== right.type) return left.type === 'folder' ? -1 : 1
        return String(left.path || left.name).localeCompare(String(right.path || right.name))
      })
      .map((item) => {
        const normalizedPath = item.path || item.name
        const children = item.type === 'folder' ? visit(item.id) : []
        const fileId = fileIdByPath.get(normalizedPath)
        return {
          id: item.id,
          name: item.name,
          path: normalizedPath,
          kind: item.type === 'folder' ? 'directory' : 'file',
          scope: 'quest',
          folder_kind: item.folder_kind,
          document_id: item.type === 'file' && fileId ? buildDocumentId(projectId, fileId) : undefined,
          open_kind: item.mime_type === 'text/markdown' ? 'markdown' : 'text',
          updated_at: item.updated_at,
          size: item.size,
          children,
        }
      })

  return visit(null)
}

function resolveDemoFileDocument(projectId: string, path: string, documentId: string) {
  const file = getScenarioFileByPath(projectId, path)
  if (!file) return null
  return {
    document_id: documentId,
    quest_id: projectId,
    title: file.name,
    path: file.path,
    content: file.content,
    revision: 'demo',
    writable: false,
    kind: file.name.endsWith('.md') ? 'markdown' : 'text',
    scope: 'quest',
    source_scope: 'quest',
    updated_at: nowIso(),
    mime_type: mimeTypeForPath(file.path),
    size_bytes: file.content.length,
  } satisfies OpenDocumentPayload
}

function buildLabMemoryEntry(projectId: string, card: MemoryCard): LabMemoryEntry {
  const path = String(card.path || '').toLowerCase()
  const branchName = path.includes('memory/ideas/')
    ? 'idea/025-idea-969ae84f'
    : path.includes('memory/knowledge/')
      ? 'analysis/claim-boundary'
      : path.includes('memory/decisions/')
        ? 'paper/run-65c18082'
        : 'run/ccpm-pilot'
  const stageKey = path.includes('memory/ideas/')
    ? 'idea'
    : path.includes('memory/knowledge/')
      ? 'analysis-campaign'
      : path.includes('memory/decisions/')
        ? 'write'
        : 'experiment'
  return {
    entry_id: String(card.id || card.document_id || card.path || Math.random()),
    kind: String(card.type || 'memory'),
    title: card.title,
    summary: card.excerpt,
    quest_id: projectId,
    branch_name: branchName,
    stage_key: stageKey,
    source_path: card.path,
    content_md: null,
    created_at: card.updated_at || nowIso(),
    updated_at: card.updated_at || nowIso(),
    occurred_at: card.updated_at || nowIso(),
    authority_level: 'durable',
    review_status: 'accepted',
  }
}

function buildStageHistoryEntries(projectId: string, stageId: string): QuestStageHistoryEntry[] {
  const scenario = resolveDemoScenario(projectId)
  if (!scenario) return []
  const stage = scenario.stages.find((item) => item.id === stageId)
  if (!stage) return []
  return stage.feed.map((item, index) => ({
    id: `${stageId}:${item.id}:${index}`,
    artifact_kind: item.type === 'artifact' ? item.kind : item.type,
    title:
      item.type === 'artifact'
        ? item.kind
        : item.type === 'operation'
          ? item.subject || item.toolName || 'bash_exec'
          : item.role,
    summary:
      item.type === 'artifact'
        ? item.content
        : item.type === 'operation'
          ? item.output || item.args || item.subject || null
          : item.content,
    status: item.type === 'operation' || item.type === 'artifact' ? item.status || null : null,
    created_at: item.createdAt,
  }))
}

function buildStageKeyFiles(projectId: string, branch: DemoBranchMeta) {
  return (branch.relatedFileIds || [])
    .map((fileId) => getScenarioFileById(projectId, fileId))
    .filter((file): file is NonNullable<typeof file> => Boolean(file))
    .map((file) => ({
      id: `${branch.nodeId}:${file.id}`,
      label: file.name,
      description: file.path,
      path: file.path,
      absolute_path: null,
      document_id: encodeDocumentPath(file.path),
      kind: 'file',
      exists: true,
      scope: 'quest',
    }))
}

function buildStageOverview(branch: DemoBranchMeta, statusLine: string, note: string): QuestStageField[] {
  const fields: QuestStageField[] = [
    { id: 'branch', label: 'Branch', value: branch.branchName },
    { id: 'stage', label: 'Stage', value: branch.stageTitle },
    { id: 'status', label: 'Status', value: branch.status || statusLine },
  ]
  if (typeof branch.metricValue === 'number') {
    fields.push({
      id: 'metric',
      label: PRIMARY_METRIC_ID,
      value: branch.metricValue,
      display_value: branch.metricValue.toFixed(4),
      tone: typeof branch.metricDelta === 'number' && branch.metricDelta < 0 ? 'good' : undefined,
    })
  }
  if (typeof branch.metricDelta === 'number') {
    fields.push({
      id: 'delta',
      label: 'Delta vs baseline',
      value: branch.metricDelta,
      display_value: branch.metricDelta.toFixed(4),
      tone: branch.metricDelta < 0 ? 'good' : 'bad',
    })
  }
  fields.push({
    id: 'note',
    label: 'Why it matters',
    value: note,
    display_value: note,
  })
  return fields
}

function buildStageDetails(projectId: string, branch: DemoBranchMeta, stageNote: string) {
  const comparisonReport = getScenarioFileById(projectId, 'comparison-report')
  const selectedIdea = getScenarioFileById(projectId, 'selected-idea')
  const selectionRationale = getScenarioFileById(projectId, 'selection-rationale')
  const outline = getScenarioFileById(projectId, 'outline')
  const introDraft = getScenarioFileById(projectId, 'intro-draft')
  const figurePlan = getScenarioFileById(projectId, 'figure-plan')
  const claimMap = getScenarioFileById(projectId, 'claim-map')
  const routeDecision = getScenarioFileById(projectId, 'route-decision')
  const paperRisks = getScenarioFileById(projectId, 'paper-risks')
  const claimBoundary = getScenarioFileById(projectId, 'claim-boundary')
  const errorClusterMap = getScenarioFileById(projectId, 'error-cluster-map')
  const runMarkdown = getScenarioFileById(projectId, 'run')
  const resultJson = getScenarioFileById(projectId, 'result')

  return {
    branch: {
      idea_title: branch.stageTitle,
      idea_problem: stageNote,
      next_target:
        branch.stageKey === 'baseline'
          ? 'Compare candidate ideas'
          : branch.stageKey === 'idea'
            ? 'Run pilot + ablation'
            : branch.stageKey === 'experiment'
              ? 'Bound the claim or write the outline'
              : branch.stageKey === 'analysis-campaign'
                ? 'Write the bounded claim into the paper branch'
                : 'Choose the next route with a human collaborator',
      decision_reason: stageNote,
      latest_main_experiment:
        typeof branch.metricValue === 'number'
          ? {
              evaluation_summary: {
                [PRIMARY_METRIC_ID]: {
                  value: branch.metricValue,
                  delta_vs_baseline: branch.metricDelta,
                },
              },
            }
          : null,
    },
    idea: {
      idea_markdown: selectedIdea?.content || null,
      literature_files: selectedIdea ? [selectedIdea.path] : [],
      draft_path: selectionRationale?.path || selectedIdea?.path || null,
      draft_markdown: selectionRationale?.content || selectedIdea?.content || null,
    },
    experiment: {
      run_markdown: runMarkdown?.content || null,
      trace_markdown: comparisonReport?.content || null,
      result_payload:
        typeof branch.metricValue === 'number'
          ? {
              metric: PRIMARY_METRIC_ID,
              value: branch.metricValue,
              delta_vs_baseline: branch.metricDelta,
            }
          : null,
      evaluation_summary:
        typeof branch.metricValue === 'number'
          ? {
              [PRIMARY_METRIC_ID]: {
                value: branch.metricValue,
                delta_vs_baseline: branch.metricDelta,
              },
            }
          : null,
      result_json: resultJson?.content || null,
    },
    analysis: {
      summary_markdown: claimBoundary?.content || errorClusterMap?.content || comparisonReport?.content || null,
      trace_markdown: comparisonReport?.content || null,
    },
    paper: {
      drafting: {
        draft_path: introDraft?.path || outline?.path || 'paper/outline.md',
        references_count: 16,
        references_path: 'paper/references.bib',
      },
      outline_candidates: outline ? [{ title: 'Outline v1', document_id: encodeDocumentPath(outline.path) }] : [],
      selected_outline: outline ? { title: 'Outline v1', document_id: encodeDocumentPath(outline.path) } : null,
      build: {
        status: branch.stageKey === 'write' ? 'ready' : 'pending',
        pdf_path: 'paper/build/main.pdf',
        pdf_paths: ['paper/build/main.pdf'],
        latex_root_path: 'paper/latex',
        main_tex_path: 'paper/latex/main.tex',
        compile_report: {
          status: branch.stageKey === 'write' ? 'ready' : 'pending',
        },
        bundle_manifest: {
          status: branch.stageKey === 'write' ? 'ready' : 'pending',
          title: 'Outline-first paper bundle',
          summary: figurePlan?.content || paperRisks?.content || routeDecision?.content || claimMap?.content || stageNote,
        },
      },
    },
  }
}

export function buildDemoFileTree(projectId: string): FileTreeResponse | null {
  const scenario = resolveDemoScenario(projectId)
  if (!scenario) return null
  const createdAt = nowIso()
  const items = new Map<string, FileAPIResponse>()

  const ensureDir = (dirPath: string) => {
    const normalized = String(dirPath || '').trim().replace(/^\/+/, '').replace(/\/+$/, '')
    if (!normalized) return
    const parts = normalized.split('/').filter(Boolean)
    for (let i = 0; i < parts.length; i += 1) {
      const current = parts.slice(0, i + 1).join('/')
      const parent = i === 0 ? null : parts.slice(0, i).join('/')
      const id = buildDirId(projectId, current)
      if (items.has(id)) continue
      items.set(id, {
        id,
        name: parts[i],
        type: 'folder',
        parent_id: parent ? buildDirId(projectId, parent) : null,
        path: current,
        created_at: createdAt,
        updated_at: createdAt,
        project_id: projectId,
      })
    }
  }

  for (const file of scenario.explorerFiles) {
    const normalizedPath = String(file.path || '').replace(/^\/+/, '')
    const parent = parentPath(normalizedPath)
    if (parent) ensureDir(parent)
    items.set(buildFileId(projectId, file.id), {
      id: buildFileId(projectId, file.id),
      name: file.name,
      type: 'file',
      mime_type: mimeTypeForPath(file.path),
      size: file.content.length,
      parent_id: parent ? buildDirId(projectId, parent) : null,
      path: normalizedPath,
      project_id: projectId,
      created_at: createdAt,
      updated_at: createdAt,
    })
  }

  const files = Array.from(items.values()).sort((left, right) => {
    if (left.type !== right.type) return left.type === 'folder' ? -1 : 1
    return String(left.path || left.name).localeCompare(String(right.path || right.name))
  })
  return {
    files,
    total: files.length,
  }
}

export function getDemoFileContent(fileId: string): string | null {
  const raw = String(fileId || '')
  if (!raw.startsWith(DEMO_FILE_PREFIX)) return null
  const [, projectId, localFileId] = raw.split('::')
  const file = getScenarioFileById(projectId, localFileId)
  return file?.content ?? null
}

export function getDemoFile(fileId: string): FileAPIResponse | null {
  const raw = String(fileId || '')
  if (!raw.startsWith(DEMO_FILE_PREFIX)) return null
  const [, projectId, localFileId] = raw.split('::')
  const file = getScenarioFileById(projectId, localFileId)
  if (!file) return null
  return buildDemoFileRecord(projectId, file.id, file.path, file.content, file.name)
}

export function listDemoDocuments(projectId: string): QuestDocument[] | null {
  const scenario = resolveDemoScenario(projectId)
  if (!scenario) return null
  const fileDocs = scenario.explorerFiles.map((file) => ({
    document_id: buildDocumentId(projectId, file.id),
    title: resolveDemoLocalePathTitle(file.path),
    kind: file.name.endsWith('.md') ? 'markdown' : 'text',
    writable: false,
    path: file.path,
    source_scope: 'quest',
  }))
  const memoryDocs = scenario.memoryEntries.map((entry) => ({
    document_id: entry.document_id || buildDocumentId(projectId, entry.title || 'memory'),
    title: entry.title || 'Memory',
    kind: 'markdown',
    writable: false,
    path: entry.path,
    source_scope: 'memory',
  }))
  return [...fileDocs, ...memoryDocs]
}

export function openDemoDocument(projectId: string, documentId: string): OpenDocumentPayload | null {
  const scenario = resolveDemoScenario(projectId)
  if (!scenario) return null

  const memoryEntry = scenario.memoryEntries.find((entry) => entry.document_id === documentId)
  if (memoryEntry) {
    return {
      document_id: documentId,
      quest_id: projectId,
      title: memoryEntry.title || 'Memory',
      path: memoryEntry.path,
      content: memoryEntry.body,
      revision: 'demo',
      writable: false,
      kind: 'markdown',
      scope: 'memory',
      source_scope: 'memory',
      updated_at: memoryEntry.updated_at,
      mime_type: 'text/markdown',
      size_bytes: memoryEntry.body.length,
    }
  }

  const raw = String(documentId || '').trim()
  if (raw.startsWith(DEMO_DOC_PREFIX)) {
    const [, docProjectId, fileId] = raw.split('::')
    if (docProjectId !== projectId) return null
    const file = getScenarioFileById(projectId, fileId)
    if (!file) return null
    return resolveDemoFileDocument(projectId, file.path, documentId)
  }

  if (raw.startsWith('questpath::') || raw.startsWith('path::')) {
    const prefix = raw.startsWith('questpath::') ? 'questpath::' : 'path::'
    const path = raw.slice(prefix.length).trim()
    if (!path) return null
    return resolveDemoFileDocument(projectId, path, documentId)
  }

  return null
}

export function openDemoDocumentAsFileNode(projectId: string, documentId: string) {
  const scenario = resolveDemoScenario(projectId)
  if (!scenario) return null
  const memoryEntry = scenario.memoryEntries.find((entry) => entry.document_id === documentId)
  if (memoryEntry) {
    return {
      id: buildFileId(projectId, `memory-${memoryEntry.document_id}`),
      name: basename(memoryEntry.path || memoryEntry.title || 'memory.md'),
      type: 'file' as const,
      mimeType: 'text/markdown',
      size: memoryEntry.body.length,
      parentId: null,
      path: memoryEntry.path,
      createdAt: memoryEntry.updated_at || nowIso(),
      updatedAt: memoryEntry.updated_at || nowIso(),
    }
  }
  const doc = openDemoDocument(projectId, documentId)
  if (!doc?.path) return null
  const localFile = scenario.explorerFiles.find((file) => file.path === doc.path)
  if (!localFile) return null
  return {
    id: buildFileId(projectId, localFile.id),
    name: localFile.name,
    type: 'file' as const,
    mimeType: mimeTypeForPath(localFile.path),
    size: localFile.content.length,
    parentId: parentPath(localFile.path) ? buildDirId(projectId, parentPath(localFile.path) || '') : null,
    path: localFile.path,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
}

export function listDemoMemory(projectId: string): MemoryCard[] | null {
  const scenario = resolveDemoScenario(projectId)
  if (!scenario) return null
  return scenario.memoryEntries.map((entry, index) => ({
    id: `demo-memory:${projectId}:${index}`,
    document_id: entry.document_id,
    title: entry.title,
    excerpt: entry.excerpt,
    type: entry.type,
    path: entry.path,
    updated_at: entry.updated_at,
    writable: false,
  }))
}

export function getDemoMetricsTimeline(projectId: string): MetricsTimelinePayload | null {
  const scenario = resolveDemoScenario(projectId)
  if (!scenario) return null
  return {
    quest_id: projectId,
    primary_metric_id: PRIMARY_METRIC_ID,
    total_runs: 3,
    baseline_ref: {
      baseline_id: 'mandela-effect-official',
      variant_id: 'gpt-oss-120b-dual-sglang',
    },
    series: [
      {
        metric_id: PRIMARY_METRIC_ID,
        label: PRIMARY_METRIC_ID,
        direction: 'lower',
        decimals: 4,
        baselines: [
          {
            metric_id: PRIMARY_METRIC_ID,
            label: 'confirmed baseline',
            baseline_id: 'mandela-effect-official',
            variant_id: 'gpt-oss-120b-dual-sglang',
            selected: true,
            value: 0.5913,
          },
        ],
        points: [
          {
            seq: 1,
            run_id: 'run-pilot',
            branch: 'run/ccpm-pilot',
            value: 0.4412,
            delta_vs_baseline: -0.1501,
          },
          {
            seq: 2,
            run_id: 'run-ablation',
            branch: 'ablation/write-only-memory',
            value: 0.5098,
            delta_vs_baseline: -0.0815,
          },
          {
            seq: 3,
            run_id: 'run-3f9c5860',
            branch: 'run/ccpm-full-manbench',
            value: 0.1905,
            delta_vs_baseline: -0.4008,
            breakthrough: true,
            breakthrough_level: 'major',
          },
        ],
      },
    ],
  }
}

export function getDemoBaselineCompare(projectId: string): BaselineComparePayload | null {
  const timeline = getDemoMetricsTimeline(projectId)
  if (!timeline) return null
  return {
    quest_id: projectId,
    primary_metric_id: timeline.primary_metric_id,
    total_entries: timeline.series.reduce(
      (max, series) => Math.max(max, (series.baselines || []).length),
      0
    ),
    baseline_ref: timeline.baseline_ref,
    entries:
      timeline.series[0]?.baselines.map((baseline) => ({
        entry_key: `${baseline.baseline_id || 'baseline'}::${baseline.variant_id || 'default'}`,
        baseline_id: baseline.baseline_id,
        variant_id: baseline.variant_id,
        label: baseline.label,
        selected: baseline.selected,
        metric_count: timeline.series.length,
      })) || [],
    series: timeline.series.map((series) => ({
      metric_id: series.metric_id,
      label: series.label,
      direction: series.direction,
      unit: series.unit,
      decimals: series.decimals,
      chart_group: series.chart_group,
      values: (series.baselines || []).map((baseline) => ({
        entry_key: `${baseline.baseline_id || 'baseline'}::${baseline.variant_id || 'default'}`,
        label: baseline.label,
        baseline_id: baseline.baseline_id,
        variant_id: baseline.variant_id,
        selected: baseline.selected,
        value: baseline.value,
        raw_value: baseline.raw_value,
      })),
    })),
  }
}

export function getDemoGitBranches(projectId: string): GitBranchesPayload | null {
  const scenario = resolveDemoScenario(projectId)
  if (!scenario) return null
  const timeline = getDemoTimelineState(projectId, scenario)
  const catalog = getDemoBranchCatalog(projectId)
  const visibleNodeIds = new Set(timeline.currentStage.visibleNodeIds)
  const nodes = catalog
    .filter((entry) => entry.nodeId === 'baseline' || visibleNodeIds.has(entry.nodeId))
    .map((entry) => ({
      ref: entry.branchName,
      label: entry.branchName,
      branch_kind:
        entry.nodeKind === 'baseline_root'
          ? 'quest'
          : entry.branchClass === 'paper'
            ? 'paper'
            : entry.branchClass,
      tier: entry.branchClass === 'main' ? 'major' : 'minor',
      mode: 'ideas',
      parent_ref: entry.parentBranch ?? undefined,
      current: entry.nodeId === timeline.currentStage.currentNodeId,
      research_head: entry.nodeId === timeline.currentStage.currentNodeId,
      latest_metric:
        typeof entry.metricValue === 'number'
          ? {
              key: PRIMARY_METRIC_ID,
              value: entry.metricValue,
              delta_vs_baseline: entry.metricDelta ?? 0,
              label: PRIMARY_METRIC_ID,
              direction: 'minimize',
            }
          : undefined,
    }))
  return {
    quest_id: projectId,
    default_ref: 'main',
    current_ref: getBranchMetaByNodeId(projectId, timeline.currentStage.currentNodeId)?.branchName || 'main',
    active_workspace_ref: getBranchMetaByNodeId(projectId, timeline.currentStage.currentNodeId)?.branchName || 'main',
    research_head_ref: getBranchMetaByNodeId(projectId, timeline.currentStage.currentNodeId)?.branchName || 'main',
    workspace_mode: 'run',
    head: 'demo-head',
    nodes,
    edges: catalog
      .filter((entry) => entry.parentBranch)
      .map((entry) => ({
        from: entry.parentBranch!,
        to: entry.branchName,
        relation: 'branch',
      })),
  }
}

export function getDemoExplorerPayload(projectId: string): ExplorerPayload | null {
  const scenario = resolveDemoScenario(projectId)
  const tree = buildDemoFileTree(projectId)
  if (!scenario || !tree) return null
  const sectionNodes = buildExplorerNodes(projectId, tree, scenario.explorerFiles)
  return {
    quest_id: projectId,
    quest_root: `/demo/${projectId}`,
    view: {
      mode: 'live',
      label: 'Guided workspace',
      read_only: true,
    },
    sections: [
      {
        id: 'workspace',
        title: 'Workspace',
        nodes: sectionNodes,
      },
    ],
  }
}

export function getDemoGitCompare(projectId: string, base: string, head: string): GitComparePayload | null {
  const spec = findCompareSpec(projectId, base, head)
  if (!spec) return null
  return {
    ok: true,
    base,
    head,
    merge_base: base,
    ahead: 1,
    behind: 0,
    commit_count: 1,
    file_count: 1,
    commits: [
      {
        sha: `demo-${base.replace(/[^a-z0-9]/gi, '')}-${head.replace(/[^a-z0-9]/gi, '')}`.slice(0, 40),
        short_sha: 'demo123',
        authored_at: nowIso(),
        author_name: 'DeepScientist',
        subject: spec.commitSubject,
      },
    ],
    files: [
      {
        path: spec.path,
        old_path: spec.oldPath || undefined,
        status: spec.status,
        added: spec.added,
        removed: spec.removed,
      },
    ],
  }
}

export function getDemoGitDiffFile(projectId: string, base: string, head: string, path: string): GitDiffPayload | null {
  const spec = findCompareSpec(projectId, base, head)
  if (!spec || spec.path !== path) return null
  return {
    ok: true,
    base,
    head,
    path,
    old_path: spec.oldPath || undefined,
    status: spec.status,
    added: spec.added,
    removed: spec.removed,
    lines: spec.patch.split('\n'),
    truncated: false,
  }
}

export function getDemoStageView(
  projectId: string,
  payload: {
    selection_ref?: string | null
    selection_type?: string | null
    branch_name?: string | null
    stage_key?: string | null
  }
): QuestStageViewPayload | null {
  const scenario = resolveDemoScenario(projectId)
  if (!scenario) return null
  const branch =
    getBranchMetaByNodeId(projectId, String(payload.selection_ref || '')) ||
    getBranchMetaByBranchName(projectId, payload.branch_name) ||
    getBranchMetaByBranchName(projectId, payload.selection_ref) ||
    getBranchMetaByNodeId(projectId, 'baseline')
  if (!branch) return null
  const finalNode = scenario.stages[scenario.stages.length - 1]?.graphNodes.find((node) => node.id === branch.nodeId) ?? null
  const currentStage = scenario.stages.find((item) => item.id === branch.historyStageId) ?? scenario.stages[0]
  const note = finalNode?.note || currentStage.statusLine.en
  const statusLine = currentStage.statusLine.en
  return {
    quest_id: projectId,
    stage_key: branch.stageKey,
    stage_label: branch.stageTitle,
    selection_ref: payload.selection_ref || branch.nodeId,
    selection_type: payload.selection_type || (branch.nodeKind === 'baseline_root' ? 'baseline_node' : 'stage_node'),
    branch_name: branch.branchName,
    title: finalNode?.title || branch.stageTitle,
    note,
    status: branch.status || statusLine,
    tags: [branch.branchClass, branch.stageKey],
    scope_paths: branch.scopePaths || [],
    compare_base: branch.compareBase || null,
    compare_head: branch.compareHead || null,
    snapshot_revision: branch.compareHead || branch.branchName,
    branch_no: branch.nodeId === 'baseline' ? '0' : null,
    lineage_intent: branch.branchClass,
    parent_branch: branch.parentBranch ?? null,
    foundation_ref: null,
    foundation_reason: branch.foundationReason ?? null,
    foundation_label: branch.foundationLabel ?? null,
    idea_draft_path: branch.stageKey === 'write' ? 'paper/outline.md' : null,
    draft_available: branch.stageKey === 'write',
    subviews: branch.stageKey === 'write' ? ['overview', 'details', 'draft'] : ['overview', 'details'],
    sections: {
      overview: buildStageOverview(branch, statusLine, note),
      key_facts: [
        { id: 'branch', label: 'Branch', value: branch.branchName },
        { id: 'workspace', label: 'Workspace', value: branch.worktreeRelPath || '.' },
        { id: 'stage', label: 'Stage', value: branch.stageTitle },
      ],
      key_files: buildStageKeyFiles(projectId, branch),
      history: buildStageHistoryEntries(projectId, branch.historyStageId),
    },
    details: buildStageDetails(projectId, branch, note),
  }
}

export function getDemoLabQuestGraph(projectId: string, params?: { view?: 'branch' | 'event' | 'stage' }) {
  const scenario = resolveDemoScenario(projectId)
  if (!scenario) return null
  const view = params?.view ?? 'branch'
  const timeline = getDemoTimelineState(projectId, scenario)
  const currentStage = timeline.currentStage
  const layoutStore = readDemoLayoutMap()
  const visibleNodeIds = new Set(timeline.currentStage.visibleNodeIds)
  const catalogMap = new Map(getDemoBranchCatalog(projectId).map((item) => [item.nodeId, item]))
  const nodes = timeline.currentStage.graphNodes
    .filter((node) => visibleNodeIds.has(node.id))
    .map((node) => {
      const meta = catalogMap.get(node.id)
      const metricPayload =
        meta && typeof meta.metricValue === 'number'
          ? buildMetricPayload(meta.metricValue, meta.metricDelta)
          : null
      return {
        node_id: node.id,
        branch_name: meta?.branchName || node.id,
        parent_branch: meta?.parentBranch ?? null,
        branch_no: meta?.nodeKind === 'baseline_root' ? '0' : null,
        idea_title: node.title,
        idea_problem: node.note || null,
        foundation_label: meta?.foundationLabel ?? null,
        foundation_reason: meta?.foundationReason ?? null,
        latest_result: metricPayload,
        metrics_json:
          meta && typeof meta.metricValue === 'number'
            ? {
                [PRIMARY_METRIC_ID]: meta.metricValue,
              }
            : null,
        branch_class: meta?.branchClass === 'experiment' ? 'idea' : meta?.branchClass || 'idea',
        node_kind: meta?.nodeKind || 'branch',
        worktree_rel_path: meta?.worktreeRelPath ?? null,
        status: mapDemoStateToStatus(node.state),
        verdict: meta?.verdict || null,
        created_at: nowIso(),
        stage_key: meta?.stageKey || 'idea',
        stage_title: meta?.stageTitle || node.title,
        event_ids: [`event:${node.id}`],
        event_count: 1,
        baseline_state: meta?.nodeKind === 'baseline_root' ? 'confirmed' : null,
        writer_state: meta?.stageKey === 'write' ? 'ready' : null,
        target_label: node.title,
        scope_paths: meta?.scopePaths || [],
        compare_base: meta?.compareBase || null,
        compare_head: meta?.compareHead || null,
        node_summary: {
          last_event_type: meta?.stageKey || 'stage',
          last_reply: node.note || currentStage.statusLine.en,
          last_error: node.state === 'failed' ? node.note || 'This branch was retired after a failed check.' : null,
          metrics_delta:
            meta && typeof meta.metricDelta === 'number'
              ? {
                  [PRIMARY_METRIC_ID]: meta.metricDelta,
                }
              : null,
          latest_metrics:
            meta && typeof meta.metricValue === 'number'
              ? {
                  [PRIMARY_METRIC_ID]: meta.metricValue,
                }
              : null,
          trend_preview:
            meta?.nodeId === 'run-main'
              ? [
                  { ts: '2026-03-22T14:55:00Z', value: 0.4412 },
                  { ts: '2026-03-22T15:02:00Z', value: 0.2811 },
                  { ts: '2026-03-22T15:06:00Z', value: 0.1905 },
                ]
              : null,
          claim_verdict: meta?.verdict === 'good' ? 'support' : null,
          go_decision: meta?.nodeId === 'run-main' ? 'go' : null,
        },
      }
    })
  const edges = scenario.graphEdges
    .filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to))
    .map((edge) => ({
      edge_id: `${edge.from}->${edge.to}`,
      source: edge.from,
      target: edge.to,
      edge_type: edge.label || 'branch',
    }))
  const fallbackLayout = Object.fromEntries(
    timeline.currentStage.graphNodes
      .filter((node) => visibleNodeIds.has(node.id))
      .map((node) => [node.id, { x: node.x, y: node.y }])
  )
  const storedLayout = (layoutStore[projectId]?.branch as Record<string, unknown> | undefined) ?? null
  return {
    view,
    nodes,
    edges,
    head_branch: getBranchMetaByNodeId(projectId, currentStage.currentNodeId)?.branchName || 'main',
    layout_json: {
      branch: storedLayout && typeof storedLayout === 'object' ? storedLayout : fallbackLayout,
      preferences: {
        nodeDisplayMode: 'summary',
      },
    },
    metric_catalog: [
      {
        key: PRIMARY_METRIC_ID,
        label: PRIMARY_METRIC_ID,
        direction: 'lower',
        importance: 1,
      },
    ],
    overlay_actions: [],
  } satisfies LabQuestGraphResponse
}

export function listDemoLabQuestEvents(projectId: string, params?: { limit?: number }): LabQuestEventListResponse | null {
  const scenario = resolveDemoScenario(projectId)
  if (!scenario) return null
  const timeline = getDemoTimelineState(projectId, scenario)
  const items: LabQuestEventItem[] = []
  scenario.stages.forEach((stage, stageIndex) => {
    const revealAll = stageIndex < timeline.stageIndex
    const revealCount = revealAll ? stage.feed.length : stage.id === timeline.currentStage.id ? timeline.revealedCurrentStageFeedCount : 0
    stage.feed.slice(0, revealCount).forEach((item, index) => {
      const branch = getBranchMetaByNodeId(projectId, stage.currentNodeId)
      items.push({
        event_id: `${stage.id}:${item.id}:${index}`,
        event_type:
          item.type === 'artifact'
            ? 'artifact.recorded'
            : item.type === 'operation'
              ? item.label === 'tool_call'
                ? 'runner.tool_call'
                : 'runner.tool_result'
              : 'conversation.message',
        branch_name: branch?.branchName || 'main',
        stage_key: branch?.stageKey || stage.anchor,
        payload_summary:
          item.type === 'artifact'
            ? item.content
            : item.type === 'operation'
              ? item.subject || item.output || item.args || null
              : item.content,
        reply_to_pi: item.type === 'message' ? item.content : null,
        created_at: item.createdAt,
        payload_json:
          item.type === 'operation'
            ? {
                args: item.args || null,
                output: item.output || null,
                subject: item.subject || null,
              }
            : item.type === 'artifact'
              ? {
                  kind: item.kind,
                  content: item.content,
                  status: item.status || null,
                }
              : {
                  role: item.role,
                  content: item.content,
                },
      })
    })
  })
  return {
    items: items
      .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))
      .slice(0, Math.max(1, params?.limit ?? 80)),
    next_cursor: null,
    has_more: false,
  }
}

export function listDemoLabMemory(projectId: string): LabMemoryListResponse | null {
  const cards = listDemoMemory(projectId)
  if (!cards) return null
  return {
    items: cards.map((card) => buildLabMemoryEntry(projectId, card)),
  }
}

export function listDemoLabAgents(projectId: string): LabListResponse<LabAgentInstance> | null {
  const scenario = resolveDemoScenario(projectId)
  if (!scenario) return null
  return {
    items: [
      {
        instance_id: `${projectId}:pi`,
        agent_id: 'principal-investigator',
        mention_label: '@pi',
        display_name: 'DeepScientist PI',
        template_id: 'principal-investigator',
        status: 'online',
        active_quest_id: projectId,
        active_quest_branch: getBranchMetaByNodeId(projectId, getDemoTimelineState(projectId, scenario).currentStage.currentNodeId)?.branchName || 'main',
        active_quest_stage_key: getBranchMetaByNodeId(projectId, getDemoTimelineState(projectId, scenario).currentStage.currentNodeId)?.stageKey || 'baseline',
        direct_session_id: `quest:${projectId}`,
        created_at: nowIso(),
        status_updated_at: nowIso(),
      },
    ],
  }
}

export function listDemoLabPapers(projectId: string): LabListResponse<LabPaper> | null {
  if (!resolveDemoScenario(projectId)) return null
  return {
    items: [
      {
        paper_root_id: `${projectId}:paper-root`,
        quest_id: projectId,
        title: 'Confidence-Calibrated Provenance Memory',
        status: 'drafting',
        folder_name: 'paper',
        root_path: 'paper',
        latest_version: {
          paper_version_id: `${projectId}:paper-v1`,
          version_index: 1,
          status: 'ready',
          created_at: nowIso(),
          main_tex_path: 'paper/latex/main.tex',
          main_tex_file_id: buildFileId(projectId, 'outline'),
        },
      },
    ],
  }
}

export function getDemoLabLayout(projectId: string): LabQuestLayoutResponse | null {
  const layout = readDemoLayoutMap()[projectId]
  return {
    layout_json: layout ?? null,
    updated_at: nowIso(),
  }
}

export function saveDemoLabLayout(projectId: string, layoutJson: Record<string, unknown>): LabQuestLayoutResponse {
  const next = readDemoLayoutMap()
  next[projectId] = layoutJson
  writeDemoLayoutMap(next)
  return {
    layout_json: layoutJson,
    updated_at: nowIso(),
  }
}
