import { create } from 'zustand'

import type { AdminRepair } from '@/lib/types/admin'

export type AdminOpsContext = {
  sourcePage?: string
  scope?: string
  targets?: Record<string, unknown>
  selectedPaths?: string[]
}

interface AdminOpsState {
  dockOpen: boolean
  activeRepair: AdminRepair | null
  context: AdminOpsContext
  closeDock: () => void
  startFreshSession: (path: string) => void
  resetContext: (path: string) => void
  clearContext: (path: string) => void
  setContext: (next: AdminOpsContext) => void
  openRepair: (repair: AdminRepair) => void
  clearActiveRepair: () => void
}

function createDefaultContext(path = '/settings'): AdminOpsContext {
  return {
    sourcePage: path,
    scope: 'system',
    targets: {},
    selectedPaths: [],
  }
}

export const useAdminOpsStore = create<AdminOpsState>((set) => ({
  dockOpen: false,
  activeRepair: null,
  context: createDefaultContext(),
  closeDock: () => {
    set({ dockOpen: false })
  },
  startFreshSession: (path) => {
    set({
      dockOpen: true,
      activeRepair: null,
      context: createDefaultContext(path),
    })
  },
  resetContext: (path) => {
    set((state) => ({
      context: createDefaultContext(path || state.context.sourcePage || '/settings'),
    }))
  },
  clearContext: (path) => {
    set((state) => ({
      context: createDefaultContext(path || state.context.sourcePage || '/settings'),
    }))
  },
  setContext: (next) => {
    set((state) => ({
      context: {
        ...state.context,
        ...next,
        targets: next.targets ? { ...next.targets } : state.context.targets,
        selectedPaths: next.selectedPaths ? [...next.selectedPaths] : state.context.selectedPaths,
      },
    }))
  },
  openRepair: (repair) => {
    set({
      dockOpen: true,
      activeRepair: repair,
    })
  },
  clearActiveRepair: () => {
    set({ activeRepair: null })
  },
}))
