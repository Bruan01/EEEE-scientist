import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import {
  ArrowLeft,
  FileCode2,
  FileText,
  FlaskConical,
  GitBranch,
  GitCommitHorizontal,
  Lightbulb,
  Loader2,
  LocateFixed,
  Network,
  Sparkles,
  X,
} from 'lucide-react'

import { GitDiffViewer } from '@/components/workspace/GitDiffViewer'
import { Badge } from '@/components/ui/badge'
import { client } from '@/lib/api'
import { cn } from '@/lib/utils'
import type {
  EvaluationSummaryPayload,
  GitBranchEdge,
  GitBranchesPayload,
  GitBranchNode,
  GitCommitDetailPayload,
  GitComparePayload,
  GitDiffPayload,
  GitLogPayload,
  GraphPayload,
} from '@/types'

type CanvasMode = 'ideas' | 'analysis'
type InspectorMode = 'compare' | 'log'
type MobileSheetView = 'root' | 'branch-diff' | 'commit-detail' | 'commit-diff'

type PositionedNode = GitBranchNode & {
  x: number
  y: number
  width: number
  height: number
}

type CommitPreviewState = {
  commit: GitLogPayload['commits'][number]
  detail?: GitCommitDetailPayload | null
  x: number
  y: number
}

function formatTime(value?: string) {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatMetricValue(value?: number | string | null, decimals?: number | null) {
  if (value == null || value === '') {
    return '—'
  }
  if (typeof value === 'number') {
    if (typeof decimals === 'number') {
      return value.toFixed(decimals)
    }
    return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
  }
  return String(value)
}

function comparisonTone(better?: boolean | null) {
  if (better === true) {
    return 'text-emerald-700 dark:text-emerald-300'
  }
  if (better === false) {
    return 'text-rose-700 dark:text-rose-300'
  }
  return 'text-muted-foreground'
}

function normalizeEvaluationSummary(value: unknown): EvaluationSummaryPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const raw = value as Record<string, unknown>
  const summary: EvaluationSummaryPayload = {
    takeaway: typeof raw.takeaway === 'string' && raw.takeaway.trim() ? raw.takeaway.trim() : null,
    claim_update: typeof raw.claim_update === 'string' && raw.claim_update.trim() ? raw.claim_update.trim() : null,
    baseline_relation:
      typeof raw.baseline_relation === 'string' && raw.baseline_relation.trim() ? raw.baseline_relation.trim() : null,
    comparability: typeof raw.comparability === 'string' && raw.comparability.trim() ? raw.comparability.trim() : null,
    failure_mode: typeof raw.failure_mode === 'string' && raw.failure_mode.trim() ? raw.failure_mode.trim() : null,
    next_action: typeof raw.next_action === 'string' && raw.next_action.trim() ? raw.next_action.trim() : null,
  }
  return Object.values(summary).some(Boolean) ? summary : null
}

function evaluationSummaryItems(value: unknown): Array<{ label: string; value: string; hint?: string }> {
  const summary = normalizeEvaluationSummary(value)
  if (!summary) return []
  const items: Array<[keyof EvaluationSummaryPayload, string, string | undefined]> = [
    ['takeaway', 'Takeaway', 'Reusable one-line conclusion.'],
    ['claim_update', 'Claim update', 'How this result shifts the current claim.'],
    ['baseline_relation', 'Baseline relation', 'Overall relation to the accepted baseline.'],
    ['comparability', 'Comparability', 'How fair and stable the comparison is.'],
    ['failure_mode', 'Failure mode', 'Primary failure class if anything blocked trust.'],
    ['next_action', 'Next action', 'Immediate route suggested by this result.'],
  ]
  return items
    .filter(([key]) => Boolean(summary[key]))
    .map(([key, label, hint]) => ({
      label,
      value: summary[key] || '—',
      hint,
    }))
}

function EvaluationSummaryGrid({
  value,
  className,
}: {
  value: unknown
  className?: string
}) {
  const items = evaluationSummaryItems(value)
  if (!items.length) return null
  return (
    <div className={cn('grid gap-2 sm:grid-cols-2', className)}>
      {items.map((item) => (
        <div key={item.label} className="rounded-[18px] bg-black/[0.03] px-3 py-3 dark:bg-white/[0.04]">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{item.label}</div>
          <div className="mt-2 text-sm font-medium leading-6 text-foreground">{item.value}</div>
          {item.hint ? <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{item.hint}</div> : null}
        </div>
      ))}
    </div>
  )
}

function kindMeta(kind?: string) {
  if (kind === 'idea') {
    return {
      icon: Lightbulb,
      shell: 'from-[#d8cfbb] to-[#cbbca7]',
      tone: 'bg-[rgba(214,189,144,0.18)]',
      label: 'Idea',
    }
  }
  if (kind === 'analysis') {
    return {
      icon: FlaskConical,
      shell: 'from-[#c7d3da] to-[#b5c0cb]',
      tone: 'bg-[rgba(143,163,184,0.16)]',
      label: 'Analysis',
    }
  }
  if (kind === 'paper') {
    return {
      icon: FileText,
      shell: 'from-[#d7d3c3] to-[#c5bea9]',
      tone: 'bg-[rgba(171,158,126,0.16)]',
      label: 'Paper',
    }
  }
  if (kind === 'implementation') {
    return {
      icon: Sparkles,
      shell: 'from-[#d4cbc5] to-[#c1b5ab]',
      tone: 'bg-[rgba(184,170,156,0.18)]',
      label: 'Main',
    }
  }
  return {
    icon: GitBranch,
    shell: 'from-[#c9d3cf] to-[#b5c1bd]',
    tone: 'bg-[rgba(142,167,168,0.16)]',
    label: 'Quest',
  }
}

function layoutIdeaNodes(payload: GitBranchesPayload): PositionedNode[] {
  const visibleRefs = new Set(payload.views?.ideas || payload.nodes.map((item) => item.ref))
  const nodes = payload.nodes.filter((item) => visibleRefs.has(item.ref))
  if (nodes.length === 0) {
    return []
  }
  const byRef = new Map(nodes.map((item) => [item.ref, item]))
  const defaultRef = payload.default_ref
  const includedParent = (item: GitBranchNode) => (item.parent_ref && byRef.has(item.parent_ref) ? item.parent_ref : defaultRef)
  const depthMemo = new Map<string, number>()
  const depthOf = (ref: string): number => {
    if (depthMemo.has(ref)) {
      return depthMemo.get(ref) || 0
    }
    const node = byRef.get(ref)
    if (!node || ref === defaultRef) {
      depthMemo.set(ref, 0)
      return 0
    }
    const parent = includedParent(node)
    const depth = parent && parent !== ref ? depthOf(parent) + 1 : 1
    depthMemo.set(ref, depth)
    return depth
  }
  const lanes = new Map<number, GitBranchNode[]>()
  nodes
    .slice()
    .sort((a, b) => {
      const aDepth = depthOf(a.ref)
      const bDepth = depthOf(b.ref)
      if (aDepth !== bDepth) return aDepth - bDepth
      if ((a.parent_ref || '') !== (b.parent_ref || '')) return (a.parent_ref || '').localeCompare(b.parent_ref || '')
      return (a.updated_at || '').localeCompare(b.updated_at || '')
    })
    .forEach((node) => {
      const depth = depthOf(node.ref)
      if (!lanes.has(depth)) {
        lanes.set(depth, [])
      }
      lanes.get(depth)?.push(node)
    })

  const positioned: PositionedNode[] = []
  for (const [depth, items] of Array.from(lanes.entries()).sort((a, b) => a[0] - b[0])) {
    items.forEach((node, index) => {
      positioned.push({
        ...node,
        x: 80 + depth * 320,
        y: 90 + index * 158,
        width: node.tier === 'major' ? 240 : 210,
        height: node.tier === 'major' ? 116 : 100,
      })
    })
  }
  return positioned
}

