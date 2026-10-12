'use client'

import * as React from 'react'
import {
  Background,
  Handle,
  Position as FlowPosition,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Node,
  type NodeProps,
  type NodeTypes,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ChevronDown, Clock, HelpCircle, Inbox, LayoutDashboard, Moon } from 'lucide-react'
import OrbitLogoStatus from '@/lib/plugins/ai-manus/components/OrbitLogoStatus'
import { cn } from '@/lib/utils'
import type { LabAgentInstance, LabGraphVM, LabQuest, LabTemplate } from '@/lib/api/lab'
import { useI18n } from '@/lib/i18n/useI18n'
import {
  formatRelativeTime,
  isLabWorkingStatus,
  normalizeLabStatus,
  pickAvatarFrameColor,
  resolveAgentDisplayName,
  resolveAgentLogo,
} from './lab-helpers'
import { dispatchLabFocus } from './lab-focus'

type Position = { x: number; y: number }

type FloatingPanelState = {
  x: number
  y: number
  collapsed: boolean
}

type StoredLayoutV2 = {
  version: 2
  viewport?: Viewport | null
  nodes?: Record<string, Position> | null
  panels?: {
    action?: Partial<FloatingPanelState>
    overview?: Partial<FloatingPanelState>
  } | null
}

type LabOverviewCanvasProps = {
  projectId: string
  quests: LabQuest[]
  agents?: LabAgentInstance[]
  templates?: LabTemplate[]
  graphVm?: LabGraphVM | null
  waitingAnswerByAgentId?: Map<string, boolean>
  pendingDecisionCount?: number
  activeQuestId?: string | null
  hasPiAgent?: boolean
  piAgent?: { name: string; logo?: string | null; frameColor?: string | null } | null
  readOnly: boolean
  canvasLevel?: 'map' | 'ops'
  actionPanel: React.ReactNode
  overviewPanel: React.ReactNode
  showFloatingPanels?: boolean
  onOpenCanvas?: (questId: string, branch?: string | null, eventId?: string | null) => void
  onOpenQuestPiChat?: (questId: string) => void
  onOpenPiChat?: () => void
  onSelectAgent?: (agentId: string, questId?: string | null) => void
}

type OverviewQuestNodeData = {
  questId: string
  title: string
  status?: string | null
  piState?: string | null
  baselineBound?: boolean
  hasCliBinding?: boolean
  headBranch?: string | null
  lastEventAt?: string | null
  pendingQuestionCount?: number
  piAgentName?: string | null
  piAgentLogo?: string | null
  piAgentFrameColor?: string | null
  onPiClick?: (() => void) | null
  createdAt?: string | null
  isActive?: boolean
  progressingCount?: number
  experimentCount?: number
  runtimeLabel?: string | null
  pushFailedCount?: number
  writerConflictCount?: number
}

type OverviewAgentNodeData = {
  kind: 'agent'
  questId: string
  agentId: string
  name: string
  avatar: string
  avatarColor: string
  statusTone: string
  statusState: 'waiting' | 'working' | 'paused' | 'resting'
  statusLabel: string
}

type OverviewPiNodeData = {
  kind: 'pi'
  agentId: string
  name: string
  avatar: string
  avatarColor: string
  statusTone: string
  statusState: 'waiting' | 'working' | 'paused' | 'resting'
  statusLabel: string
}

type OverviewPendingNodeData = {
  kind: 'pending'
  count: number
}

type OverviewNodeData =
  | OverviewQuestNodeData
  | OverviewAgentNodeData
  | OverviewPiNodeData
  | OverviewPendingNodeData

type OverviewFlowNode = Node<OverviewNodeData>

const getOverviewNodeKind = (data: OverviewNodeData) => {
  if ('kind' in data) return data.kind
  return 'quest'
}

const isOverviewNodeDataEqual = (left: OverviewNodeData, right: OverviewNodeData) => {
  const leftKind = getOverviewNodeKind(left)
  const rightKind = getOverviewNodeKind(right)
  if (leftKind !== rightKind) return false

  if (leftKind === 'quest' && rightKind === 'quest') {
    const a = left as OverviewQuestNodeData
    const b = right as OverviewQuestNodeData
    return (
      a.questId === b.questId &&
      a.title === b.title &&
      a.status === b.status &&
      a.piState === b.piState &&
      a.baselineBound === b.baselineBound &&
      a.hasCliBinding === b.hasCliBinding &&
      a.headBranch === b.headBranch &&
      a.lastEventAt === b.lastEventAt &&
      a.pendingQuestionCount === b.pendingQuestionCount &&
      a.piAgentName === b.piAgentName &&
      a.piAgentLogo === b.piAgentLogo &&
      a.piAgentFrameColor === b.piAgentFrameColor &&
      a.createdAt === b.createdAt &&
      a.isActive === b.isActive
    )
  }

  if (leftKind === 'agent' && rightKind === 'agent') {
    const a = left as OverviewAgentNodeData
    const b = right as OverviewAgentNodeData
    return (
      a.questId === b.questId &&
      a.agentId === b.agentId &&
      a.name === b.name &&
      a.avatar === b.avatar &&
      a.avatarColor === b.avatarColor &&
      a.statusTone === b.statusTone &&
      a.statusState === b.statusState &&
      a.statusLabel === b.statusLabel
    )
  }

  if (leftKind === 'pi' && rightKind === 'pi') {
    const a = left as OverviewPiNodeData
    const b = right as OverviewPiNodeData
    return (
      a.agentId === b.agentId &&
      a.name === b.name &&
      a.avatar === b.avatar &&
      a.avatarColor === b.avatarColor &&
      a.statusTone === b.statusTone &&
      a.statusState === b.statusState &&
      a.statusLabel === b.statusLabel
    )
  }

  if (leftKind === 'pending' && rightKind === 'pending') {
    const a = left as OverviewPendingNodeData
    const b = right as OverviewPendingNodeData
    return a.count === b.count
  }

  return false
}

const STORAGE_VERSION = 2 as const
const FLOATING_PANEL_MARGIN = 14
const ORB_SIZE = 44
const ORB_STEP = ORB_SIZE + 12
const OVERVIEW_PANEL_WIDTH = 420
const OVERVIEW_PANEL_HEIGHT = 520
const ACTION_PANEL_WIDTH = 420
const ACTION_PANEL_HEIGHT = 600

