'use client'

import { create } from 'zustand'
import type { CliServer, CliTerminalSession, CliTelemetryPoint } from '../types/cli'
import type { CliNotification } from '../services/notification-service'
import { ConnectionState, type ConnectionStatus } from '../types/connection'
import { listCliServers, updateCliServer } from '@/lib/api/cli'

interface CliStoreState {
  projectId: string | null
  servers: CliServer[]
  activeServerId: string | null
  isLoading: boolean
  error: string | null
  connectionStatus: ConnectionStatus
  sessionsByServer: Record<string, CliTerminalSession[]>
  notifications: CliNotification[]
  telemetryByServer: Record<string, CliTelemetryPoint[]>
}

interface CliStoreActions {
  setProjectId: (projectId: string) => void
  loadServers: (projectId: string) => Promise<void>
  refreshServers: () => Promise<void>
  setActiveServer: (serverId: string | null) => void
  updateServerStatus: (serverId: string, status: CliServer['status'], lastSeenAt?: string | null) => void
  updateServerName: (projectId: string, serverId: string, name: string) => Promise<void>
  setConnectionStatus: (status: ConnectionStatus) => void
  setSessions: (serverId: string, sessions: CliTerminalSession[]) => void
  addNotification: (notification: CliNotification) => void
  markNotificationRead: (id: string) => void
  clearNotifications: () => void
  pushTelemetryPoint: (serverId: string, point: CliTelemetryPoint) => void
  setTelemetrySeries: (serverId: string, points: CliTelemetryPoint[]) => void
}

export const useCliStore = create<CliStoreState & CliStoreActions>((set, get) => ({
  projectId: null,
  servers: [],
  activeServerId: null,
  isLoading: false,
  error: null,
  connectionStatus: {
    state: ConnectionState.DISCONNECTED,
    metrics: {
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      reconnectionAttempts: 0,
      averageReconnectTime: 0,
      messagesBuffered: 0,
      messagesDropped: 0,
    },
  },
  sessionsByServer: {},
  notifications: [],
  telemetryByServer: {},

  setProjectId: (projectId) => set({ projectId }),

  loadServers: async (projectId: string) => {
    set({ isLoading: true, error: null, projectId })
    try {
      const servers = await listCliServers(projectId)
      set({ servers, isLoading: false })
      if (!get().activeServerId && servers.length > 0) {
        set({ activeServerId: servers[0].id })
      }
    } catch (err) {
      console.error('[CLI] Failed to load servers:', err)
      set({ error: 'Failed to load servers', isLoading: false })
    }
  },

  refreshServers: async () => {
    const projectId = get().projectId
    if (!projectId) return
    await get().loadServers(projectId)
  },

  setActiveServer: (serverId) => set({ activeServerId: serverId }),

  updateServerStatus: (serverId, status, lastSeenAt) =>
    set((state) => ({
      servers: state.servers.map((server) =>
        server.id === serverId
          ? { ...server, status, last_seen_at: lastSeenAt ?? server.last_seen_at }
          : server
      ),
    })),

  updateServerName: async (projectId, serverId, name) => {
    const updated = await updateCliServer(projectId, serverId, { name })
    set((state) => ({
      servers: state.servers.map((server) => (server.id === serverId ? updated : server)),
    }))
  },

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setSessions: (serverId, sessions) =>
    set((state) => ({
      sessionsByServer: { ...state.sessionsByServer, [serverId]: sessions },
    })),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50),
    })),

  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((note) =>
        note.id === id ? { ...note, read: true } : note
      ),
    })),

  clearNotifications: () => set({ notifications: [] }),

  pushTelemetryPoint: (serverId, point) =>
    set((state) => {
      const existing = state.telemetryByServer[serverId] ?? []
      const next = [...existing, point].slice(-600)
      return { telemetryByServer: { ...state.telemetryByServer, [serverId]: next } }
    }),

  setTelemetrySeries: (serverId, points) =>
    set((state) => ({
      telemetryByServer: { ...state.telemetryByServer, [serverId]: points },
    })),
}))
