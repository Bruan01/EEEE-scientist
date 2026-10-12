import type { ConnectionMetrics } from '../types/connection'

export class ConnectionMetricsCollector {
  private metrics: ConnectionMetrics = {
    totalConnections: 0,
    successfulConnections: 0,
    failedConnections: 0,
    reconnectionAttempts: 0,
    averageReconnectTime: 0,
    messagesBuffered: 0,
    messagesDropped: 0,
  }

  recordConnection() {
    this.metrics.totalConnections += 1
  }

  recordConnectionSuccess() {
    this.metrics.successfulConnections += 1
  }

  recordConnectionFailure() {
    this.metrics.failedConnections += 1
  }

  recordReconnectionAttempt(durationMs: number) {
    this.metrics.reconnectionAttempts += 1
    const attempts = this.metrics.reconnectionAttempts
    this.metrics.averageReconnectTime =
      (this.metrics.averageReconnectTime * (attempts - 1) + durationMs) / attempts
  }

  recordMessageBuffered(count = 1) {
    this.metrics.messagesBuffered += count
  }

  recordMessageDropped(count = 1) {
    this.metrics.messagesDropped += count
  }

  getMetrics(): ConnectionMetrics {
    return { ...this.metrics }
  }
}
