import type {
  AttachmentInfo,
  EventMetadata,
  ToolEventData,
  StepEventData,
  ReasoningEventData,
} from '@/lib/types/chat-events'

export type MessageType =
  | 'user'
  | 'assistant'
  | 'text_delta'
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

export interface BaseMessageContent {
  timestamp: number
  metadata?: EventMetadata
}

export interface MessageContent extends BaseMessageContent {
  content: string
  status?: 'in_progress' | 'completed'
  role: 'user' | 'assistant'
}

export type ToolContent = ToolEventData & {
  duration_ms?: number
  error?: string
}

export interface StepContent extends StepEventData {
  tools: ToolContent[]
}

export interface ReasoningContent extends ReasoningEventData {
  content: string
  collapsed?: boolean
}

export interface AttachmentsContent extends BaseMessageContent {
  role: 'user' | 'assistant'
  attachments: AttachmentInfo[]
}

export interface StatusContent extends BaseMessageContent {
  content: string
  status?: string
  actionLabel?: string
  actionId?: string
}

export type QuestionPromptAnswerValue = string | number | boolean | Array<string | number>

export type QuestionPromptAnswerMap = Record<string, QuestionPromptAnswerValue>

export interface QuestionPromptContent extends BaseMessageContent {
  toolCallId: string
  args: Record<string, unknown>
  status: 'calling' | 'called'
  answers?: QuestionPromptAnswerMap
  error?: string
}

export type ClarifyQuestionOption = {
  id: string
  label: string
}

export interface ClarifyQuestionContent extends BaseMessageContent {
  toolCallId?: string
  question: string
  options: ClarifyQuestionOption[]
  multi: boolean
  status: 'calling' | 'answered' | 'called'
  defaultSelected?: string[]
  selections?: string[]
  selectedLabels?: string[]
  missingFields?: string[]
  error?: string
  source?: 'backend' | 'local'
}

export type PatchReviewStatus = 'pending' | 'applying' | 'accepted' | 'rejected' | 'failed'

export type PatchReviewFile = {
  path: string
  changeType: 'create' | 'update' | 'delete' | 'move'
  diffLines: string[]
  moveTo?: string
}

export interface PatchReviewContent extends BaseMessageContent {
  patch: string
  files: PatchReviewFile[]
  status: PatchReviewStatus
  toolCallId?: string
  targetPath?: string
  rationale?: string
  summary?: {
    added?: number
    updated?: number
    deleted?: number
    moved?: number
  }
  error?: string
}

export interface ChatMessageItem {
  id: string
  type: MessageType
  seq: number
  ts: number
  content:
    | MessageContent
    | ToolContent
    | StepContent
    | ReasoningContent
    | AttachmentsContent
    | StatusContent
    | QuestionPromptContent
    | ClarifyQuestionContent
    | PatchReviewContent
}
