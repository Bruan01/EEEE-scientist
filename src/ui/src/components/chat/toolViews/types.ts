import type { ToolEventData, ExecutionTarget } from '@/lib/types/chat-events'
import type { BashProgress, BashSessionStatus } from '@/lib/types/bash'

export type BashExecLiveState = {
  status: BashSessionStatus | null
  exitCode: number | null
  stopReason: string
  progress: BashProgress | null
}

export interface ToolViewProps {
  sessionId?: string
  toolContent: ToolEventData
  live: boolean
  isShare?: boolean
  projectId?: string
  executionTarget?: ExecutionTarget
  cliServerId?: string | null
  readOnly?: boolean
  active?: boolean
  panelMode?: 'tool' | 'terminal' | 'inline'
  chrome?: 'default' | 'bare'
  preferBashTerminalRender?: boolean
  onLiveStateChange?: (state: BashExecLiveState) => void
}
