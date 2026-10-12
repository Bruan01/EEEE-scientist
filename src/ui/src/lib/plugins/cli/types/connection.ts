export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  AUTHENTICATING = 'authenticating',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  SUSPENDED = 'suspended',
  FAILED = 'failed',
}

export interface ConnectionMetrics {
  totalConnections: number
  successfulConnections: number
  failedConnections: number
  reconnectionAttempts: number
  averageReconnectTime: number
  messagesBuffered: number
  messagesDropped: number
}

export interface ConnectionStatus {
  state: ConnectionState
  latencyMs?: number
  lastError?: string
  lastConnectedAt?: number
  reconnectAttempts?: number
  nextRetryIn?: number
  bufferedMessages?: number
  metrics?: ConnectionMetrics
}
