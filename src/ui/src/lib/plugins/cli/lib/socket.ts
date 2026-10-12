import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '@/lib/stores/auth'
import { resolveApiBaseUrl } from '@/lib/api/client'
import { supportsSocketIo } from '@/lib/runtime/quest-runtime'
import type { CliEnvelope } from './protocol'

export type CliSocket = Socket<any, any>

export type SocketAuthMode = 'user'

type SocketEntry = {
  socket: CliSocket
  refCount: number
}

const SOCKET_CACHE = new Map<string, SocketEntry>()
const CLIENT_ID_KEY = 'ds_cli_client_id'
let cachedClientId: string | null = null

function createNoopCliSocket(): CliSocket {
  const socket = {
    connected: false,
    connect: () => socket,
    disconnect: () => socket,
    on: () => socket,
    off: () => socket,
    emit: () => true,
  }
  return socket as unknown as CliSocket
}

export function getCliClientId(): string {
  if (cachedClientId) return cachedClientId
  let clientId = ''
  if (typeof window !== 'undefined') {
    try {
      clientId = window.localStorage.getItem(CLIENT_ID_KEY) || ''
    } catch {
      clientId = ''
    }
  }
  if (!clientId) {
    try {
      clientId = crypto.randomUUID()
    } catch {
      clientId = `cli-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(CLIENT_ID_KEY, clientId)
      } catch {
        // noop
      }
    }
  }
  cachedClientId = clientId
  return clientId
}

// Use resolveApiBaseUrl from @/lib/api/client for consistent API URL resolution

export function acquireCliSocket(options: { authMode?: SocketAuthMode } = {}) {
  if (!supportsSocketIo()) {
    return {
      socket: createNoopCliSocket(),
      release: () => {},
    }
  }
  const endpoint = resolveApiBaseUrl()
  const cacheKey = `${endpoint}::user`

  let entry = SOCKET_CACHE.get(cacheKey)
  if (!entry) {
    const socket = io(`${endpoint}/cli`, {
      path: '/ws/socket.io',
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: (cb) => {
        const client_id = getCliClientId()
        const protocol_version = 'cli.v1'
        const token =
          useAuthStore.getState().accessToken ||
          (typeof window !== 'undefined' ? window.localStorage.getItem('ds_access_token') : null)
        cb({ token: token || null, client_id, protocol_version })
      },
    }) as CliSocket

    entry = { socket, refCount: 0 }
    SOCKET_CACHE.set(cacheKey, entry)
  }

  entry.refCount += 1
  if (!entry.socket.connected) {
    entry.socket.connect()
  }

  return {
    socket: entry.socket,
    release: () => {
      const current = SOCKET_CACHE.get(cacheKey)
      if (!current) return
      current.refCount -= 1
      if (current.refCount <= 0) {
        current.socket.disconnect()
        SOCKET_CACHE.delete(cacheKey)
      }
    },
  }
}

export function unwrapPayload<T = any>(data: CliEnvelope<T> | T): T {
  if (data && typeof data === 'object' && 'payload' in data) {
    return (data as CliEnvelope<T>).payload
  }
  return data as T
}
