import * as React from 'react'
import { Check, Circle, FileSearch, Sparkles } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'

import { cn } from '@/lib/utils'

type PlanningStepsPulseProps = {
  locale: 'en' | 'zh'
  className?: string
  mode?: 'loop' | 'once'
  stepMs?: number
  activeIndex?: number | null
  settled?: boolean
}

const zhSteps = [
  { label: '理解任务', icon: Circle },
  { label: '整理信息', icon: FileSearch },
  { label: '生成规划', icon: Sparkles },
]

const enSteps = [
  { label: 'Understand', icon: Circle },
  { label: 'Organize', icon: FileSearch },
  { label: 'Plan', icon: Sparkles },
]

export function PlanningStepsPulse({
  locale,
  className,
  mode = 'loop',
  stepMs = 2500,
  activeIndex: activeIndexProp = null,
  settled = false,
}: PlanningStepsPulseProps) {
  const shouldReduceMotion = useReducedMotion()
  const steps = locale === 'zh' ? zhSteps : enSteps
  const [internalActiveIndex, setInternalActiveIndex] = React.useState(0)
  const controlledIndex = activeIndexProp == null ? null : Math.max(0, Math.min(activeIndexProp, steps.length - 1))
  const effectiveActiveIndex = controlledIndex ?? internalActiveIndex

  React.useEffect(() => {
    if (controlledIndex != null) return
    if (shouldReduceMotion) return
    if (mode === 'once') {
      setInternalActiveIndex(0)
      const timers = steps.slice(1).map((_, index) =>
        window.setTimeout(() => setInternalActiveIndex(index + 1), stepMs * (index + 1))
      )
      return () => timers.forEach((timer) => window.clearTimeout(timer))
    }
    const timer = window.setInterval(() => {
      setInternalActiveIndex((current) => (current + 1) % steps.length)
    }, 900)
    return () => window.clearInterval(timer)
  }, [controlledIndex, mode, shouldReduceMotion, stepMs, steps.length])

  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {steps.map((step, index) => {
        const Icon = step.icon
        const isActive = !settled && index === effectiveActiveIndex
        const isDone =
          !shouldReduceMotion &&
          (index < effectiveActiveIndex || (settled && index <= effectiveActiveIndex) || (mode === 'once' && effectiveActiveIndex === steps.length - 1 && index <= effectiveActiveIndex))
        return (
          <span
            key={step.label}
            className={cn(
              'inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-center text-[11px] transition-all duration-300 sm:px-3',
              isActive
                ? 'border-[rgba(45,42,38,0.18)] bg-white text-[rgba(45,42,38,0.92)] shadow-[0_10px_28px_-24px_rgba(45,42,38,0.5)]'
                : 'border-[rgba(45,42,38,0.08)] bg-[rgba(248,245,240,0.8)] text-[rgba(107,103,97,0.78)]'
            )}
          >
            <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
              {isDone ? (
                <Check className="h-3.5 w-3.5 stroke-[1.8]" />
              ) : isActive ? (
                <Sparkles className="h-3.5 w-3.5 animate-pulse stroke-[1.6]" />
              ) : (
                <Icon className="h-3.5 w-3.5 stroke-[1.5]" />
              )}
            </span>
            {step.label}
          </span>
        )
      })}
    </div>
  )
}

export default PlanningStepsPulse