const readStoredLayout = (projectId: string): StoredLayoutV2 | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(`ds:lab:overview_layout:v${STORAGE_VERSION}:${projectId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredLayoutV2>
    if (parsed?.version !== STORAGE_VERSION) return null
    return parsed as StoredLayoutV2
  } catch {
    return null
  }
}

const writeStoredLayout = (projectId: string, layout: StoredLayoutV2) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      `ds:lab:overview_layout:v${STORAGE_VERSION}:${projectId}`,
      JSON.stringify(layout)
    )
  } catch {
    // ignore storage failures (quota, private mode, etc.)
  }
}

const computeDefaultQuestPosition = (index: number, origin: Position): Position => {
  const cols = 3
  const gapX = 260
  const gapY = 170
  const col = index % cols
  const row = Math.floor(index / cols)
  return { x: origin.x + col * gapX, y: origin.y + row * gapY }
}

const GUIDE_COLUMNS = 2
const GUIDE_GAP_X = 494
const GUIDE_GAP_Y = 221
const GUIDE_NODE_WIDTH = 340
const GUIDE_NODE_HEIGHT = 150
const GUIDE_GROUP_PADDING = 28
const GUIDE_GROUP_HEADER_HEIGHT = 28
const GUIDE_CENTER_X = 0
const GUIDE_START_Y = 40
const PI_NODE_WIDTH = 220

const computeGuideGroupRect = (stepsCount: number, cardHeight: number) => {
  const rows = Math.max(1, Math.ceil(stepsCount / GUIDE_COLUMNS))
  const totalWidth = (GUIDE_COLUMNS - 1) * GUIDE_GAP_X + GUIDE_NODE_WIDTH
  const totalHeight = (rows - 1) * GUIDE_GAP_Y + cardHeight
  const width = totalWidth + GUIDE_GROUP_PADDING * 2
  const height = totalHeight + GUIDE_GROUP_PADDING * 2 + GUIDE_GROUP_HEADER_HEIGHT
  const x = GUIDE_CENTER_X - totalWidth / 2 - GUIDE_GROUP_PADDING
  const y = GUIDE_START_Y - GUIDE_GROUP_PADDING - GUIDE_GROUP_HEADER_HEIGHT
  return { x, y, width, height }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

type Rect = { x: number; y: number; width: number; height: number }

const rectsOverlap = (a: Rect, b: Rect) => {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  )
}

const POSITION_EPS = 0.5

const sanitizePosition = (pos: Position, fallback: Position) => {
  const x = Number.isFinite(pos.x) ? pos.x : fallback.x
  const y = Number.isFinite(pos.y) ? pos.y : fallback.y
  return { x, y }
}

const isPositionDifferent = (a: Position, b: Position) => {
  return Math.abs(a.x - b.x) > POSITION_EPS || Math.abs(a.y - b.y) > POSITION_EPS
}

const resolveOrbPosition = (current: Position, bounds: DOMRect, blockers: Rect[]) => {
  const leftX = FLOATING_PANEL_MARGIN
  const rightX = Math.max(FLOATING_PANEL_MARGIN, bounds.width - ORB_SIZE - FLOATING_PANEL_MARGIN)
  const topY = FLOATING_PANEL_MARGIN
  const bottomY = Math.max(FLOATING_PANEL_MARGIN, bounds.height - ORB_SIZE - FLOATING_PANEL_MARGIN)

  const clampedX = clamp(current.x, leftX, rightX)
  const clampedY = clamp(current.y, topY, bottomY)

  const distances = [
    { edge: 'left', dist: Math.abs(clampedX - leftX) },
    { edge: 'right', dist: Math.abs(clampedX - rightX) },
    { edge: 'top', dist: Math.abs(clampedY - topY) },
    { edge: 'bottom', dist: Math.abs(clampedY - bottomY) },
  ].sort((a, b) => a.dist - b.dist)
  const primary = distances[0]?.edge ?? 'left'

  const candidates: Position[] = []
  const pushCandidate = (x: number, y: number) => {
    candidates.push({
      x: clamp(x, leftX, rightX),
      y: clamp(y, topY, bottomY),
    })
  }

  if (primary === 'left' || primary === 'right') {
    const edgeX = primary === 'left' ? leftX : rightX
    pushCandidate(edgeX, clampedY)
    pushCandidate(edgeX, clampedY + ORB_STEP)
    pushCandidate(edgeX, clampedY - ORB_STEP)
    pushCandidate(primary === 'left' ? rightX : leftX, clampedY)
  } else {
    const edgeY = primary === 'top' ? topY : bottomY
    pushCandidate(clampedX, edgeY)
    pushCandidate(clampedX + ORB_STEP, edgeY)
    pushCandidate(clampedX - ORB_STEP, edgeY)
    pushCandidate(clampedX, primary === 'top' ? bottomY : topY)
  }

  pushCandidate(leftX, topY)
  pushCandidate(rightX, topY)
  pushCandidate(leftX, bottomY)
  pushCandidate(rightX, bottomY)

  const seen = new Set<string>()
  const uniqueCandidates = candidates.filter((candidate) => {
    const key = `${candidate.x}:${candidate.y}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  for (const candidate of uniqueCandidates) {
    const orbRect = { x: candidate.x, y: candidate.y, width: ORB_SIZE, height: ORB_SIZE }
    if (!blockers.some((block) => rectsOverlap(orbRect, block))) {
      return candidate
    }
  }

  return uniqueCandidates[0] ?? { x: leftX, y: topY }
}

const resolvePanelSize = (kind: 'overview' | 'action', collapsed: boolean, bounds: DOMRect) => {
  if (collapsed) {
    return { width: ORB_SIZE, height: ORB_SIZE }
  }
  const baseWidth = kind === 'action' ? ACTION_PANEL_WIDTH : OVERVIEW_PANEL_WIDTH
  const baseHeight = kind === 'action' ? ACTION_PANEL_HEIGHT : OVERVIEW_PANEL_HEIGHT
  return {
    width: Math.min(baseWidth, Math.max(ORB_SIZE, bounds.width - 24)),
    height: Math.min(baseHeight, Math.max(ORB_SIZE, bounds.height - 24)),
  }
}

const resolvePanelState = (
  stored: Partial<FloatingPanelState> | undefined | null,
  fallback: FloatingPanelState
) => {
  return {
    x: Number.isFinite(stored?.x) ? Number(stored?.x) : fallback.x,
    y: Number.isFinite(stored?.y) ? Number(stored?.y) : fallback.y,
    collapsed: typeof stored?.collapsed === 'boolean' ? stored.collapsed : fallback.collapsed,
  }
}

const OverviewPendingActionPanelContext = React.createContext<React.ReactNode>(null)

