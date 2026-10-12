import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '@/lib/stores/auth'
import type { SystemNotification } from '@/lib/types/notification'
import { resolveApiBaseUrl } from '@/lib/api/client'
import { supportsSocketIo } from '@/lib/runtime/quest-runtime'

export interface NotificationServerEvents {
  'notification:new': (payload: { notification: SystemNotification }) => void
}

export interface NotificationClientEvents {
  'notify:join': (payload: { projectId: string }) => void
  'notify:leave': (payload: { projectId: string }) => void
}

export type NotificationSocket = Socket<NotificationServerEvents, NotificationClientEvents>

// Use resolveApiBaseUrl from @/lib/api/client for consistent API URL resolution
const getApiBaseUrl = resolveApiBaseUrl

type SocketEntry = {
  socket: NotificationSocket
  refCount: number
}

const SOCKET_CACHE = new Map<string, SocketEntry>()

function createNoopNotificationSocket(): NotificationSocket {
  const socket = {
    connected: false,
    connect: () => socket,
    disconnect: () => socket,
    on: () => socket,
    off: () => socket,
    emit: () => true,
  }
  return socket as unknown as NotificationSocket
}

export function acquireNotificationSocket(): { socket: NotificationSocket; release: () => void } {
  if (!supportsSocketIo()) {
    return {
      socket: createNoopNotificationSocket(),
      release: () => {},
    }
  }
  const endpoint = getApiBaseUrl()
  let entry = SOCKET_CACHE.get(endpoint)

  if (!entry) {
    const socket = io(endpoint, {
      path: '/ws/socket.io',
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: (cb) => {
        const token =
          useAuthStore.getState().accessToken ||
          (typeof window !== 'undefined' ? window.localStorage.getItem('ds_access_token') : null)
        cb({ token })
      },
    }) as NotificationSocket

    entry = { socket, refCount: 0 }
    SOCKET_CACHE.set(endpoint, entry)
  }

  entry.refCount += 1
  if (!entry.socket.connected) {
    entry.socket.connect()
  }

  return {
    socket: entry.socket,
    release: () => {
      const cur = SOCKET_CACHE.get(endpoint)
      if (!cur) return
      cur.refCount -= 1
      if (cur.refCount <= 0) {
        cur.socket.disconnect()
        SOCKET_CACHE.delete(endpoint)
      }
    },
  }
}
