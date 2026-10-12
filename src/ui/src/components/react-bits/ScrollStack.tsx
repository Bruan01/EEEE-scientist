'use client'

import { useLayoutEffect, useRef, useCallback, useEffect, type ReactNode } from 'react'
import './ScrollStack.css'

export const ScrollStackItem = ({
  children,
  itemClassName = '',
}: {
  children: ReactNode
  itemClassName?: string
}) => <div className={`scroll-stack-card ${itemClassName}`.trim()}>{children}</div>

type ScrollStackProps = {
  children: ReactNode
  className?: string
  itemDistance?: number
  itemScale?: number
  itemStackDistance?: number
  stackPosition?: string
  scaleEndPosition?: string
  baseScale?: number
  scaleDuration?: number
  rotationAmount?: number
  blurAmount?: number
  useWindowScroll?: boolean
  onStackComplete?: () => void
  progress?: number
  mode?: 'scroll' | 'sequence'
  sequenceTimings?: { enter: number; hold: number; exit: number }
  sequenceDistance?: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const ScrollStack = ({
  children,
  className = '',
  itemDistance = 100,
  itemScale = 0.03,
  itemStackDistance = 30,
  stackPosition = '20%',
  scaleEndPosition = '10%',
  baseScale = 0.85,
  scaleDuration = 0.5,
  rotationAmount = 0,
  blurAmount = 0,
  useWindowScroll = false,
  onStackComplete,
  progress,
  mode = 'scroll',
  sequenceTimings,
  sequenceDistance = 52,
}: ScrollStackProps) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const stackCompletedRef = useRef(false)
  const cardsRef = useRef<HTMLElement[]>([])
  const lastTransformsRef = useRef(
    new Map<number, { translateY: number; scale: number; rotation: number; blur: number; opacity: number }>()
  )
  const isUpdatingRef = useRef(false)

  const calculateProgress = useCallback((scrollTop: number, start: number, end: number) => {
    if (scrollTop < start) return 0
    if (scrollTop > end) return 1
    return (scrollTop - start) / (end - start)
  }, [])

  const parsePercentage = useCallback((value: string, containerHeight: number) => {
    if (typeof value === 'string' && value.includes('%')) {
      return (parseFloat(value) / 100) * containerHeight
    }
    return parseFloat(value)
  }, [])

  const getScrollData = useCallback(() => {
    if (useWindowScroll) {
      const containerHeight = window.innerHeight
      let scrollTop = window.scrollY
      if (typeof progress === 'number') {
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - containerHeight)
        scrollTop = (clamp(progress, 0, 100) / 100) * maxScroll
      }
      return {
        scrollTop,
        containerHeight,
        scrollContainer: document.documentElement,
      }
    }

    const scroller = scrollerRef.current
    const containerHeight = scroller?.clientHeight ?? 0
    let scrollTop = scroller?.scrollTop ?? 0
    if (typeof progress === 'number') {
      const scrollHeight = scroller?.scrollHeight ?? containerHeight
      const maxScroll = Math.max(0, scrollHeight - containerHeight)
      scrollTop = (clamp(progress, 0, 100) / 100) * maxScroll
    }
    return {
      scrollTop,
      containerHeight,
      scrollContainer: scroller,
    }
  }, [useWindowScroll, progress])

  const getElementOffset = useCallback(
    (element: HTMLElement) => {
      if (useWindowScroll) {
        const rect = element.getBoundingClientRect()
        return rect.top + window.scrollY
      }
      return element.offsetTop
    },
    [useWindowScroll]
  )

  const updateCardTransforms = useCallback(() => {
    if (!cardsRef.current.length || isUpdatingRef.current) return

    isUpdatingRef.current = true

    if (mode === 'sequence') {
      const totalCards = cardsRef.current.length
      const normalizedProgress = clamp(progress ?? 0, 0, 100) / 100
      const segmentSize = totalCards > 0 ? 1 / totalCards : 1
      const timings = sequenceTimings || { enter: 0.28, hold: 0.44, exit: 0.28 }
      const timingTotal = timings.enter + timings.hold + timings.exit || 1
      const enterRatio = timings.enter / timingTotal
      const holdRatio = timings.hold / timingTotal
      const exitRatio = timings.exit / timingTotal

      cardsRef.current.forEach((card, i) => {
        if (!card) return

        const segmentStart = segmentSize * i
        const segmentEnd = segmentStart + segmentSize
        const local = (normalizedProgress - segmentStart) / segmentSize

        let opacity = 0
        let translateY = 0
        let scale = 0.98
        let blur = 0
        let rotation = 0
        let zIndex = 1

        if (local >= 0 && local <= 1) {
          zIndex = 3
          if (local <= enterRatio) {
            const t = enterRatio > 0 ? local / enterRatio : 1
            opacity = t
            translateY = (1 - t) * sequenceDistance
            scale = 0.96 + 0.04 * t
          } else if (local <= enterRatio + holdRatio) {
            opacity = 1
            translateY = 0
            scale = 1
          } else {
            const t = exitRatio > 0 ? (local - enterRatio - holdRatio) / exitRatio : 1
            opacity = Math.max(0, 1 - t)
            translateY = -t * sequenceDistance
            scale = 1 - 0.02 * t
          }
        } else if (local < 0) {
          translateY = sequenceDistance
        } else {
          translateY = -sequenceDistance
        }

        const newTransform = {
          translateY: Math.round(translateY * 100) / 100,
          scale: Math.round(scale * 1000) / 1000,
          rotation,
          blur,
          opacity: Math.round(opacity * 1000) / 1000,
        }

        const lastTransform = lastTransformsRef.current.get(i)
        const hasChanged =
          !lastTransform ||
          Math.abs(lastTransform.translateY - newTransform.translateY) > 0.1 ||
          Math.abs(lastTransform.scale - newTransform.scale) > 0.001 ||
          Math.abs(lastTransform.opacity - newTransform.opacity) > 0.001

        if (hasChanged) {
          const transform = `translate3d(-50%, -50%, 0) translate3d(0, ${newTransform.translateY}px, 0) scale(${newTransform.scale})`
          const filter = newTransform.blur > 0 ? `blur(${newTransform.blur}px)` : ''

          card.style.transform = transform
          card.style.opacity = String(newTransform.opacity)
          card.style.filter = filter
          card.style.zIndex = String(zIndex)
          card.style.pointerEvents = newTransform.opacity > 0.9 ? 'auto' : 'none'

          lastTransformsRef.current.set(i, newTransform)
        }
      })

      isUpdatingRef.current = false
      return
    }

    const { scrollTop, containerHeight } = getScrollData()
    const stackPositionPx = parsePercentage(stackPosition, containerHeight)
    const scaleEndPositionPx = parsePercentage(scaleEndPosition, containerHeight)

    const endElement = useWindowScroll
      ? document.querySelector<HTMLElement>('.scroll-stack-end')
      : scrollerRef.current?.querySelector<HTMLElement>('.scroll-stack-end')

    const endElementTop = endElement ? getElementOffset(endElement) : 0

    cardsRef.current.forEach((card, i) => {
      if (!card) return

      const cardTop = getElementOffset(card)
      const triggerStart = cardTop - stackPositionPx - itemStackDistance * i
      const triggerEnd = cardTop - scaleEndPositionPx
      const pinStart = cardTop - stackPositionPx - itemStackDistance * i
      const pinEnd = endElementTop - containerHeight / 2

      const scaleProgress = calculateProgress(scrollTop, triggerStart, triggerEnd)
      const targetScale = baseScale + i * itemScale
      const scale = 1 - scaleProgress * (1 - targetScale)
      const rotation = rotationAmount ? i * rotationAmount * scaleProgress : 0

      let blur = 0
      if (blurAmount) {
        let topCardIndex = 0
        for (let j = 0; j < cardsRef.current.length; j += 1) {
          const jCardTop = getElementOffset(cardsRef.current[j])
          const jTriggerStart = jCardTop - stackPositionPx - itemStackDistance * j
          if (scrollTop >= jTriggerStart) {
            topCardIndex = j
          }
        }

        if (i < topCardIndex) {
          const depthInStack = topCardIndex - i
          blur = Math.max(0, depthInStack * blurAmount)
        }
      }

      let translateY = 0
      const isPinned = scrollTop >= pinStart && scrollTop <= pinEnd

      if (isPinned) {
        translateY = scrollTop - cardTop + stackPositionPx + itemStackDistance * i
      } else if (scrollTop > pinEnd) {
        translateY = pinEnd - cardTop + stackPositionPx + itemStackDistance * i
      }

      const newTransform = {
        translateY: Math.round(translateY * 100) / 100,
        scale: Math.round(scale * 1000) / 1000,
        rotation: Math.round(rotation * 100) / 100,
        blur: Math.round(blur * 100) / 100,
        opacity: 1,
      }

      const lastTransform = lastTransformsRef.current.get(i)
      const hasChanged =
        !lastTransform ||
        Math.abs(lastTransform.translateY - newTransform.translateY) > 0.1 ||
        Math.abs(lastTransform.scale - newTransform.scale) > 0.001 ||
        Math.abs(lastTransform.rotation - newTransform.rotation) > 0.1 ||
        Math.abs(lastTransform.blur - newTransform.blur) > 0.1

      if (hasChanged) {
        const transform = `translate3d(0, ${newTransform.translateY}px, 0) scale(${newTransform.scale}) rotate(${newTransform.rotation}deg)`
        const filter = newTransform.blur > 0 ? `blur(${newTransform.blur}px)` : ''

        card.style.transform = transform
        card.style.filter = filter
        card.style.opacity = '1'
        card.style.pointerEvents = 'auto'

        lastTransformsRef.current.set(i, newTransform)
      }

      if (i === cardsRef.current.length - 1) {
        const isInView = scrollTop >= pinStart && scrollTop <= pinEnd
        if (isInView && !stackCompletedRef.current) {
          stackCompletedRef.current = true
          onStackComplete?.()
        } else if (!isInView && stackCompletedRef.current) {
          stackCompletedRef.current = false
        }
      }
    })

    isUpdatingRef.current = false
  }, [
    itemScale,
    itemStackDistance,
    stackPosition,
    scaleEndPosition,
    baseScale,
    rotationAmount,
    blurAmount,
    useWindowScroll,
    onStackComplete,
    calculateProgress,
    parsePercentage,
    getScrollData,
    getElementOffset,
  ])

  const handleScroll = useCallback(() => {
    updateCardTransforms()
  }, [updateCardTransforms])

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const cards = Array.from(
      useWindowScroll
        ? document.querySelectorAll<HTMLElement>('.scroll-stack-card')
        : scroller.querySelectorAll<HTMLElement>('.scroll-stack-card')
    )

    cardsRef.current = cards
    const transformsCache = lastTransformsRef.current

    cards.forEach((card, i) => {
      if (mode === 'sequence') {
        card.style.marginBottom = '0'
        card.style.transition = 'none'
      } else if (i < cards.length - 1) {
        card.style.marginBottom = `${itemDistance}px`
        card.style.transition = `transform ${scaleDuration}s ease, filter ${scaleDuration}s ease`
      } else {
        card.style.transition = `transform ${scaleDuration}s ease, filter ${scaleDuration}s ease`
      }
      card.style.willChange = 'transform, filter, opacity'
      card.style.transformOrigin = 'top center'
      card.style.backfaceVisibility = 'hidden'
      card.style.transform = 'translateZ(0)'
      card.style.webkitTransform = 'translateZ(0)'
      card.style.perspective = '1000px'
      card.style.webkitPerspective = '1000px'
    })

    updateCardTransforms()

    const scrollTarget = useWindowScroll ? window : scroller

    if (typeof progress !== 'number' && mode === 'scroll') {
      scrollTarget.addEventListener('scroll', handleScroll, { passive: true })
    }

    return () => {
      if (typeof progress !== 'number' && mode === 'scroll') {
        scrollTarget.removeEventListener('scroll', handleScroll)
      }
      stackCompletedRef.current = false
      cardsRef.current = []
      transformsCache.clear()
      isUpdatingRef.current = false
    }
  }, [
    itemDistance,
    itemScale,
    itemStackDistance,
    stackPosition,
    scaleEndPosition,
    baseScale,
    scaleDuration,
    rotationAmount,
    blurAmount,
    useWindowScroll,
    onStackComplete,
    updateCardTransforms,
    handleScroll,
    progress,
    mode,
    sequenceTimings,
    sequenceDistance,
  ])

  useEffect(() => {
    if (typeof progress !== 'number') return
    updateCardTransforms()
  }, [progress, updateCardTransforms])

  return (
    <div
      className={`scroll-stack-scroller ${mode === 'sequence' ? 'scroll-stack-sequence' : typeof progress === 'number' ? 'scroll-stack-progress' : ''} ${className}`.trim()}
      ref={scrollerRef}
    >
      <div className="scroll-stack-inner">
        {children}
        <div className="scroll-stack-end" />
      </div>
    </div>
  )
}

export default ScrollStack