function layoutAnalysisNodes(payload: GitBranchesPayload): PositionedNode[] {
  const visibleRefs = new Set(payload.views?.analysis || payload.nodes.map((item) => item.ref))
  const nodes = payload.nodes.filter((item) => visibleRefs.has(item.ref))
  if (nodes.length === 0) {
    return []
  }

  const majors = nodes.filter((item) => item.tier === 'major').sort((a, b) => {
    if (a.ref === payload.default_ref) return -1
    if (b.ref === payload.default_ref) return 1
    return (a.updated_at || '').localeCompare(b.updated_at || '')
  })
  const analysis = nodes.filter((item) => item.branch_kind === 'analysis')
  const positions = new Map<string, PositionedNode>()

  majors.forEach((node, index) => {
    const isRoot = node.ref === payload.default_ref
    const column = isRoot ? 0 : index
    positions.set(node.ref, {
      ...node,
      x: 90 + column * 300,
      y: isRoot ? 160 : 80,
      width: 238,
      height: 116,
    })
  })

  const grouped = new Map<string, GitBranchNode[]>()
  analysis.forEach((node) => {
    const parentRef = node.parent_ref && positions.has(node.parent_ref) ? node.parent_ref : payload.default_ref
    if (!grouped.has(parentRef)) {
      grouped.set(parentRef, [])
    }
    grouped.get(parentRef)?.push(node)
  })

  for (const [parentRef, items] of grouped.entries()) {
    const parent = positions.get(parentRef)
    if (!parent) continue
    items.forEach((node, index) => {
      const columnOffset = index % 2
      const row = Math.floor(index / 2)
      positions.set(node.ref, {
        ...node,
        x: parent.x + columnOffset * 260,
        y: parent.y + 180 + row * 136,
        width: 220,
        height: 96,
      })
    })
  }

  return Array.from(positions.values())
}

