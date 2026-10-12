/**
 * useLLMStream Hook
 *
 * Provides LLM streaming chat functionality.
 * TODO: Implement actual streaming logic.
 */

import { useState, useCallback } from 'react'

export interface LLMMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  status?: 'pending' | 'streaming' | 'done' | 'error'
}

export interface UseLLMStreamOptions {
  projectId?: string
  sessionId?: string | null
}

export interface UseLLMStreamReturn {
  messages: LLMMessage[]
  sendMessage: (text: string) => Promise<void>
  stop: () => void
  isStreaming: boolean
  sessionId: string | null
  error: string | null
}

export function useLLMStream(options?: UseLLMStreamOptions): UseLLMStreamReturn {
  const [messages, setMessages] = useState<LLMMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [sessionId] = useState<string | null>(options?.sessionId ?? null)
  const [error] = useState<string | null>(null)

  const sendMessage = useCallback(async (text: string) => {
    // Add user message
    const userMessage: LLMMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      status: 'done',
    }
    setMessages((prev) => [...prev, userMessage])

    // TODO: Implement actual LLM streaming
    // For now, just add a placeholder response
    setIsStreaming(true)
    const assistantMessage: LLMMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: 'LLM streaming is not yet implemented.',
      status: 'done',
    }
    setMessages((prev) => [...prev, assistantMessage])
    setIsStreaming(false)
  }, [])

  const stop = useCallback(() => {
    setIsStreaming(false)
  }, [])

  return {
    messages,
    sendMessage,
    stop,
    isStreaming,
    sessionId,
    error,
  }
}
