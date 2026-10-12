import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { countTokensByTextLength, revealTokens, tokenizeElement } from '../lib/streaming/token-animator'

export type TokenStreamMode = 'assistant' | 'reasoning' | 'status' | 'code' | 'table'

type TokenStreamOptions = {
  ref: RefObject<HTMLElement | null>
  active: boolean
  contentKey: string
  mode?: TokenStreamMode
  reducedMotion?: boolean
  maxTokens?: number
  maxChars?: number
  onComplete?: () => void
}

type PerfState = {
  lastFrame: number
  slowFrames: number
  quality: number
}

const DEFAULT_MAX_TOKENS = 4000
const DEFAULT_MAX_CHARS = 2400
const RATE_WINDOW_MS = 500
const QUEUE_BOOST_THRESHOLD = 800
const RATE_SCALE = 0.5

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const computeInitialQuality = () => {
  if (typeof window === 'undefined') return 0
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const cores = navigator.hardwareConcurrency
  if ((memory && memory <= 4) || (cores && cores <= 4)) return 1
  return 0
}

const applyModeVars = (container: HTMLElement, mode: TokenStreamMode) => {
  container.dataset.tokenMode = mode
}

const applyQuality = (container: HTMLElement, quality: number) => {
  container.dataset.tokenQuality = String(quality)
}

export function useTokenStream({
  ref,
  active,
  contentKey,
  mode = 'assistant',
  reducedMotion,
  maxTokens = DEFAULT_MAX_TOKENS,
  maxChars = DEFAULT_MAX_CHARS,
  onComplete,
}: TokenStreamOptions) {
  const tokensRef = useRef<HTMLSpanElement[]>([])
  const visibleCountRef = useRef(0)
  const queueRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const carryRef = useRef(0)
  const prevTextRef = useRef('')
  const hasTokenizedRef = useRef(false)
  const perfRef = useRef<PerfState>({
    lastFrame: 0,
    slowFrames: 0,
    quality: computeInitialQuality(),
  })

  const rateSamplesRef = useRef<Array<{ time: number; tokens: number }>>([])
  const renderRateRef = useRef(60)

  const segmenter = useMemo(
    () =>
      new Intl.Segmenter(undefined, {
        granularity: 'grapheme',
      }),
    []
  )

  const stopRaf = () => {
    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  const pushRateSample = (tokens: number) => {
    const now = performance.now()
    rateSamplesRef.current.push({ time: now, tokens })
    const cutoff = now - RATE_WINDOW_MS
    while (rateSamplesRef.current.length > 0 && rateSamplesRef.current[0].time < cutoff) {
      rateSamplesRef.current.shift()
    }
    const total = rateSamplesRef.current.reduce((sum, item) => sum + item.tokens, 0)
    const windowSec = RATE_WINDOW_MS / 1000
    const deltaRate = total / windowSec
    const targetRate = clamp(deltaRate * 1.1, 20, 220)
    renderRateRef.current = targetRate
  }

  const revealNext = () => {
    const tokens = tokensRef.current
    if (tokens.length === 0) return
    if (!ref.current) return
    const now = performance.now()
    const perf = perfRef.current
    const last = perf.lastFrame || now
    const dt = Math.max(0, now - last) / 1000
    perf.lastFrame = now
    if (dt > 0.05) {
      perf.slowFrames += 1
    } else {
      perf.slowFrames = Math.max(0, perf.slowFrames - 1)
    }
    if (perf.slowFrames >= 3 && perf.quality < 3) {
      perf.quality += 1
      perf.slowFrames = 0
      applyQuality(ref.current, perf.quality)
    }

    if (perf.quality >= 3) {
      const end = revealTokens(tokens, 0, tokens.length)
      visibleCountRef.current = end
      queueRef.current = 0
      stopRaf()
      onComplete?.()
      return
    }

    let rate = renderRateRef.current
    if (queueRef.current > QUEUE_BOOST_THRESHOLD) {
      rate *= 1.5
    }
    rate *= RATE_SCALE
    let tokensThisFrame = rate * dt + carryRef.current
    let count = Math.floor(tokensThisFrame)
    carryRef.current = tokensThisFrame - count
    if (count <= 0) {
      rafRef.current = window.requestAnimationFrame(revealNext)
      return
    }

    const start = visibleCountRef.current
    const end = revealTokens(tokens, start, start + count)
    visibleCountRef.current = end
    queueRef.current = Math.max(0, tokens.length - end)
    if (queueRef.current === 0) {
      stopRaf()
      onComplete?.()
      return
    }
    rafRef.current = window.requestAnimationFrame(revealNext)
  }

  useLayoutEffect(() => {
    const container = ref.current
    if (!container) return

    if (reducedMotion) {
      perfRef.current.quality = 3
      applyQuality(container, 3)
    } else {
      applyQuality(container, perfRef.current.quality)
    }
    applyModeVars(container, mode)

    if (!active && !hasTokenizedRef.current) {
      prevTextRef.current = container.textContent ?? ''
      return
    }

    const textLength = container.textContent?.length ?? 0
    if (textLength > maxChars) {
      const tokens = tokensRef.current
      if (tokens.length > 0) {
        perfRef.current.quality = 3
        applyQuality(container, 3)
        revealTokens(tokens, 0, tokens.length, { instant: true })
        visibleCountRef.current = tokens.length
      }
      queueRef.current = 0
      stopRaf()
      prevTextRef.current = container.textContent ?? ''
      onComplete?.()
      return
    }

    const { tokens, text } = tokenizeElement(container, { segmenter })
    tokensRef.current = tokens
    hasTokenizedRef.current = true

    if (tokens.length > maxTokens) {
      perfRef.current.quality = 3
      applyQuality(container, 3)
      revealTokens(tokens, 0, tokens.length, { instant: true })
      visibleCountRef.current = tokens.length
      queueRef.current = 0
      stopRaf()
      onComplete?.()
      return
    }

    const prevText = prevTextRef.current
    const nextText = text
    let prefixLen = 0
    const limit = Math.min(prevText.length, nextText.length)
    while (prefixLen < limit && prevText[prefixLen] === nextText[prefixLen]) {
      prefixLen += 1
    }

    const prefixVisible = countTokensByTextLength(tokens, prefixLen)
    const previousVisible = visibleCountRef.current
    const visibleCount =
      previousVisible > 0 ? Math.min(prefixVisible, previousVisible) : prefixVisible
    revealTokens(tokens, 0, visibleCount, { instant: true })
    visibleCountRef.current = visibleCount
    queueRef.current = Math.max(0, tokens.length - visibleCount)

    if (queueRef.current > 0) {
      pushRateSample(queueRef.current)
    }

    prevTextRef.current = nextText
    carryRef.current = 0

    if (active && queueRef.current === 0) {
      stopRaf()
      onComplete?.()
      return
    }

    if (active && perfRef.current.quality < 3 && queueRef.current > 0) {
      stopRaf()
      rafRef.current = window.requestAnimationFrame(revealNext)
    } else if (!active) {
      revealTokens(tokens, visibleCount, tokens.length, { instant: true })
      visibleCountRef.current = tokens.length
      queueRef.current = 0
      stopRaf()
      onComplete?.()
    }
  }, [active, contentKey, maxChars, maxTokens, mode, reducedMotion, ref, segmenter, onComplete])

  useEffect(() => {
    return () => {
      stopRaf()
    }
  }, [])
}
