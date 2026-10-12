import { client } from '@/lib/api'
import type { SystemUpdateStatus } from '@/types'

let cachedStatus: SystemUpdateStatus | null = null
let cachedAt = 0
let inFlight: Promise<SystemUpdateStatus> | null = null

export async function loadSystemUpdateStatus(options?: {
  force?: boolean
  maxAgeMs?: number
}) {
  const force = Boolean(options?.force)
  const maxAgeMs = typeof options?.maxAgeMs === 'number' ? options.maxAgeMs : 5000
  const now = Date.now()

  if (!force && cachedStatus && now - cachedAt <= maxAgeMs) {
    return cachedStatus
  }
  if (!force && inFlight) {
    return inFlight
  }

  inFlight = client.systemUpdateStatus().then((payload) => {
    cachedStatus = payload
    cachedAt = Date.now()
    return payload
  }).finally(() => {
    inFlight = null
  })

  return inFlight
}

export function clearSystemUpdateStatusCache() {
  cachedStatus = null
  cachedAt = 0
  inFlight = null
}
