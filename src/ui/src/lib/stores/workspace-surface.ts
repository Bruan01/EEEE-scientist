'use client'

import { create } from 'zustand'

export type WorkspaceContentKind =
  | 'pdf'
  | 'markdown'
  | 'mdx'
  | 'html'
  | 'latex'
  | 'notebook'
  | 'lab'
  | 'cli'
  | 'code'
  | 'file'

export type WorkspaceDocumentMode =
  | 'pdf'
  | 'markdown'
  | 'novel'
  | 'rendered'
  | 'source'
  | 'preview'
  | 'snapshot'
  | 'diff'

export type WorkspaceCompileState = 'idle' | 'saving' | 'compiling' | 'error'

export type WorkspaceSelectionReferenceRect = {
  left: number
  top: number
  width: number
  height: number
  pageNumber?: number
}

export type WorkspaceSelectionReference = {
  id: string
  kind: 'pdf_text'
  tabId: string
  fileId?: string
  resourceId?: string
  resourcePath?: string
  resourceName?: string
  pageNumber?: number
  selectedText: string
  markdownExcerpt?: string
  excerptStatus?: 'idle' | 'loading' | 'ready' | 'error'
  rects?: WorkspaceSelectionReferenceRect[]
  createdAt: string
}

export type WorkspaceIssueFocus = {
  kind: 'latex_error'
  tabId: string
  fileId?: string
  resourceId?: string
  resourcePath?: string
  resourceName?: string
  line?: number
  message: string
  severity: 'error' | 'warning'
  excerpt?: string
  createdAt: string
}

export type WorkspaceTabViewState = {
  contentKind?: WorkspaceContentKind
  documentMode?: WorkspaceDocumentMode
  resourceName?: string
  resourcePath?: string
  pageNumber?: number
  isReadOnly?: boolean
  selectionCount?: number
  compileState?: WorkspaceCompileState
  diagnostics?: {
    errors?: number
    warnings?: number
  }
}

type WorkspaceSurfaceStore = {
  tabState: Record<string, WorkspaceTabViewState>
  references: Record<string, WorkspaceSelectionReference>
  referencesByTabId: Record<string, string[]>
  activeReferenceByTabId: Record<string, string | null>
  activeIssueByTabId: Record<string, WorkspaceIssueFocus | null>
  updateTabState: (tabId: string, patch: Partial<WorkspaceTabViewState>) => void
  clearTabState: (tabId: string) => void
  addReference: (reference: WorkspaceSelectionReference) => void
  updateReference: (
    referenceId: string,
    patch: Partial<Omit<WorkspaceSelectionReference, 'id' | 'tabId' | 'kind'>>
  ) => void
  removeReference: (referenceId: string) => void
  clearTabReferences: (tabId: string) => void
  setActiveReference: (tabId: string, referenceId: string | null) => void
  setActiveIssue: (tabId: string, issue: WorkspaceIssueFocus | null) => void
  clearTabIssue: (tabId: string) => void
}

