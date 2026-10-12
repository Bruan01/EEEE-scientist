'use client'

import { Children, isValidElement, type ReactElement, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type StepProps = {
  title?: string
  description?: string
  children: ReactNode
}

export function Step({ children }: StepProps) {
  return <>{children}</>
}

type StepperProps = {
  initialStep?: number
  onStepChange?: (step: number) => void
  onFinalStepCompleted?: () => void
  backButtonText?: string
  nextButtonText?: string | ((step: number, totalSteps: number) => string)
  nextDisabled?: boolean | ((step: number, totalSteps: number) => boolean)
  backDisabled?: boolean | ((step: number, totalSteps: number) => boolean)
  contentAnimation?: boolean
  className?: string
  children: ReactNode
}

const clampStep = (step: number, totalSteps: number) => {
  if (totalSteps <= 0) return 1
  return Math.min(Math.max(step, 1), totalSteps)
}

export default function Stepper({
  initialStep = 1,
  onStepChange,
  onFinalStepCompleted,
  backButtonText = 'Previous',
  nextButtonText = 'Next',
  nextDisabled,
  backDisabled,
  contentAnimation = false,
  className,
  children,
}: StepperProps) {
  const steps = useMemo(
    () =>
      Children.toArray(children).filter((child) => isValidElement(child)) as ReactElement<StepProps>[],
    [children]
  )
  const totalSteps = steps.length
  const [currentStep, setCurrentStep] = useState(() => clampStep(initialStep, totalSteps))
  const previousStepRef = useRef(currentStep)

  useEffect(() => {
    setCurrentStep(clampStep(initialStep, totalSteps))
  }, [initialStep, totalSteps])

  useEffect(() => {
    onStepChange?.(currentStep)
  }, [currentStep, onStepChange])

  useEffect(() => {
    previousStepRef.current = currentStep
  }, [currentStep])

  const resolveDisabled = (
    value: StepperProps['nextDisabled'],
    step: number,
    total: number
  ) => {
    if (typeof value === 'function') return value(step, total)
    return Boolean(value)
  }

  const isFinalStep = currentStep >= totalSteps
  const isNextDisabled = resolveDisabled(nextDisabled, currentStep, totalSteps)
  const isBackDisabled = resolveDisabled(backDisabled, currentStep, totalSteps)
  const canGoBack = currentStep > 1 && !isBackDisabled
  const nextLabel =
    typeof nextButtonText === 'function' ? nextButtonText(currentStep, totalSteps) : nextButtonText

  const handleNext = () => {
    if (isFinalStep) {
      if (!isNextDisabled) {
        onFinalStepCompleted?.()
      }
      return
    }
    if (isNextDisabled) return
    setCurrentStep((prev) => clampStep(prev + 1, totalSteps))
  }

  const handleBack = () => {
    if (!canGoBack) return
    setCurrentStep((prev) => clampStep(prev - 1, totalSteps))
  }

  if (totalSteps === 0) {
    return null
  }

  const activeStep = steps[currentStep - 1]
  const activeTitle = activeStep?.props?.title ?? `Step ${currentStep}`
  const activeDescription = activeStep?.props?.description
  const stepDirection = currentStep >= previousStepRef.current ? 'forward' : 'back'

  return (
    <div className={cn('stepper-root flex flex-col gap-5', className)}>
      <div className="stepper-header flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {steps.map((step, index) => {
            const stepNumber = index + 1
            const isComplete = stepNumber < currentStep
            const isActive = stepNumber === currentStep
            const title = step.props.title ?? `Step ${stepNumber}`
            return (
              <div key={`${title}-${stepNumber}`} className="flex items-center gap-3">
                <div
                  className={cn(
                    'stepper-dot flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition',
                    isComplete &&
                      'border-transparent bg-[var(--cli-accent-olive)] text-[var(--cli-ink-0)]',
                    isActive &&
                      'border-[var(--cli-accent-olive)] bg-white/90 text-[var(--cli-ink-1)]',
                    !isComplete &&
                      !isActive &&
                      'border-white/60 bg-white/60 text-[var(--cli-muted-1)]'
                  )}
                  data-state={isComplete ? 'complete' : isActive ? 'active' : 'upcoming'}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : stepNumber}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wide text-[var(--cli-muted-1)]">
                    Step {stepNumber}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      isActive ? 'text-[var(--cli-ink-1)]' : 'text-[var(--cli-muted-1)]'
                    )}
                  >
                    {title}
                  </span>
                </div>
                {index < totalSteps - 1 ? (
                  <div className="h-px w-8 bg-white/60" aria-hidden="true" />
                ) : null}
              </div>
            )
          })}
        </div>
        <div className="rounded-full border border-white/50 bg-white/80 px-3 py-1 text-[10px] uppercase tracking-wide text-[var(--cli-muted-1)]">
          {currentStep} / {totalSteps}
        </div>
      </div>

      <div
        key={contentAnimation ? `step-${currentStep}` : 'step-static'}
        className="stepper-content rounded-xl border border-white/40 bg-white/80 p-4"
        data-step={currentStep}
        data-direction={stepDirection}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-[var(--cli-ink-1)]">{activeTitle}</div>
            {activeDescription ? (
              <div className="text-xs text-[var(--cli-muted-1)]">{activeDescription}</div>
            ) : null}
          </div>
          <span className="rounded-full border border-white/60 bg-white/70 px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--cli-muted-1)]">
            Step {currentStep}
          </span>
        </div>
        <div className="mt-4">{activeStep}</div>
      </div>

      <div className="stepper-actions flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={handleBack} disabled={!canGoBack}>
          {backButtonText}
        </Button>
        <Button onClick={handleNext} disabled={isNextDisabled}>
          {nextLabel}
        </Button>
      </div>
    </div>
  )
}
