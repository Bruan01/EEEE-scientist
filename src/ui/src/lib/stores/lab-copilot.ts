import { create } from 'zustand'

export type LabCopilotMode = 'direct' | 'group' | 'friends'
export type LabDirectComposeRequest = {
  text: string
  token: number
  submitMode: 'draft' | 'auto'
  origin?: string | null
  proposalId?: string | null
}

interface LabCopilotState {
  mode: LabCopilotMode
  activeQuestId: string | null
  activeAgentId: string | null
  directPrefill: string | null
  directComposeRequest: LabDirectComposeRequest | null
  groupPrefill: string | null
  followEffects: boolean
  agentStatusOverrides: Record<string, string>
  piOnboardingActive: boolean
  piOnboardingKind: 'start' | 'resume' | null
  piOnboardingQuestId: string | null
  piOnboardingAgentId: string | null
}

interface LabCopilotActions {
  setMode: (mode: LabCopilotMode) => void
  setActiveQuest: (questId: string | null) => void
  setActiveAgent: (agentId: string | null) => void
  setDirectPrefill: (value: string | null) => void
  queueDirectComposeRequest: (value: {
    text: string
    token?: number
    submitMode?: 'draft' | 'auto'
    origin?: string | null
    proposalId?: string | null
  }) => void
  clearDirectComposeRequest: () => void
  setGroupPrefill: (value: string | null) => void
  setFollowEffects: (value: boolean) => void
  setAgentStatusOverride: (agentId: string, status: string | null) => void
  beginPiOnboarding: (payload: {
    kind: 'start' | 'resume'
    questId?: string | null
    agentId?: string | null
  }) => void
  endPiOnboarding: () => void
  clearSelections: () => void
}

export const useLabCopilotStore = create<LabCopilotState & LabCopilotActions>((set) => ({
  mode: 'direct',
  activeQuestId: null,
  activeAgentId: null,
  directPrefill: null,
  directComposeRequest: null,
  groupPrefill: null,
  followEffects: true,
  agentStatusOverrides: {},
  piOnboardingActive: false,
  piOnboardingKind: null,
  piOnboardingQuestId: null,
  piOnboardingAgentId: null,
  setMode: (mode) => set({ mode }),
  setActiveQuest: (questId) => set({ activeQuestId: questId }),
  setActiveAgent: (agentId) => set({ activeAgentId: agentId }),
  setDirectPrefill: (value) =>
    set({
      directPrefill: value,
      directComposeRequest: value
        ? {
            text: value,
            token: Date.now(),
            submitMode: 'draft',
            origin: 'legacy_prefill',
          }
        : null,
    }),
  queueDirectComposeRequest: (value) =>
    set({
      directPrefill: value.text,
      directComposeRequest: {
        text: value.text,
        token: value.token ?? Date.now(),
        submitMode: value.submitMode ?? 'draft',
        origin: value.origin ?? null,
        proposalId: value.proposalId ?? null,
      },
    }),
  clearDirectComposeRequest: () =>
    set({
      directPrefill: null,
      directComposeRequest: null,
    }),
  setGroupPrefill: (value) => set({ groupPrefill: value }),
  setFollowEffects: (value) => set({ followEffects: value }),
  setAgentStatusOverride: (agentId, status) =>
    set((state) => {
      const next = { ...state.agentStatusOverrides }
      if (!status) {
        delete next[agentId]
      } else {
        next[agentId] = status
      }
      return { agentStatusOverrides: next }
    }),
  beginPiOnboarding: ({ kind, questId, agentId }) =>
    set({
      piOnboardingActive: true,
      piOnboardingKind: kind,
      piOnboardingQuestId: questId ?? null,
      piOnboardingAgentId: agentId ?? null,
    }),
  endPiOnboarding: () =>
    set({
      piOnboardingActive: false,
      piOnboardingKind: null,
      piOnboardingQuestId: null,
      piOnboardingAgentId: null,
    }),
  clearSelections: () =>
    set({
      activeQuestId: null,
      activeAgentId: null,
      directPrefill: null,
      directComposeRequest: null,
      groupPrefill: null,
      agentStatusOverrides: {},
    }),
}))
