import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatSurface, ExecutionTarget } from '@/lib/types/chat-events'

interface ChatSessionState {
  sessionIdsByProject: Record<string, string>
  sessionIdsByProjectSurface: Record<string, Record<ChatSurface, string>>
  lastEventIdBySession: Record<string, string | null>
  executionTargetsByProject: Record<string, ExecutionTarget>
  cliServerIdsByProject: Record<string, string | null>
}

interface ChatSessionActions {
  setSessionId: (projectId: string, sessionId: string) => void
  clearSessionId: (projectId: string) => void
  getSessionId: (projectId: string) => string | null
  setSessionIdForSurface: (projectId: string, surface: ChatSurface, sessionId: string) => void
  clearSessionIdForSurface: (projectId: string, surface: ChatSurface) => void
  getSessionIdForSurface: (projectId: string, surface: ChatSurface) => string | null
  setLastEventId: (sessionId: string, eventId: string | null) => void
  getLastEventId: (sessionId: string) => string | null
  setExecutionTarget: (
    projectId: string,
    target: ExecutionTarget,
    cliServerId?: string | null
  ) => void
  setCliServerId: (projectId: string, cliServerId: string | null) => void
  getExecutionTarget: (projectId: string) => ExecutionTarget
  getCliServerId: (projectId: string) => string | null
}

export const useChatSessionStore = create<ChatSessionState & ChatSessionActions>()(
  persist(
    (set, get) => ({
      sessionIdsByProject: {},
      sessionIdsByProjectSurface: {},
      lastEventIdBySession: {},
      executionTargetsByProject: {},
      cliServerIdsByProject: {},

      setSessionId: (projectId, sessionId) =>
        set((state) => ({
          sessionIdsByProject: {
            ...state.sessionIdsByProject,
            [projectId]: sessionId,
          },
        })),

      clearSessionId: (projectId) =>
        set((state) => {
          const next = { ...state.sessionIdsByProject }
          delete next[projectId]
          return { sessionIdsByProject: next }
        }),

      getSessionId: (projectId) => get().sessionIdsByProject[projectId] ?? null,

      setSessionIdForSurface: (projectId, surface, sessionId) =>
        set((state) => ({
          sessionIdsByProjectSurface: {
            ...state.sessionIdsByProjectSurface,
            [projectId]: {
              ...(state.sessionIdsByProjectSurface[projectId] ?? {}),
              [surface]: sessionId,
            },
          },
        })),

      clearSessionIdForSurface: (projectId, surface) =>
        set((state) => {
          const current = state.sessionIdsByProjectSurface[projectId]
          if (!current || !(surface in current)) return {}
          const next = { ...current }
          delete (next as Partial<Record<ChatSurface, string>>)[surface]
          return {
            sessionIdsByProjectSurface: {
              ...state.sessionIdsByProjectSurface,
              [projectId]: next as Record<ChatSurface, string>,
            },
          }
        }),

      getSessionIdForSurface: (projectId, surface) =>
        get().sessionIdsByProjectSurface[projectId]?.[surface] ?? null,

      setLastEventId: (sessionId, eventId) =>
        set((state) => ({
          lastEventIdBySession: {
            ...state.lastEventIdBySession,
            [sessionId]: eventId,
          },
        })),

      getLastEventId: (sessionId) => get().lastEventIdBySession[sessionId] ?? null,

      setExecutionTarget: (projectId, target, cliServerId) =>
        set((state) => {
          const shouldUpdateCliServerId = typeof cliServerId !== 'undefined'
          return {
            executionTargetsByProject: {
              ...state.executionTargetsByProject,
              [projectId]: target,
            },
            cliServerIdsByProject: {
              ...state.cliServerIdsByProject,
              [projectId]: shouldUpdateCliServerId
                ? cliServerId
                : state.cliServerIdsByProject[projectId] ?? null,
            },
          }
        }),

      setCliServerId: (projectId, cliServerId) =>
        set((state) => ({
          cliServerIdsByProject: {
            ...state.cliServerIdsByProject,
            [projectId]: cliServerId,
          },
        })),

      getExecutionTarget: (projectId) =>
        get().executionTargetsByProject[projectId] ?? 'sandbox',

      getCliServerId: (projectId) => get().cliServerIdsByProject[projectId] ?? null,
    }),
    {
      name: 'ds-chat-session-store',
      partialize: (state) => ({
        sessionIdsByProject: state.sessionIdsByProject,
        sessionIdsByProjectSurface: state.sessionIdsByProjectSurface,
        lastEventIdBySession: state.lastEventIdBySession,
        executionTargetsByProject: state.executionTargetsByProject,
        cliServerIdsByProject: state.cliServerIdsByProject,
      }),
    }
  )
)
