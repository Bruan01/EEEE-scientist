export type CopilotPrefill = {
  text: string
  focus?: boolean
  token: number
}

export type CopilotSuggestionItem = {
  label: string
  prompt: string
}

export type CopilotSuggestionPayload = {
  tabId?: string
  title: string
  subtitle?: string
  items: CopilotSuggestionItem[]
}

export type CopilotMessageRect = {
  left: number
  top: number
  width: number
  height: number
}

export type CopilotFocusedIssue = {
  kind: 'latex_error'
  tabId?: string
  fileId?: string
  resourceId?: string
  resourcePath?: string
  resourceName?: string
  line?: number
  message: string
  severity: 'error' | 'warning'
  excerpt?: string
}

export type AiManusChatActions = {
  toggleHistory: () => void
  startNewThread: () => void
  setThreadId: (threadId: string | null) => void
  clearThread?: () => void
  focusComposer: () => void
  setComposerValue: (text: string, focus?: boolean) => void
  submitComposer: () => void
  openToolPanel?: () => void
  toggleToolPanel?: () => void
  toggleAttachmentsDrawer?: () => void
  setAttachmentsDrawerOpen?: (open: boolean) => void
  runFixWithAi?: (payload: {
    folderId: string
    buildId?: string | null
    focusedError?: CopilotFocusedIssue | null
    promptText?: string | null
  }) => void
  jumpToTimelineItem?: (
    id: string,
    options?: { behavior?: ScrollBehavior; align?: 'start' | 'center' | 'end' }
  ) => void
  getFirstUserMessageRect?: () => CopilotMessageRect | null
}

export type AiManusChatMeta = {
  threadId: string | null
  historyOpen: boolean
  isResponding: boolean
  toolCount?: number
  ready: boolean
  isRestoring?: boolean
  restoreAttempted?: boolean
  hasHistory?: boolean
  error: string | null
  title?: string | null
  statusText?: string | null
  statusPrevText?: string | null
  statusKey?: number
  toolPanelVisible?: boolean
  toolToggleVisible?: boolean
  attachmentsDrawerOpen?: boolean
  fixWithAiRunning?: boolean
}

export type AiManusChatChrome = {
  dockSide?: 'left' | 'right'
  onClose?: () => void
  onToggleDockSide?: () => void
}
