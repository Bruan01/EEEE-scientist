import type { QuestionPromptAnswerMap } from '../types'

type RawOption = string | number | { label?: string; value?: string; name?: string }

type RawQuestion = {
  id?: string
  key?: string
  name?: string
  qid?: string
  question?: string
  title?: string
  label?: string
  text?: string
  prompt?: string
  description?: string
  help?: string
  hint?: string
  options?: RawOption[]
  choices?: RawOption[]
  values?: RawOption[]
  multiple?: boolean | string | number
  allow_free_text?: boolean | string | number
  allowFreeText?: boolean | string | number
  allow_custom_input?: boolean | string | number
  allowCustomInput?: boolean | string | number
  free_text?: boolean | string | number
  freeText?: boolean | string | number
  default?: string | number | boolean | Array<string | number>
  default_value?: string | number | boolean | Array<string | number>
  defaultValue?: string | number | boolean | Array<string | number>
  value?: string | number | boolean | Array<string | number>
  defaults?: string | number | boolean | Array<string | number>
  selected?: string | number | boolean | Array<string | number>
  answer?: string | number | boolean | Array<string | number>
}

export type QuestionPromptArgs = {
  title?: string
  description?: string
  prompt?: string
  text?: string
  question?: string
  options?: unknown
  multiple?: boolean | string | number
  default?: string | number | boolean | Array<string | number>
  questions?: unknown
  additional_question?: unknown
  additionalQuestion?: unknown
}

type NormalizedOption = { label: string; value: string }

export type NormalizedQuestion = {
  id: string
  text: string
  description: string
  options: NormalizedOption[]
  multiple: boolean
  allowFreeText: boolean
}

type ChoiceValue = number | number[]

export type ChoiceAnswerMap = Record<string, ChoiceValue>

export type FreeTextAnswerMap = Record<string, string>

export type FreeTextActiveMap = Record<string, boolean>

function coerceBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y'
  }
  return false
}

function normalizeOption(option: RawOption, fallbackIndex: number): NormalizedOption | null {
  if (typeof option === 'string') {
    const trimmed = option.trim()
    return trimmed ? { label: trimmed, value: trimmed } : null
  }
  if (typeof option === 'number') {
    const value = String(option)
    return { label: value, value }
  }
  if (option && typeof option === 'object') {
    const label = String(option.label || option.name || option.value || '').trim()
    if (!label) return null
    const value = String(option.value || option.label || option.name || '').trim()
    const resolvedValue = value || `option-${fallbackIndex}`
    return { label, value: resolvedValue }
  }
  return null
}

function normalizeIndex(value: string | number, options: NormalizedOption[]): number | null {
  const max = options.length
  if (max === 0) return null
  if (typeof value === 'number') {
    if (value >= 1 && value <= max) return value - 1
    if (value >= 0 && value < max) return value
    return null
  }
  const raw = value.trim()
  if (!raw) return null
  if (/^\\d+$/.test(raw)) {
    return normalizeIndex(Number(raw), options)
  }
  const lowered = raw.toLowerCase()
  const matchIndex = options.findIndex(
    (option) => option.label === raw || option.value === raw || option.label.toLowerCase() === lowered
  )
  return matchIndex >= 0 ? matchIndex : null
}

function buildRawQuestions(args: QuestionPromptArgs): RawQuestion[] {
  const coerceJson = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return null
    try {
      return JSON.parse(trimmed)
    } catch {
      return null
    }
  }

  const coerceQuestions = (value: unknown): RawQuestion[] => {
    if (Array.isArray(value)) return value as RawQuestion[]
    if (value && typeof value === 'object') return [value as RawQuestion]
    if (typeof value === 'string') {
      const parsed = coerceJson(value)
      if (Array.isArray(parsed)) return parsed as RawQuestion[]
      if (parsed && typeof parsed === 'object') return [parsed as RawQuestion]
    }
    return []
  }

  const coerceOptions = (value: unknown): RawOption[] | undefined => {
    if (Array.isArray(value)) return value as RawOption[]
    if (typeof value === 'string') {
      const parsed = coerceJson(value)
      if (Array.isArray(parsed)) return parsed as RawOption[]
      const lines = value
        .split('\\n')
        .map((item) => item.trim())
        .filter(Boolean)
      if (lines.length === 1 && lines[0].includes(',')) {
        return lines[0]
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean) as RawOption[]
      }
      return lines.length > 0 ? (lines as RawOption[]) : undefined
    }
    return undefined
  }

  const rawQuestions = coerceQuestions(args.questions)
  const additional = args.additional_question ?? args.additionalQuestion

  if (rawQuestions.length === 0 && args.question) {
    const resolvedOptions = coerceOptions(args.options)
    if (resolvedOptions && resolvedOptions.length > 0) {
      rawQuestions.push({
        question: args.question,
        options: resolvedOptions,
        multiple: coerceBoolean(args.multiple),
        default: args.default,
      })
    }
  }

  if (additional && typeof additional === 'object') {
    rawQuestions.push(additional as RawQuestion)
  }

  return rawQuestions
}

