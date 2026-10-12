import { apiClient } from './client'

export type FeedbackCreateInput = {
  title: string
  description: string
  improvement_suggestion?: string
  type: 'bug' | 'feature' | 'improvement' | 'question' | 'info' | 'other'
  priority: 'low' | 'medium' | 'high' | 'critical'
  project_id?: string
  page_path?: string
  meta?: Record<string, unknown>
  screenshot_url?: string
}

export type FeedbackSubmitResponse = {
  success: boolean
  feedback_id: string
}

export async function submitFeedback(input: FeedbackCreateInput): Promise<FeedbackSubmitResponse> {
  const response = await apiClient.post<FeedbackSubmitResponse>('/api/feedback', input)
  return response.data
}
