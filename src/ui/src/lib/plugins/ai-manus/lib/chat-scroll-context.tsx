'use client'

import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'

export type ChatScrollState = {
  isNearBottom: boolean
}

const ChatScrollContext = createContext<ChatScrollState | null>(null)

export function ChatScrollProvider({
  value,
  children,
}: {
  value: ChatScrollState
  children: ReactNode
}) {
  return <ChatScrollContext.Provider value={value}>{children}</ChatScrollContext.Provider>
}

export function useChatScrollState() {
  return useContext(ChatScrollContext)
}
