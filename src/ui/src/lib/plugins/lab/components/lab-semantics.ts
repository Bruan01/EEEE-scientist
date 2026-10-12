export type LabCanvasSemanticTone = 'truth' | 'abstraction' | 'runtime' | 'overlay'

export type LabCanvasSemanticGroup = 'view' | 'node' | 'edge'

export type LabCanvasSemanticEntry = {
  id: string
  group: LabCanvasSemanticGroup
  tone: LabCanvasSemanticTone
  labelKey: string
  labelDefault: string
  descriptionKey: string
  descriptionDefault: string
}

export const LAB_CANVAS_SEMANTIC_GROUP_META: Record<
  LabCanvasSemanticGroup,
  { labelKey: string; labelDefault: string }
> = {
  view: {
    labelKey: 'quest_semantic_group_view',
    labelDefault: 'Views',
  },
  node: {
    labelKey: 'quest_semantic_group_node',
    labelDefault: 'Nodes',
  },
  edge: {
    labelKey: 'quest_semantic_group_edge',
    labelDefault: 'Edges',
  },
}

export const LAB_CANVAS_SEMANTIC_TONE_META: Record<
  LabCanvasSemanticTone,
  { labelKey: string; labelDefault: string }
> = {
  truth: {
    labelKey: 'quest_semantic_tone_truth',
    labelDefault: 'Truth',
  },
  abstraction: {
    labelKey: 'quest_semantic_tone_abstraction',
    labelDefault: 'Abstraction',
  },
  runtime: {
    labelKey: 'quest_semantic_tone_runtime',
    labelDefault: 'Runtime',
  },
  overlay: {
    labelKey: 'quest_semantic_tone_overlay',
    labelDefault: 'Overlay',
  },
}

export const LAB_CANVAS_SEMANTIC_TABLE: LabCanvasSemanticEntry[] = [
  {
    id: 'view.branch',
    group: 'view',
    tone: 'truth',
    labelKey: 'quest_semantic_view_branch_label',
    labelDefault: 'Branch map',
    descriptionKey: 'quest_semantic_view_branch_desc',
    descriptionDefault: 'Shows Git branch/worktree truth and lineage between routes.',
  },
  {
    id: 'view.event',
    group: 'view',
    tone: 'abstraction',
    labelKey: 'quest_semantic_view_event_label',
    labelDefault: 'Event trace',
    descriptionKey: 'quest_semantic_view_event_desc',
    descriptionDefault: 'Shows ordered research events, not Git parent relationships.',
  },
  {
    id: 'view.stage',
    group: 'view',
    tone: 'abstraction',
    labelKey: 'quest_semantic_view_stage_label',
    labelDefault: 'Stage flow',
    descriptionKey: 'quest_semantic_view_stage_desc',
    descriptionDefault: 'Shows grouped pipeline stages to explain progress at a glance.',
  },
  {
    id: 'node.branch',
    group: 'node',
    tone: 'truth',
    labelKey: 'quest_semantic_node_branch_label',
    labelDefault: 'Branch / worktree route',
    descriptionKey: 'quest_semantic_node_branch_desc',
    descriptionDefault: 'Represents one research route backed by a real branch and worktree.',
  },
  {
    id: 'node.event',
    group: 'node',
    tone: 'abstraction',
    labelKey: 'quest_semantic_node_event_label',
    labelDefault: 'Event / stage marker',
    descriptionKey: 'quest_semantic_node_event_desc',
    descriptionDefault: 'Represents a milestone, decision, or grouped stage summary.',
  },
  {
    id: 'node.agent',
    group: 'node',
    tone: 'runtime',
    labelKey: 'quest_semantic_node_agent_label',
    labelDefault: 'Agent runtime',
    descriptionKey: 'quest_semantic_node_agent_desc',
    descriptionDefault: 'Represents a live PI or researcher runtime attached to a route.',
  },
  {
    id: 'node.proposal',
    group: 'node',
    tone: 'overlay',
    labelKey: 'quest_semantic_node_proposal_label',
    labelDefault: 'Control proposal',
    descriptionKey: 'quest_semantic_node_proposal_desc',
    descriptionDefault: 'Represents a pending user or PI control change before truth is updated.',
  },
  {
    id: 'edge.parent',
    group: 'edge',
    tone: 'truth',
    labelKey: 'quest_semantic_edge_parent_label',
    labelDefault: 'Truth lineage',
    descriptionKey: 'quest_semantic_edge_parent_desc',
    descriptionDefault: 'Represents parent branch lineage from the worktree graph.',
  },
  {
    id: 'edge.sequence',
    group: 'edge',
    tone: 'abstraction',
    labelKey: 'quest_semantic_edge_sequence_label',
    labelDefault: 'Event order',
    descriptionKey: 'quest_semantic_edge_sequence_desc',
    descriptionDefault: 'Represents temporal event ordering for replay and trace reading.',
  },
  {
    id: 'edge.stage',
    group: 'edge',
    tone: 'abstraction',
    labelKey: 'quest_semantic_edge_stage_label',
    labelDefault: 'Stage transition',
    descriptionKey: 'quest_semantic_edge_stage_desc',
    descriptionDefault: 'Represents movement across the research pipeline rather than Git ancestry.',
  },
  {
    id: 'edge.overlay',
    group: 'edge',
    tone: 'overlay',
    labelKey: 'quest_semantic_edge_overlay_label',
    labelDefault: 'Proposed relation',
    descriptionKey: 'quest_semantic_edge_overlay_desc',
    descriptionDefault: 'Represents pending control intent and never overwrites truth edges.',
  },
]

