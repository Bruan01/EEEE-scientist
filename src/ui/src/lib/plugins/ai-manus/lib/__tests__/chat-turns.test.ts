import { buildChatTurns } from '@/lib/plugins/ai-manus/lib/chat-turns'
import type {
  ChatMessageItem,
  MessageContent,
  ToolContent,
  ReasoningContent,
} from '@/lib/plugins/ai-manus/types'

describe('buildChatTurns', () => {
  it('preserves interleaved text and tool ordering', () => {
    const toolCall: ToolContent = {
      event_id: 'evt-tool-call',
      timestamp: 1,
      tool_call_id: 'tool-1',
      name: 'shell',
      status: 'calling',
      function: 'shell_exec',
      args: { command: 'echo 1' },
    }
    const toolResult: ToolContent = {
      event_id: 'evt-tool-result',
      timestamp: 4,
      tool_call_id: 'tool-1',
      name: 'shell',
      status: 'called',
      function: 'shell_exec',
      args: { command: 'echo 1' },
      content: { result: { stdout: 'ok' } },
    }

    const messages: ChatMessageItem[] = [
      {
        id: 'text-1',
        type: 'text_delta',
        seq: 1,
        ts: 1,
        content: {
          role: 'assistant',
          content: 'Alpha',
          timestamp: 1,
          status: 'completed',
        } as MessageContent,
      },
      {
        id: 'tool-call-1',
        type: 'tool_call',
        seq: 2,
        ts: 2,
        content: toolCall,
      },
      {
        id: 'text-2',
        type: 'text_delta',
        seq: 3,
        ts: 3,
        content: {
          role: 'assistant',
          content: 'Beta',
          timestamp: 3,
          status: 'completed',
        } as MessageContent,
      },
      {
        id: 'tool-result-1',
        type: 'tool_result',
        seq: 4,
        ts: 4,
        content: toolResult,
      },
    ]

    const blocks = buildChatTurns(messages).flatMap((turn) => turn.blocks)

    expect(blocks.map((block) => block.kind)).toEqual(['text', 'tool_call', 'text', 'tool_result'])
    expect((blocks[0].message.content as MessageContent).content).toContain('Alpha')
    expect((blocks[2].message.content as MessageContent).content).toContain('Beta')
  })

  it('merges consecutive reasoning blocks of the same kind', () => {
    const messages: ChatMessageItem[] = [
      {
        id: 'reasoning-1',
        type: 'reasoning',
        seq: 1,
        ts: 1,
        content: {
          reasoning_id: 'r-1',
          status: 'completed',
          kind: 'full',
          content: 'First part.',
          timestamp: 1,
        } as ReasoningContent,
      },
      {
        id: 'reasoning-2',
        type: 'reasoning',
        seq: 2,
        ts: 2,
        content: {
          reasoning_id: 'r-2',
          status: 'completed',
          kind: 'full',
          content: 'Second part.',
          timestamp: 2,
        } as ReasoningContent,
      },
    ]

    const blocks = buildChatTurns(messages).flatMap((turn) => turn.blocks)

    expect(blocks.map((block) => block.kind)).toEqual(['reasoning'])
    const mergedContent = (blocks[0].message.content as ReasoningContent).content
    expect(mergedContent).toContain('First part.')
    expect(mergedContent).toContain('Second part.')
    expect(blocks[0].sourceIds).toEqual(['reasoning-1', 'reasoning-2'])
  })
})
