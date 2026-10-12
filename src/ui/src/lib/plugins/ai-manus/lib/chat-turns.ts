import type { AttachmentsContent, ChatMessageItem, MessageContent, ReasoningContent, ToolContent } from '../types'

export type ChatTurnBlockKind =
  | 'text'
  | 'tool'
  | 'tool_call'
  | 'tool_result'
  | 'status'
  | 'step'
  | 'reasoning'
  | 'attachment'
  | 'attachments'
  | 'question_prompt'
  | 'clarify_question'
  | 'patch_review'

export type ChatTurnBlock = {
  id: string
  kind: ChatTurnBlockKind
  message: ChatMessageItem
  sourceIds: string[]
  role?: 'user' | 'assistant'
  agentLabel?: string | null
}

export type ChatTurn = {
  id: string
  blocks: ChatTurnBlock[]
}

function resolveAgentLabel(message: ChatMessageItem): string | null {
  if (message.type !== 'text_delta') return null
  const metadata = (message.content as MessageContent).metadata
  if (typeof metadata?.agent_label === 'string' && metadata.agent_label.trim()) {
    return metadata.agent_label
  }
  if (typeof metadata?.agent_id === 'string' && metadata.agent_id.trim()) {
    return `@${metadata.agent_id}`
  }
  return null
}

function mergeTextContent(left: string, right: string): string {
  if (!left) return right
  if (!right) return left
  const separator = left.endsWith('\n\n') ? '' : left.endsWith('\n') ? '\n' : '\n\n'
  return `${left}${separator}${right}`
}

function mergeTextMessages(base: ChatMessageItem, next: ChatMessageItem): ChatMessageItem {
  const baseContent = base.content as MessageContent
  const nextContent = next.content as MessageContent
  const mergedText = mergeTextContent(baseContent.content, nextContent.content)
  const mergedMetadata = nextContent.metadata ?? baseContent.metadata
  const mergedContent: MessageContent = {
    ...baseContent,
    ...nextContent,
    content: mergedText,
    metadata: mergedMetadata,
    role: nextContent.role ?? baseContent.role,
  }
  const mergedStatus =
    baseContent.status === 'in_progress' || nextContent.status === 'in_progress'
      ? 'in_progress'
      : nextContent.status ?? baseContent.status
  if (mergedStatus) {
    mergedContent.status = mergedStatus
  }
  return {
    ...base,
    content: mergedContent,
  }
}

function mergeReasoningMessages(base: ChatMessageItem, next: ChatMessageItem): ChatMessageItem {
  const baseContent = base.content as ReasoningContent
  const nextContent = next.content as ReasoningContent
  const mergedText = mergeTextContent(baseContent.content, nextContent.content)
  const mergedStatus =
    baseContent.status === 'in_progress' || nextContent.status === 'in_progress'
      ? 'in_progress'
      : nextContent.status ?? baseContent.status
  const mergedContent: ReasoningContent = {
    ...baseContent,
    ...nextContent,
    content: mergedText,
    status: mergedStatus,
    kind: baseContent.kind ?? nextContent.kind,
    reasoning_id: baseContent.reasoning_id,
  }
  return {
    ...base,
    content: mergedContent,
  }
}

function createTextBlock(message: ChatMessageItem): ChatTurnBlock {
  const content = message.content as MessageContent
  return {
    id: message.id,
    kind: 'text',
    role: content.role,
    message,
    sourceIds: [message.id],
    agentLabel: content.role === 'assistant' ? resolveAgentLabel(message) : null,
  }
}

function createNonTextBlock(message: ChatMessageItem): ChatTurnBlock {
  return {
    id: message.id,
    kind: message.type as ChatTurnBlockKind,
    message,
    sourceIds: [message.id],
  }
}

function mergeToolMessages(base: ChatMessageItem, next: ChatMessageItem): ChatMessageItem {
  const baseContent = base.content as ToolContent
  const nextContent = next.content as ToolContent
  const mergedContent: ToolContent = {
    ...baseContent,
    ...nextContent,
    args:
      nextContent.args && Object.keys(nextContent.args).length > 0
        ? nextContent.args
        : baseContent.args,
    content: nextContent.content ?? baseContent.content,
    metadata: nextContent.metadata ?? baseContent.metadata,
    error: nextContent.error ?? baseContent.error,
  }
  return {
    ...next,
    id: base.id,
    content: mergedContent,
  }
}

export function buildChatTurns(messages: ChatMessageItem[]): ChatTurn[] {
  const turns: ChatTurn[] = []
  let activeTurn: ChatTurn | null = null

  const startTurn = (id: string) => {
    const turn: ChatTurn = { id, blocks: [] }
    activeTurn = turn
    turns.push(turn)
    return turn
  }

  for (const message of messages) {
    if (message.type === 'text_delta') {
      const textContent = message.content as MessageContent
      if (textContent.role === 'user') {
        const turn = startTurn(message.id)
        turn.blocks.push(createTextBlock(message))
        continue
      }
    }

    if (message.type === 'attachments' || message.type === 'attachment') {
      const attachments = message.content as AttachmentsContent
      if (
        !activeTurn ||
        (attachments.role === 'user' &&
          activeTurn.blocks.length > 0 &&
          activeTurn.blocks[activeTurn.blocks.length - 1].role !== 'user')
      ) {
        activeTurn = startTurn(message.id)
      }
      if (!activeTurn) continue
      activeTurn.blocks.push(createNonTextBlock(message))
      continue
    }

    if (!activeTurn) {
      activeTurn = startTurn(message.id)
    }
    if (!activeTurn) continue

    if (message.type === 'text_delta') {
      const nextLabel = resolveAgentLabel(message)
      const lastBlock = activeTurn.blocks[activeTurn.blocks.length - 1]
      const lastRole = lastBlock?.role ?? null
      if (lastBlock?.kind === 'text' && lastRole === 'assistant' && lastBlock.agentLabel === nextLabel) {
        lastBlock.message = mergeTextMessages(lastBlock.message, message)
        lastBlock.sourceIds.push(message.id)
      } else {
        activeTurn.blocks.push(createTextBlock(message))
      }
      continue
    }

    if (message.type === 'reasoning') {
      const lastBlock = activeTurn.blocks[activeTurn.blocks.length - 1]
      if (lastBlock?.kind === 'reasoning') {
        const lastContent = lastBlock.message.content as ReasoningContent
        const nextContent = message.content as ReasoningContent
        const lastKind = lastContent.kind ?? 'full'
        const nextKind = nextContent.kind ?? 'full'
        if (lastKind === nextKind) {
          lastBlock.message = mergeReasoningMessages(lastBlock.message, message)
          lastBlock.sourceIds.push(message.id)
          continue
        }
      }
    }

    if (message.type === 'tool_call' || message.type === 'tool_result') {
      const nextTool = message.content as ToolContent
      if (nextTool.tool_call_id) {
        let merged = false
        for (let index = activeTurn.blocks.length - 1; index >= 0; index -= 1) {
          const candidate = activeTurn.blocks[index]
          if (candidate?.kind !== 'tool_call' && candidate?.kind !== 'tool_result') {
            continue
          }
          const previousTool = candidate.message.content as ToolContent
          if (
            previousTool.tool_call_id &&
            previousTool.tool_call_id === nextTool.tool_call_id
          ) {
            candidate.kind = message.type
            candidate.message = mergeToolMessages(candidate.message, message)
            candidate.sourceIds.push(message.id)
            merged = true
            break
          }
        }
        if (merged) {
          continue
        }
      }
    }

    activeTurn.blocks.push(createNonTextBlock(message))
  }

  return turns
}
