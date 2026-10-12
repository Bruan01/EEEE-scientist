import type {
  AttachmentsContent,
  ChatMessageItem,
  ClarifyQuestionContent,
  MessageContent,
  QuestionPromptContent,
  ReasoningContent,
  StepContent,
  ToolContent,
} from '../types'
import { redactSensitive, truncateText } from '@/lib/bugbash/sanitize'

const MAX_EVENTS = 400
const PREVIEW_LIMIT = 180

type TimelineSummaryMeta = {
  session_id?: string | null
  project_id?: string | null
  title?: string | null
  mode?: string | null
  ui_surface?: string | null
  execution_target?: string | null
}

export type CopilotTimelineSummary = TimelineSummaryMeta & {
  exported_at: string
  totals: {
    total_messages: number
    exported_messages: number
    truncated: boolean
  }
  events: Array<Record<string, unknown>>
}

const buildPreview = (text?: string | null) => {
  if (!text) return undefined
  const cleaned = redactSensitive(text.trim())
  if (!cleaned) return undefined
  return truncateText(cleaned, PREVIEW_LIMIT)
}

const safeKeys = (value: unknown) => {
  if (!value || typeof value !== 'object') return []
  return Object.keys(value).slice(0, 12)
}

const extractExtensions = (attachments: AttachmentsContent['attachments']) => {
  const extensions = new Set<string>()
  for (const attachment of attachments) {
    if (attachment.filename) {
      const parts = attachment.filename.split('.')
      if (parts.length > 1) {
        extensions.add(parts.pop()!.toLowerCase())
      }
    } else if (attachment.content_type) {
      extensions.add(attachment.content_type)
    }
  }
  return Array.from(extensions).slice(0, 8)
}

export function buildCopilotTimelineSummary(
  messages: ChatMessageItem[],
  meta: TimelineSummaryMeta = {}
): CopilotTimelineSummary {
  const trimmed = messages.slice(-MAX_EVENTS)
  const truncated = messages.length > trimmed.length
  const events = trimmed.map((message) => {
    const base = {
      id: message.id,
      seq: message.seq,
      ts: message.ts,
      type: message.type,
    } as Record<string, unknown>

    switch (message.type) {
      case 'text_delta': {
        const content = message.content as MessageContent
        return {
          ...base,
          role: content.role,
          status: content.status,
          length: content.content?.length ?? 0,
          preview: buildPreview(content.content),
        }
      }
      case 'tool':
      case 'tool_call':
      case 'tool_result': {
        const content = message.content as ToolContent
        return {
          ...base,
          status: content.status,
          tool: content.name,
          function: content.function,
          tool_call_id: content.tool_call_id,
          args_keys: safeKeys(content.args),
          result_keys: safeKeys(content.content),
          ui_effect: content.ui_effect?.name,
        }
      }
      case 'step': {
        const content = message.content as StepContent
        return {
          ...base,
          status: content.status,
          description: buildPreview(content.description),
          tool_count: content.tools?.length ?? 0,
        }
      }
      case 'reasoning': {
        const content = message.content as ReasoningContent
        return {
          ...base,
          status: content.status,
          kind: content.kind,
          length: content.content?.length ?? 0,
          preview: buildPreview(content.content),
        }
      }
      case 'attachments':
      case 'attachment': {
        const content = message.content as AttachmentsContent
        return {
          ...base,
          role: content.role,
          attachments: {
            count: content.attachments.length,
            types: extractExtensions(content.attachments),
          },
        }
      }
      case 'question_prompt': {
        const content = message.content as QuestionPromptContent
        return {
          ...base,
          status: content.status,
          tool_call_id: content.toolCallId,
          args_keys: safeKeys(content.args),
          answer_keys: content.answers ? Object.keys(content.answers).slice(0, 12) : [],
        }
      }
      case 'clarify_question': {
        const content = message.content as ClarifyQuestionContent
        return {
          ...base,
          status: content.status,
          question: buildPreview(content.question),
          options: content.options?.length ?? 0,
          selections: content.selections?.length ?? 0,
        }
      }
      case 'status': {
        const content = message.content as { content?: string; status?: string }
        return {
          ...base,
          status: content.status,
          preview: buildPreview(content.content),
        }
      }
      default:
        return base
    }
  })

  return {
    exported_at: new Date().toISOString(),
    ...meta,
    totals: {
      total_messages: messages.length,
      exported_messages: trimmed.length,
      truncated,
    },
    events,
  }
}
