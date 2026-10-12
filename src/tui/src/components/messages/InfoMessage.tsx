import React from 'react'
import { Text, Box } from 'ink'
import { theme } from '../../semantic-colors.js'
import { RenderInline } from '../../utils/InlineMarkdownRenderer.js'

type InfoMessageProps = {
  text: string
  icon?: string
  color?: string
  width?: number
  tone?: 'success' | 'error' | 'warning'
}

const resolveToneColor = (
  tone?: 'success' | 'error' | 'warning',
  overrideColor?: string
) => {
  if (overrideColor) return overrideColor
  if (tone === 'success') return theme.status.success
  if (tone === 'error') return theme.status.error
  if (tone === 'warning') return theme.status.warning
  return theme.status.warning
}

export const InfoMessage: React.FC<InfoMessageProps> = ({
  text,
  icon,
  color,
  width,
  tone,
}) => {
  const resolvedColor = resolveToneColor(tone, color)
  const prefix = icon ? (icon.endsWith(' ') ? icon : `${icon} `) : 'i '
  const prefixWidth = prefix.length

  return (
    <Box flexDirection="row" width={width}>
      <Box width={prefixWidth}>
        <Text color={resolvedColor}>{prefix}</Text>
      </Box>
      <Box flexGrow={1} flexDirection="column">
        {text.split('\n').map((line, index) => (
          <Text wrap="wrap" key={index} color={resolvedColor}>
            <RenderInline text={line} defaultColor={resolvedColor} />
          </Text>
        ))}
      </Box>
    </Box>
  )
}
