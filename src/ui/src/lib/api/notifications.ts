import { apiClient } from '@/lib/api/client'
import type { NotificationListResponse } from '@/lib/types/notification'

const NOTIFICATIONS_BASE = '/api/v1/notifications'

function isLocalNotificationsFallbackError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const status = (error as { response?: { status?: number } }).response?.status
  return status === 404 || status === 405 || status === 501
}

export async function listNotifications(
  projectId: string,
  options?: { skip?: number; limit?: number }
): Promise<NotificationListResponse> {
  const params = new URLSearchParams()
  params.set('project_id', projectId)
  if (typeof options?.skip === 'number') {
    params.set('skip', String(options.skip))
  }
  if (typeof options?.limit === 'number') {
    params.set('limit', String(options.limit))
  }
  try {
    const response = await apiClient.get<NotificationListResponse>(
      `${NOTIFICATIONS_BASE}?${params.toString()}`
    )
    return response.data
  } catch (error) {
    if (!isLocalNotificationsFallbackError(error)) {
      throw error
    }
    return {
      items: [],
      total: 0,
      skip: options?.skip ?? 0,
      limit: options?.limit ?? 100,
      has_more: false,
    }
  }
}

export async function markNotificationsRead(ids: string[]): Promise<number> {
  if (!ids.length) return 0
  try {
    const response = await apiClient.post<{ updated: number }>(`${NOTIFICATIONS_BASE}/mark-read`, {
      ids,
    })
    return response.data.updated ?? 0
  } catch (error) {
    if (!isLocalNotificationsFallbackError(error)) {
      throw error
    }
    return ids.length
  }
}

export async function markAllNotificationsRead(projectId: string): Promise<number> {
  try {
    const response = await apiClient.post<{ updated: number }>(
      `${NOTIFICATIONS_BASE}/mark-all-read?project_id=${projectId}`
    )
    return response.data.updated ?? 0
  } catch (error) {
    if (!isLocalNotificationsFallbackError(error)) {
      throw error
    }
    return 0
  }
}
