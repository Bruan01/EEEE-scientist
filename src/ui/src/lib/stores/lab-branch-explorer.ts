import { create } from 'zustand'

export type LabBranchExplorerTarget = {
  projectId: string
  agentInstanceId: string
  templateKey: string
  questId: string
  branchName: string
  serverId: string
  rootPath: string
  label: string
  subtitle?: string | null
} | null

type LabBranchExplorerState = {
  target: LabBranchExplorerTarget
  setTarget: (target: LabBranchExplorerTarget) => void
  clear: () => void
}

export const useLabBranchExplorerStore = create<LabBranchExplorerState>((set) => ({
  target: null,
  setTarget: (target) => set({ target }),
  clear: () => set({ target: null }),
}))

