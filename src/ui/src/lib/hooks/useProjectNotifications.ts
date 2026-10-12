import { useEffect } from 'react'
import { listNotifications } from '@/lib/api/notifications'
import { supportsNotifications } from '@/lib/runtime/quest-runtime'
import { useNotificationsStore } from '@/lib/stores/notifications'
import { acquireNotificationSocket } from '@/lib/realtime/notification-socket'
import type { SystemNotification } from '@/lib/types/notification'

export function useProjectNotifications(projectId: string | null) {
  const setProject = useNotificationsStore((state) => state.setProject)
  const setNotifications = useNotificationsStore((state) => state.setNotifications)
  const setLoading = useNotificationsStore((state) => state.setLoading)
  const setError = useNotificationsStore((state) => state.setError)
  const addNotification = useNotificationsStore((state) => state.addNotification)

  useEffect(() => {
    if (!projectId) {
      setProject(null)
      return
    }

    if (!supportsNotifications()) {
      setNotifications(projectId, [])
      setLoading(false)
      setError(null)
      return
    }

    let active = true
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const response = await listNotifications(projectId, { limit: 100 })
        if (!active) return
        setNotifications(projectId, response.items || [])
      } catch (err: any) {
        if (!active) return
        setError(err?.message || 'Failed to load notifications')
        setLoading(false)
      }
    })()

    const { socket, release } = acquireNotificationSocket()
    socket.emit('notify:join', { projectId })

    const handleNew = (payload: { notification: SystemNotification }) => {
      if (payload?.notification) {
        addNotification(payload.notification)
      }
    }
    socket.on('notification:new', handleNew)

    return () => {
      active = false
      socket.off('notification:new', handleNew)
      socket.emit('notify:leave', { projectId })
      release()
    }
  }, [addNotification, projectId, setError, setLoading, setNotifications, setProject])
}
