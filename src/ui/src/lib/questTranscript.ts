import type { FeedItem } from '@/types'

export type QuestTranscriptMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachments?: Array<Record<string, unknown>>
  createdAt?: string
  streaming?: boolean
  badge?: string | null
  deliveryState?: string | null
  readState?: string | null
  readReason?: string | null
  readAt?: string | null
  messageId?: string | null
  interactionId?: string | null
  emphasis?: 'message' | 'artifact'
}

function normalizeComparableText(value?: string | null) {
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

function parseTimestampMs(value?: string) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function withinDuplicateWindow(left?: string, right?: string, seconds = 90) {
  const leftMs = parseTimestampMs(left)
  const rightMs = parseTimestampMs(right)
  if (leftMs == null || rightMs == null) return true
  return Math.abs(leftMs - rightMs) <= seconds * 1000
}

function isVisibleUserMessage(item: Extract<FeedItem, { type: 'message' }>) {
  return item.role === 'user' && (item.content.trim().length > 0 || (item.attachments?.length || 0) > 0)
}

function isVisibleInteractiveArtifact(item: Extract<FeedItem, { type: 'artifact' }>) {
  return Boolean(item.interactionId && item.content.trim())
}

function shouldSuppressDuplicateInteraction(
  rendered: QuestTranscriptMessage[],
  candidate: Extract<FeedItem, { type: 'artifact' }>
) {
  const candidateInteractionId = String(candidate.interactionId || '').trim()

  for (let index = rendered.length - 1; index >= 0; index -= 1) {
    const previous = rendered[index]
    if (previous.role === 'user') {
      return false
    }

    const previousInteractionId = String(previous.interactionId || '').trim()
    if (
      candidateInteractionId &&
      previousInteractionId &&
      candidateInteractionId === previousInteractionId &&
      textsLookEquivalent(previous.content, candidate.content)
    ) {
      return true
    }

    if (!withinDuplicateWindow(previous.createdAt, candidate.createdAt)) {
      continue
    }
    if (textsLookEquivalent(previous.content, candidate.content)) {
      return true
    }
  }

  return false
}

export function buildQuestTranscriptMessages(feed: FeedItem[]): QuestTranscriptMessage[] {
  const messages: QuestTranscriptMessage[] = []

  for (const item of feed) {
    if (item.type === 'message') {
      if (!isVisibleUserMessage(item)) {
        continue
      }
      messages.push({
        id: item.id,
        role: 'user',
        content: item.content.trim(),
        attachments: item.attachments,
        createdAt: item.createdAt,
        streaming: false,
        deliveryState: item.deliveryState ?? null,
        readState: item.readState ?? null,
        readReason: item.readReason ?? null,
        readAt: item.readAt ?? null,
        messageId: item.messageId ?? null,
        emphasis: 'message',
      })
      continue
    }

    if (item.type !== 'artifact' || !isVisibleInteractiveArtifact(item)) {
      continue
    }
    if (shouldSuppressDuplicateInteraction(messages, item)) {
      continue
    }

    messages.push({
      id: item.id,
      role: 'assistant',
      content: item.content.trim(),
      attachments: item.attachments,
      createdAt: item.createdAt,
      streaming: false,
      interactionId: item.interactionId ?? null,
      emphasis: 'message',
    })
  }

  return messages
}
