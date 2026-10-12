export type LabStreamStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'error' | null | undefined

export function resolveLabListPollingInterval({
  liveEnabled,
  streamStatus,
  fastMs,
  slowMs,
}: {
  liveEnabled: boolean
  streamStatus: LabStreamStatus
  fastMs: number
  slowMs: number
}): number | false {
  if (!liveEnabled) return false
  return streamStatus === 'open' ? slowMs : fastMs
}
