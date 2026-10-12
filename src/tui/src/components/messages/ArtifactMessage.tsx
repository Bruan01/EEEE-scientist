import React from 'react'
import { theme } from '../../semantic-colors.js'
import { InfoMessage } from './InfoMessage.js'
export const ArtifactMessage: React.FC<{
  kind: string
  content: string
  status?: string
  reason?: string
  guidance?: string
  branch?: string
  workspaceRoot?: string
  flowType?: string
  protocolStep?: string
  ideaId?: string | null
  campaignId?: string | null
  sliceId?: string | null
  checkpointHead?: string | null
  width?: number
}> = ({
  kind,
  content,
  status,
  reason,
  guidance,
  branch,
  workspaceRoot,
  flowType,
  protocolStep,
  ideaId,
  campaignId,
  sliceId,
  checkpointHead,
  width = 80,
}) => {
  const text = [
    `${kind}${status ? ` · ${status}` : ''}${flowType ? ` · ${flowType}` : ''}${protocolStep ? ` · ${protocolStep}` : ''}`,
    content,
    branch ? `Branch: ${branch}` : '',
    workspaceRoot ? `Workspace: ${workspaceRoot}` : '',
    ideaId ? `Idea: ${ideaId}` : '',
    campaignId ? `Campaign: ${campaignId}` : '',
    sliceId ? `Slice: ${sliceId}` : '',
    reason ? `Reason: ${reason}` : '',
    guidance ? `Next: ${guidance}` : '',
    checkpointHead ? `Checkpoint: ${checkpointHead}` : '',
  ]
    .filter(Boolean)
    .join('\n')
  return (
    <InfoMessage
      text={text}
      icon="◇"
      color={status === 'error' ? theme.status.error : theme.status.warning}
      width={width}
    />
  )
}
