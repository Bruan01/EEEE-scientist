import React, { memo, useCallback, useMemo, useRef, useState } from 'react'
import { Box, Static, Text } from 'ink'
import { useTerminalSize } from '../hooks/useTerminalSize.js'
import { useSafeInput } from '../hooks/useSafeInput.js'
import {
  Scrollable,
  type ScrollableHandle,
  type ScrollState,
} from './shared/Scrollable.js'
import { MessageList } from './MessageList.js'
import { ConfigScreen, type ConfigPanel } from './ConfigScreen.js'
import { HistoryItemDisplay } from './HistoryItemDisplay.js'
import { QuestScreen } from './QuestScreen.js'
import { UtilityScreen, type UtilityPanel } from './UtilityScreen.js'
import { WelcomePanel } from './WelcomePanel.js'
import type { ConnectorSnapshot, FeedItem, QuestSummary, SessionPayload } from '../types.js'
import { theme } from '../semantic-colors.js'
import { isAlternateBufferEnabled } from '../utils/terminal.js'

type MainContentProps = {
  quests: QuestSummary[]
  browseQuestId: string | null
  configMode: 'browse' | 'edit' | null
  configPanel: ConfigPanel | null
  utilityPanel: UtilityPanel | null
  questPanelMode: 'projects' | 'pause' | 'stop' | 'resume' | null
  questPanelQuests: QuestSummary[]
  questPanelIndex: number
  snapshot: QuestSummary | null
  connectors: ConnectorSnapshot[]
  session: SessionPayload | null
  history: FeedItem[]
  pendingHistoryItems: FeedItem[]
  baseUrl: string
  connectionState: 'connecting' | 'connected' | 'error'
  availableHeight?: number
  onQuestPanelMove?: (direction: 1 | -1) => void
  onQuestPanelConfirm?: () => void
  onQuestPanelCancel?: () => void
}

