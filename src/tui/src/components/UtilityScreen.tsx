import React from 'react'
import { Box, Text } from 'ink'

import { useTerminalSize } from '../hooks/useTerminalSize.js'
import { theme } from '../semantic-colors.js'
import { shortenPath } from '../utils/paths.js'

export type UtilityLine = {
  id?: string
  label?: string
  value: string
  tone?: 'default' | 'muted' | 'success' | 'warning' | 'error' | 'link'
}

export type UtilitySection = {
  id?: string
  title: string
  lines: Array<string | UtilityLine>
}

export type UtilityPanel = {
  kind: 'help' | 'benchstore' | 'tasks' | 'baselines' | 'config' | 'run' | 'status' | 'debug'
  title: string
  subtitle?: string
  lines?: Array<string | UtilityLine>
  sections?: UtilitySection[]
  footer?: string
}

const colorForTone = (tone?: UtilityLine['tone']) => {
  if (tone === 'success') return theme.status.success
  if (tone === 'warning') return theme.status.warning
  if (tone === 'error') return theme.status.error
  if (tone === 'link') return theme.text.link
  if (tone === 'muted') return theme.text.secondary
  return theme.text.primary
}

const normalizeLine = (line: string | UtilityLine): UtilityLine =>
  typeof line === 'string' ? { value: line } : line

const renderLine = (line: string | UtilityLine, key: string, columns: number) => {
  const item = normalizeLine(line)
  const color = colorForTone(item.tone)
  const value = shortenPath(item.value, Math.max(24, columns - 4))
  return (
    <Text key={key} color={color}>
      {item.label ? `${item.label}: ${value}` : value || ' '}
    </Text>
  )
}

export const UtilityScreen: React.FC<{ panel: UtilityPanel }> = ({ panel }) => {
  const { columns } = useTerminalSize()
  return (
    <Box flexDirection="column" width={columns}>
      <Text color={theme.text.primary}>{panel.title}</Text>
      {panel.subtitle ? <Text color={theme.text.secondary}>{panel.subtitle}</Text> : null}
      {panel.lines && panel.lines.length > 0 ? (
        <Box marginTop={1} flexDirection="column">
          {panel.lines.map((line, index) => renderLine(line, `line:${index}`, columns))}
        </Box>
      ) : null}
      {panel.sections?.map((section, sectionIndex) => (
        <Box key={section.id || `section:${sectionIndex}`} marginTop={1} flexDirection="column">
          <Text color={theme.text.link}>{section.title}</Text>
          {section.lines.length > 0 ? (
            section.lines.map((line, lineIndex) =>
              renderLine(line, `${section.id || sectionIndex}:line:${lineIndex}`, columns)
            )
          ) : (
            <Text color={theme.text.secondary}>No entries.</Text>
          )}
        </Box>
      ))}
      {panel.footer ? (
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>{panel.footer}</Text>
        </Box>
      ) : null}
    </Box>
  )
}
