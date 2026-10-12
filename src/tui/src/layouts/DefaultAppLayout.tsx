import React, { useLayoutEffect, useRef, useState } from 'react'
import { Box, measureElement, type DOMElement } from 'ink'
import stringWidth from 'string-width'
import type { ConfigPanel } from '../components/ConfigScreen.js'
import { MainContent } from '../components/MainContent.js'
import { Composer } from '../components/Composer.js'
import { useTerminalSize } from '../hooks/useTerminalSize.js'
import type { ConnectorSnapshot, FeedItem, QuestSummary, SessionPayload, TuiDebugSnapshot } from '../types.js'
import type { UtilityPanel } from '../components/UtilityScreen.js'
import { isAlternateBufferEnabled } from '../utils/terminal.js'

type DefaultAppLayoutProps = {
  baseUrl: string
  quests: QuestSummary[]
  activeQuestId: string | null
  browseQuestId: string | null
  configMode: 'browse' | 'edit' | null
  configPanel: ConfigPanel | null
  utilityPanel: UtilityPanel | null
  questPanelMode: 'projects' | 'pause' | 'stop' | 'resume' | null
  questPanelQuests: QuestSummary[]
  questPanelIndex: number
  snapshot: QuestSummary | null
  session: SessionPayload | null
  connectors: ConnectorSnapshot[]
  history: FeedItem[]
  pendingHistoryItems: FeedItem[]
  input: string
  connectionState: 'connecting' | 'connected' | 'error'
  statusLine: string
  debugSnapshot?: TuiDebugSnapshot | null
  suggestions?: Array<{ name: string; description: string }>
  onChange: (next: string) => void
  onSubmit: (override?: string) => void
  onCancel: () => void
  onQuestPanelMove?: (direction: 1 | -1) => void
  onQuestPanelConfirm?: () => void
  onQuestPanelCancel?: () => void
}

const estimateWrappedRows = (value: string, width: number): number => {
  const safeWidth = Math.max(1, width)
  const lines = value.length > 0 ? value.split('\n') : ['']
  return lines.reduce((count, line) => {
    const measured = Math.max(1, stringWidth(line || ''))
    return count + Math.max(1, Math.ceil(measured / safeWidth))
  }, 0)
}

export const DefaultAppLayout: React.FC<DefaultAppLayoutProps> = ({
  baseUrl,
  quests,
  activeQuestId,
  browseQuestId,
  configMode,
  configPanel,
  utilityPanel,
  questPanelMode,
  questPanelQuests,
  questPanelIndex,
  snapshot,
  session,
  connectors,
  history,
  pendingHistoryItems,
  input,
  connectionState,
  statusLine,
  debugSnapshot = null,
  suggestions = [],
  onChange,
  onSubmit,
  onCancel,
  onQuestPanelMove,
  onQuestPanelConfirm,
  onQuestPanelCancel,
}) => {
  const { columns, rows } = useTerminalSize()
  const composerRef = useRef<DOMElement>(null)
  const [composerHeight, setComposerHeight] = useState(0)
  const useAlternateBuffer = isAlternateBufferEnabled()
  const composerMeasureRows = estimateWrappedRows(input, Math.max(12, columns - 6))

  useLayoutEffect(() => {
    if (composerRef.current) {
      const height = Math.round(measureElement(composerRef.current).height)
      if (Number.isFinite(height)) setComposerHeight((prev) => (prev !== height ? height : prev))
    }
  }, [
    activeQuestId,
    columns,
    composerMeasureRows,
    configMode,
    connectionState,
    questPanelMode,
    rows,
    session?.acp_session?.session_id,
    snapshot?.status,
    debugSnapshot?.signature,
    statusLine,
    suggestions.length,
  ])

  const safeRows = Math.max(1, rows)
  const safeComposerHeight = Number.isFinite(composerHeight) ? composerHeight : 0
  const requestedGap = 2
  const gap = useAlternateBuffer
    ? Math.max(0, Math.min(requestedGap, safeRows - safeComposerHeight - 1))
    : requestedGap
  const mainHeight = useAlternateBuffer
    ? Math.max(1, safeRows - safeComposerHeight - gap)
    : undefined

  return (
    <Box
      flexDirection="column"
      width={columns}
      height={useAlternateBuffer ? safeRows : undefined}
    >
      <Box
        flexGrow={useAlternateBuffer ? 1 : 0}
        height={mainHeight}
        overflow={useAlternateBuffer ? 'hidden' : undefined}
      >
        <MainContent
          quests={quests}
          browseQuestId={browseQuestId}
          configMode={configMode}
          configPanel={configPanel}
          utilityPanel={utilityPanel}
          questPanelMode={questPanelMode}
          questPanelQuests={questPanelQuests}
          questPanelIndex={questPanelIndex}
          snapshot={snapshot}
          connectors={connectors}
          session={session}
          history={history}
          pendingHistoryItems={pendingHistoryItems}
          baseUrl={baseUrl}
          connectionState={connectionState}
          availableHeight={mainHeight}
          onQuestPanelMove={onQuestPanelMove}
          onQuestPanelConfirm={onQuestPanelConfirm}
          onQuestPanelCancel={onQuestPanelCancel}
        />
      </Box>
      {gap > 0 ? <Box height={gap} flexShrink={0} /> : null}
      <Box ref={composerRef} flexShrink={0}>
        <Composer
          input={input}
          statusLine={statusLine}
          debugSnapshot={debugSnapshot}
          suggestions={suggestions}
          configMode={configMode}
          selectionMode={questPanelMode}
          mode={activeQuestId ? 'quest' : 'home'}
          activeQuestId={activeQuestId}
          connectionState={connectionState}
          isRunning={String(snapshot?.status || '') === 'running'}
          questRoot={
            (session?.snapshot?.quest_root as string | undefined) || snapshot?.quest_root
          }
          modelLabel={
            typeof session?.snapshot?.runner === 'string'
              ? session.snapshot.runner
              : undefined
          }
          sessionId={session?.acp_session?.session_id}
          onChange={onChange}
          onSubmit={onSubmit}
          onCancel={onCancel}
          placeholder={
            configMode === 'edit'
              ? 'Edit the config content, then press Enter to save'
              : configMode === 'browse'
                ? 'Use arrows to choose a config item, then press Enter'
              : utilityPanel
                ? 'Type a slash command, or press Esc to close this panel'
              : questPanelMode
              ? 'Use arrows to choose a quest, then press Enter'
              : activeQuestId
              ? 'Send a message to the active quest or type /command'
              : 'Type /new <goal> to create a quest, or /use <quest_id> to bind one'
          }
        />
      </Box>
    </Box>
  )
}
