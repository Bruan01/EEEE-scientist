import React from 'react'
import { Box, Text } from 'ink'
import { theme } from '../semantic-colors.js'
import { ThemedGradient } from './ThemedGradient.js'
import { useTerminalSize } from '../hooks/useTerminalSize.js'
import { shortenPath, tildeifyPath } from '../utils/paths.js'

type FooterProps = {
  questRoot?: string
  modelLabel?: string
  sessionId?: string
  showCancelHint?: boolean
}

export const Footer: React.FC<FooterProps> = ({
  questRoot,
  modelLabel,
  sessionId,
  showCancelHint = false,
}) => {
  const { columns } = useTerminalSize()

  const pathLength = Math.max(20, Math.floor(columns * 0.25))
  const displayPath = shortenPath(tildeifyPath(questRoot || process.cwd()), pathLength)
  const rightText = [modelLabel || 'local', sessionId].filter(Boolean).join(' · ')

  return (
    <Box justifyContent="space-between" width={columns} flexDirection="row" alignItems="center" paddingX={1}>
      <Box>
        {showCancelHint && (
          <Text color={theme.text.secondary}>Press Esc to cancel | </Text>
        )}
        <ThemedGradient>{displayPath}</ThemedGradient>
      </Box>
      <Box alignItems="center" justifyContent="flex-end">
        <Text color={theme.text.accent}>
          {rightText}
        </Text>
      </Box>
    </Box>
  )
}
