import React from 'react'
import { Box } from 'ink'
import type { FeedItem } from '../types.js'
import { UserMessage } from './messages/UserMessage.js'
import { AssistantMessage } from './messages/AssistantMessage.js'
import { ArtifactMessage } from './messages/ArtifactMessage.js'
import { EventMessage } from './messages/EventMessage.js'
import { OperationMessage } from './messages/OperationMessage.js'
import { BashExecOperationMessage } from './messages/BashExecOperationMessage.js'

type HistoryItemDisplayProps = {
  item: FeedItem
  terminalWidth: number
  baseUrl: string
  questId?: string | null
  liveBash?: boolean
}

const HistoryItemDisplayComponent: React.FC<HistoryItemDisplayProps> = ({
  item,
  terminalWidth,
  baseUrl,
  questId,
  liveBash = false,
}) => {
  const isBashOperation =
    item.type === 'operation' &&
    (
      item.mcpServer === 'bash_exec' ||
      item.mcpTool === 'bash_exec' ||
      item.toolName === 'bash_exec' ||
      item.toolName === 'bash_exec.bash_exec'
    )

  return (
    <Box flexDirection="column" width={terminalWidth} marginBottom={2}>
      {item.type === 'message' && item.role === 'user' && (
        <UserMessage text={item.content} width={terminalWidth} />
      )}
      {item.type === 'message' && item.role === 'assistant' && (
        <AssistantMessage
          text={item.content}
          source={item.source}
          skillId={item.skillId}
          streaming={item.stream}
          width={terminalWidth}
        />
      )}
      {isBashOperation ? (
        <BashExecOperationMessage
          label={item.label}
          content={item.content}
          toolName={item.toolName}
          toolCallId={item.toolCallId}
          status={item.status}
          args={item.args}
          output={item.output}
          mcpServer={item.mcpServer}
          mcpTool={item.mcpTool}
          metadata={item.metadata}
          width={terminalWidth}
          baseUrl={baseUrl}
          questId={questId}
          live={liveBash}
        />
      ) : item.type === 'operation' ? (
        <OperationMessage
          label={item.label}
          content={item.content}
          toolName={item.toolName}
          toolCallId={item.toolCallId}
          status={item.status}
          subject={item.subject}
          args={item.args}
          output={item.output}
          width={terminalWidth}
        />
      ) : null}
      {item.type === 'artifact' && (
        <ArtifactMessage
          kind={item.kind}
          content={item.content}
          status={item.status}
          reason={item.reason}
          guidance={item.guidance}
          branch={item.branch}
          workspaceRoot={item.workspaceRoot}
          flowType={item.flowType}
          protocolStep={item.protocolStep}
          ideaId={item.ideaId}
          campaignId={item.campaignId}
          sliceId={item.sliceId}
          checkpointHead={typeof item.checkpoint?.head === 'string' ? item.checkpoint.head : null}
          width={terminalWidth}
        />
      )}
      {item.type === 'event' && (
        <EventMessage label={item.label} content={item.content} width={terminalWidth} />
      )}
    </Box>
  )
}

export const HistoryItemDisplay = React.memo(HistoryItemDisplayComponent)
HistoryItemDisplay.displayName = 'HistoryItemDisplay'
