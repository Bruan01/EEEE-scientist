'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import TextType from '@/components/TextType'

const THINKING_PHRASES = [
  'Thinking through the implications, I am mapping the assumptions, checking consistency, and choosing the most reliable path forward.',
  'Let me reason carefully, test the hypothesis against edge cases, and refine the explanation so every step feels justified.',
  'I am holding the full context in mind, linking earlier clues, and pruning any guesses that do not survive scrutiny.',
  'Give me a moment to synthesize the details, select the strongest rationale, and write it in clean, precise language.',
  'I am tracing the logic line by line, spotting ambiguities, and tightening the argument before presenting the final answer.',
  'Let me explore a few candidate solutions, compare their tradeoffs, and pick the one with the clearest justification.',
  'I am aligning the structure of the response, verifying each claim, and ensuring the reasoning reads smoothly from start to finish.',
  'Pausing to think, I am testing the framing, simplifying the complexity, and keeping the core insight in focus.',
  'I am evaluating the evidence, checking for contradictions, and selecting the explanation that best fits the observed constraints.',
  'Let me reason it out, identify the key causal links, and ensure the conclusion follows directly from the premises.',
  'Automating discovery: I am designing experiments, scheduling runs, and capturing results so the system can iterate and learn rapidly.',
  'I am setting up a hypothesis search loop, exploring parameter space, and logging outcomes for automated scientific insight.',
  'The agent is orchestrating data collection, cleaning measurements, and proposing the next experiment to maximize discovery yield.',
  'I am wiring the pipeline to test conjectures, run simulations, and promote the most promising models into the next iteration.',
  'Automated science mode: we generate hypotheses, verify with controlled trials, and archive everything for reproducible progress.',
  'I am coordinating a research agent to scan literature, propose tests, and validate findings through rapid experimental cycles.',
  'The system is assembling datasets, running ablations, and scoring theories to guide the next automated experiment.',
  'I am configuring the lab automation stack to explore chemical pathways, measure outcomes, and refine catalysts iteratively.',
  'We are prototyping a discovery engine that predicts novel structures, validates them, and prioritizes the most surprising results.',
  'I am building an autonomous research loop that plans experiments, executes them, and updates its model with every observation.',
]

const SPEED_MULTIPLIER = 1.5
const TYPE_DURATION_MS = Math.round(4500 / SPEED_MULTIPLIER)
const HOLD_DURATION_MS = Math.round(4000 / SPEED_MULTIPLIER)
const DELETE_DURATION_MS = Math.round(500 / SPEED_MULTIPLIER)

type Phase = 'reveal' | 'erase'

export function ThinkingIndicator({
  compact,
  active = true,
}: {
  compact?: boolean
  active?: boolean
}) {
  const isCompact = Boolean(compact)
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('reveal')
  const timersRef = useRef<number[]>([])

  const phrase = THINKING_PHRASES[phraseIndex % THINKING_PHRASES.length] ?? ''
  const revealSpeed = useMemo(() => {
    const length = Math.max(12, phrase.length)
    return Math.max(16, Math.floor(TYPE_DURATION_MS / length))
  }, [phrase.length])
  const revealDuration = useMemo(() => (phrase.length + 1) * revealSpeed, [phrase.length, revealSpeed])
  const deleteSpeed = useMemo(() => {
    const length = Math.max(12, phrase.length)
    return Math.max(10, Math.floor(DELETE_DURATION_MS / length))
  }, [phrase.length])
  const deleteDuration = useMemo(
    () => (phrase.length + 1) * deleteSpeed,
    [phrase.length, deleteSpeed]
  )

  useEffect(() => {
    const clearTimers = () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer))
      timersRef.current = []
    }

    clearTimers()
    if (!active) {
      setPhase('reveal')
      return clearTimers
    }

    setPhase('reveal')
    timersRef.current.push(
      window.setTimeout(() => {
        setPhase('erase')
      }, revealDuration + HOLD_DURATION_MS)
    )
    timersRef.current.push(
      window.setTimeout(() => {
        setPhraseIndex((prev) => (prev + 1) % THINKING_PHRASES.length)
      }, revealDuration + HOLD_DURATION_MS + deleteDuration + 60)
    )

    return clearTimers
  }, [active, deleteDuration, phraseIndex, revealDuration])

  return (
    <div
      className={
        isCompact
          ? 'ai-manus-thinking text-[10px] text-[var(--text-tertiary)]'
          : 'ai-manus-thinking text-[10px] text-[var(--text-tertiary)]'
      }
      role="status"
      aria-live="polite"
    >
      {phase === 'reveal' ? (
        <>
          <TextType
            key={`reveal-${phraseIndex}`}
            as="span"
            text={phrase}
            typingSpeed={revealSpeed}
            pauseDuration={0}
            loop={false}
            showCursor={false}
            className="ai-manus-thinking-text"
          />
          <span className="ai-manus-thinking-dots" aria-hidden="true">
            <span className="ai-manus-thinking-dot">.</span>
            <span className="ai-manus-thinking-dot">.</span>
            <span className="ai-manus-thinking-dot">.</span>
          </span>
        </>
      ) : (
        <TextType
          key={`erase-${phraseIndex}`}
          as="span"
          text={phrase}
          typingSpeed={1}
          deletingSpeed={deleteSpeed}
          pauseDuration={0}
          loop={false}
          showCursor={false}
          startWithFullText
          deleteOnly
          className="ai-manus-thinking-text"
        />
      )}
    </div>
  )
}

export default ThinkingIndicator
