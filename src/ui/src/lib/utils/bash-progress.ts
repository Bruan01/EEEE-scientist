import type { BashProgress } from '@/lib/types/bash'

const clampPercent = (value: number) => Math.min(100, Math.max(0, value))

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

export const getProgressPercent = (progress?: BashProgress | null) => {
  if (!progress) return null
  if (isFiniteNumber(progress.percent)) {
    return clampPercent(progress.percent)
  }
  if (isFiniteNumber(progress.current) && isFiniteNumber(progress.total) && progress.total > 0) {
    return clampPercent((progress.current / progress.total) * 100)
  }
  return null
}

export const formatProgressLabel = (progress?: BashProgress | null) => {
  if (!progress) return ''
  const unit = progress.unit ? ` ${progress.unit}` : ''
  if (isFiniteNumber(progress.current) && isFiniteNumber(progress.total) && progress.total > 0) {
    return `${progress.current}/${progress.total}${unit}`
  }
  if (isFiniteNumber(progress.current)) {
    return `${progress.current}${unit}`
  }
  return ''
}

const formatEta = (etaSeconds?: number | null) => {
  if (!isFiniteNumber(etaSeconds) || etaSeconds < 0) return ''
  const totalSeconds = Math.round(etaSeconds)
  if (totalSeconds < 60) return `${totalSeconds}s`
  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}m ${seconds}s`
  }
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

const formatNextUpdateAt = (value?: string | null) => {
  if (!isNonEmptyString(value)) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export const formatProgressMeta = (progress?: BashProgress | null) => {
  if (!progress) return ''
  const parts: string[] = []
  if (progress.desc) parts.push(progress.desc)
  if (progress.phase) parts.push(progress.phase)
  if (isFiniteNumber(progress.rate)) parts.push(`${progress.rate.toFixed(2)}/s`)
  const nextUpdateIn = formatEta(progress.next_reply_in ?? progress.next_check_in ?? progress.eta ?? null)
  if (nextUpdateIn) parts.push(`next update in ${nextUpdateIn}`)
  const nextUpdateAt = formatNextUpdateAt(progress.next_reply_at ?? progress.next_check_at ?? null)
  if (nextUpdateAt) parts.push(`next ${nextUpdateAt}`)
  return parts.join(' · ')
}
