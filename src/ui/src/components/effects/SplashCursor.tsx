'use client'

import { useEffect, useRef, useState } from 'react'

type TrailPoint = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  size: number
}

const COOL_COLOR = [159, 177, 194] as const
const WARM_COLOR = [199, 173, 150] as const

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const lerp = (from: number, to: number, value: number) => from + (to - from) * value

const mixColor = (mix: number) => {
  const t = clamp(mix, 0, 1)
  return [
    Math.round(lerp(COOL_COLOR[0], WARM_COLOR[0], t)),
    Math.round(lerp(COOL_COLOR[1], WARM_COLOR[1], t)),
    Math.round(lerp(COOL_COLOR[2], WARM_COLOR[2], t)),
  ] as const
}

const colorString = (mix: number, alpha: number) => {
  const [r, g, b] = mixColor(mix)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function SplashCursor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const trailRef = useRef<TrailPoint[]>([])
  const lastTrailRef = useRef(0)
  const lastMoveRef = useRef(0)
  const cursorRef = useRef({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    initialized: false,
  })
  const previousRef = useRef({ x: 0, y: 0 })
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 })
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)')

    const computeEnabled = () =>
      !(prefersReducedMotion.matches || coarsePointer.matches || navigator.maxTouchPoints > 0)

    setEnabled(computeEnabled())

    const handleChange = () => {
      setEnabled(computeEnabled())
    }

    prefersReducedMotion.addEventListener('change', handleChange)
    coarsePointer.addEventListener('change', handleChange)

    return () => {
      prefersReducedMotion.removeEventListener('change', handleChange)
      coarsePointer.removeEventListener('change', handleChange)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return undefined

    const canvas = canvasRef.current
    if (!canvas) return undefined

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return undefined

    const resize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      sizeRef.current = { width, height, dpr }
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()

    const cursor = cursorRef.current
    const previous = previousRef.current

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== 'mouse') return
      cursor.targetX = event.clientX
      cursor.targetY = event.clientY
      lastMoveRef.current = performance.now()
      cursor.initialized = true
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerdown', handlePointerMove, { passive: true })
    window.addEventListener('resize', resize)

    let lastTime = performance.now()

    const animate = (time: number) => {
      const delta = Math.min(64, time - lastTime)
      lastTime = time
      const deltaScale = delta / 16

      const { width, height } = sizeRef.current
      ctx.clearRect(0, 0, width, height)

      if (cursor.initialized) {
        cursor.x += (cursor.targetX - cursor.x) * 0.2
        cursor.y += (cursor.targetY - cursor.y) * 0.2
      }

      const dx = cursor.x - previous.x
      const dy = cursor.y - previous.y
      previous.x = cursor.x
      previous.y = cursor.y

      const speed = Math.min(42, Math.hypot(dx, dy) * (1000 / Math.max(16, delta)))
      const isActive = time - lastMoveRef.current < 140

      if (isActive) {
        const trail = trailRef.current
        const last = trail[trail.length - 1]
        const distance = last ? Math.hypot(cursor.x - last.x, cursor.y - last.y) : Infinity

        if (time - lastTrailRef.current > 14 || distance > 4) {
          lastTrailRef.current = time
          trail.push({
            x: cursor.x,
            y: cursor.y,
            vx: dx * 0.35,
            vy: dy * 0.35,
            life: 1,
            size: clamp(10 + speed * 0.18, 8, 22),
          })
          if (trail.length > 40) {
            trail.shift()
          }
        }
      }

      const trail = trailRef.current
      for (let i = trail.length - 1; i >= 0; i -= 1) {
        const point = trail[i]
        point.life -= 0.03 * deltaScale
        point.x += point.vx * deltaScale
        point.y += point.vy * deltaScale
        point.vx *= 0.92
        point.vy *= 0.92

        if (point.life <= 0) {
          trail.splice(i, 1)
        }
      }

      if (trail.length > 1) {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        const drawRibbon = (widthScale: number, alphaScale: number) => {
          for (let i = 0; i < trail.length - 1; i += 1) {
            const t = i / (trail.length - 1)
            const start = trail[i]
            const end = trail[i + 1]
            const life = Math.min(start.life, end.life)
            const alpha = alphaScale * (1 - t) * life
            if (alpha <= 0.002) continue

            const width = (start.size * (1 - t) + 2) * widthScale
            const mix = 0.2 + t * 0.6

            ctx.strokeStyle = colorString(mix, alpha)
            ctx.lineWidth = width
            ctx.beginPath()
            ctx.moveTo(start.x, start.y)
            ctx.lineTo(end.x, end.y)
            ctx.stroke()
          }
        }

        drawRibbon(1.6, 0.08)
        drawRibbon(0.9, 0.18)

        const head = trail[trail.length - 1]
        if (head) {
          const glow = ctx.createRadialGradient(
            head.x,
            head.y,
            0,
            head.x,
            head.y,
            head.size * 2.6
          )
          glow.addColorStop(0, colorString(0.45, 0.32 * head.life))
          glow.addColorStop(1, colorString(0.45, 0))
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(head.x, head.y, head.size * 2.6, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      rafRef.current = null
      trailRef.current = []

      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerdown', handlePointerMove)
      window.removeEventListener('resize', resize)
    }
  }, [enabled])

  if (!enabled) return null

  return <canvas ref={canvasRef} className="auth-splash-cursor" aria-hidden="true" />
}
