'use client'

import { useEffect, useMemo, useState } from 'react'
import { listPremiumMessages, dismissPremiumMessage, markPremiumMessageRead } from '@/lib/api/messages'
import { getFileContent } from '@/lib/api/files'
import type { PremiumMessage, PremiumTargetScope } from '@/lib/types/messages'
import { PremiumMessageDialog } from '@/components/messages/PremiumMessageDialog'
import { usePremiumMessagesStore } from '@/lib/stores/premium-messages'

export function PremiumMessageHost({
  scope,
  projectId,
  enabled = true,
}: {
  scope: PremiumTargetScope
  projectId?: string
  enabled?: boolean
}) {
  const [messages, setMessages] = useState<PremiumMessage[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const setStoreMessages = usePremiumMessagesStore((state) => state.setMessages)
  const markStoreRead = usePremiumMessagesStore((state) => state.markRead)
  const markStoreDontRemind = usePremiumMessagesStore((state) => state.markDontRemind)
  const clearStore = usePremiumMessagesStore((state) => state.clear)

  const active = useMemo(() => messages.find((m) => m.id === activeId) || null, [activeId, messages])
  const activeIndex = useMemo(
    () => (activeId ? messages.findIndex((m) => m.id === activeId) : -1),
    [activeId, messages]
  )
  const hasNext = messages.length > 1 && activeIndex >= 0 && activeIndex < messages.length - 1
  const isMulti = messages.length > 1

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setMessages([])
    setActiveId(null)
    setOpen(false)
    clearStore()

    listPremiumMessages({ scope, project_id: projectId })
      .then((res) => {
        if (cancelled) return
        const items = res?.items || []
        if (items.length === 0) {
          clearStore()
          return
        }
        setStoreMessages({ scope, projectId: projectId || null, items })
        const popupItems = items.filter((item) => !item.state?.dont_remind)
        if (popupItems.length === 0) {
          setMessages([])
          setActiveId(null)
          setOpen(false)
          return
        }
        const firstUnread = popupItems.find((item) => !item.state?.read_at) || popupItems[0]
        setMessages(popupItems)
        setActiveId(firstUnread?.id || null)
        setOpen(true)
      })
      .catch(() => {
        // best-effort: ignore if user is not authorized yet
      })

    return () => {
      cancelled = true
    }
  }, [clearStore, enabled, projectId, scope, setStoreMessages])

  useEffect(() => {
    if (!active) return
    if (!open) return
    let cancelled = false

    const markRead = async () => {
      if (active.state?.read_at) return
      try {
        const res = await markPremiumMessageRead(active.id)
        const readAt = res?.read_at || new Date().toISOString()
        if (cancelled) return
        setMessages((prev) =>
          prev.map((item) =>
            item.id === active.id && !item.state.read_at
              ? { ...item, state: { ...item.state, read_at: readAt } }
              : item
          )
        )
        markStoreRead(active.id, readAt)
      } catch {
        // best-effort
      }
    }

    const load = async () => {
      setLoading(true)
      try {
        await markRead()
        if (active.content_markdown) {
          setContent(active.content_markdown)
          return
        }
        if (active.content_file_id) {
          const text = await getFileContent(active.content_file_id)
          if (cancelled) return
          setContent(text)
          return
        }
        setContent(active.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [active, markStoreRead, open])

  const handleNext = () => {
    if (!hasNext) return
    const next = messages[activeIndex + 1]
    if (!next) return
    setActiveId(next.id)
    setOpen(true)
  }

  const handleClose = async () => {
    if (!active) return
    try {
      await dismissPremiumMessage(active.id, { dont_remind: false })
    } catch {
      // best-effort
    }
    setOpen(false)
  }

  const handleDontRemind = async () => {
    if (messages.length === 0) return

    if (isMulti) {
      const results = await Promise.all(
        messages.map(async (message) => {
          try {
            await dismissPremiumMessage(message.id, { dont_remind: true })
            return true
          } catch {
            return false
          }
        })
      )
      const allSuccess = results.every((item) => item)
      if (!allSuccess) {
        return
      }
      markStoreDontRemind(messages.map((message) => message.id))
      setMessages([])
      setActiveId(null)
      setOpen(false)
      return
    }

    if (active) {
      try {
        await dismissPremiumMessage(active.id, { dont_remind: true })
      } catch {
        return
      }
      markStoreDontRemind([active.id])
    }
    setMessages([])
    setActiveId(null)
    setOpen(false)
  }

  if (!active) return null

  return (
    <PremiumMessageDialog
      open={open}
      onClose={handleClose}
      onDontRemind={handleDontRemind}
      onNext={handleNext}
      hasNext={hasNext}
      step={activeIndex >= 0 ? activeIndex + 1 : 1}
      total={messages.length}
      title={active.title || active.message}
      imageUrl={active.image_url || undefined}
      level={active.level}
      content={content}
      loading={loading}
    />
  )
}
