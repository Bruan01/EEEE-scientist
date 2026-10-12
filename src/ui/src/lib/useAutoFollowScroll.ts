'use client'

import * as React from 'react'

type UseAutoFollowScrollOptions = {
  scrollRef: React.RefObject<HTMLElement | null>
  contentRef?: React.RefObject<HTMLElement | null>
  deps?: React.DependencyList
  minBottomThreshold?: number
}

function bottomThreshold(node: HTMLElement, minBottomThreshold: number) {
  return Math.max(minBottomThreshold, node.clientHeight * 0.1)
}

export function useAutoFollowScroll({
  scrollRef,
  contentRef,
  deps = [],
  minBottomThreshold = 96,
}: UseAutoFollowScrollOptions) {
  const [isNearBottom, setIsNearBottom] = React.useState(true)
  const isNearBottomRef = React.useRef(true)
  const initializedRef = React.useRef(false)
  const rafRef = React.useRef<number | null>(null)

  const syncNearBottom = React.useCallback(() => {
    const node = scrollRef.current
    if (!node) return
    const nextIsNearBottom =
      node.scrollHeight - node.scrollTop - node.clientHeight <=
      bottomThreshold(node, minBottomThreshold)
    isNearBottomRef.current = nextIsNearBottom
    setIsNearBottom((current) =>
      current === nextIsNearBottom ? current : nextIsNearBottom
    )
  }, [minBottomThreshold, scrollRef])

  const scrollToBottom = React.useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      const node = scrollRef.current
      if (!node) return
      node.scrollTo({ top: node.scrollHeight, behavior })
      isNearBottomRef.current = true
      setIsNearBottom(true)
    },
    [scrollRef]
  )

  const scheduleFollow = React.useCallback(() => {
    if (typeof window === 'undefined') return
    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current)
    }
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      if (isNearBottomRef.current) {
        scrollToBottom('auto')
      } else {
        syncNearBottom()
      }
    })
  }, [scrollToBottom, syncNearBottom])

  React.useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const handleScroll = () => {
      syncNearBottom()
    }
    syncNearBottom()
    node.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      node.removeEventListener('scroll', handleScroll)
    }
  }, [scrollRef, syncNearBottom])

  React.useLayoutEffect(() => {
    const node = scrollRef.current
    if (!node) return
    if (!initializedRef.current) {
      initializedRef.current = true
      scrollToBottom('auto')
      return
    }
    if (isNearBottomRef.current) {
      scrollToBottom('auto')
    } else {
      syncNearBottom()
    }
  }, [scrollRef, scrollToBottom, syncNearBottom, ...deps])

  React.useEffect(() => {
    const node = scrollRef.current
    const observedNode = contentRef?.current ?? node
    if (!node || !observedNode || typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(() => {
      scheduleFollow()
    })
    observer.observe(observedNode)
    if (observedNode !== node) {
      observer.observe(node)
    }
    return () => {
      observer.disconnect()
    }
  }, [contentRef, scheduleFollow, scrollRef])

  React.useEffect(() => {
    return () => {
      if (rafRef.current != null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  return {
    isNearBottom,
    scrollToBottom,
  }
}

export default useAutoFollowScroll
