"use client"

import { useMemo, useState } from 'react'
import { Bell, Check, Trash2 } from 'lucide-react'
import { useCliStore } from '../stores/cli-store'
import { requestNotificationPermission } from '../services/notification-service'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/useI18n'

export function NotificationCenter() {
  const { t } = useI18n('cli')
  const notifications = useCliStore((state) => state.notifications)
  const markNotificationRead = useCliStore((state) => state.markNotificationRead)
  const clearNotifications = useCliStore((state) => state.clearNotifications)
  const [permission, setPermission] = useState<NotificationPermission | null>(null)

  const unreadCount = useMemo(
    () => notifications.filter((note) => !note.read).length,
    [notifications]
  )

  const handlePermission = async () => {
    const result = await requestNotificationPermission()
    setPermission(result)
  }

  return (
    <div className="cli-card rounded-2xl border border-white/40 bg-white/70 p-4 text-sm text-[var(--cli-muted-1)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--cli-ink-1)]">
          <Bell className="h-4 w-4" />
          {t('notifications')}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--cli-muted-1)]">{t('unread_count', { count: unreadCount })}</span>
          {notifications.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={clearNotifications}>
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              {t('clear')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {notifications.map((note) => (
          <div
            key={note.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-white/40 bg-white/70 px-3 py-2"
          >
            <div>
              <div className="text-sm font-medium text-[var(--cli-ink-1)]">{note.title}</div>
              {note.body ? (
                <div className="mt-1 text-xs text-[var(--cli-muted-1)]">{note.body}</div>
              ) : null}
            </div>
            {!note.read ? (
              <button
                type="button"
                className="cli-focus-ring text-[var(--cli-muted-1)] hover:text-[var(--cli-ink-1)]"
                onClick={() => markNotificationRead(note.id)}
                title={t('mark_as_read')}
                aria-label={t('mark_as_read')}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ))}
        {notifications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/50 bg-white/40 p-4 text-center text-xs text-[var(--cli-muted-1)]">
            {t('no_notifications_yet')}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-white/40 bg-white/70 px-3 py-2 text-xs text-[var(--cli-muted-1)]">
        <span>{t('browser_notifications', { permission: permission ?? Notification.permission })}</span>
        <Button variant="secondary" size="sm" onClick={handlePermission}>
          {t('enable')}
        </Button>
      </div>
    </div>
  )
}