export function normalizeQuestions(args: QuestionPromptArgs): NormalizedQuestion[] {
  const rawQuestions = buildRawQuestions(args)
  return rawQuestions
    .map((question, index) => {
      const resolvedId = question.id || question.key || question.name || question.qid || `q${index + 1}`
      const id = String(resolvedId)
      const text = String(
        question.question || question.prompt || question.text || question.title || question.label || id
      ).trim()
      const description = String(question.description || question.help || question.hint || '').trim()
      const optionValue = question.options || question.choices || question.values
      const rawOptions = Array.isArray(optionValue)
        ? optionValue
        : typeof optionValue === 'string' || typeof optionValue === 'number'
          ? [optionValue]
          : optionValue && typeof optionValue === 'object'
            ? Object.values(optionValue as Record<string, RawOption>)
            : []
      const options = rawOptions
        .map((option, optIndex) => normalizeOption(option, optIndex))
        .filter(Boolean) as NormalizedOption[]
      const multiple = coerceBoolean(question.multiple)
      const allowFreeText = coerceBoolean(
        question.allow_free_text ??
          question.allowFreeText ??
          question.allow_custom_input ??
          question.allowCustomInput ??
          question.free_text ??
          question.freeText
      )
      return {
        id,
        text,
        description,
        options,
        multiple,
        allowFreeText,
      }
    })
    .filter((question) => question.options.length > 0)
}

export function buildRawDefaultAnswers(
  args: QuestionPromptArgs,
  questions: NormalizedQuestion[]
): QuestionPromptAnswerMap {
  const rawQuestions = buildRawQuestions(args)
  const rawAnswers: QuestionPromptAnswerMap = {}

  questions.forEach((question, index) => {
    const raw = rawQuestions[index] ?? {}
    const rawValue =
      raw.answer ??
      raw.default ??
      raw.default_value ??
      raw.defaultValue ??
      raw.value ??
      raw.defaults ??
      raw.selected ??
      undefined
    if (rawValue === undefined) return
    rawAnswers[question.id] = rawValue as QuestionPromptAnswerMap[string]
  })

  return rawAnswers
}

export function coerceAnswerState(
  raw: QuestionPromptAnswerMap | undefined,
  questions: NormalizedQuestion[]
): { choices: ChoiceAnswerMap; freeText: FreeTextAnswerMap; freeTextActive: FreeTextActiveMap } {
  const choices: ChoiceAnswerMap = {}
  const freeText: FreeTextAnswerMap = {}
  const freeTextActive: FreeTextActiveMap = {}
  if (!raw || typeof raw !== 'object') return { choices, freeText, freeTextActive }

  questions.forEach((question) => {
    const rawValue = raw[question.id]
    if (rawValue === undefined || rawValue === null) return
    const allowFreeText = question.allowFreeText
    const recordFreeText = (value: string) => {
      if (!allowFreeText) return
      const text = value.trim()
      if (!text) return
      freeText[question.id] = text
    }

    if (question.multiple) {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue]
      const indices: number[] = []
      values.forEach((item) => {
        if (typeof item !== 'string' && typeof item !== 'number') return
        const idx = normalizeIndex(item, question.options)
        if (idx !== null) {
          if (!indices.includes(idx)) indices.push(idx)
          return
        }
        if (allowFreeText && typeof item === 'string') {
          recordFreeText(item)
        }
      })
      if (indices.length > 0) {
        choices[question.id] = indices
      }
      if (freeText[question.id]) {
        freeTextActive[question.id] = true
      }
      return
    }

    const candidates = Array.isArray(rawValue) ? rawValue : [rawValue]
    for (const item of candidates) {
      if (typeof item !== 'string' && typeof item !== 'number') continue
      const idx = normalizeIndex(item, question.options)
      if (idx !== null) {
        choices[question.id] = idx
        return
      }
      if (allowFreeText && typeof item === 'string') {
        recordFreeText(item)
        if (freeText[question.id]) {
          freeTextActive[question.id] = true
        }
        return
      }
    }
  })

  return { choices, freeText, freeTextActive }
}

