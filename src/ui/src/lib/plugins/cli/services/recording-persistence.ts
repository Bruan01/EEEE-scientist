type RecordingEntry = {
  ts: number
  data: string
}

type PersistedRecording = {
  sessionId: string
  serverId: string
  title: string
  entries: RecordingEntry[]
  updatedAt: number
}

const STORAGE_KEY = 'cli_terminal_recordings'
const MAX_RECORDINGS = 12
const MAX_AGE_HOURS = 24

function loadStore(): PersistedRecording[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PersistedRecording[]
    const expiryMs = MAX_AGE_HOURS * 60 * 60 * 1000
    const now = Date.now()
    return parsed.filter((item) => now - item.updatedAt < expiryMs)
  } catch {
    return []
  }
}

function saveStore(items: PersistedRecording[]): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Ignore storage errors (quota/full/private mode).
  }
}

export function loadRecording(sessionId: string): PersistedRecording | null {
  const items = loadStore()
  const match = items.find((item) => item.sessionId === sessionId)
  return match || null
}

export function saveRecording(
  sessionId: string,
  serverId: string,
  title: string,
  entries: RecordingEntry[]
): void {
  const items = loadStore().filter((item) => item.sessionId !== sessionId)
  const next: PersistedRecording = {
    sessionId,
    serverId,
    title,
    entries,
    updatedAt: Date.now(),
  }
  items.unshift(next)
  items.sort((a, b) => b.updatedAt - a.updatedAt)
  const trimmed = items.slice(0, MAX_RECORDINGS)
  saveStore(trimmed)
}

