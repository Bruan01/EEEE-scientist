import { create } from 'zustand'
import type { AgentDescriptor } from '@/lib/api/projects'

interface AgentRegistryState {
  agentsByProject: Record<string, AgentDescriptor[]>
  setAgentsForProject: (projectId: string, agents: AgentDescriptor[]) => void
  getAgentsForProject: (projectId: string) => AgentDescriptor[]
}

export const useAgentRegistryStore = create<AgentRegistryState>((set, get) => ({
  agentsByProject: {},
  setAgentsForProject: (projectId, agents) =>
    set((state) => ({
      agentsByProject: {
        ...state.agentsByProject,
        [projectId]: agents,
      },
    })),
  getAgentsForProject: (projectId) => get().agentsByProject[projectId] ?? [],
}))
