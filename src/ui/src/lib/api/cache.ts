type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const memoryCache = new Map<string, CacheEntry<unknown>>()

function readStorage<T>(key: string): CacheEntry<T> | null {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as CacheEntry<T>
  } catch {
    return null
  }
}

export function getCachedValue<T>(key: string): T | null {
  const now = Date.now()
  const memoryEntry = memoryCache.get(key) as CacheEntry<T> | undefined
  if (memoryEntry && memoryEntry.expiresAt > now) return memoryEntry.value

  const storageEntry = readStorage<T>(key)
  if (storageEntry && storageEntry.expiresAt > now) {
    memoryCache.set(key, storageEntry as CacheEntry<unknown>)
    return storageEntry.value
  }

  memoryCache.delete(key)
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(key)
  }
  return null
}

export function setCachedValue<T>(key: string, value: T, ttlMs: number) {
  const entry: CacheEntry<T> = {
    value,
    expiresAt: Date.now() + ttlMs,
  }
  memoryCache.set(key, entry as CacheEntry<unknown>)
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(key, JSON.stringify(entry))
  }
}

export function clearCachedValue(key: string) {
  memoryCache.delete(key)
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(key)
  }
}
