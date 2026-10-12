/**
 * File Content Cache Store
 *
 * Provides VSCode-like buffers for small text/code files:
 * - In-memory cache for fast tab switching
 * - IndexedDB persistence for files < 1MB to avoid reloading on refresh
 * - Dirty tracking + save state
 */

import { create } from 'zustand'
import { createIdbStore } from '@/lib/storage/idb'
import * as fileApi from '@/lib/api/files'

const PERSIST_MAX_BYTES = 1 * 1024 * 1024 // 1MB
const MEMORY_MAX_BYTES = 20 * 1024 * 1024 // soft limit

export type FileSaveState = 'idle' | 'saving' | 'error'

export type FileContentKey = string

export interface FileContentEntry {
  key: FileContentKey
  projectId: string
  fileId: string
  mimeType?: string
  sizeBytes?: number
  updatedAt?: string
  content: string
  isDirty: boolean
  saveState: FileSaveState
  saveError?: string
  conflict?: {
    serverUpdatedAt?: string
  }
  lastAccessedAt: number
  lastSavedAt?: number
}

type PersistedEntry = Pick<
  FileContentEntry,
  | 'projectId'
  | 'fileId'
  | 'mimeType'
  | 'sizeBytes'
  | 'updatedAt'
  | 'content'
  | 'isDirty'
  | 'lastAccessedAt'
  | 'lastSavedAt'
  | 'conflict'
> & {
  v: 1
}

function makeKey(projectId: string, fileId: string): FileContentKey {
  return `${projectId}:${fileId}`
}

function getByteSize(text: string): number {
  try {
    return new TextEncoder().encode(text).byteLength
  } catch {
    return text.length
  }
}

function shouldPersist(entry: Pick<FileContentEntry, 'sizeBytes' | 'content'>): boolean {
  const bytes = entry.sizeBytes ?? getByteSize(entry.content)
  return bytes <= PERSIST_MAX_BYTES
}

const idb = createIdbStore({ dbName: 'ds-file-cache', version: 1, storeName: 'files' })

export interface FileContentState {
  entries: Record<FileContentKey, FileContentEntry>
  totalBytes: number
  loadingKeys: Record<FileContentKey, boolean>

  getKey: (projectId: string, fileId: string) => FileContentKey
  getEntry: (projectId: string, fileId: string) => FileContentEntry | undefined

  ensureLoaded: (args: {
    projectId: string
    fileId: string
    updatedAt?: string
    mimeType?: string
    sizeBytes?: number
  }) => Promise<FileContentEntry>
  reload: (args: {
    projectId: string
    fileId: string
    updatedAt?: string
    mimeType?: string
    sizeBytes?: number
    ignoreDirty?: boolean
  }) => Promise<FileContentEntry | undefined>

  setContent: (args: { projectId: string; fileId: string; content: string }) => void
  touch: (args: { projectId: string; fileId: string }) => void
  save: (args: { projectId: string; fileId: string }) => Promise<FileContentEntry>
  applyServerSnapshot: (args: {
    projectId: string
    fileId: string
    content: string
    updatedAt?: string
    sizeBytes?: number
    mimeType?: string
    keepDirty?: boolean
  }) => void
  evictIfNeeded: () => void
}

