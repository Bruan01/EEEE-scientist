import React from 'react'
import { Box, Text } from 'ink'
import stringWidth from 'string-width'
import { Logo } from './Logo.js'
import { theme } from '../semantic-colors.js'
import { useTerminalSize } from '../hooks/useTerminalSize.js'
import { ThemedGradient } from './ThemedGradient.js'
import type { ConnectorSnapshot, QuestSummary } from '../types.js'

const clipText = (value: string, maxWidth: number) => {
  const safeWidth = Math.max(4, maxWidth)
  if (stringWidth(value) <= safeWidth) {
    return value
  }
  const glyphs = Array.from(value)
  let clipped = ''
  for (const glyph of glyphs) {
    if (stringWidth(`${clipped}${glyph}…`) > safeWidth) {
      break
    }
    clipped += glyph
  }
  return `${clipped}…`
}

type WelcomePanelProps = {
  quests: QuestSummary[]
  browseQuestId: string | null
  connectors: ConnectorSnapshot[]
  baseUrl: string
  connectionState: 'connecting' | 'connected' | 'error'
}

export const WelcomePanel: React.FC<WelcomePanelProps> = ({
  quests,
  browseQuestId,
  connectors,
  baseUrl,
  connectionState,
}) => {
  const { columns } = useTerminalSize()
  const connectionText = connectionState
  const activeCount = quests.filter((quest) =>
    ['running', 'waiting_for_user'].includes(String(quest.status || ''))
  ).length
  const pendingDecisionCount = quests.reduce(
    (count, quest) =>
      count + (Array.isArray(quest.pending_decisions) ? quest.pending_decisions.length : 0),
    0
  )
  const connectionColor =
    connectionState === 'connected'
      ? theme.status.success
      : connectionState === 'error'
        ? theme.status.error
        : theme.status.warning
  const selectedQuest =
    quests.find((quest) => quest.quest_id === browseQuestId) ?? quests[0] ?? null
  const connectorSummary =
    connectors.length > 0
      ? connectors
          .map(
            (connector) =>
              `${connector.name}:${connector.inbox_count ?? 0}/${connector.outbox_count ?? 0}`
          )
          .join(' · ')
      : 'No connectors configured'
  const compactConnectorSummary =
    connectors.length > 0
      ? `${connectors.length} connectors configured`
      : 'No connectors configured'
  const showApiLine = columns >= 120
  const resolvedBaseUrl = (() => {
    try {
      return new URL(baseUrl)
    } catch {
      return null
    }
  })()
  const frontendUrl = (() => {
    if (resolvedBaseUrl) {
      const target = new URL(resolvedBaseUrl.toString())
      if (target.hostname === '0.0.0.0') {
        target.hostname = '127.0.0.1'
      }
      target.pathname = '/projects'
      target.search = ''
      return target.toString()
    }
    return `${baseUrl.replace(/\/$/, '')}/projects`
  })()
  const apiUrl = resolvedBaseUrl?.toString() ?? baseUrl

  const infoLines = [
    { label: '', value: 'Research operating system', style: 'title' },
    { label: 'Mode', value: selectedQuest ? 'quest mode' : 'request mode', style: 'normal' },
    { label: 'Server', value: connectionText, style: 'connection' },
    ...(showApiLine ? [{ label: 'API', value: apiUrl, style: 'normal' }] : []),
    {
      label: 'Quests',
      value: `${quests.length} total · ${activeCount} active`,
      style: 'normal',
    },
  ]
  const visibleConnectorSummary =
    columns >= 112 || stringWidth(connectorSummary) <= Math.max(24, columns - 6)
      ? connectorSummary
      : compactConnectorSummary
  const commandLine =
    columns >= 92
      ? 'Type /help for commands · /new <goal> to start · /resume to reopen a quest.'
      : 'Commands: /help · /new <goal> · /resume'
  const selectedQuestTitle = selectedQuest
    ? clipText(`${selectedQuest.quest_id} · ${selectedQuest.title}`, columns - 2)
    : null
  const selectedQuestMeta = selectedQuest
    ? clipText(
        `${selectedQuest.status} · ${selectedQuest.active_anchor} · ${selectedQuest.branch || 'main'}`,
        columns - 2
      )
    : null
  const emptyQuestLine = clipText(
    'No quest selected yet. Use /new <goal> to create one or /use <quest_id> to bind one.',
    columns - 2
  )
  const urlBannerText = clipText(frontendUrl, Math.max(24, columns - 6))
  const urlHint =
    columns >= 108
      ? 'Press Ctrl+O to open the web workspace if auto-open is unavailable.'
      : 'Ctrl+O opens the web workspace.'

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="column">
        {infoLines.map((info, idx) => (
          <Box key={idx}>
            {info.style === 'title' ? (
              <ThemedGradient bold>{info.value}</ThemedGradient>
            ) : (
              <>
                {info.label && (
                  <Text color={theme.text.secondary}>{info.label}: </Text>
                )}
                <Text
                  color={
                    info.style === 'connection' ? connectionColor : theme.text.primary
                  }
                >
                  {info.value}
                </Text>
              </>
            )}
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Logo />
      </Box>

      <Box marginTop={1} width={columns} justifyContent="center">
        <Text color={theme.text.link}>Web Workspace</Text>
      </Box>
      <Box width={columns} justifyContent="center">
        <Text bold color={theme.text.accent}>
          {urlBannerText}
        </Text>
      </Box>
      <Box width={columns} justifyContent="center">
        <Text color={theme.text.secondary}>{clipText(urlHint, Math.max(20, columns - 4))}</Text>
      </Box>

      <Box marginTop={1}>
        <Text color={theme.text.secondary}>{commandLine}</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>
          {`Quests ${quests.length} · Active ${activeCount} · Pending decisions ${pendingDecisionCount}`}
        </Text>
        <Text color={theme.text.secondary}>
          {clipText(visibleConnectorSummary, columns - 2)}
        </Text>
        {selectedQuest ? (
          <>
            <Text color={theme.text.primary}>{selectedQuestTitle}</Text>
            <Text color={theme.text.secondary}>{selectedQuestMeta}</Text>
          </>
        ) : (
          <Text color={theme.text.secondary}>{emptyQuestLine}</Text>
        )}
      </Box>
    </Box>
  )
}