export const useWorkspaceSurfaceStore = create<WorkspaceSurfaceStore>((set, get) => ({
  tabState: {},
  references: {},
  referencesByTabId: {},
  activeReferenceByTabId: {},
  activeIssueByTabId: {},

  updateTabState: (tabId, patch) =>
    set((state) => ({
      tabState: {
        ...state.tabState,
        [tabId]: {
          ...(state.tabState[tabId] || {}),
          ...patch,
        },
      },
    })),

  clearTabState: (tabId) =>
    set((state) => {
      const next = { ...state.tabState }
      delete next[tabId]
      const nextIssues = { ...state.activeIssueByTabId }
      delete nextIssues[tabId]
      return { tabState: next, activeIssueByTabId: nextIssues }
    }),

  addReference: (reference) =>
    set((state) => {
      const existingIds = state.referencesByTabId[reference.tabId] || []
      const nextIds = existingIds.includes(reference.id)
        ? existingIds
        : [...existingIds, reference.id]
      return {
        references: {
          ...state.references,
          [reference.id]: reference,
        },
        referencesByTabId: {
          ...state.referencesByTabId,
          [reference.tabId]: nextIds,
        },
        activeReferenceByTabId: {
          ...state.activeReferenceByTabId,
          [reference.tabId]: reference.id,
        },
        tabState: {
          ...state.tabState,
          [reference.tabId]: {
            ...(state.tabState[reference.tabId] || {}),
            selectionCount: nextIds.length,
          },
        },
      }
    }),

  updateReference: (referenceId, patch) =>
    set((state) => {
      const current = state.references[referenceId]
      if (!current) return state
      return {
        references: {
          ...state.references,
          [referenceId]: {
            ...current,
            ...patch,
          },
        },
      }
    }),

  removeReference: (referenceId) =>
    set((state) => {
      const current = state.references[referenceId]
      if (!current) return state

      const nextReferences = { ...state.references }
      delete nextReferences[referenceId]

      const existingIds = state.referencesByTabId[current.tabId] || []
      const nextIds = existingIds.filter((id) => id !== referenceId)
      const nextReferencesByTabId = { ...state.referencesByTabId }
      if (nextIds.length > 0) {
        nextReferencesByTabId[current.tabId] = nextIds
      } else {
        delete nextReferencesByTabId[current.tabId]
      }

      const nextActive = { ...state.activeReferenceByTabId }
      if (nextActive[current.tabId] === referenceId) {
        nextActive[current.tabId] = nextIds[0] || null
      }

      return {
        references: nextReferences,
        referencesByTabId: nextReferencesByTabId,
        activeReferenceByTabId: nextActive,
        tabState: {
          ...state.tabState,
          [current.tabId]: {
            ...(state.tabState[current.tabId] || {}),
            selectionCount: nextIds.length,
          },
        },
      }
    }),

  clearTabReferences: (tabId) =>
    set((state) => {
      const nextReferences = { ...state.references }
      const ids = state.referencesByTabId[tabId] || []
      ids.forEach((id) => {
        delete nextReferences[id]
      })

      const nextReferencesByTabId = { ...state.referencesByTabId }
      delete nextReferencesByTabId[tabId]

      const nextActive = { ...state.activeReferenceByTabId }
      delete nextActive[tabId]

      return {
        references: nextReferences,
        referencesByTabId: nextReferencesByTabId,
        activeReferenceByTabId: nextActive,
        tabState: {
          ...state.tabState,
          [tabId]: {
            ...(state.tabState[tabId] || {}),
            selectionCount: 0,
          },
        },
      }
    }),

  setActiveReference: (tabId, referenceId) =>
    set((state) => {
      if (referenceId) {
        const ids = state.referencesByTabId[tabId] || []
        if (!ids.includes(referenceId)) {
          return state
        }
      }
      return {
        activeReferenceByTabId: {
          ...state.activeReferenceByTabId,
          [tabId]: referenceId,
        },
      }
    }),

  setActiveIssue: (tabId, issue) =>
    set((state) => ({
      activeIssueByTabId: {
        ...state.activeIssueByTabId,
        [tabId]: issue ? { ...issue, tabId } : null,
      },
    })),

  clearTabIssue: (tabId) =>
    set((state) => {
      const next = { ...state.activeIssueByTabId }
      delete next[tabId]
      return { activeIssueByTabId: next }
    }),
}))

export function getActiveWorkspaceReference(tabId?: string | null) {
  if (!tabId) return null
  const state = useWorkspaceSurfaceStore.getState()
  const referenceId = state.activeReferenceByTabId[tabId]
  return referenceId ? state.references[referenceId] || null : null
}

export function getWorkspaceReferencesForTab(tabId?: string | null) {
  if (!tabId) return []
  const state = useWorkspaceSurfaceStore.getState()
  const ids = state.referencesByTabId[tabId] || []
  return ids
    .map((id) => state.references[id])
    .filter((item): item is WorkspaceSelectionReference => Boolean(item))
}

export function getActiveWorkspaceIssue(tabId?: string | null) {
  if (!tabId) return null
  const state = useWorkspaceSurfaceStore.getState()
  return state.activeIssueByTabId[tabId] || null
}