export const useFileContentStore = create<FileContentState>((set, get) => ({
  entries: {},
  totalBytes: 0,
  loadingKeys: {},

  getKey: makeKey,

  getEntry: (projectId, fileId) => get().entries[makeKey(projectId, fileId)],

  ensureLoaded: async ({ projectId, fileId, updatedAt, mimeType, sizeBytes }) => {
    const key = makeKey(projectId, fileId)
    const existing = get().entries[key]

    const setLoading = (loading: boolean) =>
      set((s) => ({ loadingKeys: { ...s.loadingKeys, [key]: loading } }))

    const upsert = (incoming: Omit<FileContentEntry, 'key'>) => {
      set((s) => {
        const prev = s.entries[key]
        const prevBytes = prev ? (prev.sizeBytes ?? getByteSize(prev.content)) : 0
        const nextBytes = incoming.sizeBytes ?? getByteSize(incoming.content)
        return {
          entries: { ...s.entries, [key]: { ...incoming, key } },
          totalBytes: Math.max(0, s.totalBytes - prevBytes + nextBytes),
        }
      })
      get().evictIfNeeded()
      return get().entries[key]!
    }

    // Memory hit
    if (existing) {
      // If we have local edits, keep them (Overleaf-like autosave is last-write-wins here)
      if (existing.isDirty) {
        get().touch({ projectId, fileId })
        return existing
      }

      // If server version changed, fetch fresh content
      if (existing.updatedAt && updatedAt && existing.updatedAt !== updatedAt) {
        // fall through
      } else {
        get().touch({ projectId, fileId })
        return existing
      }
    }

    setLoading(true)
    try {
      // Try IndexedDB cache for small files
      const persisted = await idb.get<PersistedEntry>(key)
      if (persisted) {
        const entry: FileContentEntry = {
          key,
          projectId: persisted.projectId,
          fileId: persisted.fileId,
          mimeType: persisted.mimeType,
          sizeBytes: persisted.sizeBytes ?? getByteSize(persisted.content),
          updatedAt: persisted.updatedAt,
          content: persisted.content,
          isDirty: persisted.isDirty,
          saveState: 'idle',
          conflict: undefined,
          lastAccessedAt: Date.now(),
          lastSavedAt: persisted.lastSavedAt,
          saveError: undefined,
        }

        // If cache is stale and NOT dirty, ignore it and fetch remote content
        if (updatedAt && entry.updatedAt && entry.updatedAt !== updatedAt && !entry.isDirty) {
          // ignore persisted
        } else {
          return upsert(entry)
        }
      }

      // Fetch from backend
      const text = await fileApi.getFileContent(fileId)
      const bytes = sizeBytes ?? getByteSize(text)
      const created = upsert({
        projectId,
        fileId,
        mimeType,
        sizeBytes: bytes,
        updatedAt,
        content: text,
        isDirty: false,
        saveState: 'idle',
        saveError: undefined,
        conflict: undefined,
        lastAccessedAt: Date.now(),
        lastSavedAt: undefined,
      })

      // Persist small files
      if (shouldPersist(created)) {
        const persistedEntry: PersistedEntry = {
          v: 1,
          projectId,
          fileId,
          mimeType,
          sizeBytes: created.sizeBytes,
          updatedAt: created.updatedAt,
          content: created.content,
          isDirty: created.isDirty,
          lastAccessedAt: created.lastAccessedAt,
          lastSavedAt: created.lastSavedAt,
          conflict: created.conflict,
        }
        await idb.set(key, persistedEntry)
      }

      return created
    } finally {
      setLoading(false)
    }
  },

  reload: async ({ projectId, fileId, updatedAt, mimeType, sizeBytes, ignoreDirty }) => {
    const key = makeKey(projectId, fileId)
    const existing = get().entries[key]

    if (existing?.isDirty && !ignoreDirty) {
      get().touch({ projectId, fileId })
      return existing
    }

    const setLoading = (loading: boolean) =>
      set((s) => ({ loadingKeys: { ...s.loadingKeys, [key]: loading } }))

    setLoading(true)
    try {
      const text = await fileApi.getFileContent(fileId)
      const bytes = sizeBytes ?? getByteSize(text)
      get().applyServerSnapshot({
        projectId,
        fileId,
        content: text,
        updatedAt,
        sizeBytes: bytes,
        mimeType,
      })
      return get().entries[key]
    } finally {
      setLoading(false)
    }
  },

  setContent: ({ projectId, fileId, content }) => {
    const key = makeKey(projectId, fileId)
    const now = Date.now()

    set((s) => {
      const prev = s.entries[key]
      const nextBytes = getByteSize(content)
      const prevBytes = prev ? (prev.sizeBytes ?? getByteSize(prev.content)) : 0

      const next: FileContentEntry = {
        key,
        projectId,
        fileId,
        mimeType: prev?.mimeType,
        sizeBytes: nextBytes,
        updatedAt: prev?.updatedAt,
        content,
        isDirty: true,
        saveState: prev?.saveState ?? 'idle',
        saveError: undefined,
        conflict: prev?.conflict,
        lastAccessedAt: now,
        lastSavedAt: prev?.lastSavedAt,
      }

      return {
        entries: { ...s.entries, [key]: next },
        totalBytes: Math.max(0, s.totalBytes - prevBytes + nextBytes),
      }
    })

    // Persist drafts for small files so refresh doesn't lose edits
    const entry = get().entries[key]
    if (entry && shouldPersist(entry)) {
      const persistedEntry: PersistedEntry = {
        v: 1,
        projectId,
        fileId,
        mimeType: entry.mimeType,
        sizeBytes: entry.sizeBytes,
        updatedAt: entry.updatedAt,
        content: entry.content,
        isDirty: entry.isDirty,
        lastAccessedAt: entry.lastAccessedAt,
        lastSavedAt: entry.lastSavedAt,
        conflict: entry.conflict,
      }
      idb.set(key, persistedEntry).catch(() => {
        // ignore persistence errors
      })
    }
  },

  touch: ({ projectId, fileId }) => {
    const key = makeKey(projectId, fileId)
    set((s) => {
      const entry = s.entries[key]
      if (!entry) return s
      return { entries: { ...s.entries, [key]: { ...entry, lastAccessedAt: Date.now() } } }
    })
  },

  save: async ({ projectId, fileId }) => {
    const key = makeKey(projectId, fileId)
    const entry = get().entries[key]
    if (!entry) {
      return await get().ensureLoaded({ projectId, fileId })
    }

    set((s) => ({
      entries: {
        ...s.entries,
        [key]: { ...s.entries[key]!, saveState: 'saving', saveError: undefined },
      },
    }))

    try {
      const result = await fileApi.updateFileContent(fileId, entry.content)
      const updatedAt = result.updated_at
      const next = {
        ...get().entries[key]!,
        isDirty: false,
        saveState: 'idle' as const,
        updatedAt,
        lastSavedAt: Date.now(),
        saveError: undefined,
        conflict: undefined,
      }

      set((s) => ({
        entries: { ...s.entries, [key]: next },
      }))

      if (shouldPersist(next)) {
        const persistedEntry: PersistedEntry = {
          v: 1,
          projectId,
          fileId,
          mimeType: next.mimeType,
          sizeBytes: next.sizeBytes,
          updatedAt: next.updatedAt,
          content: next.content,
          isDirty: next.isDirty,
          lastAccessedAt: next.lastAccessedAt,
          lastSavedAt: next.lastSavedAt,
          conflict: next.conflict,
        }
        await idb.set(key, persistedEntry)
      }

      return next
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed'
      set((s) => ({
        entries: {
          ...s.entries,
          [key]: { ...s.entries[key]!, saveState: 'error', saveError: message },
        },
      }))
      return get().entries[key]!
    }
  },

  applyServerSnapshot: ({ projectId, fileId, content, updatedAt, sizeBytes, mimeType, keepDirty }) => {
    const key = makeKey(projectId, fileId)
    const now = Date.now()

    set((s) => {
      const prev = s.entries[key]
      const prevBytes = prev ? (prev.sizeBytes ?? getByteSize(prev.content)) : 0
      const nextBytes = sizeBytes ?? getByteSize(content)

      const next: FileContentEntry = {
        key,
        projectId,
        fileId,
        mimeType: mimeType ?? prev?.mimeType,
        sizeBytes: nextBytes,
        updatedAt: updatedAt ?? prev?.updatedAt,
        content,
        isDirty: keepDirty ? !!prev?.isDirty : false,
        saveState: 'idle',
        saveError: undefined,
        conflict: undefined,
        lastAccessedAt: now,
        lastSavedAt: keepDirty ? prev?.lastSavedAt : now,
      }

      return {
        entries: { ...s.entries, [key]: next },
        totalBytes: Math.max(0, s.totalBytes - prevBytes + nextBytes),
      }
    })

    const entry = get().entries[key]
    if (entry && shouldPersist(entry)) {
      const persistedEntry: PersistedEntry = {
        v: 1,
        projectId,
        fileId,
        mimeType: entry.mimeType,
        sizeBytes: entry.sizeBytes,
        updatedAt: entry.updatedAt,
        content: entry.content,
        isDirty: entry.isDirty,
        lastAccessedAt: entry.lastAccessedAt,
        lastSavedAt: entry.lastSavedAt,
        conflict: undefined,
      }
      idb.set(key, persistedEntry).catch(() => {})
    }
  },

  evictIfNeeded: () => {
    const { totalBytes, entries } = get()
    if (totalBytes <= MEMORY_MAX_BYTES) return

    const list = Object.values(entries)
      .slice()
      .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)

    let bytes = totalBytes
    const nextEntries: Record<string, FileContentEntry> = { ...entries }
    for (const entry of list) {
      if (bytes <= MEMORY_MAX_BYTES) break
      if (entry.isDirty) continue
      const entryBytes = entry.sizeBytes ?? getByteSize(entry.content)
      delete nextEntries[entry.key]
      bytes -= entryBytes
    }

    if (bytes !== totalBytes) {
      set({ entries: nextEntries, totalBytes: Math.max(0, bytes) })
    }
  },
}))

export function useFileContentLoading(
  projectId?: string,
  fileId?: string
): boolean {
  const key = projectId && fileId ? makeKey(projectId, fileId) : null
  return useFileContentStore((s) => (key ? !!s.loadingKeys[key] : false))
}
