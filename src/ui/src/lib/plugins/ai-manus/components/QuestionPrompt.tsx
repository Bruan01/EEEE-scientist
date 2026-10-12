'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { QuestionPromptAnswerMap } from '../types'
import { renderMarkdown, renderMarkdownInline } from '../lib/markdown'
import {
  type ChoiceAnswerMap,
  type FreeTextAnswerMap,
  type FreeTextActiveMap,
  type NormalizedQuestion,
  type QuestionPromptArgs,
  buildRawDefaultAnswers,
  coerceAnswerState,
  formatAnsweredLabels,
  isAnswered,
  normalizeQuestions,
  serializeDraftAnswers,
} from '../lib/question-prompt-utils'

export function QuestionPrompt({
  toolCallId,
  args,
  status,
  answers,
  error,
  compact,
  submitLabel,
  submittingLabel,
  resolveWorkspaceFileLink,
  isWorkspaceFileLink,
  onFileLinkClick,
  onSubmit,
}: {
  toolCallId: string
  args: Record<string, unknown>
  status: 'calling' | 'called'
  answers?: QuestionPromptAnswerMap
  error?: string
  compact?: boolean
  submitLabel?: string
  submittingLabel?: string
  resolveWorkspaceFileLink?: (href: string) => boolean
  isWorkspaceFileLink?: (href: string) => boolean
  onFileLinkClick?: (href: string) => boolean
  onSubmit?: (answers: QuestionPromptAnswerMap) => Promise<void>
}) {
  const parsedArgs = args as QuestionPromptArgs
  const questions = useMemo(() => normalizeQuestions(parsedArgs), [parsedArgs])
  const promptDescriptionValue = String(parsedArgs.description || '').trim()
  const promptDescriptionHtml = useMemo(
    () =>
      promptDescriptionValue
        ? renderMarkdown(promptDescriptionValue, {
            resolveWorkspaceFileLink,
            isWorkspaceFileLink,
          })
        : '',
    [promptDescriptionValue, isWorkspaceFileLink, resolveWorkspaceFileLink]
  )
  const descriptionHtmlById = useMemo(() => {
    const lookup: Record<string, string> = {}
    questions.forEach((question) => {
      if (!question.description) return
      lookup[question.id] = renderMarkdown(question.description, {
        resolveWorkspaceFileLink,
        isWorkspaceFileLink,
      })
    })
    return lookup
  }, [questions, isWorkspaceFileLink, resolveWorkspaceFileLink])
  const defaultState = useMemo(() => {
    const rawDefaults = buildRawDefaultAnswers(parsedArgs, questions)
    return coerceAnswerState(rawDefaults, questions)
  }, [parsedArgs, questions])
  const defaults = defaultState.choices
  const defaultFreeTextAnswers = defaultState.freeText
  const defaultFreeTextActive = defaultState.freeTextActive
  const answered = status === 'called' && !error
  const interactive = status === 'calling' && !error && Boolean(onSubmit)
  const isCompact = Boolean(compact)
  const resolvedSubmitLabel = submitLabel?.trim() || 'Next'
  const resolvedSubmittingLabel = submittingLabel?.trim() || 'Submitting...'
  const descriptionTextClass = cn(
    'prose max-w-none text-[var(--text-tertiary)] [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1',
    isCompact
      ? 'prose-sm text-[11px] [&_p]:text-[11px] [&_li]:text-[11px]'
      : 'prose-sm text-[12px] [&_p]:text-[12px] [&_li]:text-[12px]'
  )

  const [draftAnswers, setDraftAnswers] = useState<ChoiceAnswerMap>(defaults)
  const [draftFreeTextAnswers, setDraftFreeTextAnswers] =
    useState<FreeTextAnswerMap>(defaultFreeTextAnswers)
  const [draftFreeTextActive, setDraftFreeTextActive] =
    useState<FreeTextActiveMap>(defaultFreeTextActive)
  const [activeIndex, setActiveIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setDraftAnswers(defaults)
    setDraftFreeTextAnswers(defaultFreeTextAnswers)
    setDraftFreeTextActive(defaultFreeTextActive)
    setActiveIndex(0)
    setSubmitting(false)
  }, [defaults, defaultFreeTextAnswers, defaultFreeTextActive, toolCallId])

  if (error) {
    return null
  }

  const titleValue = String(parsedArgs.title || '').trim()
  const title = titleValue || 'User Request'
  const hasQuestions = questions.length > 0
  const currentQuestion = questions[activeIndex]
  const isMultiFreeText = Boolean(currentQuestion?.multiple && currentQuestion.allowFreeText)
  const choiceLabel = questions.some((question) => question.multiple) ? 'Multiple Choice' : 'Single Choice'
  const canNext = currentQuestion
    ? isAnswered(currentQuestion, draftAnswers, draftFreeTextAnswers, draftFreeTextActive)
    : false
  const isFinalStep = !currentQuestion || activeIndex >= questions.length - 1
  const actionLabel = isFinalStep ? resolvedSubmitLabel : 'Next'
  const actionLoadingLabel = isFinalStep ? resolvedSubmittingLabel : 'Submitting...'

  const toggleChoice = (question: NormalizedQuestion, optionIndex: number) => {
    if (!interactive) return
    if (question.allowFreeText && !question.multiple) {
      setDraftFreeTextActive((prev) => {
        if (!prev[question.id]) return prev
        return { ...prev, [question.id]: false }
      })
    }
    setDraftAnswers((prev) => {
      const next = { ...prev }
      if (question.multiple) {
        const current = Array.isArray(next[question.id]) ? (next[question.id] as number[]) : []
        next[question.id] = current.includes(optionIndex)
          ? current.filter((item) => item !== optionIndex)
          : [...current, optionIndex]
      } else {
        if (next[question.id] === optionIndex) {
          delete next[question.id]
        } else {
          next[question.id] = optionIndex
        }
      }
      return next
    })
  }

  const activateFreeText = (question: NormalizedQuestion) => {
    if (!interactive) return
    setDraftFreeTextActive((prev) => ({ ...prev, [question.id]: true }))
    if (!question.multiple) {
      setDraftAnswers((prev) => {
        if (!(question.id in prev)) return prev
        const next = { ...prev }
        delete next[question.id]
        return next
      })
    }
  }

  const updateFreeTextAnswer = (question: NormalizedQuestion, nextValue: string) => {
    if (!interactive) return
    activateFreeText(question)
    setDraftFreeTextAnswers((prev) => ({ ...prev, [question.id]: nextValue }))
  }

  const handleBack = () => {
    if (!interactive || submitting) return
    if (activeIndex <= 0) return
    setActiveIndex(activeIndex - 1)
  }

  const handleSkip = async () => {
    if (!interactive || submitting) return
    const nextIndex = activeIndex + 1
    if (nextIndex < questions.length) {
      setActiveIndex(nextIndex)
      return
    }
    setSubmitting(true)
    try {
      await onSubmit?.(
        serializeDraftAnswers(draftAnswers, questions, draftFreeTextAnswers, draftFreeTextActive)
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleNext = async () => {
    if (!interactive || submitting || !currentQuestion) return
    if (!isAnswered(currentQuestion, draftAnswers, draftFreeTextAnswers, draftFreeTextActive)) return
    const nextIndex = activeIndex + 1
    if (nextIndex < questions.length) {
      setActiveIndex(nextIndex)
      return
    }
    setSubmitting(true)
    try {
      await onSubmit?.(
        serializeDraftAnswers(draftAnswers, questions, draftFreeTextAnswers, draftFreeTextActive)
      )
    } finally {
      setSubmitting(false)
    }
  }

  const renderAnswered = () => (
    <div className="mt-4 space-y-3">
      {questions.map((question) => {
        const labels = formatAnsweredLabels(question, answers?.[question.id])
        return (
          <div
            key={question.id}
            className="rounded-[16px] border border-[var(--border-light)] bg-[var(--fill-tsp-white-light)] px-4 py-3"
          >
            <div
              className={cn(
                'font-medium text-[var(--text-primary)]',
                isCompact ? 'text-[12px]' : 'text-[12px]'
              )}
              dangerouslySetInnerHTML={{
                __html: renderMarkdownInline(question.text, {
                  resolveWorkspaceFileLink,
                  isWorkspaceFileLink,
                }),
              }}
            />
            {descriptionHtmlById[question.id] ? (
              <div
                className={cn('mt-1', descriptionTextClass)}
                dangerouslySetInnerHTML={{ __html: descriptionHtmlById[question.id] }}
              />
            ) : null}
            <div className="mt-2 flex flex-col gap-2">
              {labels.length > 0 ? (
                labels.map((label) => (
                  <span
                    key={`${question.id}-${label}`}
                    className={cn(
                      'w-full rounded-[12px] border border-[var(--border-input-active)] bg-[var(--fill-blue)] px-3 py-2 font-medium text-[var(--text-primary)]',
                      isCompact ? 'text-[11px]' : 'text-[11px]',
                      'whitespace-normal break-words'
                    )}
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdownInline(label, {
                        resolveWorkspaceFileLink,
                        isWorkspaceFileLink,
                      }),
                    }}
                  >
                  </span>
                ))
              ) : (
                <span
                  className={cn(
                    'text-[var(--text-tertiary)]',
                    isCompact ? 'text-[11px]' : 'text-[11px]'
                  )}
                >
                  (no answer)
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="ai-manus-question-prompt w-full">
      <div
        onClickCapture={(event) => {
          if (!onFileLinkClick) return
          const target = event.target as HTMLElement | null
          const fileButton = target?.closest<HTMLElement>('[data-file-href]')
          const buttonHref = fileButton?.getAttribute('data-file-href')?.trim() || ''
          const anchor = target?.closest<HTMLAnchorElement>('a[href]')
          const rawHref = buttonHref || anchor?.getAttribute('href')?.trim() || ''
          if (!rawHref) return
          const handled = onFileLinkClick(rawHref)
          if (!handled) return
          event.preventDefault()
          event.stopPropagation()
        }}
        className={cn(
          'ai-manus-question-prompt__card rounded-[22px] border border-[var(--border-light)] bg-[var(--background-white-main)]',
          isCompact ? 'px-4 py-4' : 'px-6 py-5'
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-[var(--text-secondary)]">
            <span className={cn('truncate', isCompact ? 'text-[12px]' : 'text-[12px]')}>
              Considering <span className="text-[var(--text-brand)]">{title}</span>
            </span>
            <Check size={14} className="shrink-0 text-[var(--text-brand)]" />
          </div>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'rounded-full bg-[var(--fill-tsp-white-light)] px-3 py-1 text-[var(--text-secondary)]',
                isCompact ? 'text-[11px]' : 'text-[11px]'
              )}
            >
              {choiceLabel}
            </span>
            {interactive ? (
              <button
                type="button"
                onClick={handleSkip}
                className={cn(
                  'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
                  isCompact ? 'text-[11px]' : 'text-[11px]'
                )}
              >
                Skip
              </button>
            ) : null}
          </div>
        </div>

        {promptDescriptionHtml ? (
          <div
            className={cn('mt-2', descriptionTextClass)}
            dangerouslySetInnerHTML={{ __html: promptDescriptionHtml }}
          />
        ) : null}

        {!hasQuestions && !error ? (
          <div className={cn('mt-3 text-[var(--text-tertiary)]', isCompact ? 'text-[12px]' : 'text-[12px]')}>
            No selectable options were provided.
          </div>
        ) : null}

        {hasQuestions && !answered ? (
          <div className="mt-4">
            <div
              className={cn(
                'font-medium text-[var(--text-primary)]',
                isCompact ? 'text-[15px]' : 'text-[16px]'
              )}
              dangerouslySetInnerHTML={{
                __html: renderMarkdownInline(currentQuestion?.text ?? '', {
                  resolveWorkspaceFileLink,
                  isWorkspaceFileLink,
                }),
              }}
            />
            {currentQuestion && descriptionHtmlById[currentQuestion.id] ? (
              <div
                className={cn('mt-1', descriptionTextClass)}
                dangerouslySetInnerHTML={{ __html: descriptionHtmlById[currentQuestion.id] }}
              />
            ) : null}

            {currentQuestion ? (
              <div className="mt-4 flex flex-col gap-3">
                {currentQuestion.options.map((option, optionIndex) => {
                  const selected = currentQuestion.multiple
                    ? Array.isArray(draftAnswers[currentQuestion.id]) &&
                      (draftAnswers[currentQuestion.id] as number[]).includes(optionIndex)
                    : draftAnswers[currentQuestion.id] === optionIndex
                  return (
                    <button
                      key={`${currentQuestion.id}-${option.value}`}
                      type="button"
                      onClick={(event) => {
                        if ((event.target as HTMLElement | null)?.closest('a,[data-file-href]')) return
                        toggleChoice(currentQuestion, optionIndex)
                      }}
                      disabled={!interactive}
                      className={cn(
                        'w-full rounded-[14px] border px-4 py-3 text-left leading-relaxed transition-all',
                        selected
                          ? 'border-[var(--border-input-active)] bg-[var(--fill-blue)] text-[var(--text-primary)]'
                          : 'border-[var(--border-dark)] text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-white-light)]',
                        !interactive && 'opacity-60',
                        isCompact ? 'text-[12px]' : 'text-[12px]',
                        'whitespace-normal break-words'
                      )}
                      aria-pressed={selected}
                    >
                      <span
                        dangerouslySetInnerHTML={{
                          __html: renderMarkdownInline(option.label, {
                            resolveWorkspaceFileLink,
                            isWorkspaceFileLink,
                          }),
                        }}
                      />
                    </button>
                  )
                })}
                {currentQuestion.allowFreeText ? (
                  <div className="w-full">
                    <textarea
                      value={draftFreeTextAnswers[currentQuestion.id] ?? ''}
                      onFocus={() => activateFreeText(currentQuestion)}
                      onChange={(event) => updateFreeTextAnswer(currentQuestion, event.target.value)}
                      placeholder={
                        isMultiFreeText ? 'Add a custom answer (kept with selections)' : 'Add a custom answer'
                      }
                      disabled={!interactive}
                      rows={2}
                      className={cn(
                        'w-full resize-none break-words rounded-[14px] border bg-[var(--fill-tsp-white-light)] px-4 py-2 text-[12px] text-[var(--text-primary)] outline-none transition-colors',
                        draftFreeTextActive[currentQuestion.id]
                          ? 'border-[var(--border-input-gold)]'
                          : 'border-[var(--border-dark)]',
                        !interactive && 'opacity-60'
                      )}
                      aria-label="Custom answer"
                    />
                    {isMultiFreeText ? (
                      <div className="mt-2 text-[11px] text-[var(--text-tertiary)]">
                        Custom answer will be sent together with selected options.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-3">
              {activeIndex > 0 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={!interactive || submitting}
                  className={cn(
                    'mr-auto text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]',
                    isCompact ? 'text-[11px]' : 'text-[11px]',
                    (!interactive || submitting) && 'opacity-60'
                  )}
                >
                  Back
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleNext}
                disabled={!interactive || submitting || !canNext}
                className={cn(
                  'rounded-full px-6 py-2 font-semibold transition-all',
                  isCompact ? 'text-[12px]' : 'text-[12px]',
                  !interactive || submitting || !canNext
                    ? 'bg-[var(--fill-tsp-gray-dark)] text-[var(--text-tertiary)]'
                    : 'bg-[var(--Button-primary-black)] text-[var(--text-onblack)] hover:brightness-110'
                )}
              >
                {submitting ? actionLoadingLabel : actionLabel}
              </button>
            </div>
          </div>
        ) : null}

        {answered ? renderAnswered() : null}
      </div>
    </div>
  )
}

export default QuestionPrompt
