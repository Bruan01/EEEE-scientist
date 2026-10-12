import { describe, expect, it } from 'vitest'

import { findLatestRenderedOperationId, mergeFeedItemsForRender } from '@/lib/feedOperations'
import type { FeedItem } from '@/types'

type OperationItem = Extract<FeedItem, { type: 'operation' }>

function operation(overrides: Partial<OperationItem>): OperationItem {
  return {
    id: 'op-default',
    type: 'operation',
    label: 'tool_call',
    content: '',
    ...overrides,
  }
}

describe('feedOperations', () => {
  it('does not merge reused tool call ids across different runs', () => {
    const items: FeedItem[] = [
      operation({ id: 'call-1', runId: 'run-1', toolCallId: 'item_1', toolName: 'bash_exec', label: 'tool_call' }),
      operation({ id: 'result-1', runId: 'run-1', toolCallId: 'item_1', toolName: 'bash_exec', label: 'tool_result' }),
      operation({ id: 'call-2', runId: 'run-2', toolCallId: 'item_1', toolName: 'bash_exec', label: 'tool_call' }),
      operation({ id: 'result-2', runId: 'run-2', toolCallId: 'item_1', toolName: 'bash_exec', label: 'tool_result' }),
    ]

    const merged = mergeFeedItemsForRender(items)
    const operations = merged.filter((item): item is Extract<typeof merged[number], { type: 'operation' }> => item.type === 'operation')

    expect(operations).toHaveLength(2)
    expect(operations.map((item) => item.renderId)).toEqual(['tool:run-1:item_1', 'tool:run-2:item_1'])
    expect(findLatestRenderedOperationId(merged)).toBe('tool:run-2:item_1')
  })

  it('still merges tool call and result within the same run', () => {
    const items: FeedItem[] = [
      operation({ id: 'call', runId: 'run-1', toolCallId: 'item_9', toolName: 'file_change', label: 'tool_call' }),
      operation({
        id: 'result',
        runId: 'run-1',
        toolCallId: 'item_9',
        toolName: 'file_change',
        label: 'tool_result',
        output: JSON.stringify([{ path: '/tmp/example.py', kind: 'update' }]),
      }),
    ]

    const merged = mergeFeedItemsForRender(items)
    const operations = merged.filter((item): item is Extract<typeof merged[number], { type: 'operation' }> => item.type === 'operation')

    expect(operations).toHaveLength(1)
    expect(operations[0].hasResult).toBe(true)
    expect(operations[0].output).toContain('example.py')
  })
})
