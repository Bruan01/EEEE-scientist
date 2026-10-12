'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { acquireCliSocket, getCliClientId, unwrapPayload } from '../lib/socket'
import { wrapEnvelope, type CliEnvelope } from '../lib/protocol'
import { ConnectionState, type ConnectionStatus } from '../types/connection'
import { ConnectionStateMachine } from '../services/connection-state-machine'
import { ConnectionMetricsCollector } from '../services/connection-metrics'
import { MessageBuffer } from '../services/message-buffer'
import { ReconnectionManager } from '../services/reconnection-manager'

export type CliSocketHandlers = {
  onTerminalOutput?: (payload: CliEnvelope) => void
  onStatusUpdate?: (payload: CliEnvelope) => void
  onFileResponse?: (payload: CliEnvelope) => void
  onConfirmRequired?: (payload: CliEnvelope) => void
  onBlocked?: (payload: CliEnvelope) => void
  onSessionCreated?: (payload: CliEnvelope) => void
  onSessionAttached?: (payload: CliEnvelope) => void
  onSessionDetached?: (payload: CliEnvelope) => void
  onSessionClosed?: (payload: CliEnvelope) => void
  onSessionError?: (payload: CliEnvelope) => void
  onMethodStatus?: (payload: CliEnvelope) => void
  onMethodDone?: (payload: CliEnvelope) => void
  onMethodError?: (payload: CliEnvelope) => void
  onMethodListResponse?: (payload: CliEnvelope) => void
  onMethodGetResponse?: (payload: CliEnvelope) => void
  onError?: (message: string) => void
}

type EmitOptions = {
  priority?: 'high' | 'normal' | 'low'
  maxAge?: number
}

const CLI_OFFLINE_MESSAGE = 'CLI server offline. Please ensure the CLI is running.'

const normalizeGatewayError = (message: string) => {
  const lower = message.toLowerCase()
  if (
    (lower.includes('cli server') && (lower.includes('not connected') || lower.includes('offline'))) ||
    lower.includes('cli_server_not_connected') ||
    lower.includes('cli_server_offline')
  ) {
    return CLI_OFFLINE_MESSAGE
  }
  return message
}

