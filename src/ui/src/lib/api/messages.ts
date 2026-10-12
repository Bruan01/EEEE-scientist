import { apiClient } from './client'
import type { PremiumMessageListResponse, PremiumTargetScope } from '@/lib/types/messages'

export async function listPremiumMessages(params: {
  scope: PremiumTargetScope
  project_id?: string
}): Promise<PremiumMessageListResponse> {
  const response = await apiClient.get<PremiumMessageListResponse>('/api/v1/messages/premium', {
    params,
  })
  return response.data
}

export async function dismissPremiumMessage(
  messageId: string,
  input?: { dont_remind?: boolean }
): Promise<{ success: boolean }> {
  const response = await apiClient.post<{ success: boolean }>(
    `/api/v1/messages/${messageId}/dismiss`,
    {
      dont_remind: input?.dont_remind ?? true,
    }
  )
  return response.data
}

export async function markPremiumMessageRead(
  messageId: string
): Promise<{ success: boolean; read_at?: string }> {
  const response = await apiClient.post<{ success: boolean; read_at?: string }>(
    `/api/v1/messages/${messageId}/read`
  )
  return response.data
}