export function isAnswered(
  question: NormalizedQuestion,
  answers: ChoiceAnswerMap,
  freeTextAnswers: FreeTextAnswerMap,
  freeTextActive: FreeTextActiveMap
): boolean {
  const value = answers[question.id]
  const isFreeTextActive = Boolean(freeTextActive[question.id])
  if (question.allowFreeText && isFreeTextActive) {
    const text = freeTextAnswers[question.id]
    return Boolean(text && text.trim())
  }
  if (question.multiple) {
    if (Array.isArray(value) && value.length > 0) return true
    if (!question.allowFreeText) return false
    const text = freeTextAnswers[question.id]
    return Boolean(text && text.trim())
  }
  return typeof value === 'number'
}

export function formatAnsweredLabels(
  question: NormalizedQuestion,
  rawValue: QuestionPromptAnswerMap[string] | undefined
): string[] {
  if (rawValue === undefined || rawValue === null) return []
  const values = Array.isArray(rawValue) ? rawValue : [rawValue]
  const labels: string[] = []

  values.forEach((item) => {
    if (typeof item !== 'string' && typeof item !== 'number') return
    const idx = normalizeIndex(item, question.options)
    if (idx !== null) {
      const label = question.options[idx]?.label
      if (label) labels.push(label)
      return
    }
    if (typeof item === 'string') {
      const text = item.trim()
      if (!text) return
      labels.push(text)
    }
  })

  return labels
}

export function serializeDraftAnswers(
  answers: ChoiceAnswerMap,
  questions: NormalizedQuestion[],
  freeTextAnswers: FreeTextAnswerMap,
  freeTextActive: FreeTextActiveMap
): QuestionPromptAnswerMap {
  const payload: QuestionPromptAnswerMap = {}
  questions.forEach((question) => {
    const value = answers[question.id]
    if (question.multiple) {
      const values = Array.isArray(value) ? value : []
      const indices: number[] = []
      values.forEach((entry) => {
        if (typeof entry === 'number') {
          const idx =
            entry >= 0 && entry < question.options.length
              ? entry
              : entry >= 1 && entry <= question.options.length
                ? entry - 1
                : null
          if (idx === null || indices.includes(idx)) return
          indices.push(idx)
          return
        }
        if (typeof entry !== 'string') return
        const idx = normalizeIndex(entry, question.options)
        if (idx === null || indices.includes(idx)) return
        indices.push(idx)
      })
      if (indices.length > 0) {
        const labels = indices
          .map((idx) => question.options[idx]?.label || question.options[idx]?.value || String(idx + 1))
          .filter(Boolean)
        const text = question.allowFreeText ? freeTextAnswers[question.id]?.trim() : ''
        if (text) {
          const lower = text.toLowerCase()
          if (!labels.some((label) => label.toLowerCase() === lower)) {
            labels.push(text)
          }
        }
        payload[question.id] = labels
      } else if (question.allowFreeText) {
        const text = freeTextAnswers[question.id]?.trim()
        if (text) {
          payload[question.id] = [text]
        }
      }
      return
    }
    if (question.allowFreeText && freeTextActive[question.id]) {
      const text = freeTextAnswers[question.id]?.trim()
      if (text) {
        payload[question.id] = text
      }
      return
    }
    if (typeof value === 'number') {
      const option = question.options[value]
      const label = option?.label || option?.value || String(value + 1)
      payload[question.id] = label
    }
  })
  return payload
}