export function getLabCanvasSemanticSections(): Array<{
  group: LabCanvasSemanticGroup
  items: LabCanvasSemanticEntry[]
}> {
  return (['view', 'node', 'edge'] as LabCanvasSemanticGroup[]).map((group) => ({
    group,
    items: LAB_CANVAS_SEMANTIC_TABLE.filter((item) => item.group === group),
  }))
}

export function resolveLabCanvasViewSemantic(
  viewMode: 'branch' | 'event' | 'stage'
): LabCanvasSemanticEntry {
  if (viewMode === 'event') {
    return LAB_CANVAS_SEMANTIC_TABLE.find((item) => item.id === 'view.event')!
  }
  if (viewMode === 'stage') {
    return LAB_CANVAS_SEMANTIC_TABLE.find((item) => item.id === 'view.stage')!
  }
  return LAB_CANVAS_SEMANTIC_TABLE.find((item) => item.id === 'view.branch')!
}

export function resolveLabCanvasSelectionSemantic({
  selectionType,
  edgeType,
  hasActiveProposal,
}: {
  selectionType?: string | null
  edgeType?: string | null
  hasActiveProposal?: boolean
}): LabCanvasSemanticEntry | null {
  if (hasActiveProposal) {
    return LAB_CANVAS_SEMANTIC_TABLE.find((item) => item.id === 'node.proposal') ?? null
  }
  const normalizedSelectionType = String(selectionType || '').trim().toLowerCase()
  const normalizedEdgeType = String(edgeType || '').trim().toLowerCase()

  if (normalizedSelectionType === 'branch_node') {
    return LAB_CANVAS_SEMANTIC_TABLE.find((item) => item.id === 'node.branch') ?? null
  }
  if (normalizedSelectionType === 'agent_node') {
    return LAB_CANVAS_SEMANTIC_TABLE.find((item) => item.id === 'node.agent') ?? null
  }
  if (normalizedSelectionType === 'event_node' || normalizedSelectionType === 'stage_node') {
    return LAB_CANVAS_SEMANTIC_TABLE.find((item) => item.id === 'node.event') ?? null
  }
  if (normalizedSelectionType === 'edge') {
    if (normalizedEdgeType.includes('parent')) {
      return LAB_CANVAS_SEMANTIC_TABLE.find((item) => item.id === 'edge.parent') ?? null
    }
    if (normalizedEdgeType.includes('stage')) {
      return LAB_CANVAS_SEMANTIC_TABLE.find((item) => item.id === 'edge.stage') ?? null
    }
    return LAB_CANVAS_SEMANTIC_TABLE.find((item) => item.id === 'edge.sequence') ?? null
  }
  return null
}
