import { create } from 'zustand'
import { normalizePath } from '@/lib/plugins/cli/lib/file-utils'

const READ_EFFECT_DURATION_MS = 3500
const MOVE_EFFECT_DURATION_MS = 3000
const RENAME_EFFECT_DURATION_MS = 3000

const readTimers = new Map<string, number>()
const moveTimers = new Map<string, number>()
const renameTimers = new Map<string, number>()

export const buildCliEffectKey = (serverId: string, path: string) => {
  const normalized = normalizePath(path)
  return `${serverId}:${normalized}`
}

type CliFileEffectsState = {
  highlightedKey: string | null
  readingKeys: Set<string>
  writingKeys: Set<string>
  movedKeys: Set<string>
  renamedKeys: Set<string>
  highlight: (key: string) => void
  markRead: (key: string) => void
  markWrite: (key: string) => void
  clearWrite: (key: string) => void
  markMove: (key: string) => void
  clearMove: (key: string) => void
  markRename: (key: string) => void
  clearRename: (key: string) => void
}

export const useCliFileEffectsStore = create<CliFileEffectsState>((set, get) => ({
  highlightedKey: null,
  readingKeys: new Set(),
  writingKeys: new Set(),
  movedKeys: new Set(),
  renamedKeys: new Set(),
  highlight: (key) => {
    set({ highlightedKey: key })
    window.setTimeout(() => {
      const current = get().highlightedKey
      if (current === key) {
        set({ highlightedKey: null })
      }
    }, 3000)
  },
  markRead: (key) => {
    set((state) => {
      const next = new Set(state.readingKeys)
      next.add(key)
      return { readingKeys: next }
    })
    const existing = readTimers.get(key)
    if (existing) {
      window.clearTimeout(existing)
    }
    const timer = window.setTimeout(() => {
      readTimers.delete(key)
      set((state) => {
        if (!state.readingKeys.has(key)) return state
        const next = new Set(state.readingKeys)
        next.delete(key)
        return { readingKeys: next }
      })
    }, READ_EFFECT_DURATION_MS)
    readTimers.set(key, timer)
  },
  markWrite: (key) => {
    set((state) => {
      const next = new Set(state.writingKeys)
      next.add(key)
      return { writingKeys: next }
    })
  },
  clearWrite: (key) => {
    set((state) => {
      if (!state.writingKeys.has(key)) return state
      const next = new Set(state.writingKeys)
      next.delete(key)
      return { writingKeys: next }
    })
  },
  markMove: (key) => {
    set((state) => {
      const next = new Set(state.movedKeys)
      next.add(key)
      return { movedKeys: next }
    })
    const existing = moveTimers.get(key)
    if (existing) {
      window.clearTimeout(existing)
    }
    const timer = window.setTimeout(() => {
      moveTimers.delete(key)
      set((state) => {
        if (!state.movedKeys.has(key)) return state
        const next = new Set(state.movedKeys)
        next.delete(key)
        return { movedKeys: next }
      })
    }, MOVE_EFFECT_DURATION_MS)
    moveTimers.set(key, timer)
  },
  clearMove: (key) => {
    set((state) => {
      if (!state.movedKeys.has(key)) return state
      const next = new Set(state.movedKeys)
      next.delete(key)
      return { movedKeys: next }
    })
  },
  markRename: (key) => {
    set((state) => {
      const next = new Set(state.renamedKeys)
      next.add(key)
      return { renamedKeys: next }
    })
    const existing = renameTimers.get(key)
    if (existing) {
      window.clearTimeout(existing)
    }
    const timer = window.setTimeout(() => {
      renameTimers.delete(key)
      set((state) => {
        if (!state.renamedKeys.has(key)) return state
        const next = new Set(state.renamedKeys)
        next.delete(key)
        return { renamedKeys: next }
      })
    }, RENAME_EFFECT_DURATION_MS)
    renameTimers.set(key, timer)
  },
  clearRename: (key) => {
    set((state) => {
      if (!state.renamedKeys.has(key)) return state
      const next = new Set(state.renamedKeys)
      next.delete(key)
      return { renamedKeys: next }
    })
  },
}))
