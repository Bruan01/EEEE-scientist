import React from 'react'
import { Text } from 'ink'

import { theme } from '../semantic-colors.js'

type GradientStatusTextProps = {
  text: string
}

export const GradientStatusText: React.FC<GradientStatusTextProps> = ({ text }) => {
  const palette = theme.ui.gradient.length > 0 ? [...theme.ui.gradient] : [theme.text.accent]
  const segments = text.split('|').map((segment) => segment.trim())

  return (
    <Text wrap="truncate">
      {segments.map((segment, index) => (
        <React.Fragment key={`segment-${index}`}>
          {index > 0 ? <Text color={theme.text.secondary}> | </Text> : null}
          <Text color={palette[index % palette.length] || theme.text.accent}>{segment}</Text>
        </React.Fragment>
      ))}
    </Text>
  )
}
