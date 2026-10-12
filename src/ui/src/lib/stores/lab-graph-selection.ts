import { create } from 'zustand'
import type { LabQuestGraphAction, LabQuestSelectionContext } from '@/lib/api/lab'

export type CompareTarget = {
  baseline?: string | null
  head?: string | null
  selected?: string | null
}

export type LabGraphSelection = LabQuestSelectionContext & {
  label?: string | null
  summary?: string | null
  prompt_context?: string | null
  event_id?: string | null
}

type LabGraphSelectionState = {
  selection: LabGraphSelection | null
  activeProposal: LabQuestGraphAction | null
  replayCursorEventId: string | null
  compareTargets: CompareTarget
}

type LabGraphSelectionActions = {
  setSelection: (selection: LabGraphSelection | null) => void
  setActiveProposal: (proposal: LabQuestGraphAction | null) => void
  setReplayCursorEventId: (eventId: string | null) => void
  setCompareTargets: (targets: Partial<CompareTarget>) => void
  clear: () => void
}

export const useLabGraphSelectionStore = create<
  LabGraphSelectionState & LabGraphSelectionActions
>((set) => ({
  selection: null,
  activeProposal: null,
  replayCursorEventId: null,
  compareTargets: {},
  setSelection: (selection) => set({ selection }),
  setActiveProposal: (activeProposal) => set({ activeProposal }),
  setReplayCursorEventId: (replayCursorEventId) => set({ replayCursorEventId }),
  setCompareTargets: (targets) =>
    set((state) => ({
      compareTargets: {
        ...state.compareTargets,
        ...targets,
      },
    })),
  clear: () =>
    set({
      selection: null,
      activeProposal: null,
      replayCursorEventId: null,
      compareTargets: {},
    }),
}))