export function useCliSocket(options: {
  projectId?: string | null
  serverId?: string | null
  handlers?: CliSocketHandlers
}) {
  const { projectId, serverId, handlers } = options
  const clientIdRef = useRef<string>(getCliClientId())
  const reconnectRef = useRef(new ReconnectionManager())
  const reconnectingRef = useRef(false)
  const bufferRef = useRef(new MessageBuffer<CliEnvelope>())
  const stateMachineRef = useRef(new ConnectionStateMachine())
  const metricsRef = useRef(new ConnectionMetricsCollector())
  const reconnectStartedAtRef = useRef<number | null>(null)
  const subscribedRef = useRef(false)
  const subscribeInFlightRef = useRef<Promise<boolean> | null>(null)
  const scheduleReconnectRef = useRef<() => void>(() => {})
  const [status, setStatus] = useState<ConnectionStatus>(() => ({
    state: stateMachineRef.current.getState(),
    bufferedMessages: 0,
    metrics: metricsRef.current.getMetrics(),
  }))

  const { socket, release } = useMemo(() => acquireCliSocket(), [])

  const syncMetrics = useCallback(() => {
    setStatus((prev) => ({
      ...prev,
      metrics: metricsRef.current.getMetrics(),
    }))
  }, [])

  const updateBufferedStatus = useCallback(() => {
    const bufferStatus = bufferRef.current.getStatus()
    setStatus((prev) => ({
      ...prev,
      bufferedMessages: bufferStatus.size,
      metrics: metricsRef.current.getMetrics(),
    }))
  }, [])

  const emitEnvelope = useCallback(
    (
      event: string,
      payload: Record<string, unknown>,
      meta: Partial<CliEnvelope> = {},
      options?: EmitOptions
    ) => {
      if (!projectId || !serverId) return
      const envelope = wrapEnvelope(payload, {
        project_id: projectId,
        server_id: serverId,
        client_id: clientIdRef.current,
        ...meta,
      })

      if (!socket.connected) {
        try {
          const accepted = bufferRef.current.enqueue({
            type: event,
            payload: envelope,
            priority: options?.priority ?? 'normal',
            maxAge: options?.maxAge,
          })
          if (!accepted) {
            metricsRef.current.recordMessageDropped()
            syncMetrics()
            handlers?.onError?.('Message buffer full; dropping newest message')
          } else {
            metricsRef.current.recordMessageBuffered()
          }
        } catch (error) {
          metricsRef.current.recordMessageDropped()
          syncMetrics()
          handlers?.onError?.(error instanceof Error ? error.message : 'Message buffer error')
        }
        updateBufferedStatus()
        return
      }

      socket.emit(event, envelope)
    },
    [projectId, serverId, socket, handlers, updateBufferedStatus, syncMetrics]
  )

  const flushBuffer = useCallback(() => {
    if (!socket.connected) return
    const messages = bufferRef.current.flush()
    messages.forEach((message) => socket.emit(message.type, message.payload))
    updateBufferedStatus()
  }, [socket, updateBufferedStatus])

  const subscribe = useCallback(async () => {
    if (!projectId || !serverId) return false
    if (subscribeInFlightRef.current) {
      return subscribeInFlightRef.current
    }
    const startedAt = Date.now()
    const envelope = wrapEnvelope({}, {
      project_id: projectId,
      server_id: serverId,
      client_id: clientIdRef.current,
    })

    metricsRef.current.recordConnection()
    syncMetrics()

    const promise = new Promise<boolean>((resolve) => {
      socket.timeout(3000).emit('cli:subscribe', envelope, (err?: Error) => {
        subscribeInFlightRef.current = null
        if (err) {
          subscribedRef.current = false
          metricsRef.current.recordConnectionFailure()
          syncMetrics()
          const currentState = stateMachineRef.current.getState()
          if (
            currentState === ConnectionState.AUTHENTICATING &&
            stateMachineRef.current.canSendEvent('AUTH_FAILURE')
          ) {
            stateMachineRef.current.sendEvent({ type: 'AUTH_FAILURE', error: err.message })
          }
          if (currentState === ConnectionState.RECONNECTING) {
            scheduleReconnectRef.current()
          }
          setStatus((prev) => ({ ...prev, lastError: err.message }))
          resolve(false)
          return
        }
        const latencyMs = Date.now() - startedAt
        const currentState = stateMachineRef.current.getState()
        if (currentState === ConnectionState.RECONNECTING) {
          stateMachineRef.current.sendEvent({ type: 'RECONNECT_SUCCESS' })
        } else if (currentState === ConnectionState.AUTHENTICATING) {
          stateMachineRef.current.sendEvent({ type: 'AUTH_SUCCESS' })
        }
        subscribedRef.current = true
        metricsRef.current.recordConnectionSuccess()
        syncMetrics()
        reconnectRef.current.reset()
        reconnectingRef.current = false
        setStatus((prev) => ({
          ...prev,
          latencyMs,
          lastConnectedAt: Date.now(),
        }))
        resolve(true)
      })
    })
    subscribeInFlightRef.current = promise
    return promise
  }, [projectId, serverId, socket, syncMetrics])

  const attemptReconnect = useCallback(async () => {
    if (socket.connected && subscribedRef.current) return true

    if (!socket.connected) {
      const connected = await new Promise<boolean>((resolve) => {
        let settled = false
        const timeout = window.setTimeout(() => {
          if (settled) return
          settled = true
          cleanup()
          resolve(false)
        }, 4000)

        const handleConnect = () => {
          if (settled) return
          settled = true
          cleanup()
          resolve(true)
        }

        const handleError = () => {
          if (settled) return
          settled = true
          cleanup()
          resolve(false)
        }

        const cleanup = () => {
          window.clearTimeout(timeout)
          socket.off('connect', handleConnect)
          socket.off('connect_error', handleError)
        }

        socket.once('connect', handleConnect)
        socket.once('connect_error', handleError)
        socket.connect()
      })

      if (!connected) return false
    }

    const subscribed = await subscribe()
    if (subscribed) {
      flushBuffer()
    }
    return subscribed
  }, [socket, subscribe, flushBuffer])

  const scheduleReconnect = useCallback(() => {
    if (reconnectingRef.current) return
    reconnectingRef.current = true
    reconnectRef.current.scheduleReconnect(attemptReconnect)
  }, [attemptReconnect])

  scheduleReconnectRef.current = scheduleReconnect

  useEffect(() => {
    const stateMachine = stateMachineRef.current
    const unsubscribeState = stateMachine.subscribe((nextState, event) => {
      setStatus((prev) => ({
        ...prev,
        state: nextState,
        lastError: event.type === 'AUTH_FAILURE' ? event.error : prev.lastError,
      }))
    })

    const unsubscribeReconnect = reconnectRef.current.subscribe((reconnectState) => {
      if (reconnectState.status === 'waiting') {
        reconnectStartedAtRef.current = null
        setStatus((prev) => ({
          ...prev,
          reconnectAttempts: reconnectState.retryCount,
          nextRetryIn: reconnectState.nextRetryIn,
        }))
        return
      }
      if (reconnectState.status === 'reconnecting') {
        if (!reconnectStartedAtRef.current) {
          reconnectStartedAtRef.current = Date.now()
        }
        setStatus((prev) => ({
          ...prev,
          reconnectAttempts: reconnectState.retryCount,
          nextRetryIn: undefined,
        }))
        return
      }
      if (reconnectState.status === 'failed') {
        reconnectingRef.current = false
        metricsRef.current.recordConnectionFailure()
        syncMetrics()
        if (stateMachine.canSendEvent('MAX_RETRIES_EXCEEDED')) {
          stateMachine.sendEvent({ type: 'MAX_RETRIES_EXCEEDED' })
        }
        setStatus((prev) => ({
          ...prev,
          lastError: reconnectState.message,
        }))
        return
      }
      if (reconnectState.status === 'connected') {
        reconnectingRef.current = false
        if (reconnectStartedAtRef.current) {
          metricsRef.current.recordReconnectionAttempt(
            Date.now() - reconnectStartedAtRef.current
          )
          syncMetrics()
          reconnectStartedAtRef.current = null
        }
        setStatus((prev) => ({
          ...prev,
          reconnectAttempts: 0,
          nextRetryIn: undefined,
        }))
        return
      }
      if (reconnectState.status === 'cancelled') {
        reconnectingRef.current = false
        reconnectStartedAtRef.current = null
        setStatus((prev) => ({
          ...prev,
          reconnectAttempts: 0,
          nextRetryIn: undefined,
        }))
      }
    })

    return () => {
      unsubscribeState()
      unsubscribeReconnect()
    }
  }, [syncMetrics])

  useEffect(() => {
    if (!projectId || !serverId) return

    const stateMachine = stateMachineRef.current
    if (stateMachine.canSendEvent('CONNECT')) {
      stateMachine.sendEvent({ type: 'CONNECT' })
    }

    const handleConnect = async () => {
      const currentState = stateMachine.getState()
      if (currentState === ConnectionState.CONNECTING && stateMachine.canSendEvent('AUTH_SUCCESS')) {
        stateMachine.sendEvent({ type: 'AUTH_SUCCESS' })
      }
      if (currentState !== ConnectionState.RECONNECTING) {
        const subscribed = await subscribe()
        if (subscribed) {
          flushBuffer()
        }
      }
    }

    const handleDisconnect = (reason?: string) => {
      subscribedRef.current = false
      if (stateMachine.canSendEvent('CONNECTION_LOST')) {
        stateMachine.sendEvent({ type: 'CONNECTION_LOST' })
      }
      if (reason) {
        setStatus((prev) => ({ ...prev, lastError: `Disconnected: ${reason}` }))
      }
      scheduleReconnect()
    }

    const handleError = (error: unknown) => {
      subscribedRef.current = false
      const message = error instanceof Error ? error.message : 'Connection error'
      setStatus((prev) => ({ ...prev, lastError: message }))
      handlers?.onError?.(message)
      metricsRef.current.recordConnectionFailure()
      syncMetrics()
      if (stateMachine.canSendEvent('CONNECTION_LOST')) {
        stateMachine.sendEvent({ type: 'CONNECTION_LOST' })
      }
      scheduleReconnect()
    }

    const handleTerminalOutput = (payload: CliEnvelope) => {
      handlers?.onTerminalOutput?.(payload)
    }

    const handleStatusUpdate = (payload: CliEnvelope) => {
      handlers?.onStatusUpdate?.(payload)
    }

    const handleFileResponse = (payload: CliEnvelope) => {
      handlers?.onFileResponse?.(payload)
    }

    const handleConfirm = (payload: CliEnvelope) => {
      handlers?.onConfirmRequired?.(payload)
    }

    const handleBlocked = (payload: CliEnvelope) => {
      handlers?.onBlocked?.(payload)
    }

    const handleSessionCreated = (payload: CliEnvelope) => {
      handlers?.onSessionCreated?.(payload)
    }

    const handleSessionAttached = (payload: CliEnvelope) => {
      handlers?.onSessionAttached?.(payload)
    }

    const handleSessionDetached = (payload: CliEnvelope) => {
      handlers?.onSessionDetached?.(payload)
    }

    const handleSessionClosed = (payload: CliEnvelope) => {
      handlers?.onSessionClosed?.(payload)
    }

    const handleSessionError = (payload: CliEnvelope) => {
      handlers?.onSessionError?.(payload)
    }

    const handleMethodStatus = (payload: CliEnvelope) => {
      handlers?.onMethodStatus?.(payload)
    }

    const handleMethodDone = (payload: CliEnvelope) => {
      handlers?.onMethodDone?.(payload)
    }

    const handleMethodError = (payload: CliEnvelope) => {
      handlers?.onMethodError?.(payload)
    }

    const handleMethodListResponse = (payload: CliEnvelope) => {
      handlers?.onMethodListResponse?.(payload)
    }

    const handleMethodGetResponse = (payload: CliEnvelope) => {
      handlers?.onMethodGetResponse?.(payload)
    }

    const handleGatewayError = (payload: { event?: string; message?: string }) => {
      const message =
        typeof payload?.message === 'string' && payload.message
          ? payload.message
          : 'CLI server error'
      const eventLabel =
        typeof payload?.event === 'string' && payload.event ? ` (${payload.event})` : ''
      const normalized = normalizeGatewayError(message)
      handlers?.onError?.(`${normalized}${eventLabel}`)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleError)
    socket.on('cli:terminal:output', handleTerminalOutput)
    socket.on('cli:status:update', handleStatusUpdate)
    socket.on('cli:file:list:response', handleFileResponse)
    socket.on('cli:file:content:response', handleFileResponse)
    socket.on('cli:file:download:response', handleFileResponse)
    socket.on('cli:file:write:response', handleFileResponse)
    socket.on('cli:file:delete:response', handleFileResponse)
    socket.on('cli:terminal:confirm_required', handleConfirm)
    socket.on('cli:terminal:blocked', handleBlocked)
    socket.on('cli:session:created', handleSessionCreated)
    socket.on('cli:session:attached', handleSessionAttached)
    socket.on('cli:session:detached', handleSessionDetached)
    socket.on('cli:session:closed', handleSessionClosed)
    socket.on('cli:session:error', handleSessionError)
    socket.on('cli:method:status', handleMethodStatus)
    socket.on('cli:method:done', handleMethodDone)
    socket.on('cli:method:error', handleMethodError)
    socket.on('cli:method:list:response', handleMethodListResponse)
    socket.on('cli:method:get:response', handleMethodGetResponse)
    socket.on('cli:error', handleGatewayError)

    if (!socket.connected) {
      socket.connect()
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleError)
      socket.off('cli:terminal:output', handleTerminalOutput)
      socket.off('cli:status:update', handleStatusUpdate)
      socket.off('cli:file:list:response', handleFileResponse)
      socket.off('cli:file:content:response', handleFileResponse)
      socket.off('cli:file:download:response', handleFileResponse)
      socket.off('cli:file:write:response', handleFileResponse)
      socket.off('cli:file:delete:response', handleFileResponse)
      socket.off('cli:terminal:confirm_required', handleConfirm)
      socket.off('cli:terminal:blocked', handleBlocked)
      socket.off('cli:session:created', handleSessionCreated)
      socket.off('cli:session:attached', handleSessionAttached)
      socket.off('cli:session:detached', handleSessionDetached)
      socket.off('cli:session:closed', handleSessionClosed)
      socket.off('cli:session:error', handleSessionError)
      socket.off('cli:method:status', handleMethodStatus)
      socket.off('cli:method:done', handleMethodDone)
      socket.off('cli:method:error', handleMethodError)
      socket.off('cli:method:list:response', handleMethodListResponse)
      socket.off('cli:method:get:response', handleMethodGetResponse)
      socket.off('cli:error', handleGatewayError)
      reconnectRef.current.cancel()
      release()
    }
  }, [projectId, serverId, socket, release, subscribe, flushBuffer, handlers, scheduleReconnect, syncMetrics])

  const sendTerminalInput = useCallback(
    (payload: {
      data: string
      sessionId: string
      seq: number
      operationId: string
      confirmed?: boolean
      mode?: 'terminal' | 'ui'
    }) => {
      const inputPayload: Record<string, unknown> = {
        data: payload.data,
        confirmed: payload.confirmed,
      }
      if (payload.mode) {
        inputPayload.mode = payload.mode
      }
      emitEnvelope(
        'cli:terminal:input',
        inputPayload,
        {
          session_id: payload.sessionId,
          seq: payload.seq,
          operation_id: payload.operationId,
        },
        { priority: 'high' }
      )
    },
    [emitEnvelope]
  )

  const sendTerminalResize = useCallback(
    (payload: { cols: number; rows: number; sessionId: string }) => {
      emitEnvelope(
        'cli:terminal:resize',
        { cols: payload.cols, rows: payload.rows },
        { session_id: payload.sessionId },
        { priority: 'low', maxAge: 2000 }
      )
    },
    [emitEnvelope]
  )

  const sendFileRequest = useCallback(
    (event: string, payload: Record<string, unknown>, meta?: Partial<CliEnvelope>) => {
      emitEnvelope(event, payload, meta)
    },
    [emitEnvelope]
  )

  return {
    socket,
    status,
    emitEnvelope,
    sendTerminalInput,
    sendTerminalResize,
    sendFileRequest,
    unwrapPayload,
  }
}
