import type { PdfAnnotationEffectData, PdfJumpEffectData } from '@/lib/types/ui-effects'

export type PdfQueuedEffect =
  | { id: string; name: 'pdf:jump'; data: PdfJumpEffectData }
  | { id: string; name: 'annotation:created' | 'pdf:annotation_created'; data: PdfAnnotationEffectData }

const pendingEffects = new Map<string, PdfQueuedEffect[]>()
const handledIds: string[] = []
const handledSet = new Set<string>()
const MAX_HANDLED_IDS = 200

export function queuePdfEffect(effect: PdfQueuedEffect) {
  const fileId = effect.data?.fileId
  if (!fileId) return
  const existing = pendingEffects.get(fileId) ?? []
  existing.push(effect)
  pendingEffects.set(fileId, existing)
}

export function consumePdfEffects(fileId: string): PdfQueuedEffect[] {
  const existing = pendingEffects.get(fileId)
  if (!existing || existing.length === 0) return []
  pendingEffects.delete(fileId)
  return existing
}

export function isPdfEffectHandled(effectId?: string | null): boolean {
  if (!effectId) return false
  return handledSet.has(effectId)
}

export function markPdfEffectHandled(effectId?: string | null) {
  if (!effectId || handledSet.has(effectId)) return
  handledSet.add(effectId)
  handledIds.push(effectId)
  if (handledIds.length > MAX_HANDLED_IDS) {
    const removed = handledIds.shift()
    if (removed) handledSet.delete(removed)
  }
}
