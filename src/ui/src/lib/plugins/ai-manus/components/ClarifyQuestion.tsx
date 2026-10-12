'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { renderMarkdownInline } from '../lib/markdown'
import type { ClarifyQuestionOption } from '../types'

const EMPTY_SELECTIONS: string[] = []

function normalizeSelections(
  selections: string[] | undefined,
  defaults: string[] | undefined
): string[] {
  if (selections && selections.length > 0) return selections
  if (defaults && defaults.length > 0) return defaults
  return EMPTY_SELECTIONS
}

function resolveLabels(options: ClarifyQuestionOption[], selections: string[]): string[] {
  if (selections.length === 0) return []
  const lookup = new Map(options.map((option) => [option.id, option.label]))
  return selections.map((id) => lookup.get(id)).filter((label): label is string => Boolean(label))
}

export function ClarifyQuestion({
  question,
  options,
  multi,
  status,
  defaultSelected,
  selections,
  missingFields,
  error,
  compact,
  resolveWorkspaceFileLink,
  isWorkspaceFileLink,
  onFileLinkClick,
  onSubmit,
}: {
  question: string
  options: ClarifyQuestionOption[]
  multi: boolean
  status: 'calling' | 'answered' | 'called'
  defaultSelected?: string[]
  selections?: string[]
  missingFields?: string[]
  error?: string
  compact?: boolean
  resolveWorkspaceFileLink?: (href: string) => boolean
  isWorkspaceFileLink?: (href: string) => boolean
  onFileLinkClick?: (href: string) => boolean
  onSubmit?: (selections: string[]) => Promise<void>
}) {
  const isCompact = Boolean(compact)
  const interactive = status === 'calling' && !error && Boolean(onSubmit)
  const answered = status !== 'calling'
  const resolvedSelections = useMemo(
    () => normalizeSelections(selections, defaultSelected),
    [defaultSelected, selections]
  )
  const selectionKey = resolvedSelections.join('|')
  const [draftSelections, setDraftSelections] = useState<string[]>(resolvedSelections)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setDraftSelections(resolvedSelections)
    setSubmitting(false)
  }, [selectionKey, question])

  if (error) {
    return null
  }

  const choiceLabel = multi ? 'Multiple Choice' : 'Single Choice'
  const canSubmit = draftSelections.length > 0
  const selectedLabels = resolveLabels(options, selections ?? draftSelections)
  const missingText = (missingFields ?? []).filter(Boolean).join(', ')

  const toggleSelection = (id: string) => {
    if (!interactive) return
    setDraftSelections((prev) => {
      if (multi) {
        return prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      }
      return prev[0] === id ? [] : [id]
    })
  }

  const handleSubmit = async () => {
    if (!interactive || submitting || !canSubmit) return
    setSubmitting(true)
    const payload = multi ? draftSelections : draftSelections.slice(0, 1)
    try {
      await onSubmit?.(payload)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="ai-manus-question-prompt ai-manus-clarify-question w-full">
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
              Clarify request
            </span>
            <Check size={14} className="shrink-0 text-[var(--text-brand)]" />
          </div>
          <span
            className={cn(
              'rounded-full bg-[var(--fill-tsp-white-light)] px-3 py-1 text-[var(--text-secondary)]',
              isCompact ? 'text-[11px]' : 'text-[11px]'
            )}
          >
            {choiceLabel}
          </span>
        </div>

        {missingText ? (
          <div className={cn('mt-2 text-[var(--text-tertiary)]', isCompact ? 'text-[11px]' : 'text-[11px]')}>
            Missing: {missingText}
          </div>
        ) : null}

        {!answered ? (
          <div className="mt-4">
            <div
              className={cn(
                'font-medium text-[var(--text-primary)]',
                isCompact ? 'text-[15px]' : 'text-[16px]'
              )}
              dangerouslySetInnerHTML={{
                __html: renderMarkdownInline(question, {
                  resolveWorkspaceFileLink,
                  isWorkspaceFileLink,
                }),
              }}
            />
            {options.length === 0 ? (
              <div
                className={cn(
                  'mt-3 text-[var(--text-tertiary)]',
                  isCompact ? 'text-[12px]' : 'text-[12px]'
                )}
              >
                No selectable options were provided.
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-3">
                {options.map((option) => {
                  const selected = draftSelections.includes(option.id)
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={(event) => {
                        if ((event.target as HTMLElement | null)?.closest('a,[data-file-href]')) return
                        toggleSelection(option.id)
                      }}
                      disabled={!interactive}
                      className={cn(
                        'rounded-full border px-4 py-2 text-left transition-all',
                        selected
                          ? 'border-[var(--border-input-active)] bg-[var(--fill-blue)] text-[var(--text-primary)]'
                          : 'border-[var(--border-dark)] text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-white-light)]',
                        !interactive && 'opacity-60',
                        isCompact ? 'text-[12px]' : 'text-[12px]'
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
              </div>
            )}

            <div className="mt-5 flex items-center justify-end">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!interactive || submitting || !canSubmit}
                className={cn(
                  'rounded-full px-6 py-2 font-semibold transition-all',
                  isCompact ? 'text-[12px]' : 'text-[12px]',
                  !interactive || submitting || !canSubmit
                    ? 'bg-[var(--fill-tsp-gray-dark)] text-[var(--text-tertiary)]'
                    : 'bg-[var(--Button-primary-black)] text-[var(--text-onblack)] hover:brightness-110'
                )}
              >
                {submitting ? 'Submitting...' : 'Confirm'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-[16px] border border-[var(--border-light)] bg-[var(--fill-tsp-white-light)] px-4 py-3">
              <div
                className={cn('font-medium text-[var(--text-primary)]', isCompact ? 'text-[12px]' : 'text-[12px]')}
                dangerouslySetInnerHTML={{
                  __html: renderMarkdownInline(question, {
                    resolveWorkspaceFileLink,
                    isWorkspaceFileLink,
                  }),
                }}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedLabels.length > 0 ? (
                  selectedLabels.map((label) => (
                    <span
                      key={label}
                      className={cn(
                        'rounded-full border border-[var(--border-input-active)] bg-[var(--fill-blue)] px-3 py-1 font-medium text-[var(--text-primary)]',
                        isCompact ? 'text-[11px]' : 'text-[11px]'
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
          </div>
        )}
      </div>
    </div>
  )
}

export default ClarifyQuestion
