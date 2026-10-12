export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

export type CliNotification = {
  id: string
  title: string
  body?: string
  level: NotificationLevel
  createdAt: number
  read?: boolean
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied'
  }
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

export function sendBrowserNotification(title: string, body?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  new Notification(title, { body })
}
