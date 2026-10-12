import { create } from 'zustand'
import type { PremiumMessage, PremiumTargetScope } from '@/lib/types/messages'

type PremiumMessagesState = {
  scope: PremiumTargetScope | null
  projectId: string | null
  items: PremiumMessage[]
  isLoading: boolean
  error: string | null
  setMessages: (input: {
    scope: PremiumTargetScope
    projectId?: string | null
    items: PremiumMessage[]
  }) => void
  markRead: (id: string, readAt?: string) => void
  markDontRemind: (ids: string[], dismissedAt?: string) => void
  setLoading: (value: boolean) => void
  setError: (value: string | null) => void
  clear: () => void
}

export const usePremiumMessagesStore = create<PremiumMessagesState>((set) => ({
  scope: null,
  projectId: null,
  items: [],
  isLoading: false,
  error: null,
  setMessages: ({ scope, projectId = null, items }) =>
    set({
      scope,
      projectId,
      items: items || [],
      isLoading: false,
      error: null,
    }),
  markRead: (id, readAt) =>
    set((state) => {
      if (!id) return state
      const ts = readAt || new Date().toISOString()
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === id
            ? { ...item, state: { ...item.state, read_at: item.state.read_at ?? ts } }
            : item
        ),
      }
    }),
  markDontRemind: (ids, dismissedAt) =>
    set((state) => {
      if (!ids.length) return state
      const ts = dismissedAt || new Date().toISOString()
      return {
        ...state,
        items: state.items.map((item) =>
          ids.includes(item.id)
            ? {
                ...item,
                state: {
                  ...item.state,
                  dont_remind: true,
                  dismissed_at: item.state.dismissed_at ?? ts,
                },
              }
            : item
        ),
      }
    }),
  setLoading: (value) => set({ isLoading: value }),
  setError: (value) => set({ error: value }),
  clear: () => set({ scope: null, projectId: null, items: [], isLoading: false, error: null }),
}))
