import React from 'react'
import { Box, Text } from 'ink'
import { useTerminalSize } from '../hooks/useTerminalSize.js'
import { theme } from '../semantic-colors.js'

const WORDMARK_LINES = [
  '  ____                  ____       _            _   _     _   ',
  ' |  _ \\  ___  ___ _ __ / ___|  ___(_) ___ _ __ | |_(_)___| |_ ',
  " | | | |/ _ \\/ _ \\ '_ \\\\___ \\ / __| |/ _ \\ '_ \\| __| / __| __|",
  ' | |_| |  __/  __/ |_) |___) | (__| |  __/ | | | |_| \\__ \\ |_ ',
  ' |____/ \\___|\\___| .__/|____/ \\___|_|\\___|_| |_|\\__|_|___/\\__|',
  '                 |_|                                          ',
]

const WORDMARK_COLORS = [
  theme.ui.brand.strong,
  theme.ui.brand.medium,
  theme.ui.brand.soft,
  theme.ui.brand.soft,
  theme.ui.brand.medium,
  theme.text.secondary,
]

type IconSegment = {
  text: string
  color: string
}

const ICON_LINES: IconSegment[][] = [
  [{ text: '  ╭─────────╮', color: theme.ui.brand.medium }],
  [
    { text: '  │ ', color: theme.ui.brand.medium },
    { text: '●', color: theme.ui.brand.soft },
    { text: '─', color: theme.ui.brand.medium },
    { text: '●', color: theme.ui.brand.strong },
    { text: '─', color: theme.ui.brand.medium },
    { text: '●', color: theme.ui.brand.soft },
    { text: '   │', color: theme.ui.brand.medium },
  ],
  [
    { text: '  │ │ ', color: theme.ui.brand.medium },
    { text: '╲', color: theme.ui.brand.soft },
    { text: '│', color: theme.ui.brand.medium },
    { text: '    │', color: theme.ui.brand.medium },
  ],
  [
    { text: '  │ ', color: theme.ui.brand.medium },
    { text: '●', color: theme.ui.brand.soft },
    { text: '─', color: theme.ui.brand.medium },
    { text: '●', color: theme.ui.brand.strong },
    { text: '─', color: theme.ui.brand.medium },
    { text: '●', color: theme.ui.brand.medium },
    { text: '─', color: theme.ui.brand.medium },
    { text: '●', color: theme.ui.brand.soft },
    { text: ' │', color: theme.ui.brand.medium },
  ],
  [
    { text: '  │   ', color: theme.ui.brand.medium },
    { text: '╲', color: theme.ui.brand.soft },
    { text: ' │', color: theme.ui.brand.medium },
    { text: '   │', color: theme.ui.brand.medium },
  ],
  [
    { text: '  │    ', color: theme.ui.brand.medium },
    { text: '●', color: theme.ui.brand.medium },
    { text: '    │', color: theme.ui.brand.medium },
  ],
  [{ text: '  ╰─────────╯', color: theme.ui.brand.medium }],
]

const IconMark: React.FC = () => (
  <Box flexDirection="column" marginRight={2}>
    {ICON_LINES.map((segments, lineIndex) => (
      <Text key={`icon-line-${lineIndex}`}>
        {segments.map((segment, segmentIndex) => (
          <Text key={`icon-line-${lineIndex}-segment-${segmentIndex}`} color={segment.color}>
            {segment.text}
          </Text>
        ))}
      </Text>
    ))}
  </Box>
)

const CompactMark: React.FC = () => (
  <Text>
    <Text color={theme.ui.brand.medium}>[</Text>
    <Text color={theme.ui.brand.soft}>●</Text>
    <Text color={theme.ui.brand.medium}>─</Text>
    <Text color={theme.ui.brand.strong}>●</Text>
    <Text color={theme.ui.brand.medium}>─</Text>
    <Text color={theme.ui.brand.soft}>●</Text>
    <Text color={theme.ui.brand.medium}>]</Text>
    <Text color={theme.text.secondary}> </Text>
    <Text color={theme.ui.brand.strong}>DEEP</Text>
    <Text color={theme.ui.brand.medium}>SCIENT</Text>
    <Text color={theme.ui.brand.soft}>IST</Text>
  </Text>
)

export const Logo: React.FC = () => {
  const { columns } = useTerminalSize()

  if (columns < 120) {
    return (
      <Box flexDirection="column">
        <CompactMark />
      </Box>
    )
  }

  return (
    <Box flexDirection="row" alignItems="flex-start">
      <IconMark />
      <Box flexDirection="column">
        {WORDMARK_LINES.map((line, index) => (
          <Text key={line} color={WORDMARK_COLORS[index] || theme.ui.brand.strong}>
            {line}
          </Text>
        ))}
      </Box>
    </Box>
  )
}
