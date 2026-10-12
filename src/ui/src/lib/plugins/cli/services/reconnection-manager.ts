export type ReconnectionConfig = {
  initialDelay: number
  maxDelay: number
  maxRetries: number
  backoffMultiplier: number
  jitterFactor: number
}

export type ReconnectionState =
  | { status: 'waiting'; retryCount: number; maxRetries: number; nextRetryIn: number }
  | { status: 'reconnecting'; retryCount: number }
  | { status: 'connected' }
  | { status: 'failed'; message: string }
  | { status: 'cancelled' }

export const DEFAULT_RECONNECTION_CONFIG: ReconnectionConfig = {
  initialDelay: 1000,
  maxDelay: 300000,
  maxRetries: 30,
  backoffMultiplier: 1.5,
  jitterFactor: 0.2,
}

export class ReconnectionManager {
  private config: ReconnectionConfig
  private retryCount = 0
  private currentTimeout: ReturnType<typeof setTimeout> | null = null
  private listeners: Set<(state: ReconnectionState) => void> = new Set()

  constructor(config: Partial<ReconnectionConfig> = {}) {
    this.config = { ...DEFAULT_RECONNECTION_CONFIG, ...config }
  }

  private calculateDelay(): number {
    const baseDelay = Math.min(
      this.config.initialDelay * Math.pow(this.config.backoffMultiplier, this.retryCount),
      this.config.maxDelay
    )
    const jitter = baseDelay * this.config.jitterFactor * (Math.random() * 2 - 1)
    return Math.max(0, Math.floor(baseDelay + jitter))
  }

  scheduleReconnect(onReconnect: () => Promise<boolean>): void {
    if (this.retryCount >= this.config.maxRetries) {
      this.notifyListeners({
        status: 'failed',
        message: `Max retries reached (${this.config.maxRetries})`,
      })
      return
    }

    const delay = this.calculateDelay()
    this.retryCount += 1

    this.notifyListeners({
      status: 'waiting',
      retryCount: this.retryCount,
      maxRetries: this.config.maxRetries,
      nextRetryIn: delay,
    })

    this.currentTimeout = setTimeout(async () => {
      this.notifyListeners({ status: 'reconnecting', retryCount: this.retryCount })
      try {
        const success = await onReconnect()
        if (success) {
          this.reset()
          this.notifyListeners({ status: 'connected' })
          return
        }
      } catch (error) {
        console.error('[CLI] Reconnect failed:', error)
      }
      this.scheduleReconnect(onReconnect)
    }, delay)
  }

  reset(): void {
    this.retryCount = 0
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout)
      this.currentTimeout = null
    }
  }

  cancel(): void {
    this.reset()
    this.notifyListeners({ status: 'cancelled' })
  }

  retryNow(onReconnect: () => Promise<boolean>): void {
    this.cancel()
    this.retryCount = 0
    this.scheduleReconnect(onReconnect)
  }

  subscribe(listener: (state: ReconnectionState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getRetryCount(): number {
    return this.retryCount
  }

  private notifyListeners(state: ReconnectionState): void {
    this.listeners.forEach((listener) => listener(state))
  }
}
