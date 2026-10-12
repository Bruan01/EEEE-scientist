import { describe, expect, it } from 'vitest'

import { buildQuestTranscriptMessages } from '@/lib/questTranscript'
import type { FeedItem } from '@/types'

describe('questTranscript', () => {
  it('keeps only user messages and interaction artifacts in the chat transcript', () => {
    const feed: FeedItem[] = [
      {
        id: 'user-1',
        type: 'message',
        role: 'user',
        content: 'Please send the update outward.',
        createdAt: '2026-04-21T09:00:00.000Z',
      },
      {
        id: 'assistant-runner',
        type: 'message',
        role: 'assistant',
        content: 'Internal runner reply that should stay in Studio only.',
        createdAt: '2026-04-21T09:00:02.000Z',
        eventType: 'runner.agent_message',
      },
      {
        id: 'assistant-delta',
        type: 'message',
        role: 'assistant',
        content: 'Streaming delta that should stay in Studio only.',
        createdAt: '2026-04-21T09:00:03.000Z',
        eventType: 'runner.delta',
        stream: true,
      },
      {
        id: 'tool-call',
        type: 'operation',
        label: 'tool_call',
        content: 'artifact.interact',
        toolName: 'artifact.interact',
        createdAt: '2026-04-21T09:00:04.000Z',
      },
      {
        id: 'interaction-1',
        type: 'artifact',
        kind: 'progress',
        content: 'Interaction update sent to the user.',
        interactionId: 'interaction-1',
        createdAt: '2026-04-21T09:00:05.000Z',
        attachments: [{ kind: 'file', name: 'summary.md' }],
      },
    ]

    expect(buildQuestTranscriptMessages(feed)).toEqual([
      expect.objectContaining({
        id: 'user-1',
        role: 'user',
        content: 'Please send the update outward.',
      }),
      expect.objectContaining({
        id: 'interaction-1',
        role: 'assistant',
        content: 'Interaction update sent to the user.',
        interactionId: 'interaction-1',
        attachments: [{ kind: 'file', name: 'summary.md' }],
      }),
    ])
  })

  it('dedupes repeated interaction artifacts until the next user turn', () => {
    const feed: FeedItem[] = [
      {
        id: 'user-1',
        type: 'message',
        role: 'user',
        content: 'Give me the current status.',
        createdAt: '2026-04-21T09:10:00.000Z',
      },
      {
        id: 'interaction-1',
        type: 'artifact',
        kind: 'progress',
        content: 'Current status: syncing artifacts.',
        interactionId: 'interaction-1',
        createdAt: '2026-04-21T09:10:05.000Z',
      },
      {
        id: 'interaction-1-duplicate',
        type: 'artifact',
        kind: 'progress',
        content: 'Current status: syncing artifacts.',
        interactionId: 'interaction-1',
        createdAt: '2026-04-21T09:10:20.000Z',
      },
      {
        id: 'user-2',
        type: 'message',
        role: 'user',
        content: 'Send the next update too.',
        createdAt: '2026-04-21T09:11:00.000Z',
      },
      {
        id: 'interaction-2',
        type: 'artifact',
        kind: 'progress',
        content: 'Current status: syncing artifacts.',
        interactionId: 'interaction-2',
        createdAt: '2026-04-21T09:11:05.000Z',
      },
    ]

    expect(buildQuestTranscriptMessages(feed).map((item) => item.id)).toEqual([
      'user-1',
      'interaction-1',
      'user-2',
      'interaction-2',
    ])
  })
})
