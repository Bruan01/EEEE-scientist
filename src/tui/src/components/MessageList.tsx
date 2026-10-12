import React from 'react'
import { Box } from 'ink'
import type { FeedItem } from '../types.js'
import { HistoryItemDisplay } from './HistoryItemDisplay.js'

type MessageListProps = {
  messages: FeedItem[]
  terminalWidth: number
  baseUrl: string
  questId?: string | null
  latestBashOperationId?: string | null
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  terminalWidth,
  baseUrl,
  questId,
  latestBashOperationId,
}) => {
  return (
    <Box flexDirection="column">
      {messages.map((message) => (
        <HistoryItemDisplay
          key={message.id}
          item={message}
          terminalWidth={terminalWidth}
          baseUrl={baseUrl}
          questId={questId}
          liveBash={message.id === latestBashOperationId}
        />
      ))}
    </Box>
  )
}
