import type { FeedItem } from '@/types'

import {
  mergeFeedItemsForRender,
  type RenderFeedItem,
  type RenderOperationFeedItem,
} from '@/lib/feedOperations'

type MessageItem = Extract<FeedItem, { type: 'message' }>
type ArtifactItem = Extract<FeedItem, { type: 'artifact' }>
type EventItem = Extract<FeedItem, { type: 'event' }>

export type StudioTurnRole = 'user' | 'assistant' | 'system'

export type StudioTurnBlock =
  | {
      id: string
      kind: 'message'
      item: MessageItem
    }
  | {
      id: string
      kind: 'reasoning'
      item: MessageItem
    }
  | {
      id: string
      kind: 'operation'
      item: RenderOperationFeedItem
    }
  | {
      id: string
      kind: 'artifact'
      item: ArtifactItem
    }
  | {
      id: string
      kind: 'event'
      item: EventItem
    }

export type StudioTurn = {
  id: string
  role: StudioTurnRole
  createdAt?: string
  runId?: string | null
  skillId?: string | null
  blocks: StudioTurnBlock[]
}

function artifactHasMetrics(item: ArtifactItem) {
  return Boolean(
    item.details?.primary_metric_id ||
      item.details?.primary_value != null ||
      item.details?.delta_vs_baseline != null ||
      item.details?.breakthrough_level ||
      item.details?.breakthrough
  )
}

function shouldRenderStudioArtifact(item: ArtifactItem) {
  if (item.kind !== 'run') return true
  return artifactHasMetrics(item)
}

function shouldRenderStudioEvent(item: EventItem) {
  const label = item.label.trim().toLowerCase()
  if (!label) return false
  if (label === 'run_started' || label === 'run_finished') return false
  if (label === 'quest_runtime_reconciled') return false
  return label === 'run_failed' || label.startsWith('quest_') || label === 'interaction.reply_received'
}

function createTurn(
  role: StudioTurnRole,
  item: RenderFeedItem | StudioTurnBlock['item']
): StudioTurn {
  let createdAt: string | undefined
  let runId: string | null | undefined
  let skillId: string | null | undefined

  if ('createdAt' in item) {
    createdAt = item.createdAt
  }
  if ('runId' in item) {
    runId = item.runId
  }
  if ('skillId' in item) {
    skillId = item.skillId
  }

  const basisId =
    ('id' in item && typeof item.id === 'string' && item.id) ||
    `${role}-${createdAt || 'unknown'}`

  return {
    id: `studio-turn:${basisId}`,
    role,
    createdAt,
    runId,
    skillId,
    blocks: [],
  }
}

function appendBlock(turn: StudioTurn, block: StudioTurnBlock) {
  turn.blocks.push(block)
  if (!turn.createdAt) {
    const createdAt = 'createdAt' in block.item ? block.item.createdAt : undefined
    if (createdAt) {
      turn.createdAt = createdAt
    }
  }
  if (
    !turn.runId &&
    'runId' in block.item &&
    typeof block.item.runId === 'string' &&
    block.item.runId
  ) {
    turn.runId = block.item.runId
  }
  if (
    !turn.skillId &&
    'skillId' in block.item &&
    typeof block.item.skillId === 'string' &&
    block.item.skillId
  ) {
    turn.skillId = block.item.skillId
  }
}

function normalizeComparableText(value: string | undefined | null) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function textsLookEquivalent(left: string | undefined | null, right: string | undefined | null) {
  const normalizedLeft = normalizeComparableText(left)
  const normalizedRight = normalizeComparableText(right)
  if (!normalizedLeft || !normalizedRight) return false
  if (normalizedLeft === normalizedRight) return true
  const [shorter, longer] =
    normalizedLeft.length <= normalizedRight.length
      ? [normalizedLeft, normalizedRight]
      : [normalizedRight, normalizedLeft]
  return shorter.length >= 48 && longer.includes(shorter)
}

function dropDuplicateRunArtifacts(turn: StudioTurn, message: MessageItem) {
  if (message.role !== 'assistant' || message.reasoning) {
    return
  }
  turn.blocks = turn.blocks.filter((block) => {
    if (block.kind !== 'artifact') return true
    if (block.item.kind !== 'run') return true
    if (artifactHasMetrics(block.item)) return true
    return !textsLookEquivalent(block.item.content, message.content)
  })
}

function ensureAssistantTurn(
  turns: StudioTurn[],
  current: StudioTurn | null,
  item: RenderFeedItem | MessageItem | ArtifactItem | EventItem
) {
  const itemRunId = 'runId' in item ? item.runId ?? null : null
  if (
    current &&
    current.role === 'assistant' &&
    (!itemRunId || !current.runId || current.runId === itemRunId)
  ) {
    return current
  }
  const next = createTurn('assistant', item)
  turns.push(next)
  return next
}

export function buildStudioTurns(items: FeedItem[]): StudioTurn[] {
  const renderItems = mergeFeedItemsForRender(items)
  const turns: StudioTurn[] = []
  let currentTurn: StudioTurn | null = null

  for (const item of renderItems) {
    if (item.type === 'message') {
      if (item.role === 'user') {
        currentTurn = createTurn('user', item)
        appendBlock(currentTurn, {
          id: `${item.id}:message`,
          kind: 'message',
          item,
        })
        turns.push(currentTurn)
        continue
      }

      currentTurn = ensureAssistantTurn(turns, currentTurn, item)
      dropDuplicateRunArtifacts(currentTurn, item)
      appendBlock(currentTurn, {
        id: `${item.id}:${item.reasoning ? 'reasoning' : 'message'}`,
        kind: item.reasoning ? 'reasoning' : 'message',
        item,
      })
      continue
    }

    if (item.type === 'operation') {
      currentTurn = ensureAssistantTurn(turns, currentTurn, item)
      appendBlock(currentTurn, {
        id: `${item.id}:operation`,
        kind: 'operation',
        item,
      })
      continue
    }

    if (item.type === 'artifact') {
      if (!shouldRenderStudioArtifact(item)) {
        continue
      }
      currentTurn = ensureAssistantTurn(turns, currentTurn, item)
      appendBlock(currentTurn, {
        id: `${item.id}:artifact`,
        kind: 'artifact',
        item,
      })
      continue
    }

    if (item.type === 'event' && shouldRenderStudioEvent(item)) {
      const role: StudioTurnRole =
        item.label === 'run_failed' ? 'assistant' : 'system'
      currentTurn =
        role === 'assistant'
          ? ensureAssistantTurn(turns, currentTurn, item)
          : createTurn('system', item)
      appendBlock(currentTurn, {
        id: `${item.id}:event`,
        kind: 'event',
        item,
      })
      if (role === 'system') {
        turns.push(currentTurn)
      }
      continue
    }
  }

  return turns.filter((turn) => turn.blocks.length > 0)
}
