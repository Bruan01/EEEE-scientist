'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

export type LabAnimationLevel = 'off' | 'simple' | 'full'

const STORAGE_KEY = 'lab-animation-level'

export function useLabAnimationLevel() {
  const prefersReducedMotion = useReducedMotion()
  const [level, setLevel] = useState<LabAnimationLevel>('full')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(STORAGE_KEY) as LabAnimationLevel | null
    if (stored) {
      setLevel(stored)
      return
    }
    if (prefersReducedMotion) {
      setLevel('off')
      return
    }
    const lowEnd = typeof navigator !== 'undefined' && navigator.hardwareConcurrency <= 4
    setLevel(lowEnd ? 'simple' : 'full')
  }, [prefersReducedMotion])

  const update = (next: LabAnimationLevel) => {
    setLevel(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next)
    }
  }

  return { level, setLevel: update }
}