const OverviewQuestNode = ({ data }: NodeProps) => {
  const { t } = useI18n('lab')
  const nodeData = data as OverviewQuestNodeData
  const status = nodeData.status ? String(nodeData.status).toLowerCase() : null
  const pi = nodeData.piState ? String(nodeData.piState).toLowerCase() : null
  const baselineBound = Boolean(nodeData.baselineBound)
  const headBranch = nodeData.headBranch?.trim() || 'main'
  const hasCliBinding = Boolean(nodeData.hasCliBinding)
  const pendingQuestionCount = Math.max(0, Number(nodeData.pendingQuestionCount ?? 0))
  const hasPendingQuestions = pendingQuestionCount > 0
  const lastEventLabel = nodeData.lastEventAt
    ? formatRelativeTime(nodeData.lastEventAt)
    : t('overview_last_event_none', undefined, 'No event yet')
  return (
    <div
      className={cn(
        'lab-overview-quest-node',
        nodeData.isActive && 'is-active',
        status ? `is-${status}` : null
      )}
    >
      <Handle type="target" position={FlowPosition.Left} className="lab-flow-handle" />
      <Handle type="source" position={FlowPosition.Right} className="lab-flow-handle" />

      <div className="lab-overview-quest-node__title-row">
        <div className="lab-overview-quest-node__title">{nodeData.title || 'Quest'}</div>
        {nodeData.piAgentName ? (
          <button
            type="button"
            className="lab-overview-pi-chip nodrag nopan nowheel"
            onClick={(event) => {
              event.stopPropagation()
              nodeData.onPiClick?.()
            }}
            aria-label={t('overview_open_pi_chat', undefined, 'Open PI chat')}
            title={t('overview_open_pi_chat', undefined, 'Open PI chat')}
          >
            <span
              className="lab-overview-pi-avatar"
              style={
                nodeData.piAgentFrameColor
                  ? { borderColor: nodeData.piAgentFrameColor }
                  : undefined
              }
            >
              {nodeData.piAgentLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={nodeData.piAgentLogo} alt="" />
              ) : (
                <span className="lab-overview-pi-avatar__fallback">{t('overview_pi_label')}</span>
              )}
            </span>
            <span className="lab-overview-pi-label">{nodeData.piAgentName}</span>
          </button>
        ) : null}
      </div>
      <div className="lab-overview-quest-node__meta">
        <span>{status || t('overview_unknown', undefined, 'unknown')}</span>
        <span>
          {t('overview_pi_label', undefined, 'PI')} {pi || t('overview_unknown', undefined, 'unknown')}
        </span>
      </div>
      <div className="lab-overview-quest-node__chips">
        <span className="lab-overview-quest-chip">
          {baselineBound
            ? t('overview_baseline_bound', undefined, 'Baseline bound')
            : t('overview_baseline_pending', undefined, 'Baseline pending')}
        </span>
        <span className="lab-overview-quest-chip">
          {t('overview_head_branch', { branch: headBranch }, 'Head {branch}')}
        </span>
        <span className="lab-overview-quest-chip">
          {hasCliBinding
            ? t('overview_cli_bound', undefined, 'CLI bound')
            : t('overview_cli_pending', undefined, 'CLI pending')}
        </span>
        {hasPendingQuestions ? (
          <span className="lab-overview-quest-chip lab-overview-quest-chip--attention">
            {t('overview_decision_count', { count: pendingQuestionCount }, '{count} decisions')}
          </span>
        ) : null}
        {typeof nodeData.progressingCount === 'number' ? (
          <span className="lab-overview-quest-chip">
            {t('overview_progressing_count', { count: nodeData.progressingCount }, '{count} progressing')}
          </span>
        ) : null}
        {typeof nodeData.experimentCount === 'number' ? (
          <span className="lab-overview-quest-chip">
            {t('overview_experiment_count', { count: nodeData.experimentCount }, '{count} experiments')}
          </span>
        ) : null}
        {typeof nodeData.pushFailedCount === 'number' && nodeData.pushFailedCount > 0 ? (
          <span className="lab-overview-quest-chip lab-overview-quest-chip--attention">
            {t('overview_push_failed_count', { count: nodeData.pushFailedCount }, '{count} push failed')}
          </span>
        ) : null}
        {typeof nodeData.writerConflictCount === 'number' && nodeData.writerConflictCount > 0 ? (
          <span className="lab-overview-quest-chip lab-overview-quest-chip--attention">
            {t(
              'overview_writer_conflict_count',
              { count: nodeData.writerConflictCount },
              '{count} writer conflicts'
            )}
          </span>
        ) : null}
        {nodeData.runtimeLabel ? (
          <span className="lab-overview-quest-chip">{nodeData.runtimeLabel}</span>
        ) : null}
        <span className="lab-overview-quest-chip" title={nodeData.lastEventAt ?? undefined}>
          {t('overview_last_event', { value: lastEventLabel }, 'Last event {value}')}
        </span>
      </div>
    </div>
  )
}

