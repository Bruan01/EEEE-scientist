import React from 'react'
import { Text, Box } from 'ink'
import { MarkdownDisplay } from '../../utils/MarkdownDisplay.js'
import { theme } from '../../semantic-colors.js'

type AssistantMessageProps = {
  text: string
  source?: string
  skillId?: string | null
  streaming?: boolean
  width: number
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  text,
  source,
  skillId,
  streaming,
  width,
}) => {
  const prefix = '• '
  const responseColor = theme.text.response
  const prefixWidth = prefix.length
  const contentWidth = Math.max(1, width - prefixWidth)
  const agentLabel =
    [source ? `@${source}` : null, skillId ? `skill:${skillId}` : null, streaming ? 'streaming' : null]
      .filter(Boolean)
      .join(' · ') || null

  return (
    <Box flexDirection="row" width={width}>
      <Box width={prefixWidth}>
        <Text color={responseColor}>{prefix}</Text>
      </Box>
      <Box flexGrow={1} flexDirection="column" width={contentWidth}>
        {agentLabel ? (
          <Box marginBottom={1}>
            <Text color={theme.text.mention}>{agentLabel}</Text>
          </Box>
        ) : null}
        <MarkdownDisplay
          text={text}
          isPending={Boolean(streaming)}
          terminalWidth={contentWidth}
          renderMarkdown
          overrideColor={responseColor}
        />
      </Box>
    </Box>
  )
}
