export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export type SystemNotification = {
  id: string
  project_id: string
  user_id: string
  type: NotificationType
  title: string
  description?: string | null
  source?: string | null
  event?: string | null
  link?: string | null
  meta?: Record<string, unknown> | null
  created_at: string
  read_at?: string | null
}

export type NotificationListResponse = {
  items: SystemNotification[]
  total: number
  skip: number
  limit: number
  has_more: boolean
}
