export type BufferedMessage<T = unknown> = {
  id: string
  type: string
  payload: T
  timestamp: number
  priority: 'high' | 'normal' | 'low'
  maxAge?: number
}

export class MessageBuffer<T = unknown> {
  private buffer: BufferedMessage<T>[] = []
  private maxSize: number
  private onOverflow: 'drop_oldest' | 'drop_newest' | 'reject'

  constructor(options: { maxSize?: number; onOverflow?: 'drop_oldest' | 'drop_newest' | 'reject' } = {}) {
    this.maxSize = options.maxSize ?? 1000
    this.onOverflow = options.onOverflow ?? 'drop_oldest'
  }

  enqueue(message: Omit<BufferedMessage<T>, 'id' | 'timestamp'>): boolean {
    this.pruneExpired()

    if (this.buffer.length >= this.maxSize) {
      switch (this.onOverflow) {
        case 'drop_oldest': {
          this.buffer.sort((a, b) => {
            const priorityOrder = { high: 0, normal: 1, low: 2 }
            return priorityOrder[b.priority] - priorityOrder[a.priority] || a.timestamp - b.timestamp
          })
          this.buffer.pop()
          break
        }
        case 'drop_newest':
          return false
        case 'reject':
          throw new Error('Message buffer overflow')
      }
    }

    const bufferedMessage: BufferedMessage<T> = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }

    this.buffer.push(bufferedMessage)
    return true
  }

  flush(): BufferedMessage<T>[] {
    this.pruneExpired()
    const messages = [...this.buffer].sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 }
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      return priorityDiff !== 0 ? priorityDiff : a.timestamp - b.timestamp
    })
    this.buffer = []
    return messages
  }

  getStatus(): { size: number; maxSize: number; oldestTimestamp: number | null } {
    return {
      size: this.buffer.length,
      maxSize: this.maxSize,
      oldestTimestamp:
        this.buffer.length > 0 ? Math.min(...this.buffer.map((message) => message.timestamp)) : null,
    }
  }

  clear(): void {
    this.buffer = []
  }

  countByPriority(priority: 'high' | 'normal' | 'low'): number {
    return this.buffer.filter((message) => message.priority === priority).length
  }

  private pruneExpired(): void {
    const now = Date.now()
    this.buffer = this.buffer.filter((message) => {
      if (!message.maxAge) return true
      return now - message.timestamp < message.maxAge
    })
  }
}
