import React from 'react'
import { Box, Text } from 'ink'

import { theme } from '../semantic-colors.js'

type LoadingIndicatorProps = {
  active: boolean
  currentLoadingPhrase?: string
  rightContent?: React.ReactNode
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  active,
  currentLoadingPhrase,
  rightContent,
}) => {
  if (!active) {
    return null
  }

  return (
    <Box marginTop={1} width="100%" justifyContent="space-between">
      <Text color={theme.text.link}>{currentLoadingPhrase || 'Running'}</Text>
      {rightContent ? <Box>{rightContent}</Box> : null}
    </Box>
  )
}
