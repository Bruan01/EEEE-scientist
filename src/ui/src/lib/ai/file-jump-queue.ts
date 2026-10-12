import type { FileJumpEffectData } from '@/lib/types/ui-effects'

export type FileJumpQueuedEffect = { id: string; data: FileJumpEffectData }

const pendingEffects = new Map<string, FileJumpQueuedEffect[]>()

export function queueFileJumpEffect(effect: FileJumpQueuedEffect) {
  const fileId = effect.data?.fileId
  if (!fileId) return
  const existing = pendingEffects.get(fileId) ?? []
  existing.push(effect)
  pendingEffects.set(fileId, existing)
}

export function consumeFileJumpEffects(fileId: string): FileJumpQueuedEffect[] {
  const existing = pendingEffects.get(fileId)
  if (!existing || existing.length === 0) return []
  pendingEffects.delete(fileId)
  return existing
}
