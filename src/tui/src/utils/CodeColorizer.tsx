import React from 'react'
import { Box, Text } from 'ink'
import { theme } from '../semantic-colors.js'

export interface ColorizeCodeOptions {
  code: string
  language?: string | null
  availableHeight?: number
  maxWidth: number
  hideLineNumbers?: boolean
}

const resolveLineColor = (line: string, language?: string | null): string => {
  const isDiff = language === 'diff' || language === 'patch'
  const baseColor = isDiff ? theme.text.primary : theme.text.secondary
  if (!isDiff) {
    return baseColor
  }
  const match = line.match(/^\s*(?:\d+\s+)?([+-])/)
  if (!match) return baseColor
  return match[1] === '+' ? theme.status.success : theme.status.error
}

export const colorizeCode = ({
  code,
  language,
  availableHeight,
  hideLineNumbers = true,
  maxWidth,
}: ColorizeCodeOptions): React.ReactNode => {
  const lines = code.replace(/\n$/, '').split('\n')
  const trimmed = availableHeight ? lines.slice(-availableHeight) : lines
  const padWidth = String(trimmed.length).length

  return (
    <Box flexDirection="column" width={maxWidth}>
      {trimmed.map((line, index) => (
        <Box key={index} width={maxWidth}>
          {!hideLineNumbers && (
            <Text color={theme.ui.comment}>{`${String(index + 1).padStart(padWidth, ' ')} `}</Text>
          )}
          <Text color={resolveLineColor(line, language)} wrap="wrap">
            {line}
          </Text>
        </Box>
      ))}
    </Box>
  )
}
