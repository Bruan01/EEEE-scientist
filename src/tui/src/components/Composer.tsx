import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { InputPrompt } from './InputPrompt.js'
import { GradientStatusText } from './GradientStatusText.js'
import { LoadingIndicator } from './LoadingIndicator.js'
import { theme } from '../semantic-colors.js'
import { useTerminalSize } from '../hooks/useTerminalSize.js'
import { Footer } from './Footer.js'
import type { TuiDebugSnapshot } from '../types.js'

type ComposerProps = {
  input: string
  statusLine: string
  suggestions?: Array<{ name: string; description: string }>
  placeholder?: string
  mode: 'home' | 'quest'
  configMode?: 'browse' | 'edit' | null
  selectionMode?: 'projects' | 'pause' | 'stop' | 'resume' | null
  activeQuestId?: string | null
  connectionState: 'connecting' | 'connected' | 'error'
  isRunning?: boolean
  questRoot?: string
  modelLabel?: string
  sessionId?: string
  debugSnapshot?: TuiDebugSnapshot | null
  onChange: (next: string) => void
  onSubmit: (override?: string) => void
  onCancel: () => void
}

export const Composer: React.FC<ComposerProps> = ({
  input,
  statusLine,
  suggestions = [],
  placeholder = 'Type a message or /command',
  mode,
  configMode = null,
  selectionMode = null,
  activeQuestId,
  connectionState,
  isRunning = false,
  questRoot,
  modelLabel,
  sessionId,
  debugSnapshot,
  onChange,
  onSubmit,
  onCancel,
}) => {
  const { columns } = useTerminalSize()
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const statusLeft = [
    connectionState,
    mode === 'home' ? 'home' : activeQuestId ? `quest:${activeQuestId}` : 'quest',
    modelLabel,
  ]
    .filter(Boolean)
    .join(' | ')
  const statusRight = statusLine

  useEffect(() => {
    setSuggestionIndex(0)
  }, [input, suggestions.length])

  const selectedSuggestion =
    suggestions.length > 0
      ? { command: suggestions[suggestionIndex]?.name || suggestions[0]?.name || '' }
      : null

  return (
    <Box flexDirection="column" width={columns} flexShrink={0} flexGrow={0}>
      <Box marginTop={1} justifyContent="space-between" width="100%">
        <Box>
          <Text color={theme.text.secondary}>{statusLeft || 'offline'}</Text>
        </Box>
        <Box>
          <GradientStatusText text={statusRight} />
        </Box>
      </Box>

      <LoadingIndicator
        active={isRunning}
        currentLoadingPhrase="DeepScientist is working"
        rightContent={
          <Text color={theme.text.secondary}>
            {activeQuestId ? `quest:${activeQuestId}` : mode}
          </Text>
        }
      />

      {debugSnapshot ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.secondary}>
            debug · surface: <Text color={theme.text.primary}>{debugSnapshot.surface}</Text> · web:{' '}
            <Text color={theme.text.link}>{debugSnapshot.web_analog}</Text>
          </Text>
          <Text color={theme.text.secondary}>
            route:{' '}
            <Text
              color={
                debugSnapshot.route.kind === 'blocked'
                  ? theme.status.warning
                  : debugSnapshot.route.kind === 'backend-command' || debugSnapshot.route.kind.startsWith('backend')
                    ? theme.status.success
                    : theme.text.primary
              }
            >
              {debugSnapshot.route.kind}
            </Text>{' '}
            · target: <Text color={theme.text.primary}>{debugSnapshot.route.target}</Text>
          </Text>
          <Text color={theme.text.secondary}>
            parse: <Text color={theme.text.primary}>{debugSnapshot.input.parsed}</Text> · preview:{' '}
            <Text color={theme.text.primary}>{debugSnapshot.input.preview}</Text>
            {debugSnapshot.input.redacted ? <Text color={theme.status.warning}> · redacted</Text> : null}
          </Text>
        </Box>
      ) : null}

      <InputPrompt
        value={input}
        placeholder={placeholder}
        disabled={configMode === 'browse' || Boolean(selectionMode)}
        glowActive={false}
        onChange={onChange}
        onSubmit={onSubmit}
        onCancel={onCancel}
        suggestionsVisible={suggestions.length > 0}
        selectedSuggestion={selectedSuggestion}
        onSuggestionNavigate={(direction) => {
          if (suggestions.length === 0) return
          setSuggestionIndex((prev) => (prev + direction + suggestions.length) % suggestions.length)
        }}
        historyItems={[]}
      />

      {suggestions.length > 0 ? (
        <Box marginTop={1} flexDirection="column">
          {suggestions.slice(0, 5).map((item, index) => {
            const active = index === suggestionIndex
            return (
              <Box key={item.name} flexDirection="row">
                <Text color={active ? theme.status.success : theme.text.secondary}>
                  {active ? '> ' : '  '}
                </Text>
                <Text color={active ? theme.text.primary : theme.text.mention}>{item.name}</Text>
                <Text color={theme.text.secondary}>{` - ${item.description}`}</Text>
              </Box>
            )
          })}
        </Box>
      ) : (
        <Text color={theme.text.secondary}>
          {configMode === 'edit'
            ? 'Config editor · Enter save · Ctrl+J newline · Esc cancel'
            : configMode === 'browse'
              ? 'Config workspace · ↑/↓ select · Enter open · Esc back'
            : selectionMode
            ? 'Quest browser · ↑/↓ select · Enter confirm · Esc cancel'
            : mode === 'home'
            ? 'Enter binds selected quest · /new creates · ↑/↓ select quest · Tab next'
            : 'Enter sends message · /projects browser · Ctrl+R refresh · Ctrl+G config'}
        </Text>
      )}

      <Footer questRoot={questRoot} modelLabel={modelLabel} sessionId={sessionId} />
    </Box>
  )
}
