import { create } from 'zustand'
import type { SystemNotification } from '@/lib/types/notification'

type NotificationState = {
  projectId: string | null
  items: SystemNotification[]
  isLoading: boolean
  error: string | null
  setProject: (projectId: string | null) => void
  setNotifications: (projectId: string, items: SystemNotification[]) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  addNotification: (item: SystemNotification) => void
  markRead: (ids: string[]) => void
  markAllRead: () => void
  clear: () => void
}

export const useNotificationsStore = create<NotificationState>((set, get) => ({
  projectId: null,
  items: [],
  isLoading: false,
  error: null,
  setProject: (projectId) =>
    set((state) => ({
      projectId,
      items: projectId === state.projectId ? state.items : [],
      error: null,
    })),
  setNotifications: (projectId, items) =>
    set({
      projectId,
      items,
      error: null,
      isLoading: false,
    }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  addNotification: (item) =>
    set((state) => {
      if (state.projectId && item.project_id !== state.projectId) return state
      if (state.items.some((existing) => existing.id === item.id)) {
        return {
          ...state,
          items: state.items.map((existing) =>
            existing.id === item.id ? { ...existing, ...item } : existing
          ),
        }
      }
      return { ...state, items: [item, ...state.items] }
    }),
  markRead: (ids) =>
    set((state) => {
      if (ids.length === 0) return state
      const now = new Date().toISOString()
      return {
        ...state,
        items: state.items.map((item) =>
          ids.includes(item.id) ? { ...item, read_at: item.read_at ?? now } : item
        ),
      }
    }),
  markAllRead: () =>
    set((state) => {
      if (state.items.length === 0) return state
      const now = new Date().toISOString()
      return {
        ...state,
        items: state.items.map((item) => ({
          ...item,
          read_at: item.read_at ?? now,
        })),
      }
    }),
  clear: () => set({ items: [], error: null }),
}))
