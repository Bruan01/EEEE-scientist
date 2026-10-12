'use client'

type MessageHandler = (event: MessageEvent) => void
type GenericHandler = (event: Event) => void

const decoder = new TextDecoder('utf-8')

export class SocketTerminalTransport {
  readyState: number = WebSocket.OPEN
  binaryType: BinaryType = 'arraybuffer'
  onmessage: MessageHandler | null = null
  onclose: GenericHandler | null = null
  onerror: GenericHandler | null = null

  private readonly listeners = new Map<string, Set<EventListener>>()
  private readonly onSend: (data: string) => void

  constructor(onSend: (data: string) => void) {
    this.onSend = onSend
  }

  send(data: string | ArrayBuffer | Uint8Array) {
    if (this.readyState !== WebSocket.OPEN) return
    if (typeof data === 'string') {
      this.onSend(data)
      return
    }
    const buffer = data instanceof Uint8Array ? data : new Uint8Array(data)
    this.onSend(decoder.decode(buffer))
  }

  close() {
    if (this.readyState === WebSocket.CLOSED) return
    this.readyState = WebSocket.CLOSED
    this.dispatch('close', new Event('close'))
  }

  addEventListener(type: string, handler: EventListener) {
    const list = this.listeners.get(type) ?? new Set()
    list.add(handler)
    this.listeners.set(type, list)
  }

  removeEventListener(type: string, handler: EventListener) {
    const list = this.listeners.get(type)
    if (!list) return
    list.delete(handler)
    if (list.size === 0) {
      this.listeners.delete(type)
    }
  }

  emitMessage(data: string | ArrayBuffer | Uint8Array) {
    if (this.readyState !== WebSocket.OPEN) return
    const messageEvent = new MessageEvent('message', { data })
    this.onmessage?.(messageEvent)
    this.dispatch('message', messageEvent)
  }

  emitError() {
    const errorEvent = new Event('error')
    this.onerror?.(errorEvent)
    this.dispatch('error', errorEvent)
  }

  private dispatch(type: string, event: Event) {
    const list = this.listeners.get(type)
    if (!list) return
    list.forEach((handler) => handler.call(this, event))
  }
}
