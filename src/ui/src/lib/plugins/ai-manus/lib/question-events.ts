import type { QuestionPromptAnswerMap } from '@/lib/plugins/ai-manus/types'

export const LAB_QUESTION_ANSWERED_EVENT = 'ds:lab:question-answered'

export type LabQuestionAnsweredDetail = {
  sessionId: string
  toolCallId: string
  answers?: QuestionPromptAnswerMap | null
}
