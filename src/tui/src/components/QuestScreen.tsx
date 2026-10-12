import React, { useMemo } from 'react'
import { Box, Text } from 'ink'

import { useTerminalSize } from '../hooks/useTerminalSize.js'
import { useSafeInput } from '../hooks/useSafeInput.js'
import { theme } from '../semantic-colors.js'
import type { QuestSummary } from '../types.js'
import { SelectionList, type SelectionItem } from './shared/SelectionList.js'

type QuestScreenMode = 'projects' | 'pause' | 'stop' | 'resume'

type QuestScreenProps = {
  mode: QuestScreenMode
  quests: QuestSummary[]
  selectedIndex: number
  availableHeight?: number
  onMove?: (direction: 1 | -1) => void
  onConfirm?: () => void
  onCancel?: () => void
}

const modeCopy: Record<QuestScreenMode, { title: string; subtitle: string }> = {
  projects: {
    title: 'Quest Browser',
    subtitle: 'Select a quest to open and continue its context.',
  },
  stop: {
    title: 'Stop Quest',
    subtitle: 'Select a quest to stop its current execution.',
  },
  pause: {
    title: 'Pause Quest',
    subtitle: 'Select a quest to pause and interrupt its current execution.',
  },
  resume: {
    title: 'Resume Quest',
    subtitle: 'Select a stopped quest to reactivate it.',
  },
}

export const QuestScreen: React.FC<QuestScreenProps> = ({
  mode,
  quests,
  selectedIndex,
  availableHeight,
  onMove,
  onConfirm,
  onCancel,
}) => {
  const { rows } = useTerminalSize()
  const copy = modeCopy[mode]
  const selectedQuest =
    quests.length > 0 ? quests[Math.max(0, Math.min(selectedIndex, quests.length - 1))] : null

  const items: Array<SelectionItem<QuestSummary>> = useMemo(
    () =>
      quests.map((quest) => ({
        key: quest.quest_id,
        label: quest.title || quest.quest_id,
        value: quest,
        description: quest.summary?.status_line,
      })),
    [quests]
  )

  const safeRows = availableHeight ?? rows
  const maxItemsToShow = Math.max(
    4,
    Math.min(items.length, Math.max(6, (safeRows || 24) - 12))
  )
  const maxOffset = Math.max(0, items.length - maxItemsToShow)
  const scrollOffset = Math.max(
    0,
    Math.min(
      maxOffset,
      selectedIndex >= maxItemsToShow ? selectedIndex - maxItemsToShow + 1 : 0
    )
  )

  useSafeInput((input, key) => {
    const submitRequested = key.return || input === '\r' || input === '\n'
    if (key.upArrow) {
      onMove?.(-1)
      return
    }
    if (key.downArrow || key.tab) {
      onMove?.(1)
      return
    }
    if (submitRequested) {
      onConfirm?.()
      return
    }
    if (key.escape) {
      onCancel?.()
    }
  })

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} flexDirection="column">
        <Text color={theme.text.primary}>{copy.title}</Text>
        <Text color={theme.text.secondary}>{copy.subtitle}</Text>
        <Text color={theme.text.secondary}>↑/↓ choose · Enter confirm · Esc cancel</Text>
      </Box>

      {selectedQuest ? (
        <Box marginBottom={1} flexDirection="column">
          <Text color={theme.text.primary}>
            {selectedQuest.quest_id} · {selectedQuest.status}
          </Text>
          <Text color={theme.text.secondary}>
            {(selectedQuest.branch || 'main')} · {selectedQuest.active_anchor || 'decision'}
          </Text>
          <Text color={theme.text.secondary}>
            {selectedQuest.summary?.status_line || selectedQuest.quest_root || 'No status summary'}
          </Text>
        </Box>
      ) : (
        <Text color={theme.text.secondary}>No quest available for this action.</Text>
      )}

      {items.length > 0 ? (
        <SelectionList
          items={items}
          activeIndex={Math.max(0, Math.min(selectedIndex, items.length - 1))}
          scrollOffset={scrollOffset}
          maxItemsToShow={maxItemsToShow}
          renderValue={(item) => (
            <Text color={theme.text.secondary}>{item.value.quest_id}</Text>
          )}
        />
      ) : null}
    </Box>
  )
}
