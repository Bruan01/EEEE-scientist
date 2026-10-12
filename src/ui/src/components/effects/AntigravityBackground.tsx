'use client'

import { useEffect, useRef, useState } from 'react'

type AntigravityBackgroundProps = {
  particleCount?: number
  speed?: number
  disturbance?: number
  trailStrength?: number
  particleSize?: number
  fieldStrength?: number
  className?: string
}

type RenderQuality = 'off' | 'low' | 'full'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  mix: number
  alpha: number
  drift: number
  spin: number
  phase: number
  wobble: number
}

type GravityCore = {
  x: number
  y: number
  strength: number
  spin: number
}

const COOL_COLOR = [159, 177, 194] as const
const WARM_COLOR = [199, 173, 150] as const
const BACKDROP_TONE = '245, 242, 236'

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

export default function AntigravityBackground({
  particleCount = 120,
  speed = 0.75,
  disturbance = 0.9,
  trailStrength = 0.12,
  particleSize = 1,
  fieldStrength = 1,
  className,
}: AntigravityBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const resizeRafRef = useRef<number | null>(null)
  const pointerRafRef = useRef<number | null>(null)
  const pointerRef = useRef({ x: 0, y: 0, active: false })
  const pendingPointerRef = useRef({ x: 0, y: 0, hasUpdate: false })
  const [quality, setQuality] = useState<RenderQuality>('off')

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)')

    const computeQuality = () => {
      if (prefersReducedMotion.matches) return 'off'
      if (coarsePointer.matches || navigator.maxTouchPoints > 0) return 'low'
      return 'full'
    }

    const updateQuality = () => {
      const next = computeQuality()
      setQuality((prev) => (prev === next ? prev : next))
    }

    updateQuality()

    prefersReducedMotion.addEventListener('change', updateQuality)
    coarsePointer.addEventListener('change', updateQuality)

    return () => {
      prefersReducedMotion.removeEventListener('change', updateQuality)
      coarsePointer.removeEventListener('change', updateQuality)
    }
  }, [])

  useEffect(() => {
    if (quality === 'off') return undefined

    const canvas = canvasRef.current
    if (!canvas) return undefined

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return undefined

    const isLow = quality === 'low'
    const speedFactor = clamp(speed, 0.2, 2) * (isLow ? 0.6 : 1)
    const disturbanceFactor = clamp(disturbance, 0, 2) * (isLow ? 0.5 : 1)
    const trailAlpha = clamp(trailStrength, 0, 0.26) * (isLow ? 0.6 : 1)
    const sizeFactor = clamp(particleSize, 0.6, 2)
    const strengthFactor = clamp(fieldStrength, 0.4, 3)
    const targetFps = isLow ? 24 : 60
    const frameInterval = 1000 / targetFps

    let width = 0
    let height = 0
    let dpr = 1
    let pointerRadius = 180
    let particles: Particle[] = []
    let cores: GravityCore[] = []
    let lastFrame = performance.now()
    let lastTime = performance.now()

    const createParticle = (): Particle => {
      const mix = Math.random()
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * speedFactor * 0.6,
        vy: (Math.random() - 0.5) * speedFactor * 0.6 - 0.3 * speedFactor,
        size: (1 + Math.random() * 2.6) * sizeFactor,
        mix,
        alpha: 0.25 + Math.random() * 0.35,
        drift: -0.01 - Math.random() * 0.02,
        spin: Math.random() > 0.5 ? 1 : -1,
        phase: Math.random() * Math.PI * 2,
        wobble: 0.2 + Math.random() * 0.6,
      }
    }

    const seedParticles = () => {
      const areaScale = clamp((width * height) / (1440 * 900), 0.6, 1.4)
      const count = Math.round(
        clamp(particleCount, 40, 220) * areaScale * (isLow ? 0.35 : 1)
      )
      particles = Array.from({ length: count }, createParticle)
    }

    const seedCores = () => {
      cores = [
        { x: width * 0.2, y: height * 0.3, strength: 0.8, spin: 1 },
        { x: width * 0.75, y: height * 0.65, strength: 0.7, spin: -1 },
        { x: width * 0.5, y: height * 0.95, strength: 0.6, spin: 1 },
      ]
    }

    const resizeCanvas = () => {
      width = window.innerWidth
      height = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, isLow ? 1.2 : 2)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      pointerRadius = clamp(width * 0.18, 140, 260)
      seedParticles()
      seedCores()
    }

    const scheduleResize = () => {
      if (resizeRafRef.current) return
      resizeRafRef.current = requestAnimationFrame(() => {
        resizeRafRef.current = null
        resizeCanvas()
      })
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== 'mouse') return
      const pending = pendingPointerRef.current
      pending.x = event.clientX
      pending.y = event.clientY
      pending.hasUpdate = true
      if (pointerRafRef.current) return
      pointerRafRef.current = requestAnimationFrame(() => {
        pointerRafRef.current = null
        if (!pending.hasUpdate) return
        const pointer = pointerRef.current
        pointer.x = pending.x
        pointer.y = pending.y
        pointer.active = true
        pending.hasUpdate = false
      })
    }

    const handlePointerLeave = () => {
      pointerRef.current.active = false
    }

    resizeCanvas()

    window.addEventListener('resize', scheduleResize)
    if (!isLow) {
      window.addEventListener('pointermove', handlePointerMove, { passive: true })
      window.addEventListener('pointerdown', handlePointerMove, { passive: true })
      window.addEventListener('pointerleave', handlePointerLeave)
    }

    const updateParticles = (delta: number) => {
      const step = delta / 16
      const friction = 0.985
      const fieldStrengthScaled = 0.9 * speedFactor * strengthFactor
      const swirlStrength = 1.1 * speedFactor * strengthFactor
      const pointerStrength = disturbanceFactor * 1.4 * strengthFactor
      const pointer = pointerRef.current

      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i]
        let ax = 0
        let ay = particle.drift * speedFactor

        for (let c = 0; c < cores.length; c += 1) {
          const core = cores[c]
          const dx = particle.x - core.x
          const dy = particle.y - core.y
          const dist = Math.hypot(dx, dy) + 0.001
          const force = (fieldStrengthScaled * core.strength) / (dist + 160)
          ax += (dx / dist) * force
          ay += (dy / dist) * force

          const swirl = (swirlStrength * core.spin) / (dist + 220)
          ax += (-dy / dist) * swirl
          ay += (dx / dist) * swirl
        }

        if (pointer.active) {
          const dx = particle.x - pointer.x
          const dy = particle.y - pointer.y
          const dist = Math.hypot(dx, dy) + 0.001
          if (dist < pointerRadius) {
            const force = (1 - dist / pointerRadius) * pointerStrength
            ax += (dx / dist) * force * 0.8
            ay += (dy / dist) * force * 0.8
          }
        }

        particle.phase += 0.01 * step
        particle.vx = (particle.vx + ax * step) * friction
        particle.vy = (particle.vy + ay * step) * friction
        particle.x += particle.vx * step + Math.cos(particle.phase) * particle.wobble
        particle.y += particle.vy * step + Math.sin(particle.phase) * particle.wobble * 0.5

        const margin = 80
        if (particle.x < -margin) particle.x = width + margin
        if (particle.x > width + margin) particle.x = -margin
        if (particle.y < -margin) {
          particle.y = height + margin
          particle.x = Math.random() * width
        }
        if (particle.y > height + margin) {
          particle.y = -margin
          particle.x = Math.random() * width
        }
      }
    }

    const drawParticles = () => {
      if (trailAlpha > 0) {
        ctx.fillStyle = `rgba(${BACKDROP_TONE}, ${trailAlpha})`
        ctx.fillRect(0, 0, width, height)
      } else {
        ctx.clearRect(0, 0, width, height)
      }

      ctx.save()
      ctx.globalCompositeOperation = 'lighter'

      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i]
        const [r, g, b] = mixColor(particle.mix)
        const glowRadius = particle.size * 5.2
        const gradient = ctx.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          glowRadius
        )
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${particle.alpha})`)
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, glowRadius, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()

      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i]
        const [r, g, b] = mixColor(particle.mix)
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${particle.alpha + 0.12})`
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const animate = (time: number) => {
      rafRef.current = requestAnimationFrame(animate)
      if (time - lastFrame < frameInterval) return
      const delta = Math.min(48, time - lastTime)
      lastTime = time
      lastFrame = time
      updateParticles(delta)
      drawParticles()
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current)
      if (pointerRafRef.current) cancelAnimationFrame(pointerRafRef.current)
      rafRef.current = null
      resizeRafRef.current = null
      pointerRafRef.current = null

      window.removeEventListener('resize', scheduleResize)
      if (!isLow) {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerdown', handlePointerMove)
        window.removeEventListener('pointerleave', handlePointerLeave)
      }
    }
  }, [quality, particleCount, speed, disturbance, trailStrength, particleSize, fieldStrength])

  if (quality === 'off') return null

  const canvasClassName = className ? `auth-antigravity ${className}` : 'auth-antigravity'

  return <canvas ref={canvasRef} className={canvasClassName} aria-hidden="true" />
}
