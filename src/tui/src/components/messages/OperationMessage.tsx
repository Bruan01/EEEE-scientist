import React from 'react'
import { Box, Text } from 'ink'
import { theme } from '../../semantic-colors.js'
import { MarkdownDisplay } from '../../utils/MarkdownDisplay.js'
type OperationMessageProps = {
  label: 'tool_call' | 'tool_result'
  content: string
  toolName?: string
  toolCallId?: string
  status?: string
  subject?: string | null
  args?: string
  output?: string
  width?: number
}

const compactDetail = (value?: string, limit = 320) => {
  const text = String(value ?? '').trim()
  if (!text) {
    return ''
  }
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`
}

const buildHeading = (content: string) => {
  const trimmed = content.trim()
  if (!trimmed) {
    return 'DeepScientist is Working...'
  }
  return trimmed
}

export const OperationMessage: React.FC<OperationMessageProps> = ({
  label,
  content,
  toolName,
  toolCallId,
  status,
  subject,
  args,
  output,
  width = 80,
}) => {
  const prefix = '• '
  const prefixWidth = prefix.length
  const contentColor = theme.text.response
  const keywordColor = theme.text.link
  const contentWidth = Math.max(1, width - prefixWidth)
  const heading = buildHeading(content)
  const detail = compactDetail(label === 'tool_result' ? output || args : args || output)
  const metadataLines = [status, toolCallId].filter(Boolean).join(' · ')
  const supplemental = [
    toolName ? `Tool: ${toolName}` : '',
    subject ? `Target: ${subject}` : '',
    metadataLines ? `Meta: ${metadataLines}` : '',
    detail ? `\`\`\`text\n${detail}\n\`\`\`` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  return (
    <Box flexDirection="row" width={width}>
      <Box width={prefixWidth}>
        <Text color={contentColor}>{prefix}</Text>
      </Box>
      <Box flexGrow={1} flexDirection="column" width={contentWidth}>
        <Text color={keywordColor} bold>
          {heading}
        </Text>
        {supplemental ? (
          <Box marginTop={1}>
            <MarkdownDisplay
              text={supplemental}
              isPending={false}
              terminalWidth={contentWidth}
              renderMarkdown
              overrideColor={contentColor}
            />
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}
