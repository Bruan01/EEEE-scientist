import React from 'react'
import { Text, Box } from 'ink'
import { theme } from '../../semantic-colors.js'
import { RenderInline } from '../../utils/InlineMarkdownRenderer.js'

type ErrorMessageProps = {
  text: string
  width?: number
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ text, width }) => {
  const prefix = '! '
  const prefixWidth = prefix.length

  return (
    <Box flexDirection="row" width={width}>
      <Box width={prefixWidth}>
        <Text color={theme.status.error}>{prefix}</Text>
      </Box>
      <Box flexGrow={1} flexDirection="column">
        {text.split('\n').map((line, index) => (
          <Text wrap="wrap" key={index} color={theme.status.error}>
            <RenderInline text={line} defaultColor={theme.status.error} />
          </Text>
        ))}
      </Box>
    </Box>
  )
}
