export const EXPLORER_REFRESH_EVENT = 'ds:explorer:refresh'

export type ExplorerRefreshTarget = 'planning' | 'cli'

export type ExplorerRefreshDetail = {
  target: ExplorerRefreshTarget
  projectId?: string
  onComplete?: () => void
}