function edgePath(from: PositionedNode, to: PositionedNode) {
  const startX = from.x + from.width
  const startY = from.y + from.height / 2
  const endX = to.x
  const endY = to.y + to.height / 2
  const controlOffset = Math.max(60, (endX - startX) * 0.45)
  return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`
}

function metricLabel(node: GitBranchNode) {
  const metric = node.latest_metric
  if (!metric?.key) {
    return null
  }
  if (metric.delta_vs_baseline != null) {
    return `${metric.key}: ${metric.value} · Δ ${metric.delta_vs_baseline}`
  }
  return `${metric.key}: ${metric.value}`
}

function lineageLabel(node: GitBranchNode) {
  if (node.lineage_intent === 'continue_line') {
    return 'continue'
  }
  if (node.lineage_intent === 'branch_alternative') {
    return 'alternative'
  }
  return null
}

function FileChangeButton({
  file,
  selected,
  onClick,
}: {
  file: GitComparePayload['files'][number]
  selected?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-change-path={file.path}
      data-change-status={file.status}
      className={cn(
        'w-full rounded-[22px] border px-3 py-3 text-left transition',
        selected
          ? 'border-[rgba(143,163,184,0.32)] bg-[rgba(143,163,184,0.14)]'
          : 'border-black/[0.06] bg-black/[0.03] hover:bg-black/[0.05] dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.06]'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{file.path}</div>
          {file.old_path ? <div className="mt-1 text-xs text-muted-foreground">{file.old_path}</div> : null}
        </div>
        <Badge>{file.status}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">+{file.added || 0}</span>
        <span className="rounded-full bg-rose-500/10 px-2 py-1 text-rose-700 dark:text-rose-300">-{file.removed || 0}</span>
      </div>
    </button>
  )
}

function CommitTimelineButton({
  commit,
  active,
  onClick,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}: {
  commit: GitLogPayload['commits'][number]
  active?: boolean
  onClick: () => void
  onMouseEnter?: (event: MouseEvent<HTMLButtonElement>) => void
  onMouseMove?: (event: MouseEvent<HTMLButtonElement>) => void
  onMouseLeave?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={cn(
        'relative block w-full rounded-[22px] border px-3 py-3 text-left transition',
        active
          ? 'border-[rgba(143,163,184,0.32)] bg-[rgba(143,163,184,0.14)]'
          : 'border-black/[0.06] bg-black/[0.03] hover:bg-black/[0.05] dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.06]'
      )}
    >
      <div className="flex items-center gap-2">
        <Badge>{commit.short_sha}</Badge>
        <div className="line-clamp-1 text-sm font-medium text-foreground">{commit.subject}</div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>{formatTime(commit.authored_at)}</span>
        {commit.author_name ? <span>· {commit.author_name}</span> : null}
      </div>
    </button>
  )
}

export function GitResearchCanvas({
  questId,
  graph,
  onNavigateExplorer,
  onOpenDocument,
}: {
  questId: string
  graph: GraphPayload | null
  onNavigateExplorer?: (selection: { mode: 'ref' | 'commit'; revision: string; label: string }) => void
  onOpenDocument?: (documentId: string) => void
}) {
  const [mode, setMode] = useState<CanvasMode>('ideas')
  const [payload, setPayload] = useState<GitBranchesPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeNode, setActiveNode] = useState<GitBranchNode | null>(null)
  const [compare, setCompare] = useState<GitComparePayload | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [logPayload, setLogPayload] = useState<GitLogPayload | null>(null)
  const [logLoading, setLogLoading] = useState(false)
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>('compare')
  const [mobileSheetView, setMobileSheetView] = useState<MobileSheetView>('root')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [diff, setDiff] = useState<GitDiffPayload | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null)
  const [commitDetail, setCommitDetail] = useState<GitCommitDetailPayload | null>(null)
  const [commitLoading, setCommitLoading] = useState(false)
  const [selectedCommitPath, setSelectedCommitPath] = useState<string | null>(null)
  const [commitDiff, setCommitDiff] = useState<GitDiffPayload | null>(null)
  const [commitDiffLoading, setCommitDiffLoading] = useState(false)
  const [commitPreview, setCommitPreview] = useState<CommitPreviewState | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const commitDetailCacheRef = useRef<Record<string, GitCommitDetailPayload>>({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void client
      .gitBranches(questId)
      .then((next) => {
        if (!cancelled) {
          setPayload(next)
        }
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
          setPayload(null)
          setError(nextError instanceof Error ? nextError.message : 'Failed to load branch canvas.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [questId, graph?.head])

  const nodes = useMemo(() => {
    if (!payload) {
      return []
    }
    return mode === 'analysis' ? layoutAnalysisNodes(payload) : layoutIdeaNodes(payload)
  }, [mode, payload])

  const nodeMap = useMemo(() => new Map(nodes.map((item) => [item.ref, item])), [nodes])
  const edges = useMemo(
    () =>
      (payload?.edges || []).filter(
        (edge) =>
          nodeMap.has(edge.from) &&
          nodeMap.has(edge.to) &&
          (mode === 'analysis' ? true : edge.tier !== 'minor')
      ),
    [mode, nodeMap, payload?.edges]
  )

  const canvasSize = useMemo(() => {
    const width = Math.max(980, ...nodes.map((node) => node.x + node.width + 140))
    const height = Math.max(440, ...nodes.map((node) => node.y + node.height + 140))
    return { width, height }
  }, [nodes])

  const fitCanvasToView = (behavior: ScrollBehavior = 'smooth') => {
    const element = containerRef.current
    if (!element || nodes.length === 0) {
      return
    }
    const minX = Math.min(...nodes.map((node) => node.x))
    const maxX = Math.max(...nodes.map((node) => node.x + node.width))
    const minY = Math.min(...nodes.map((node) => node.y))
    const maxY = Math.max(...nodes.map((node) => node.y + node.height))
    const targetLeft = Math.max(0, (minX + maxX) / 2 - element.clientWidth / 2)
    const targetTop = Math.max(0, (minY + maxY) / 2 - element.clientHeight / 2)
    element.scrollTo({ left: targetLeft, top: targetTop, behavior })
  }

  const openNode = async (node: GitBranchNode) => {
    onNavigateExplorer?.({
      mode: 'ref',
      revision: node.ref,
      label: node.ref,
    })
    setActiveNode(node)
    setInspectorMode('compare')
    setMobileSheetView('root')
    setCompare(null)
    setLogPayload(null)
    setDiff(null)
    setSelectedPath(null)
    setSelectedCommitSha(null)
    setCommitDetail(null)
    setSelectedCommitPath(null)
    setCommitDiff(null)
    const base = node.compare_base || payload?.default_ref || node.ref
    setCompareLoading(true)
    setLogLoading(true)
    try {
      const [comparePayload, nextLogPayload] = await Promise.all([
        client.gitCompare(questId, base, node.ref).catch(() => null),
        client.gitLog(questId, node.ref, base === node.ref ? undefined : base, 40).catch(() => null),
      ])
      if (comparePayload) {
        setCompare(comparePayload)
        const firstFile = comparePayload.files[0]?.path
        if (firstFile) {
          setSelectedPath(firstFile)
        }
      }
      setLogPayload(nextLogPayload)
    } catch {
      setCompare(null)
      setSelectedPath(null)
      setLogPayload(null)
    } finally {
      setCompareLoading(false)
      setLogLoading(false)
    }
  }

  useEffect(() => {
    if (!activeNode || !selectedPath) {
      return
    }
    let cancelled = false
    const base = activeNode.compare_base || payload?.default_ref || activeNode.ref
    setDiffLoading(true)
    void client
      .gitDiffFile(questId, base, activeNode.ref, selectedPath)
      .then((next) => {
        if (!cancelled) {
          setDiff(next)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDiff(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDiffLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [activeNode, payload?.default_ref, questId, selectedPath])

  useEffect(() => {
    if (!selectedCommitSha) {
      return
    }
    let cancelled = false
    setCommitLoading(true)
    void client
      .gitCommit(questId, selectedCommitSha)
      .then((next) => {
        if (!cancelled) {
          commitDetailCacheRef.current[selectedCommitSha] = next
          setCommitDetail(next)
          setSelectedCommitPath(next.files[0]?.path || null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCommitDetail(null)
          setSelectedCommitPath(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCommitLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [questId, selectedCommitSha])

  useEffect(() => {
    if (!selectedCommitSha || !selectedCommitPath) {
      return
    }
    let cancelled = false
    setCommitDiffLoading(true)
    void client
      .gitCommitFile(questId, selectedCommitSha, selectedCommitPath)
      .then((next) => {
        if (!cancelled) {
          setCommitDiff(next)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCommitDiff(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCommitDiffLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [questId, selectedCommitPath, selectedCommitSha])

  useEffect(() => {
    if (loading || nodes.length === 0) {
      return
    }
    const frame = window.requestAnimationFrame(() => {
      fitCanvasToView('auto')
    })
    return () => window.cancelAnimationFrame(frame)
  }, [loading, mode, nodes.length])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-node-card="true"]')) {
      return
    }
    const element = containerRef.current
    if (!element) {
      return
    }
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: element.scrollLeft,
      top: element.scrollTop,
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const element = containerRef.current
    if (!drag || !element) {
      return
    }
    element.scrollLeft = drag.left - (event.clientX - drag.x)
    element.scrollTop = drag.top - (event.clientY - drag.y)
  }

  const stopDragging = () => {
    dragRef.current = null
  }

  const graphSvgUrl = graph?.svg_path ? `/api/quests/${questId}/graph/svg?ts=${encodeURIComponent(graph.head || 'none')}` : null

  const openCommit = (sha: string) => {
    const commit = logPayload?.commits.find((item) => item.sha === sha)
    onNavigateExplorer?.({
      mode: 'commit',
      revision: sha,
      label: commit?.short_sha || sha.slice(0, 7),
    })
    setInspectorMode('log')
    setSelectedCommitSha(sha)
    setCommitDetail(null)
    setSelectedCommitPath(null)
    setCommitDiff(null)
    setMobileSheetView('commit-detail')
  }

  const openBranchFile = (path: string) => {
    if (selectedPath === path && activeNode && onOpenDocument) {
      onOpenDocument(`git::${activeNode.ref}::${path}`)
      return
    }
    setInspectorMode('compare')
    setSelectedPath(path)
    setMobileSheetView('branch-diff')
  }

  const openCommitFile = (path: string) => {
    if (selectedCommitPath === path && selectedCommitSha && onOpenDocument) {
      onOpenDocument(`git::${selectedCommitSha}::${path}`)
      return
    }
    setSelectedCommitPath(path)
    setMobileSheetView('commit-diff')
  }

  const showCommitPreview = (
    event: MouseEvent<HTMLButtonElement>,
    commit: GitLogPayload['commits'][number]
  ) => {
    const cached = commitDetailCacheRef.current[commit.sha]
    setCommitPreview({
      commit,
      detail: cached || null,
      x: event.clientX,
      y: event.clientY,
    })
    if (cached) {
      return
    }
    void client.gitCommit(questId, commit.sha).then((detail) => {
      commitDetailCacheRef.current[commit.sha] = detail
      setCommitPreview((current) =>
        current && current.commit.sha === commit.sha
          ? {
              ...current,
              detail,
            }
          : current
      )
    })
  }

  const moveCommitPreview = (event: MouseEvent<HTMLButtonElement>) => {
    setCommitPreview((current) =>
      current
        ? {
            ...current,
            x: event.clientX,
            y: event.clientY,
          }
        : current
    )
  }

  const mobileSheetMeta = (() => {
    if (!activeNode) {
      return { title: '', subtitle: '' }
    }
    if (mobileSheetView === 'branch-diff') {
      return {
        title: selectedPath || 'Changed file',
        subtitle: 'Branch diff',
      }
    }
    if (mobileSheetView === 'commit-detail') {
      return {
        title: commitDetail?.short_sha || 'Commit detail',
        subtitle: commitDetail?.subject || 'Single modification',
      }
    }
    if (mobileSheetView === 'commit-diff') {
      return {
        title: selectedCommitPath || 'Commit file diff',
        subtitle: commitDetail?.short_sha ? `Commit ${commitDetail.short_sha}` : 'Commit patch',
      }
    }
    return {
      title: activeNode.ref,
      subtitle: kindMeta(activeNode.branch_kind).label,
    }
  })()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-muted-foreground" />
            <div className="text-base font-semibold">Research branch canvas</div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            GitHub-style branch browsing for major idea paths and analysis sub-branches.
          </div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/[0.72] p-1 backdrop-blur-xl dark:border-white/[0.12] dark:bg-white/[0.05]">
          <button
            type="button"
            onClick={() => setMode('ideas')}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium transition',
              mode === 'ideas' ? 'bg-[rgba(143,163,184,0.18)] text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Ideas & main
          </button>
          <button
            type="button"
            onClick={() => setMode('analysis')}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium transition',
              mode === 'analysis' ? 'bg-[rgba(143,163,184,0.18)] text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Analysis branches
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
        <div className="overflow-hidden rounded-[28px] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(244,239,233,0.92))] shadow-card dark:border-white/[0.10] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))]">
          <div className="border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.08]">
            <div className="text-sm font-medium text-foreground">Canvas overview</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Scroll or drag the background, then click a node to inspect commits, files, and red/green diffs.
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              {payload?.active_workspace_ref ? <Badge>workspace: {payload.active_workspace_ref}</Badge> : null}
              {payload?.research_head_ref ? <Badge>head: {payload.research_head_ref}</Badge> : null}
              {payload?.workspace_mode ? <Badge>mode: {payload.workspace_mode}</Badge> : null}
            </div>
          </div>
          <div
            ref={containerRef}
            className="feed-scrollbar relative h-[520px] overflow-auto cursor-grab active:cursor-grabbing xl:h-[560px]"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={stopDragging}
            onPointerLeave={stopDragging}
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(120,134,151,0.14) 1px, transparent 0), linear-gradient(180deg, rgba(255,255,255,0.38), rgba(255,255,255,0.06))',
              backgroundSize: '24px 24px, auto',
            }}
          >
            {nodes.length > 0 ? (
              <div className="pointer-events-none sticky right-0 top-0 z-10 flex justify-end p-3">
                <button
                  type="button"
                  onClick={() => fitCanvasToView('smooth')}
                  className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/[0.78] px-3 py-1.5 text-xs font-medium text-foreground shadow-card backdrop-blur-xl transition hover:bg-white/[0.92] dark:border-white/[0.12] dark:bg-white/[0.08] dark:hover:bg-white/[0.12]"
                  title="Center the current branch canvas"
                >
                  <LocateFixed className="h-3.5 w-3.5 text-muted-foreground" />
                  Fit view
                </button>
              </div>
            ) : null}
            {loading ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading branch canvas...
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">{error}</div>
            ) : nodes.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No branch structure yet. The first prepared branch will appear here.
              </div>
            ) : (
              <div className="relative" style={{ width: canvasSize.width, height: canvasSize.height }}>
                <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}>
                  {edges.map((edge: GitBranchEdge) => {
                    const from = nodeMap.get(edge.from)
                    const to = nodeMap.get(edge.to)
                    if (!from || !to) {
                      return null
                    }
                    return (
                      <path
                        key={`${edge.from}:${edge.to}`}
                        d={edgePath(from, to)}
                        fill="none"
                        stroke={edge.tier === 'minor' ? 'rgba(143,163,184,0.48)' : 'rgba(184,170,156,0.58)'}
                        strokeDasharray={edge.tier === 'minor' ? '4 8' : '0'}
                        strokeWidth={edge.tier === 'minor' ? 2 : 2.6}
                      />
                    )
                  })}
                </svg>

                {nodes.map((node) => {
                  const meta = kindMeta(node.branch_kind)
                  const Icon = meta.icon
                  const metric = metricLabel(node)
                  const lineage = lineageLabel(node)
                  const badges = [
                    ...(node.active_workspace ? ['workspace'] : []),
                    ...(node.research_head ? ['head'] : []),
                    ...(!node.active_workspace && !node.research_head && node.current ? ['git current'] : []),
                    ...(node.breakthrough ? [node.breakthrough_level || 'breakthrough'] : []),
                  ]
                  if (!badges.length) {
                    badges.push(meta.label)
                  }
                  if (lineage) {
                    badges.push(lineage)
                  }
                  const summaryLine =
                    node.subject ||
                    node.latest_summary ||
                    metric ||
                    (node.parent_ref ? `Based on ${node.parent_ref}` : 'No branch summary yet.')
                  return (
                    <button
                      key={node.ref}
                      type="button"
                      data-node-card="true"
                      data-node-ref={node.ref}
                      onClick={() => void openNode(node)}
                      className={cn(
                        'absolute rounded-[24px] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(243,239,233,0.95))] p-3.5 text-left shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-black/[0.14] dark:border-white/[0.12] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))]',
                        node.active_workspace && 'ring-1 ring-[rgba(143,163,184,0.5)]',
                        node.research_head && 'shadow-[0_0_0_1px_rgba(166,127,72,0.18),0_16px_42px_-34px_rgba(166,127,72,0.3)]',
                        node.breakthrough &&
                          'shadow-[0_0_0_1px_rgba(163,135,58,0.18),0_0_0_8px_rgba(163,135,58,0.10),0_18px_42px_-34px_rgba(163,135,58,0.34)]'
                      )}
                      style={{
                        left: node.x,
                        top: node.y,
                        width: node.width,
                        minHeight: node.height,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-[16px] border border-black/10 dark:border-white/[0.12]',
                            meta.tone
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-sm font-semibold text-foreground">{node.ref}</div>
                            {badges.map((badge) => (
                              <Badge key={`${node.ref}:${badge}`}>{badge}</Badge>
                            ))}
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {summaryLine}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-[28px] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(244,239,233,0.92))] p-4 shadow-card dark:border-white/[0.10] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))]">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-semibold">Legend</div>
            </div>
            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-[rgba(184,170,156,0.85)]" />
                <span>Major branches: quest trunk, ideas, main implementations</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-[rgba(143,163,184,0.85)]" />
                <span>Minor branches: analysis experiments under one main implementation</span>
              </div>
              <div className="rounded-[18px] bg-black/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                Use the <span className="font-medium text-foreground">Ideas & main</span> mode to compare different approaches. Use <span className="font-medium text-foreground">Analysis branches</span> to inspect ablations and robustness runs attached to one accepted main branch.
              </div>
              <div className="rounded-[18px] bg-black/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                <span className="font-medium text-foreground">workspace</span> marks the branch the runtime will use next. <span className="font-medium text-foreground">head</span> marks the newest durable research head. They can be different after reactivating an older branch.
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(244,239,233,0.92))] p-4 shadow-card dark:border-white/[0.10] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))]">
            <div className="mb-3 flex items-center gap-2">
              <Network className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-semibold">Graph snapshot</div>
            </div>
            {graphSvgUrl ? (
              <div className="overflow-hidden rounded-[22px] border border-black/[0.08] bg-white shadow-card dark:border-white/[0.10]">
                <img src={graphSvgUrl} alt="Git graph" className="block w-full" />
              </div>
            ) : (
              <div className="rounded-[22px] bg-black/[0.03] px-3 py-4 text-sm text-muted-foreground dark:bg-white/[0.04]">
                Git graph will appear after the first checkpoint.
              </div>
            )}
          </div>
        </div>
      </div>

      {activeNode ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 p-0 backdrop-blur-md sm:p-4 sm:items-center">
          <div className="morandi-panel w-full max-w-6xl overflow-hidden rounded-t-[30px] rounded-b-none sm:rounded-[28px]">
            <div className="relative z-[1] border-b border-black/[0.06] px-4 py-4 dark:border-white/[0.08] sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="md:hidden">
                    <div className="flex items-center gap-3">
                      {mobileSheetView !== 'root' ? (
                        <button
                          type="button"
                          onClick={() =>
                            setMobileSheetView(
                              mobileSheetView === 'commit-diff' ? 'commit-detail' : 'root'
                            )
                          }
                          className="rounded-full bg-black/[0.05] p-2 text-muted-foreground transition hover:bg-black/[0.08] hover:text-foreground dark:bg-white/[0.06] dark:hover:bg-white/[0.08]"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </button>
                      ) : null}
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold">{mobileSheetMeta.title}</div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">{mobileSheetMeta.subtitle}</div>
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:block">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-lg font-semibold">{activeNode.ref}</div>
                      <Badge>{kindMeta(activeNode.branch_kind).label}</Badge>
                      {lineageLabel(activeNode) ? <Badge>{lineageLabel(activeNode)}</Badge> : null}
                      {activeNode.compare_base ? <Badge>base: {activeNode.compare_base}</Badge> : null}
                      {activeNode.current ? <Badge>current</Badge> : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Updated {formatTime(activeNode.updated_at)}</span>
                      <span>{activeNode.commit_count || 0} commits</span>
                      <span>Ahead {activeNode.ahead || 0}</span>
                      <span>Behind {activeNode.behind || 0}</span>
                      {metricLabel(activeNode) ? <span>{metricLabel(activeNode)}</span> : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="hidden md:inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/[0.72] p-1 backdrop-blur-xl dark:border-white/[0.12] dark:bg-white/[0.05]">
                    <button
                      type="button"
                      onClick={() => setInspectorMode('compare')}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-xs font-medium transition',
                        inspectorMode === 'compare'
                          ? 'bg-[rgba(143,163,184,0.18)] text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Branch compare
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInspectorMode('log')
                        if (!selectedCommitSha && logPayload?.commits?.[0]?.sha) {
                          openCommit(logPayload.commits[0].sha)
                        }
                      }}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-xs font-medium transition',
                        inspectorMode === 'log'
                          ? 'bg-[rgba(143,163,184,0.18)] text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Modification log
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveNode(null)
                      setMobileSheetView('root')
                    }}
                    className="rounded-full bg-black/[0.05] p-2 text-muted-foreground transition hover:bg-black/[0.08] hover:text-foreground dark:bg-white/[0.06] dark:hover:bg-white/[0.08]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="md:hidden">
              <div className="feed-scrollbar max-h-[calc(92vh-86px)] overflow-auto px-4 py-4">
                {mobileSheetView === 'root' ? (
                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(243,239,233,0.96))] p-4 shadow-card dark:border-white/[0.10] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))]">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{kindMeta(activeNode.branch_kind).label}</Badge>
                        {lineageLabel(activeNode) ? <Badge>{lineageLabel(activeNode)}</Badge> : null}
                        {metricLabel(activeNode) ? <Badge>{metricLabel(activeNode)}</Badge> : null}
                        {activeNode.current ? <Badge>current</Badge> : null}
                      </div>
                      <div className="mt-3 text-sm leading-7 text-foreground">
                        {activeNode.latest_summary || activeNode.subject || 'No branch summary yet.'}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>Updated {formatTime(activeNode.updated_at)}</span>
                        <span>· {compare?.file_count || 0} files</span>
                        <span>· {activeNode.commit_count || 0} commits</span>
                      </div>
                    </div>

                    {activeNode.latest_result?.evaluation_summary ? (
                      <section className="space-y-2">
                        <div className="text-sm font-semibold">Evaluation summary</div>
                        <EvaluationSummaryGrid value={activeNode.latest_result.evaluation_summary} />
                      </section>
                    ) : null}

                    <section className="space-y-2">
                      <div className="text-sm font-semibold">Files changed</div>
                      {compareLoading ? (
                        <div className="flex min-h-[120px] items-center justify-center gap-2 rounded-[22px] border border-dashed border-black/10 text-sm text-muted-foreground dark:border-white/[0.12]">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading files...
                        </div>
                      ) : compare?.files?.length ? (
                        compare.files.map((file) => (
                          <FileChangeButton key={file.path} file={file} selected={selectedPath === file.path} onClick={() => openBranchFile(file.path)} />
                        ))
                      ) : (
                        <div className="rounded-[22px] border border-dashed border-black/10 px-4 py-6 text-center text-sm text-muted-foreground dark:border-white/[0.12]">
                          No file changes for this branch compare.
                        </div>
                      )}
                    </section>

                    <section className="space-y-2">
                      <div className="text-sm font-semibold">Recent commits</div>
                      {logLoading ? (
                        <div className="flex min-h-[120px] items-center justify-center gap-2 rounded-[22px] border border-dashed border-black/10 text-sm text-muted-foreground dark:border-white/[0.12]">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading commits...
                        </div>
                      ) : logPayload?.commits?.length ? (
                        logPayload.commits.slice(0, 6).map((commit) => (
                          <CommitTimelineButton key={commit.sha} commit={commit} active={selectedCommitSha === commit.sha} onClick={() => openCommit(commit.sha)} />
                        ))
                      ) : (
                        <div className="rounded-[22px] border border-dashed border-black/10 px-4 py-6 text-center text-sm text-muted-foreground dark:border-white/[0.12]">
                          No recent commit history yet.
                        </div>
                      )}
                    </section>
                  </div>
                ) : null}

                {mobileSheetView === 'branch-diff' ? (
                  <div className="space-y-4">
                    <div className="text-xs text-muted-foreground">
                      Exact diff for the selected branch file.
                    </div>
                    {diffLoading ? (
                      <div className="flex min-h-[220px] items-center justify-center gap-2 rounded-[22px] border border-dashed border-black/10 text-sm text-muted-foreground dark:border-white/[0.12]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading diff...
                      </div>
                    ) : diff ? (
                      <GitDiffViewer
                        diff={diff}
                        className="border border-black/[0.06] bg-white/[0.92] shadow-none dark:border-white/[0.08] dark:bg-[rgba(24,26,31,0.92)]"
                      />
                    ) : (
                      <div className="rounded-[22px] border border-dashed border-black/10 px-4 py-6 text-center text-sm text-muted-foreground dark:border-white/[0.12]">
                        No diff available for this file.
                      </div>
                    )}
                  </div>
                ) : null}

                {mobileSheetView === 'commit-detail' ? (
                  <div className="space-y-4">
                    {commitLoading ? (
                      <div className="flex min-h-[220px] items-center justify-center gap-2 rounded-[22px] border border-dashed border-black/10 text-sm text-muted-foreground dark:border-white/[0.12]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading commit detail...
                      </div>
                    ) : commitDetail ? (
                      <>
                        <div className="rounded-[24px] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(243,239,233,0.96))] p-4 shadow-card dark:border-white/[0.10] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))]">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge>{commitDetail.short_sha}</Badge>
                            <div className="text-xs text-muted-foreground">{formatTime(commitDetail.authored_at)}</div>
                          </div>
                          <div className="mt-3 text-sm font-semibold text-foreground">{commitDetail.subject}</div>
                          {commitDetail.body ? <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground/82">{commitDetail.body}</div> : null}
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {commitDetail.author_name ? <span>{commitDetail.author_name}</span> : null}
                            <span>· {commitDetail.file_count || 0} files</span>
                          </div>
                        </div>

                        <section className="space-y-2">
                          <div className="text-sm font-semibold">Files changed in this commit</div>
                          {commitDetail.files.length ? (
                            commitDetail.files.map((file) => (
                              <FileChangeButton key={file.path} file={file} selected={selectedCommitPath === file.path} onClick={() => openCommitFile(file.path)} />
                            ))
                          ) : (
                            <div className="rounded-[22px] border border-dashed border-black/10 px-4 py-6 text-center text-sm text-muted-foreground dark:border-white/[0.12]">
                              No file changes recorded for this commit.
                            </div>
                          )}
                        </section>
                      </>
                    ) : (
                      <div className="rounded-[22px] border border-dashed border-black/10 px-4 py-6 text-center text-sm text-muted-foreground dark:border-white/[0.12]">
                        Commit detail is not available.
                      </div>
                    )}
                  </div>
                ) : null}

                {mobileSheetView === 'commit-diff' ? (
                  <div className="space-y-4">
                    <div className="text-xs text-muted-foreground">
                      Exact patch for the selected file in this commit.
                    </div>
                    {commitDiffLoading ? (
                      <div className="flex min-h-[220px] items-center justify-center gap-2 rounded-[22px] border border-dashed border-black/10 text-sm text-muted-foreground dark:border-white/[0.12]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading commit diff...
                      </div>
                    ) : commitDiff ? (
                      <GitDiffViewer
                        diff={commitDiff}
                        className="border border-black/[0.06] bg-white/[0.92] shadow-none dark:border-white/[0.08] dark:bg-[rgba(24,26,31,0.92)]"
                      />
                    ) : (
                      <div className="rounded-[22px] border border-dashed border-black/10 px-4 py-6 text-center text-sm text-muted-foreground dark:border-white/[0.12]">
                        No patch is available for this file.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="hidden max-h-[82vh] min-h-[420px] gap-0 overflow-hidden md:grid lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
              <div className="feed-scrollbar overflow-auto border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08] lg:border-b-0 lg:border-r">
                <div className="space-y-4">
                  <section>
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      Overview
                    </div>
                    <div className="rounded-[22px] bg-black/[0.03] p-3 text-sm leading-7 text-foreground dark:bg-white/[0.04]">
                      {activeNode.latest_summary || activeNode.subject || 'No branch summary yet.'}
                    </div>
                    {activeNode.latest_result ? (
                      <div className="mt-3 grid gap-2">
                        <div className="rounded-[18px] bg-black/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                          <div className="flex flex-wrap gap-2">
                            {activeNode.latest_result.run_id ? <Badge>{activeNode.latest_result.run_id}</Badge> : null}
                            {activeNode.latest_result.verdict ? <Badge>{activeNode.latest_result.verdict}</Badge> : null}
                            {activeNode.latest_result.progress_eval?.breakthrough ? (
                              <Badge>{activeNode.latest_result.progress_eval.breakthrough_level || 'breakthrough'}</Badge>
                            ) : null}
                          </div>
                          <div className="mt-2 text-xs leading-6 text-muted-foreground">
                            {activeNode.latest_result.progress_eval?.reason || activeNode.latest_result.summary || 'No structured result summary yet.'}
                          </div>
                          {activeNode.latest_result.progress_eval?.primary_metric_id ? (
                            <div className="mt-2 text-xs leading-6 text-foreground/84">
                              {activeNode.latest_result.progress_eval.primary_metric_id}: {formatMetricValue(activeNode.latest_result.progress_eval.run_value as number | null | undefined)}
                              {activeNode.latest_result.progress_eval.delta_vs_baseline != null
                                ? ` · Δ ${formatMetricValue(activeNode.latest_result.progress_eval.delta_vs_baseline as number | null | undefined)} vs baseline`
                                : ''}
                            </div>
                          ) : null}
                        </div>
                        {activeNode.latest_result.paths?.run_md || activeNode.latest_result.paths?.result_json ? (
                          <div className="rounded-[18px] bg-black/[0.03] px-3 py-3 text-xs leading-6 text-muted-foreground dark:bg-white/[0.04]">
                            {activeNode.latest_result.paths?.run_md ? <div>Run log: {activeNode.latest_result.paths.run_md}</div> : null}
                            {activeNode.latest_result.paths?.result_json ? <div>Result JSON: {activeNode.latest_result.paths.result_json}</div> : null}
                          </div>
                        ) : null}
                        <EvaluationSummaryGrid value={activeNode.latest_result.evaluation_summary} />
                      </div>
                    ) : null}
                    {activeNode.recent_artifacts?.length ? (
                      <div className="mt-3 space-y-2">
                        {activeNode.recent_artifacts.map((artifact) => (
                          <div key={artifact.artifact_id || `${artifact.kind}-${artifact.updated_at}`} className="rounded-[18px] bg-black/[0.03] px-3 py-2 dark:bg-white/[0.04]">
                            <div className="flex items-center gap-2">
                              <Badge>{artifact.kind || 'artifact'}</Badge>
                              {artifact.status ? <Badge>{artifact.status}</Badge> : null}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">{artifact.summary || artifact.reason || 'No artifact summary.'}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </section>

                  <section>
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                      Branch compare
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-[18px] bg-black/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Files</div>
                        <div className="mt-2 text-lg font-semibold">{compare?.file_count || 0}</div>
                      </div>
                      <div className="rounded-[18px] bg-black/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Unique commits</div>
                        <div className="mt-2 text-lg font-semibold">{compare?.commit_count || 0}</div>
                      </div>
                      <div className="rounded-[18px] bg-black/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Ahead</div>
                        <div className="mt-2 text-lg font-semibold">{compare?.ahead || 0}</div>
                      </div>
                      <div className="rounded-[18px] bg-black/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Behind</div>
                        <div className="mt-2 text-lg font-semibold">{compare?.behind || 0}</div>
                      </div>
                    </div>
                  </section>

                  <section>
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <GitCommitHorizontal className="h-4 w-4 text-muted-foreground" />
                      Modification log
                    </div>
                    {logLoading ? (
                      <div className="rounded-[18px] bg-black/[0.03] px-3 py-4 text-sm text-muted-foreground dark:bg-white/[0.04]">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading commit history...
                        </div>
                      </div>
                    ) : logPayload?.commits?.length ? (
                      <div className="relative pl-5">
                        <div className="absolute bottom-2 left-[7px] top-2 w-px bg-black/10 dark:bg-white/[0.12]" />
                        <div className="space-y-3">
                          {logPayload.commits.map((commit) => (
                            <div key={commit.sha} className="relative">
                              <div className="absolute -left-[18px] top-5 h-3 w-3 rounded-full border border-white bg-[rgba(143,163,184,0.9)] shadow-sm dark:border-[#1d2228]" />
                              <CommitTimelineButton
                                commit={commit}
                                active={selectedCommitSha === commit.sha && inspectorMode === 'log'}
                                onClick={() => openCommit(commit.sha)}
                                onMouseEnter={(event) => showCommitPreview(event, commit)}
                                onMouseMove={moveCommitPreview}
                                onMouseLeave={() => setCommitPreview(null)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-[18px] bg-black/[0.03] px-3 py-4 text-sm text-muted-foreground dark:bg-white/[0.04]">
                        No branch-local commit log is available yet.
                      </div>
                    )}
                  </section>
                </div>
              </div>

              <div className="feed-scrollbar overflow-auto px-5 py-4">
                {inspectorMode === 'compare' ? (
                  <div className="space-y-4">
                    {activeNode.latest_result ? (
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                        <div className="rounded-[24px] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(244,239,233,0.94))] p-4 shadow-card dark:border-white/[0.10] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))]">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                            Result overview
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-[18px] bg-black/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Run</div>
                              <div className="mt-2 text-sm font-medium text-foreground">
                                {activeNode.latest_result.run_id || '—'}
                              </div>
                            </div>
                            <div className="rounded-[18px] bg-black/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Verdict</div>
                              <div className="mt-2 text-sm font-medium text-foreground">
                                {activeNode.latest_result.verdict || activeNode.latest_result.status || '—'}
                              </div>
                            </div>
                            <div className="rounded-[18px] bg-black/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Baseline</div>
                              <div className="mt-2 text-sm font-medium text-foreground">
                                {activeNode.latest_result.baseline_ref?.baseline_id || 'none'}
                              </div>
                            </div>
                            <div className="rounded-[18px] bg-black/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Breakthrough</div>
                              <div className="mt-2 text-sm font-medium text-foreground">
                                {activeNode.latest_result.progress_eval?.breakthrough
                                  ? activeNode.latest_result.progress_eval.breakthrough_level || 'yes'
                                  : 'none'}
                              </div>
                            </div>
                          </div>
                          {activeNode.latest_result.progress_eval?.reason ? (
                            <div className="mt-3 rounded-[18px] bg-black/[0.03] px-3 py-3 text-sm leading-7 text-muted-foreground dark:bg-white/[0.04]">
                              {activeNode.latest_result.progress_eval.reason}
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-[24px] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(244,239,233,0.94))] p-4 shadow-card dark:border-white/[0.10] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))]">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <FileCode2 className="h-4 w-4 text-muted-foreground" />
                            Result files
                          </div>
                          <div className="mt-3 space-y-2 text-xs leading-6 text-muted-foreground">
                            {activeNode.latest_result.paths?.run_md ? <div>{activeNode.latest_result.paths.run_md}</div> : null}
                            {activeNode.latest_result.paths?.result_json ? <div>{activeNode.latest_result.paths.result_json}</div> : null}
                            {!activeNode.latest_result.paths?.run_md && !activeNode.latest_result.paths?.result_json ? (
                              <div>No result file paths recorded.</div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {activeNode.latest_result?.evaluation_summary ? (
                      <div className="rounded-[24px] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(244,239,233,0.94))] p-4 shadow-card dark:border-white/[0.10] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))]">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Sparkles className="h-4 w-4 text-muted-foreground" />
                          Evaluation summary
                        </div>
                        <div className="mt-3">
                          <EvaluationSummaryGrid value={activeNode.latest_result.evaluation_summary} />
                        </div>
                      </div>
                    ) : null}

                    {activeNode.latest_result?.baseline_comparisons?.items?.length ? (
                      <div className="rounded-[24px] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(244,239,233,0.94))] p-4 shadow-card dark:border-white/[0.10] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))]">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Sparkles className="h-4 w-4 text-muted-foreground" />
                          Metric comparison
                        </div>
                        <div className="mt-3 grid gap-2">
                          {activeNode.latest_result.baseline_comparisons.items.map((item) => (
                            <div
                              key={item.metric_id}
                              className="rounded-[18px] bg-black/[0.03] px-3 py-3 text-sm dark:bg-white/[0.04]"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="font-medium text-foreground">
                                  {item.label || item.metric_id}
                                </div>
                                <div className={cn('text-xs', comparisonTone(item.better))}>
                                  {item.better === true ? 'better' : item.better === false ? 'worse' : 'not comparable'}
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                <span>run {formatMetricValue(item.run_value, item.decimals)}</span>
                                <span>baseline {formatMetricValue(item.baseline_value, item.decimals)}</span>
                                <span className={comparisonTone(item.better)}>
                                  Δ {item.delta != null ? formatMetricValue(item.delta, item.decimals) : '—'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {activeNode.latest_result?.files_changed?.length ? (
                      <div className="rounded-[24px] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(244,239,233,0.94))] p-4 shadow-card dark:border-white/[0.10] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))]">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <FileCode2 className="h-4 w-4 text-muted-foreground" />
                          Recorded changed files
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {activeNode.latest_result.files_changed.map((path) => (
                            <Badge key={path}>{path}</Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">Files changed versus base</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Click a file to inspect the branch-level diff against `{activeNode.compare_base || payload?.default_ref || activeNode.ref}`.
                        </div>
                      </div>
                      {selectedPath ? <Badge>{selectedPath}</Badge> : null}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                      <div className="space-y-2">
                        {compareLoading ? (
                          <div className="flex min-h-[180px] items-center justify-center gap-2 rounded-[24px] border border-dashed border-black/10 text-sm text-muted-foreground dark:border-white/[0.12]">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading changed files...
                          </div>
                        ) : compare?.files?.length ? (
                          compare.files.map((file) => (
                            <FileChangeButton key={file.path} file={file} selected={selectedPath === file.path} onClick={() => setSelectedPath(file.path)} />
                          ))
                        ) : (
                          <div className="flex min-h-[180px] items-center justify-center rounded-[24px] border border-dashed border-black/10 px-4 text-center text-sm text-muted-foreground dark:border-white/[0.12]">
                            No file changes for this compare window.
                          </div>
                        )}
                      </div>

                      <div>
                        {diffLoading ? (
                          <div className="flex min-h-[240px] items-center justify-center gap-2 rounded-[24px] border border-dashed border-black/10 text-sm text-muted-foreground dark:border-white/[0.12]">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading diff...
                          </div>
                        ) : diff ? (
                          <GitDiffViewer
                            diff={diff}
                            className="border border-black/[0.06] bg-white/[0.92] shadow-none dark:border-white/[0.08] dark:bg-[rgba(24,26,31,0.92)]"
                          />
                        ) : (
                          <div className="flex min-h-[240px] items-center justify-center rounded-[24px] border border-dashed border-black/10 text-sm text-muted-foreground dark:border-white/[0.12]">
                            Pick a changed file to preview its red/green diff.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">Modification log detail</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Query each commit on this branch, then inspect the exact files and patch for that single change.
                        </div>
                      </div>
                      {commitDetail ? <Badge>{commitDetail.short_sha}</Badge> : null}
                    </div>

                    {commitLoading ? (
                      <div className="flex min-h-[220px] items-center justify-center gap-2 rounded-[24px] border border-dashed border-black/10 text-sm text-muted-foreground dark:border-white/[0.12]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading commit detail...
                      </div>
                    ) : commitDetail ? (
                      <div className="space-y-4">
                        <div className="overflow-hidden rounded-[26px] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(243,239,233,0.96))] p-4 shadow-card dark:border-white/[0.10] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))]">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge>{commitDetail.short_sha}</Badge>
                            {commitDetail.parents?.[0] ? <Badge>parent: {commitDetail.parents[0].slice(0, 7)}</Badge> : null}
                            <div className="text-xs text-muted-foreground">{formatTime(commitDetail.authored_at)}</div>
                          </div>
                          <div className="mt-3 text-base font-semibold text-foreground">{commitDetail.subject}</div>
                          {commitDetail.body ? <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground">{commitDetail.body}</div> : null}
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {commitDetail.author_name ? <span>{commitDetail.author_name}</span> : null}
                            {commitDetail.author_email ? <span>· {commitDetail.author_email}</span> : null}
                            <span>· {commitDetail.file_count || 0} files</span>
                            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">+{commitDetail.stats?.added || 0}</span>
                            <span className="rounded-full bg-rose-500/10 px-2 py-1 text-rose-700 dark:text-rose-300">-{commitDetail.stats?.removed || 0}</span>
                          </div>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                          <div className="space-y-2">
                            {commitDetail.files.length ? (
                              commitDetail.files.map((file) => (
                                <FileChangeButton key={file.path} file={file} selected={selectedCommitPath === file.path} onClick={() => setSelectedCommitPath(file.path)} />
                              ))
                            ) : (
                              <div className="flex min-h-[180px] items-center justify-center rounded-[24px] border border-dashed border-black/10 px-4 text-center text-sm text-muted-foreground dark:border-white/[0.12]">
                                No file changes recorded for this commit.
                              </div>
                            )}
                          </div>

                          <div>
                            {commitDiffLoading ? (
                              <div className="flex min-h-[240px] items-center justify-center gap-2 rounded-[24px] border border-dashed border-black/10 text-sm text-muted-foreground dark:border-white/[0.12]">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading commit diff...
                              </div>
                            ) : commitDiff ? (
                              <GitDiffViewer
                                diff={commitDiff}
                                className="border border-black/[0.06] bg-white/[0.92] shadow-none dark:border-white/[0.08] dark:bg-[rgba(24,26,31,0.92)]"
                              />
                            ) : (
                              <div className="flex min-h-[240px] items-center justify-center rounded-[24px] border border-dashed border-black/10 text-sm text-muted-foreground dark:border-white/[0.12]">
                                Pick a file from this commit to preview the exact patch.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-[240px] items-center justify-center rounded-[24px] border border-dashed border-black/10 text-sm text-muted-foreground dark:border-white/[0.12]">
                        Pick one modification log on the left to inspect that single change.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          {commitPreview ? (
            <div
              className="pointer-events-none fixed z-[60] hidden max-w-[320px] sm:block"
              style={{
                left: Math.min(commitPreview.x + 18, window.innerWidth - 340),
                top: Math.max(24, commitPreview.y - 12),
              }}
            >
              <div className="overflow-hidden rounded-[24px] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(243,239,233,0.96))] p-4 shadow-[0_24px_80px_-44px_rgba(18,24,32,0.42)] backdrop-blur-2xl dark:border-white/[0.12] dark:bg-[linear-gradient(180deg,rgba(28,32,38,0.94),rgba(20,24,28,0.96))]">
                <div className="flex items-center gap-2">
                  <Badge>{commitPreview.commit.short_sha}</Badge>
                  <div className="text-xs text-muted-foreground">{formatTime(commitPreview.commit.authored_at)}</div>
                </div>
                <div className="mt-3 text-sm font-semibold text-foreground">{commitPreview.commit.subject}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {commitPreview.detail?.author_name || commitPreview.commit.author_name || 'Unknown author'}
                </div>
                {commitPreview.detail?.body ? (
                  <div className="mt-3 line-clamp-4 whitespace-pre-wrap text-xs leading-6 text-foreground/82">
                    {commitPreview.detail.body}
                  </div>
                ) : (
                  <div className="mt-3 line-clamp-3 text-xs leading-6 text-foreground/78">
                    {commitPreview.detail
                      ? `${commitPreview.detail.file_count || 0} files changed, +${commitPreview.detail.stats?.added || 0} / -${commitPreview.detail.stats?.removed || 0}.`
                      : 'Loading commit summary...'}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
