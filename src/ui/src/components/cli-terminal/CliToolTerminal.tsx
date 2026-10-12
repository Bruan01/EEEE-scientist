'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EnhancedTerminal } from '@/lib/plugins/cli/components/EnhancedTerminal'
import { useCliSocket, type CliSocketHandlers } from '@/lib/plugins/cli/hooks/useCliSocket'
import { useCliAccess } from '@/lib/plugins/cli/hooks/useCliAccess'
import { ConnectionState } from '@/lib/plugins/cli/types/connection'
import { nextSeq } from '@/lib/plugins/cli/lib/protocol'
import { buildChatSessionId } from '@/lib/plugins/cli/lib/session-id'
import '@/lib/plugins/cli/styles/terminal.css'

export function CliToolTerminal({
  projectId,
  serverId,
  chatSessionId,
  shellSessionId,
  operationId,
  readOnly,
  showHeader = true,
}: {
  projectId: string
  serverId: string
  chatSessionId: string
  shellSessionId?: string
  operationId?: string | null
  readOnly?: boolean
  showHeader?: boolean
}) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const terminalWriterRef = useRef<(data: string, onComplete?: () => void) => void>(() => {})
  const terminalFocusRef = useRef<() => void>(() => {})
  const terminalSizeRef = useRef<{ cols: number; rows: number } | null>(null)
  const decoderRef = useRef<TextDecoder | null>(typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null)

  const { capabilities } = useCliAccess({ projectId, serverId, readOnly })
  const canInput = capabilities.terminal_input

  useEffect(() => {
    let active = true
    const build = async () => {
      const resolvedId = shellSessionId && shellSessionId.trim() ? shellSessionId : chatSessionId
      const scopedId = resolvedId === chatSessionId ? resolvedId : `${chatSessionId}:${resolvedId}`
      const id = await buildChatSessionId(projectId, serverId, scopedId)
      if (active) setSessionId(id)
    }
    void build()
    return () => {
      active = false
    }
  }, [chatSessionId, projectId, serverId, shellSessionId])

  const handlers = useMemo<CliSocketHandlers>(
    () => ({
      onTerminalOutput: (payload) => {
        if (operationId && payload.operation_id && payload.operation_id !== operationId) return
        const rawData = (payload.payload as Record<string, unknown>)?.data
        let output = ''
        if (typeof rawData === 'string') {
          output = rawData
        } else if (rawData instanceof ArrayBuffer) {
          output = decoderRef.current?.decode(new Uint8Array(rawData)) ?? ''
        } else if (ArrayBuffer.isView(rawData)) {
          const view = rawData as ArrayBufferView
          output = decoderRef.current?.decode(new Uint8Array(view.buffer, view.byteOffset, view.byteLength)) ?? ''
        } else if (Array.isArray(rawData)) {
          try {
            output = decoderRef.current?.decode(new Uint8Array(rawData)) ?? ''
          } catch {
            output = String(rawData)
          }
        } else if (rawData != null) {
          output = String(rawData)
        }
        if (output) {
          terminalWriterRef.current?.(output)
          terminalFocusRef.current?.()
        }
      },
    }),
    [operationId]
  )

  const { status, emitEnvelope, sendTerminalInput, sendTerminalResize } = useCliSocket({
    projectId,
    serverId,
    handlers,
  })

  useEffect(() => {
    if (!sessionId || status.state !== ConnectionState.CONNECTED) return
    emitEnvelope('cli:session:attach', { session_id: sessionId }, { session_id: sessionId })
    if (terminalSizeRef.current) {
      sendTerminalResize({
        cols: terminalSizeRef.current.cols,
        rows: terminalSizeRef.current.rows,
        sessionId,
      })
    }
  }, [emitEnvelope, sendTerminalResize, sessionId, status.state])

  const handleInput = useCallback(
    (data: string) => {
      if (!sessionId || !canInput) return
      const operation =
        operationId ||
        (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `op-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`)
      sendTerminalInput({
        data,
        sessionId,
        seq: nextSeq(),
        operationId: operation,
      })
    },
    [canInput, operationId, sendTerminalInput, sessionId]
  )

  const handleResize = useCallback((cols: number, rows: number) => {
    terminalSizeRef.current = { cols, rows }
    if (!sessionId) return
    sendTerminalResize({ cols, rows, sessionId })
  }, [sendTerminalResize, sessionId])

  return (
    <div className="cli-root h-full min-h-0">
      <EnhancedTerminal
        onInput={handleInput}
        onResize={handleResize}
        searchOpen={false}
        onSearchOpenChange={() => {}}
        onReady={({ write, focus }) => {
          terminalWriterRef.current = write
          terminalFocusRef.current = focus
        }}
        appearance="ui"
        showHeader={showHeader}
      />
      {!canInput ? (
        <div className="mt-2 text-xs text-[var(--cli-muted-1)]">
          View only. CLI input permission required.
        </div>
      ) : null}
    </div>
  )
}

export default CliToolTerminal
