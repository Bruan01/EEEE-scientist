import React from 'react'
import { Text, Box } from 'ink'
import { theme } from '../../semantic-colors.js'
import { RenderInline } from '../../utils/InlineMarkdownRenderer.js'

type UserMessageProps = {
  text: string
  width: number
}

export const UserMessage: React.FC<UserMessageProps> = ({ text, width }) => {
  const prefix = '> '
  const prefixWidth = prefix.length

  return (
    <Box flexDirection="row" paddingY={0} alignSelf="flex-start" width={width}>
      <Box width={prefixWidth} flexShrink={0}>
        <Text color={theme.text.user}>{prefix}</Text>
      </Box>
      <Box flexGrow={1}>
        <Text wrap="wrap" color={theme.text.user}>
          <RenderInline text={text} defaultColor={theme.text.user} />
        </Text>
      </Box>
    </Box>
  )
}
