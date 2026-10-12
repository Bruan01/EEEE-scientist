export type CliEnvelope<T = Record<string, unknown>> = {
  protocol_version: 'cli.v1'
  project_id?: string
  server_id?: string
  client_id?: string
  session_id?: string
  operation_id?: string
  seq?: number
  ack?: number
  ts: string
  payload: T
}

let seqCounter = 0

export function nextSeq(): number {
  seqCounter += 1
  return seqCounter
}

export function resetSeq(): void {
  seqCounter = 0
}

export function wrapEnvelope<T>(payload: T, meta: Partial<CliEnvelope<T>> = {}): CliEnvelope<T> {
  return {
    protocol_version: 'cli.v1',
    ts: new Date().toISOString(),
    payload,
    ...meta,
  }
}
