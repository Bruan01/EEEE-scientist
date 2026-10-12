import { ConnectionState } from '../types/connection'

export type ConnectionEvent =
  | { type: 'CONNECT' }
  | { type: 'AUTH_SUCCESS' }
  | { type: 'AUTH_FAILURE'; error: string }
  | { type: 'DISCONNECT' }
  | { type: 'CONNECTION_LOST' }
  | { type: 'RECONNECT_SUCCESS' }
  | { type: 'RECONNECT_FAILURE' }
  | { type: 'MAX_RETRIES_EXCEEDED' }
  | { type: 'SUSPEND' }
  | { type: 'RESUME' }

export const connectionTransitions: Record<
  ConnectionState,
  Partial<Record<ConnectionEvent['type'], ConnectionState>>
> = {
  [ConnectionState.DISCONNECTED]: {
    CONNECT: ConnectionState.CONNECTING,
  },
  [ConnectionState.CONNECTING]: {
    AUTH_SUCCESS: ConnectionState.AUTHENTICATING,
    DISCONNECT: ConnectionState.DISCONNECTED,
    CONNECTION_LOST: ConnectionState.RECONNECTING,
  },
  [ConnectionState.AUTHENTICATING]: {
    AUTH_SUCCESS: ConnectionState.CONNECTED,
    AUTH_FAILURE: ConnectionState.FAILED,
    CONNECTION_LOST: ConnectionState.RECONNECTING,
  },
  [ConnectionState.CONNECTED]: {
    DISCONNECT: ConnectionState.DISCONNECTED,
    CONNECTION_LOST: ConnectionState.RECONNECTING,
    SUSPEND: ConnectionState.SUSPENDED,
  },
  [ConnectionState.RECONNECTING]: {
    RECONNECT_SUCCESS: ConnectionState.CONNECTED,
    MAX_RETRIES_EXCEEDED: ConnectionState.FAILED,
    DISCONNECT: ConnectionState.DISCONNECTED,
  },
  [ConnectionState.SUSPENDED]: {
    RESUME: ConnectionState.CONNECTING,
    DISCONNECT: ConnectionState.DISCONNECTED,
  },
  [ConnectionState.FAILED]: {
    CONNECT: ConnectionState.CONNECTING,
    DISCONNECT: ConnectionState.DISCONNECTED,
  },
}

export class ConnectionStateMachine {
  private state: ConnectionState = ConnectionState.DISCONNECTED
  private listeners: Set<(state: ConnectionState, event: ConnectionEvent) => void> = new Set()

  getState(): ConnectionState {
    return this.state
  }

  sendEvent(event: ConnectionEvent): boolean {
    const nextState = connectionTransitions[this.state]?.[event.type]
    if (!nextState) {
      console.warn(`Invalid connection transition: ${this.state} -> ${event.type}`)
      return false
    }
    const prevState = this.state
    this.state = nextState
    this.notifyListeners(nextState, event)
    if (prevState !== nextState) {
      console.debug(`[CLI] Connection state: ${prevState} -> ${nextState} (${event.type})`)
    }
    return true
  }

  subscribe(listener: (state: ConnectionState, event: ConnectionEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  canSendEvent(eventType: ConnectionEvent['type']): boolean {
    return Boolean(connectionTransitions[this.state]?.[eventType])
  }

  reset(): void {
    this.state = ConnectionState.DISCONNECTED
  }

  private notifyListeners(state: ConnectionState, event: ConnectionEvent): void {
    this.listeners.forEach((listener) => listener(state, event))
  }
}