const OverviewAgentNode = ({ data }: NodeProps) => {
  const nodeData = data as OverviewAgentNodeData
  const statusClass = `lab-status-${nodeData.statusTone}`
  return (
    <div className="lab-overview-agent-node">
      <Handle type="target" position={FlowPosition.Left} className="lab-flow-handle" />
      <div className={cn('lab-avatar lab-avatar-sm', statusClass)}>
        <span className="lab-avatar-ring" style={{ borderColor: nodeData.avatarColor }} />
        <img src={nodeData.avatar} alt={nodeData.name} />
      </div>
      <div className="lab-overview-agent-node__meta">
        <div className="lab-overview-agent-node__name">{nodeData.name}</div>
        <div className="lab-overview-agent-node__status">
          <span
            className={cn(
              'lab-status-indicator',
              nodeData.statusState === 'working' && 'lab-status-indicator-working',
              nodeData.statusState === 'waiting' && 'lab-status-indicator-waiting'
            )}
            aria-label={nodeData.statusLabel}
            title={nodeData.statusLabel}
          >
            {nodeData.statusState === 'waiting' ? (
              <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
            ) : nodeData.statusState === 'working' ? (
              <OrbitLogoStatus compact sizePx={16} className="lab-status-orbit" />
            ) : nodeData.statusState === 'paused' ? (
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Moon className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </span>
          <span className="lab-overview-agent-node__status-label">{nodeData.statusLabel}</span>
        </div>
      </div>
    </div>
  )
}

const OverviewPiNode = ({ data }: NodeProps) => {
  const nodeData = data as OverviewPiNodeData
  const statusClass = `lab-status-${nodeData.statusTone}`
  return (
    <div className="lab-overview-agent-node">
      <Handle type="source" position={FlowPosition.Right} className="lab-flow-handle" />
      <div className={cn('lab-avatar lab-avatar-sm', statusClass)}>
        <span className="lab-avatar-ring" style={{ borderColor: nodeData.avatarColor }} />
        <img src={nodeData.avatar} alt={nodeData.name} />
      </div>
      <div className="lab-overview-agent-node__meta">
        <div className="lab-overview-agent-node__name">{nodeData.name}</div>
        <div className="lab-overview-agent-node__status">
          <span
            className={cn(
              'lab-status-indicator',
              nodeData.statusState === 'working' && 'lab-status-indicator-working',
              nodeData.statusState === 'waiting' && 'lab-status-indicator-waiting'
            )}
            aria-label={nodeData.statusLabel}
            title={nodeData.statusLabel}
          >
            {nodeData.statusState === 'waiting' ? (
              <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
            ) : nodeData.statusState === 'working' ? (
              <OrbitLogoStatus compact sizePx={16} className="lab-status-orbit" />
            ) : nodeData.statusState === 'paused' ? (
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Moon className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </span>
          <span className="lab-overview-agent-node__status-label">{nodeData.statusLabel}</span>
        </div>
      </div>
    </div>
  )
}

const OverviewPendingNode = ({ data }: NodeProps) => {
  const { t } = useI18n('lab')
  const nodeData = data as OverviewPendingNodeData
  const actionPanel = React.useContext(OverviewPendingActionPanelContext)
  return (
    <div className="lab-overview-pending-node" aria-label={t('overview_pending_decisions')}>
      <div className="lab-overview-pending-node__header">
        <div>
          <div className="lab-overview-pending-node__title">{t('overview_pending_decisions')}</div>
          <div className="lab-overview-pending-node__subtitle">
            {nodeData.count === 1
              ? t('overview_pending_single')
              : t('overview_pending_plural', { count: nodeData.count })}
          </div>
        </div>
        <span className="lab-overview-pending-node__count" aria-hidden="true">
          {nodeData.count}
        </span>
      </div>
      <div className="lab-overview-pending-node__content nodrag nowheel">
        {actionPanel}
      </div>
    </div>
  )
}

const OVERVIEW_NODE_TYPES: NodeTypes = {
  overviewQuest: OverviewQuestNode,
  overviewAgent: OverviewAgentNode,
  overviewPi: OverviewPiNode,
  overviewPending: OverviewPendingNode,
}

function FloatingPanel({
  boundsRef,
  title,
  icon,
  state,
  zIndex,
  onChange,
  onActivate,
  className,
  children,
}: {
  boundsRef: React.RefObject<HTMLDivElement | null>
  title: string
  icon: React.ReactNode
  state: FloatingPanelState
  zIndex: number
  onChange: (next: FloatingPanelState) => void
  onActivate?: () => void
  className?: string
  children: React.ReactNode
}) {
  const dragRef = React.useRef<{
    originX: number
    originY: number
    pointerId: number
    startX: number
    startY: number
    moved: boolean
  } | null>(null)
  const rootRef = React.useRef<HTMLDivElement | HTMLButtonElement | null>(null)
  const cleanupRef = React.useRef<(() => void) | null>(null)
  const lastDragMovedRef = React.useRef(false)

  React.useEffect(() => {
    return () => {
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [])

  const startDrag = React.useCallback(
    (event: React.PointerEvent) => {
      event.stopPropagation()
      if (typeof event.button === 'number' && event.button !== 0) return
      onActivate?.()
      if (!rootRef.current) return
      const bounds = boundsRef.current
      if (!bounds) return
      cleanupRef.current?.()
      lastDragMovedRef.current = false
      const boundsRect = bounds.getBoundingClientRect()
      const rootRect = rootRef.current.getBoundingClientRect()
      const originX = rootRect.left - boundsRect.left
      const originY = rootRect.top - boundsRect.top
      dragRef.current = {
        originX,
        originY,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      }
      rootRef.current.setPointerCapture(event.pointerId)

      const handleMove = (nextEvent: PointerEvent) => {
        if (!dragRef.current) return
        if (nextEvent.pointerId !== dragRef.current.pointerId) return
        const dx = nextEvent.clientX - dragRef.current.startX
        const dy = nextEvent.clientY - dragRef.current.startY
        if (Math.abs(dx) + Math.abs(dy) > 2) {
          dragRef.current.moved = true
        }
        const maxX = Math.max(
          FLOATING_PANEL_MARGIN,
          boundsRect.width - rootRect.width - FLOATING_PANEL_MARGIN
        )
        const maxY = Math.max(
          FLOATING_PANEL_MARGIN,
          boundsRect.height - rootRect.height - FLOATING_PANEL_MARGIN
        )
        const nextX = clamp(
          dragRef.current.originX + dx,
          FLOATING_PANEL_MARGIN,
          maxX
        )
        const nextY = clamp(
          dragRef.current.originY + dy,
          FLOATING_PANEL_MARGIN,
          maxY
        )
        onChange({ ...state, x: nextX, y: nextY })
      }

      const handleUp = (nextEvent: PointerEvent) => {
        if (!dragRef.current) return
        if (nextEvent.pointerId !== dragRef.current.pointerId) return
        lastDragMovedRef.current = dragRef.current.moved
        dragRef.current = null
        cleanupRef.current?.()
        cleanupRef.current = null
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      window.addEventListener('pointercancel', handleUp)
      cleanupRef.current = () => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
        window.removeEventListener('pointercancel', handleUp)
      }
    },
    [boundsRef, onActivate, onChange, state]
  )

  const collapse = React.useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()
      onChange({ ...state, collapsed: true })
    },
    [onChange, state]
  )

  const expand = React.useCallback(() => {
    if (lastDragMovedRef.current) {
      lastDragMovedRef.current = false
      return
    }
    onActivate?.()
    onChange({ ...state, collapsed: false })
  }, [onActivate, onChange, state])

  if (state.collapsed) {
    return (
      <button
        ref={rootRef as React.RefObject<HTMLButtonElement>}
        type="button"
        className={cn('lab-floating-orb nowheel nopan', className)}
        style={{ transform: `translate3d(${state.x}px, ${state.y}px, 0)`, zIndex }}
        onPointerDown={startDrag}
        onClick={(event) => {
          event.stopPropagation()
          expand()
        }}
        aria-label={`Show ${title}`}
      >
        {icon}
      </button>
    )
  }

  return (
    <div
      ref={rootRef as React.RefObject<HTMLDivElement>}
      className={cn('lab-floating-panel nowheel nopan', className)}
      style={{ transform: `translate3d(${state.x}px, ${state.y}px, 0)`, zIndex }}
      onPointerDown={(event) => {
        event.stopPropagation()
        onActivate?.()
      }}
    >
      <div className="lab-floating-panel__header" onPointerDown={startDrag}>
        <div className="lab-floating-panel__title">
          <span className="lab-floating-panel__icon">{icon}</span>
          <span>{title}</span>
        </div>
        <button
          type="button"
          className="lab-floating-panel__collapse"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={collapse}
          aria-label={`Collapse ${title}`}
        >
          <ChevronDown size={16} />
        </button>
      </div>
      <div className="lab-floating-panel__content">{children}</div>
    </div>
  )
}

function LabOverviewCanvasInner({
  projectId,
  quests,
  agents = [],
  templates = [],
  graphVm,
  waitingAnswerByAgentId = new Map<string, boolean>(),
  pendingDecisionCount,
  activeQuestId,
  hasPiAgent,
  piAgent,
  readOnly,
  canvasLevel = 'map',
  actionPanel,
  overviewPanel,
  showFloatingPanels = true,
  onOpenCanvas,
  onOpenQuestPiChat,
  onOpenPiChat,
  onSelectAgent,
}: LabOverviewCanvasProps) {
  const { t } = useI18n('lab')
  const boundsRef = React.useRef<HTMLDivElement | null>(null)
  const [canvasBoundsReady, setCanvasBoundsReady] = React.useState(false)
  const storedLayout = React.useMemo(() => readStoredLayout(projectId), [projectId])
  const storedViewport = storedLayout?.viewport ?? null
  const initialViewport =
    storedViewport &&
    Number.isFinite(storedViewport.x) &&
    Number.isFinite(storedViewport.y) &&
    Number.isFinite(storedViewport.zoom) &&
    storedViewport.zoom >= 0.15 &&
    storedViewport.zoom <= 3
      ? storedViewport
      : undefined
  const fittedViewportRef = React.useRef(false)
  const viewportCheckedRef = React.useRef(false)

  const nodesRef = React.useRef<Node<OverviewNodeData>[]>([])
  const viewportRef = React.useRef<Viewport | null>(storedLayout?.viewport ?? null)
  const saveTimeoutRef = React.useRef<number | null>(null)

  const zCounterRef = React.useRef(2)
  const [panelZ, setPanelZ] = React.useState<Record<'overview' | 'action', number>>({
    overview: 1,
    action: 2,
  })
  const [overviewPanelState, setOverviewPanelState] = React.useState<FloatingPanelState>(() =>
    resolvePanelState(storedLayout?.panels?.overview, { x: 16, y: 16, collapsed: false })
  )
  const [actionPanelState, setActionPanelState] = React.useState<FloatingPanelState>(() =>
    resolvePanelState(storedLayout?.panels?.action, { x: 16, y: 88, collapsed: false })
  )
  const governanceByQuestId = React.useMemo(() => {
    const map = new Map<string, NonNullable<LabOverviewCanvasProps['graphVm']>['quests'][number]>()
    graphVm?.quests?.forEach((questVm) => {
      map.set(questVm.questId, questVm)
    })
    return map
  }, [graphVm])

  const bringToFront = React.useCallback((key: 'overview' | 'action') => {
    zCounterRef.current += 1
    const nextZ = zCounterRef.current
    setPanelZ((prev) => ({ ...prev, [key]: nextZ }))
  }, [])

  const scheduleSave = React.useCallback(() => {
    if (typeof window === 'undefined') return
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = window.setTimeout(() => {
      const nodePositions: Record<string, Position> = {}
      nodesRef.current.forEach((node) => {
        nodePositions[node.id] = { x: node.position.x, y: node.position.y }
      })
      writeStoredLayout(projectId, {
        version: STORAGE_VERSION,
        viewport: viewportRef.current,
        nodes: nodePositions,
        panels: {
          overview: {
            x: overviewPanelState.x,
            y: overviewPanelState.y,
            collapsed: overviewPanelState.collapsed,
          },
          action: {
            x: actionPanelState.x,
            y: actionPanelState.y,
            collapsed: actionPanelState.collapsed,
          },
        },
      })
    }, 450)
  }, [actionPanelState, overviewPanelState, projectId])

  const guideGroupRect = React.useMemo(() => {
    return computeGuideGroupRect(4, GUIDE_NODE_HEIGHT)
  }, [])

  const questOrigin = React.useMemo(() => {
    const x = Math.round(guideGroupRect.x + guideGroupRect.width + 140)
    const y = Math.round(guideGroupRect.y)
    return { x, y }
  }, [guideGroupRect])

  const resolvedPendingCount = React.useMemo(() => {
    if (typeof pendingDecisionCount === 'number') {
      return Math.max(0, pendingDecisionCount)
    }
    let count = 0
    for (const value of waitingAnswerByAgentId.values()) {
      if (value) count += 1
    }
    return count
  }, [pendingDecisionCount, waitingAnswerByAgentId])
  const isOpsMode = canvasLevel === 'ops'
  const hasPendingDecisions = resolvedPendingCount > 0
  const hasPendingNode = hasPendingDecisions && !isOpsMode
  const showActionPanelFloating = isOpsMode || !hasPendingNode

  React.useLayoutEffect(() => {
    const bounds = boundsRef.current
    if (!bounds) return
    const rect = bounds.getBoundingClientRect()

    setActionPanelState((prev) => {
      const hasStoredX = Number.isFinite(storedLayout?.panels?.action?.x)
      const hasStoredY = Number.isFinite(storedLayout?.panels?.action?.y)
      if (hasStoredX || hasStoredY) return prev
      if (prev.x !== 16 || prev.y !== 88) return prev
      const nextX = Math.max(FLOATING_PANEL_MARGIN, rect.width - ACTION_PANEL_WIDTH - FLOATING_PANEL_MARGIN)
      return { ...prev, x: nextX }
    })
  }, [storedLayout?.panels?.action?.x, storedLayout?.panels?.action?.y])

  React.useLayoutEffect(() => {
    const bounds = boundsRef.current
    if (!bounds) return
    const rect = bounds.getBoundingClientRect()

    const clampPanel = (panel: FloatingPanelState, size: { width: number; height: number }) => {
      const maxX = Math.max(FLOATING_PANEL_MARGIN, rect.width - size.width - FLOATING_PANEL_MARGIN)
      const maxY = Math.max(FLOATING_PANEL_MARGIN, rect.height - size.height - FLOATING_PANEL_MARGIN)
      return {
        x: clamp(panel.x, FLOATING_PANEL_MARGIN, maxX),
        y: clamp(panel.y, FLOATING_PANEL_MARGIN, maxY),
      }
    }

    const overviewSize = resolvePanelSize('overview', overviewPanelState.collapsed, rect)
    const actionSize = resolvePanelSize('action', actionPanelState.collapsed, rect)

    let nextOverview = overviewPanelState
    if (!overviewPanelState.collapsed) {
      const clamped = clampPanel(overviewPanelState, overviewSize)
      if (clamped.x !== overviewPanelState.x || clamped.y !== overviewPanelState.y) {
        nextOverview = { ...overviewPanelState, ...clamped }
      }
    }

    let nextAction = actionPanelState
    if (!actionPanelState.collapsed) {
      const clamped = clampPanel(actionPanelState, actionSize)
      if (clamped.x !== actionPanelState.x || clamped.y !== actionPanelState.y) {
        nextAction = { ...actionPanelState, ...clamped }
      }
    }

    const blockers: Rect[] = []
    if (!nextOverview.collapsed) {
      blockers.push({ x: nextOverview.x, y: nextOverview.y, ...overviewSize })
    }
    if (!nextAction.collapsed) {
      blockers.push({ x: nextAction.x, y: nextAction.y, ...actionSize })
    }

    if (nextOverview.collapsed) {
      const pos = sanitizePosition(resolveOrbPosition(nextOverview, rect, blockers), nextOverview)
      if (isPositionDifferent(pos, nextOverview)) {
        nextOverview = { ...nextOverview, ...pos }
      }
      blockers.push({ x: nextOverview.x, y: nextOverview.y, width: ORB_SIZE, height: ORB_SIZE })
    }

    if (nextAction.collapsed) {
      const pos = sanitizePosition(resolveOrbPosition(nextAction, rect, blockers), nextAction)
      if (isPositionDifferent(pos, nextAction)) {
        nextAction = { ...nextAction, ...pos }
      }
    }

    if (
      isPositionDifferent(nextOverview, overviewPanelState) ||
      nextOverview.collapsed !== overviewPanelState.collapsed
    ) {
      setOverviewPanelState(nextOverview)
    }

    if (
      isPositionDifferent(nextAction, actionPanelState) ||
      nextAction.collapsed !== actionPanelState.collapsed
    ) {
      setActionPanelState(nextAction)
    }
  }, [actionPanelState, overviewPanelState, storedLayout?.panels?.action?.x, storedLayout?.panels?.action?.y])

  React.useEffect(() => {
    if (!isOpsMode) return
    bringToFront('action')
    setActionPanelState((prev) => (prev.collapsed ? { ...prev, collapsed: false } : prev))
  }, [bringToFront, isOpsMode])

  const pendingNode = React.useMemo(() => {
    if (!hasPendingNode) return null
    const width = ACTION_PANEL_WIDTH
    const height = ACTION_PANEL_HEIGHT
    const stored = storedLayout?.nodes?.['overview:pending'] ?? null
    const fallbackX = Math.round(guideGroupRect.x + guideGroupRect.width / 2 - width / 2)
    const fallbackY = Math.round(guideGroupRect.y + guideGroupRect.height + 96)
    const position = stored ? stored : { x: fallbackX, y: fallbackY }
    return {
      id: 'overview:pending',
      type: 'overviewPending',
      position,
      draggable: !readOnly,
      selectable: !readOnly,
      data: {
        kind: 'pending',
        count: resolvedPendingCount,
      },
      style: {
        width,
        height,
        zIndex: 2,
      },
    } satisfies Node<OverviewPendingNodeData>
  }, [guideGroupRect, hasPendingNode, readOnly, resolvedPendingCount, storedLayout?.nodes])

  const questNodes = React.useMemo(() => {
    const storedNodes = storedLayout?.nodes ?? {}
    return quests.map((quest, index) => {
      const governanceQuest = governanceByQuestId.get(quest.quest_id)
      const id = `quest:${quest.quest_id}`
      const stored = storedNodes?.[id] ?? null
      const position = stored ? stored : computeDefaultQuestPosition(index, questOrigin)
      const summary = governanceQuest?.summary
      const runtime = governanceQuest?.runtime
      const runtimeLabel =
        runtime && runtime.runningAgents > 0
          ? t('overview_runtime_running', { count: runtime.runningAgents }, '{count} running')
          : null
      return {
        id,
        type: 'overviewQuest',
        position,
        draggable: !readOnly,
        data: {
          questId: quest.quest_id,
          title: quest.title || 'Quest',
          status: quest.status ?? null,
          piState: quest.pi_state ?? runtime?.piState ?? null,
          baselineBound:
            governanceQuest?.governance.formalBaselineState === 'confirmed' ||
            quest.governance?.formalBaselineState === 'confirmed',
          hasCliBinding: Boolean(quest.cli_server_id),
          headBranch: governanceQuest?.topology.headBranch ?? quest.git_head_branch ?? null,
          lastEventAt: quest.last_event_at ?? null,
          pendingQuestionCount: Math.max(0, Number(quest.pending_question_count ?? 0)),
          piAgentName: piAgent?.name ?? null,
          piAgentLogo: piAgent?.logo ?? null,
          piAgentFrameColor: piAgent?.frameColor ?? null,
          onPiClick:
            piAgent?.name
              ? () => {
                  if (onOpenQuestPiChat) {
                    onOpenQuestPiChat(quest.quest_id)
                    return
                  }
                  onOpenPiChat?.()
                }
              : null,
          createdAt: quest.created_at ?? null,
          isActive: quest.quest_id === activeQuestId,
          progressingCount: summary?.progressingCount ?? undefined,
          experimentCount: summary?.experimentCount ?? undefined,
          runtimeLabel,
          pushFailedCount: summary?.pushFailedCount ?? undefined,
          writerConflictCount: summary?.writerConflictCount ?? undefined,
        },
      } satisfies Node<OverviewQuestNodeData>
    })
  }, [
    activeQuestId,
    governanceByQuestId,
    onOpenPiChat,
    onOpenQuestPiChat,
    piAgent,
    t,
    quests,
    readOnly,
    storedLayout?.nodes,
    questOrigin,
  ])

  const templatesById = React.useMemo(() => {
    return new Map(templates.map((template) => [template.template_id, template]))
  }, [templates])

  const piNode = React.useMemo(() => {
    if (!hasPiAgent) return null
    if (!agents.length) return null
    const piTemplate = templates.find((template) => template.template_key === 'pi') ?? null
    const piAgentInstance =
      (piTemplate
        ? agents.find((agent) => agent.template_id === piTemplate.template_id)
        : agents.find((agent) => agent.agent_id === 'pi')) ?? null
    if (!piAgentInstance) return null

    const storedNodes = storedLayout?.nodes ?? {}
    const defaultPosition = {
      x: GUIDE_CENTER_X - PI_NODE_WIDTH / 2,
      y: guideGroupRect.y + guideGroupRect.height + 48,
    }

    const nodeId = `pi:${piAgentInstance.instance_id}`
    const position = storedNodes?.[nodeId] ?? defaultPosition
    const template = piAgentInstance.template_id
      ? templatesById.get(piAgentInstance.template_id) ?? null
      : null
    const displayName = resolveAgentDisplayName(piAgentInstance) || 'PI'
    const avatar = resolveAgentLogo(piAgentInstance, template)
    const avatarColor =
      piAgentInstance.avatar_frame_color?.trim() ||
      pickAvatarFrameColor(piAgentInstance.instance_id, 0)
    const statusLabelRaw =
      typeof piAgentInstance.status === 'string' ? piAgentInstance.status.toLowerCase() : 'idle'
    const waitingForAnswer = waitingAnswerByAgentId.get(piAgentInstance.instance_id) ?? false
    const isPaused = statusLabelRaw === 'waiting' && !waitingForAnswer
    const effectiveStatus = statusLabelRaw === 'waiting' && !waitingForAnswer ? 'idle' : statusLabelRaw
    const isWaiting = waitingForAnswer
    const isWorking = !isWaiting && isLabWorkingStatus(effectiveStatus)
    const statusTone = isWaiting
      ? 'waiting'
      : isWorking
        ? 'working'
        : normalizeLabStatus(effectiveStatus)
    const statusState = isWaiting ? 'waiting' : isWorking ? 'working' : isPaused ? 'paused' : 'resting'
    const statusLabel = isWaiting ? 'Waiting for answer' : isWorking ? 'Working' : isPaused ? 'Paused' : 'Resting'

    return {
      id: nodeId,
      type: 'overviewPi',
      position,
      draggable: !readOnly,
      data: {
        kind: 'pi',
        agentId: piAgentInstance.instance_id,
        name: displayName,
        avatar,
        avatarColor,
        statusTone,
        statusState,
        statusLabel,
      },
    } satisfies Node<OverviewPiNodeData>
  }, [
    agents,
    guideGroupRect,
    hasPiAgent,
    readOnly,
    storedLayout?.nodes,
    templates,
    templatesById,
    waitingAnswerByAgentId,
  ])

  const agentNodes = React.useMemo(() => {
    if (!agents.length || !questNodes.length) return []
    const storedNodes = storedLayout?.nodes ?? {}
    const questNodeById = new Map(questNodes.map((node) => [node.id, node]))
    const questIds = new Set(quests.map((quest) => quest.quest_id))
    const agentsByQuest = new Map<string, LabAgentInstance[]>()

    agents.forEach((agent) => {
      const questId = agent.active_quest_id
      if (!questId || !questIds.has(questId)) return
      const list = agentsByQuest.get(questId) ?? []
      list.push(agent)
      agentsByQuest.set(questId, list)
    })

    const nodes: Node<OverviewAgentNodeData>[] = []
    agentsByQuest.forEach((questAgents, questId) => {
      const questNode = questNodeById.get(`quest:${questId}`)
      if (!questNode) return
      const columns = questAgents.length > 3 ? 2 : 1
      const rows = Math.ceil(questAgents.length / columns)
      questAgents.forEach((agent, index) => {
        const col = index % columns
        const row = Math.floor(index / columns)
        const offsetX = 240 + col * 170
        const offsetY = (row - (rows - 1) / 2) * 90
        const nodeId = `agent:${questId}:${agent.instance_id}`
        const stored = storedNodes?.[nodeId] ?? null
        const position = stored ?? { x: questNode.position.x + offsetX, y: questNode.position.y + offsetY }

        const template = agent.template_id ? templatesById.get(agent.template_id) ?? null : null
        const displayName = resolveAgentDisplayName(agent)
        const avatar = resolveAgentLogo(agent, template)
        const avatarColor =
          agent.avatar_frame_color?.trim() || pickAvatarFrameColor(agent.instance_id, index)
        const statusLabelRaw = typeof agent.status === 'string' ? agent.status.toLowerCase() : 'idle'
        const waitingForAnswer = waitingAnswerByAgentId.get(agent.instance_id) ?? false
        const isPaused = statusLabelRaw === 'waiting' && !waitingForAnswer
        const effectiveStatus = statusLabelRaw === 'waiting' && !waitingForAnswer ? 'idle' : statusLabelRaw
        const isWaiting = waitingForAnswer
        const isWorking = !isWaiting && isLabWorkingStatus(effectiveStatus)
        const statusTone = isWaiting
          ? 'waiting'
          : isWorking
            ? 'working'
            : normalizeLabStatus(effectiveStatus)
        const statusState = isWaiting ? 'waiting' : isWorking ? 'working' : isPaused ? 'paused' : 'resting'
        const statusLabel = isWaiting ? 'Waiting for answer' : isWorking ? 'Working' : isPaused ? 'Paused' : 'Resting'

        nodes.push({
          id: nodeId,
          type: 'overviewAgent',
          position,
          draggable: !readOnly,
          data: {
            kind: 'agent',
            questId,
            agentId: agent.instance_id,
            name: displayName,
            avatar,
            avatarColor,
            statusTone,
            statusState,
            statusLabel,
          },
        })
      })
    })
    return nodes
  }, [
    agents,
    questNodes,
    quests,
    readOnly,
    storedLayout?.nodes,
    templatesById,
    waitingAnswerByAgentId,
  ])

  const initialNodes = React.useMemo(() => {
    const piNodes = piNode ? [piNode] : []
    const pendingNodes = pendingNode ? [pendingNode] : []
    return [...pendingNodes, ...piNodes, ...questNodes, ...agentNodes]
  }, [agentNodes, pendingNode, piNode, questNodes])

  const [nodes, setNodes, onNodesChange] = useNodesState<OverviewFlowNode>(
    initialNodes as OverviewFlowNode[]
  )
  const agentEdges = React.useMemo(() => {
    const baseStyle = { stroke: 'var(--lab-border-strong)', strokeWidth: 1.2, strokeDasharray: '4 6' }
    return agentNodes.map((node) => ({
      id: `agent-edge:${node.data.questId}:${node.data.agentId}`,
      source: `quest:${node.data.questId}`,
      target: node.id,
      type: 'smoothstep',
      style: baseStyle,
      animated: false,
    }))
  }, [agentNodes])

  const piQuestEdges = React.useMemo(() => {
    if (!piNode) return []
    return questNodes.map((questNode) => ({
      id: `pi-edge:${piNode.id}:${questNode.id}`,
      source: piNode.id,
      target: questNode.id,
      type: 'smoothstep',
      style: { stroke: 'var(--lab-accent-strong)', strokeWidth: 1.4, strokeDasharray: '2 6' },
      animated: false,
    }))
  }, [piNode, questNodes])

  const edges = React.useMemo(() => {
    return [...piQuestEdges, ...agentEdges]
  }, [agentEdges, piQuestEdges])
  const flow = useReactFlow()

  React.useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  React.useEffect(() => {
    setNodes((prev) => {
      const prevById = new Map(prev.map((node) => [node.id, node]))
      const piNodes = piNode ? [piNode] : []
      const pendingNodes = pendingNode ? [pendingNode] : []
      const next = [...pendingNodes, ...piNodes, ...questNodes, ...agentNodes].map((node) => {
        const existing = prevById.get(node.id)
        if (!existing) return node
        const preservePosition =
          node.type === 'overviewQuest' ||
          node.type === 'overviewAgent' ||
          node.type === 'overviewPi' ||
          node.type === 'overviewPending'
        return preservePosition ? { ...node, position: existing.position } : node
      }) as OverviewFlowNode[]
      // If nothing meaningful changed, return prev to avoid update loops while data is loading.
      if (prev.length === next.length) {
        let unchanged = true
        for (let i = 0; i < next.length; i += 1) {
          const a = prev[i]
          const b = next[i]
          if (!a || !b || a.id !== b.id) {
            unchanged = false
            break
          }
          if (a.position.x !== b.position.x || a.position.y !== b.position.y) {
            unchanged = false
            break
          }
          if (!isOverviewNodeDataEqual(a.data, b.data)) {
            unchanged = false
            break
          }
        }
        if (unchanged) return prev
      }
      return next as unknown as Node<OverviewNodeData>[]
    })
  }, [activeQuestId, agentNodes, pendingNode, piNode, questNodes, setNodes])

  React.useEffect(() => {
    scheduleSave()
  }, [actionPanelState, overviewPanelState, scheduleSave])

  React.useEffect(() => {
    if (!nodes.length) return
    if (initialViewport) return
    if (fittedViewportRef.current) return
    let raf = 0
    let attempts = 0
    const tryFit = () => {
      attempts += 1
      try {
        flow.fitView({ padding: 0.2, duration: 450 })
        fittedViewportRef.current = true
      } catch {
        if (attempts < 8 && typeof window !== 'undefined') {
          raf = window.requestAnimationFrame(tryFit)
        }
      }
    }
    tryFit()
    return () => {
      if (raf && typeof window !== 'undefined') {
        window.cancelAnimationFrame(raf)
      }
    }
  }, [flow, initialViewport, nodes.length])

  React.useEffect(() => {
    if (!nodes.length) return
    if (!initialViewport) return
    if (fittedViewportRef.current) return
    if (viewportCheckedRef.current) return
    const bounds = boundsRef.current
    if (!bounds) return
    const rect = bounds.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const tx = initialViewport.x
    const ty = initialViewport.y
    const zoom = initialViewport.zoom
    const padding = 160
    const anyVisible = nodes.some((node) => {
      const sx = node.position.x * zoom + tx
      const sy = node.position.y * zoom + ty
      return sx > -padding && sx < rect.width + padding && sy > -padding && sy < rect.height + padding
    })
    if (!anyVisible) {
      let raf = 0
      let attempts = 0
      const tryFit = () => {
        attempts += 1
        try {
          flow.fitView({ padding: 0.2, duration: 450 })
          fittedViewportRef.current = true
        } catch {
          if (attempts < 8 && typeof window !== 'undefined') {
            raf = window.requestAnimationFrame(tryFit)
          }
        }
      }
      tryFit()
      return () => {
        if (raf && typeof window !== 'undefined') {
          window.cancelAnimationFrame(raf)
        }
      }
    }
    viewportCheckedRef.current = true
  }, [flow, initialViewport, nodes])

  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  React.useLayoutEffect(() => {
    setCanvasBoundsReady(false)
    const bounds = boundsRef.current
    if (!bounds || typeof window === 'undefined') return
    let raf = 0
    let attempts = 0
    const check = () => {
      attempts += 1
      const rect = bounds.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setCanvasBoundsReady(true)
        return
      }
      if (attempts < 6) {
        raf = window.requestAnimationFrame(check)
      }
    }
    check()
    return () => {
      if (raf) {
        window.cancelAnimationFrame(raf)
      }
    }
  }, [projectId])

  return (
    <OverviewPendingActionPanelContext.Provider value={hasPendingNode ? actionPanel : null}>
      <div ref={boundsRef} className={cn('lab-overview-canvas', isOpsMode && 'lab-overview-canvas--ops')}>
        {!canvasBoundsReady ? (
          <div className="space-y-3 p-4">
            {showFloatingPanels ? (
              <>
                {!isOpsMode ? overviewPanel : null}
                {actionPanel}
              </>
            ) : null}
          </div>
        ) : null}
        <div className="lab-quest-graph-shell lab-quest-graph-shell--full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={OVERVIEW_NODE_TYPES}
            onNodesChange={onNodesChange}
            nodesDraggable={!readOnly}
            panOnDrag
            zoomOnScroll
            zoomOnPinch
            minZoom={0.15}
            maxZoom={3}
            defaultViewport={initialViewport}
            onNodeDragStop={() => scheduleSave()}
            onMoveEnd={(_, viewport) => {
              viewportRef.current = viewport
              scheduleSave()
            }}
            onNodeClick={(_, node) => {
              const data = node.data as unknown
              if (data && typeof data === 'object' && (data as any).kind === 'pending') {
                dispatchLabFocus({
                  projectId,
                  focusType: 'overview',
                  focusId: projectId,
                })
                if (showFloatingPanels && showActionPanelFloating) {
                  bringToFront('action')
                  setActionPanelState((prev) => ({ ...prev, collapsed: false }))
                }
                return
              }
              if (data && typeof data === 'object' && (data as any).kind === 'agent') {
                const payload = data as OverviewAgentNodeData
                onSelectAgent?.(payload.agentId, payload.questId)
                return
              }
              if (data && typeof data === 'object' && (data as any).kind === 'pi') {
                const payload = data as OverviewPiNodeData
                onSelectAgent?.(payload.agentId, null)
                onOpenPiChat?.()
                return
              }

              const questId = (node.data as OverviewQuestNodeData | undefined)?.questId
              if (!questId) return
              dispatchLabFocus({
                projectId,
                focusType: 'quest',
                focusId: questId,
              })
              onOpenCanvas?.(questId)
            }}
          >
            <Background color="var(--lab-border)" gap={28} size={1} variant={'dots' as any} />
          </ReactFlow>
        </div>
        {canvasBoundsReady ? (
          <>
            {showFloatingPanels && !isOpsMode ? (
              <FloatingPanel
                boundsRef={boundsRef}
                title={t('overview_overall')}
                icon={<LayoutDashboard size={16} />}
                state={overviewPanelState}
                zIndex={panelZ.overview}
                onChange={setOverviewPanelState}
                onActivate={() => bringToFront('overview')}
                className="lab-overview-panel--overview"
              >
                {overviewPanel}
              </FloatingPanel>
            ) : null}
            {showFloatingPanels && showActionPanelFloating ? (
              <FloatingPanel
                boundsRef={boundsRef}
                title={t('overview_action_center')}
                icon={<Inbox size={16} />}
                state={actionPanelState}
                zIndex={panelZ.action}
                onChange={setActionPanelState}
                onActivate={() => bringToFront('action')}
                className="lab-overview-panel--action"
              >
                {actionPanel}
              </FloatingPanel>
            ) : null}
          </>
        ) : null}
      </div>
    </OverviewPendingActionPanelContext.Provider>
  )
}

export default function LabOverviewCanvas(props: LabOverviewCanvasProps) {
  return (
    <ReactFlowProvider>
      <LabOverviewCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