const MainContentComponent: React.FC<MainContentProps> = ({
  quests,
  browseQuestId,
  configMode,
  configPanel,
  utilityPanel,
  questPanelMode,
  questPanelQuests,
  questPanelIndex,
  snapshot,
  connectors,
  session,
  history,
  pendingHistoryItems,
  baseUrl,
  connectionState,
  availableHeight,
  onQuestPanelMove,
  onQuestPanelConfirm,
  onQuestPanelCancel,
}) => {
  const { columns } = useTerminalSize()
  const scrollRef = useRef<ScrollableHandle>(null)
  const [isFollowing, setIsFollowing] = useState(true)
  const viewportHeight = availableHeight && availableHeight > 0 ? availableHeight : undefined
  const useAlternateBuffer = isAlternateBufferEnabled()

  const hasHistory = history.length > 0
  const hasPending = pendingHistoryItems.length > 0
  const showWelcome = !hasHistory && !hasPending && !snapshot

  const handleScrollState = useCallback((state: ScrollState) => {
    const maxScroll = Math.max(0, state.scrollHeight - state.innerHeight)
    const atBottom = state.scrollTop >= maxScroll - 1
    setIsFollowing(atBottom)
  }, [])

  const selectedQuestId = snapshot?.quest_id ?? browseQuestId ?? null
  const latestBashOperationId = useMemo(() => {
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const item = history[index]
      if (item.type !== 'operation') {
        continue
      }
      if (
        item.mcpServer === 'bash_exec' ||
        item.mcpTool === 'bash_exec' ||
        item.toolName === 'bash_exec' ||
        item.toolName === 'bash_exec.bash_exec'
      ) {
        return item.id
      }
    }
    return null
  }, [history])

  const historyNodes = useMemo(
    () => (
      <MessageList
        messages={history}
        terminalWidth={columns}
        baseUrl={baseUrl}
        questId={selectedQuestId}
        latestBashOperationId={latestBashOperationId}
      />
    ),
    [history, columns, baseUrl, selectedQuestId, latestBashOperationId]
  )
  const pendingNodes = useMemo(
    () => (
      <MessageList
        messages={pendingHistoryItems}
        terminalWidth={columns}
        baseUrl={baseUrl}
        questId={selectedQuestId}
        latestBashOperationId={latestBashOperationId}
      />
    ),
    [pendingHistoryItems, columns, baseUrl, selectedQuestId, latestBashOperationId]
  )
  const emptyQuestNote = snapshot ? (
    <Box marginBottom={1} flexDirection="column">
      <Text color={theme.text.primary}>{snapshot.title || snapshot.quest_id}</Text>
      <Text color={theme.text.secondary}>
        {(snapshot.branch || 'main')} · {(snapshot.status || 'active')} ·{' '}
        {snapshot.active_anchor || 'planning'}
      </Text>
      <Text color={theme.text.secondary}>
        {(session?.snapshot?.quest_root as string | undefined) ||
          snapshot.quest_root ||
          'No quest path'}
      </Text>
      <Text color={theme.text.secondary}>
        No messages yet. Send a prompt or run a slash command.
      </Text>
    </Box>
  ) : null
  const staticItems = useMemo(
    () =>
      [
        emptyQuestNote ? { id: 'empty-quest-note', node: emptyQuestNote } : null,
        ...history.map((item) => ({
          id: item.id,
          node: (
            <HistoryItemDisplay
              item={item}
              terminalWidth={columns}
              baseUrl={baseUrl}
              questId={selectedQuestId}
              liveBash={item.id === latestBashOperationId}
            />
          ),
        })),
      ].filter(Boolean) as Array<{ id: string; node: React.ReactNode }>,
    [baseUrl, columns, emptyQuestNote, history, latestBashOperationId, selectedQuestId]
  )

  useSafeInput((_input, key) => {
    if (!viewportHeight) return
    if (key.pageUp) {
      scrollRef.current?.scrollBy(-viewportHeight)
      return
    }
    if (key.pageDown) {
      scrollRef.current?.scrollBy(viewportHeight)
      return
    }
    if (key.shift && key.upArrow) {
      scrollRef.current?.scrollBy(-1)
      return
    }
    if (key.shift && key.downArrow) {
      scrollRef.current?.scrollBy(1)
    }
  })

  const renderConfigPanel = () => {
    const node = (
      <ConfigScreen
        panel={configPanel || { kind: 'root', items: [], selectedIndex: 0, selectedQuestId }}
        availableHeight={availableHeight}
      />
    )
    if (!viewportHeight) {
      return node
    }
    return (
      <Scrollable ref={scrollRef} height={viewportHeight} width={columns} onScrollState={handleScrollState}>
        {node}
      </Scrollable>
    )
  }

  const renderUtilityPanel = () => {
    if (!utilityPanel) {
      return null
    }
    const node = <UtilityScreen panel={utilityPanel} />
    if (!viewportHeight) {
      return node
    }
    return (
      <Scrollable ref={scrollRef} height={viewportHeight} width={columns} onScrollState={handleScrollState}>
        {node}
      </Scrollable>
    )
  }

  if (utilityPanel) {
    return renderUtilityPanel()
  }

  if (showWelcome) {
    if (configMode) {
      return renderConfigPanel()
    }
    if (questPanelMode) {
      return (
        <QuestScreen
          mode={questPanelMode}
          quests={questPanelQuests}
          selectedIndex={questPanelIndex}
          availableHeight={availableHeight}
          onMove={onQuestPanelMove}
          onConfirm={onQuestPanelConfirm}
          onCancel={onQuestPanelCancel}
        />
      )
    }
    return (
      <WelcomePanel
        quests={quests}
        browseQuestId={browseQuestId}
        connectors={connectors}
        baseUrl={baseUrl}
        connectionState={connectionState}
      />
    )
  }

  if (configMode) {
    return renderConfigPanel()
  }

  if (questPanelMode) {
    return (
      <QuestScreen
        mode={questPanelMode}
        quests={questPanelQuests}
        selectedIndex={questPanelIndex}
        availableHeight={availableHeight}
        onMove={onQuestPanelMove}
        onConfirm={onQuestPanelConfirm}
        onCancel={onQuestPanelCancel}
      />
    )
  }

  if (!useAlternateBuffer) {
    return (
      <>
        <Static items={staticItems}>
          {(item) => <Box key={item.id}>{item.node}</Box>}
        </Static>
        <Box flexDirection="column" width={columns}>
          {pendingNodes}
        </Box>
      </>
    )
  }

  if (!viewportHeight) {
    return (
      <Box flexDirection="column" width={columns}>
        {emptyQuestNote}
        {historyNodes}
        {pendingNodes}
      </Box>
    )
  }

  return (
    <Scrollable
      ref={scrollRef}
      height={viewportHeight}
      width={columns}
      scrollToBottom={isFollowing}
      onScrollState={handleScrollState}
    >
      {emptyQuestNote}
      {historyNodes}
      {pendingNodes}
    </Scrollable>
  )
}

export const MainContent = memo(MainContentComponent)
