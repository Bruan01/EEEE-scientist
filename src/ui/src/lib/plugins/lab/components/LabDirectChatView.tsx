'use client'

import * as React from 'react'
import type { ReactNode } from 'react'
import type { AgentDescriptor } from '@/lib/api/projects'
import { AiManusChatView } from '@/lib/plugins/ai-manus/AiManusChatView'
import type { ChatMessageItem } from '@/lib/plugins/ai-manus/types'
import type {
  AiManusChatActions,
  AiManusChatMeta,
  CopilotPrefill,
} from '@/lib/plugins/ai-manus/view-types'

type LabDirectChatViewProps = {
  projectId: string
  readOnly?: boolean
  visible?: boolean
  prefill?: CopilotPrefill | null
  leadMessage?: ChatMessageItem | null
  hideCopilotGreeting?: boolean
  mentionablesOverride?: AgentDescriptor[]
  defaultAgentOverride?: AgentDescriptor
  mentionsEnabledOverride?: boolean
  enforcedMentionPrefix?: string
  lockedMentionPrefix?: string
  messageMetadata?: Record<string, unknown>
  composerMode?: 'text' | 'notebook'
  composerFooter?: ReactNode
  busyOverride?: boolean
  onActionsChange?: (actions: AiManusChatActions | null) => void
  onMetaChange?: (meta: AiManusChatMeta) => void
  onUserSubmit?: (message: string) => void
}

export function LabDirectChatView({
  projectId,
  readOnly,
  visible,
  prefill,
  leadMessage,
  hideCopilotGreeting,
  mentionablesOverride,
  defaultAgentOverride,
  mentionsEnabledOverride,
  enforcedMentionPrefix,
  lockedMentionPrefix,
  messageMetadata,
  composerMode,
  composerFooter,
  busyOverride,
  onActionsChange,
  onMetaChange,
  onUserSubmit,
}: LabDirectChatViewProps) {
  const normalizedPrefill = React.useMemo(() => {
    if (!prefill?.text) return prefill ?? null
    const raw = prefill.text
    if (!raw.startsWith('@')) return prefill
    const match = raw.match(/^@[^\s]+/)
    if (!match) return prefill
    const end = match[0].length
    if (raw[end] === ' ') return prefill
    return { ...prefill, text: `${raw.slice(0, end)} ${raw.slice(end)}` }
  }, [prefill])
  const [historyOpenOverride, setHistoryOpenOverride] = React.useState(false)
  const historyPanelId = React.useId()

  return (
    <AiManusChatView
      mode="lab-direct"
      uiMode="copilot"
      projectId={projectId}
      readOnly={readOnly}
      visible={visible}
      prefill={normalizedPrefill}
      embedded
      historyMode="overlay"
      layoutPadding="flush"
      sessionListEnabled={false}
      historyPanelId={historyPanelId}
      historyOpenOverride={historyOpenOverride}
      onHistoryOpenChange={setHistoryOpenOverride}
      onActionsChange={onActionsChange}
      onMetaChange={onMetaChange}
      mentionablesOverride={mentionablesOverride}
      defaultAgentOverride={defaultAgentOverride}
      mentionsEnabledOverride={mentionsEnabledOverride}
      enforcedMentionPrefix={enforcedMentionPrefix}
      lockedMentionPrefix={lockedMentionPrefix}
      lockLeadingMentionSpace
      messageMetadata={messageMetadata}
      hideCopilotGreeting={hideCopilotGreeting}
      composerMode={composerMode}
      composerFooter={composerFooter}
      leadMessage={leadMessage}
      busyOverride={busyOverride}
      onUserSubmit={onUserSubmit}
    />
  )
}

export default LabDirectChatView
