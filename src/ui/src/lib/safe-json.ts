type SafeJsonPrimitive = string | number | boolean | null
export type SafeJsonValue =
  | SafeJsonPrimitive
  | SafeJsonValue[]
  | { [key: string]: SafeJsonValue }

const MAX_NORMALIZE_DEPTH = 8

function constructorNameOf(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const ctor = (value as { constructor?: { name?: unknown } }).constructor
  return typeof ctor?.name === 'string' && ctor.name.trim() ? ctor.name : null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isElementLike(value: unknown): value is {
  tagName?: unknown
  nodeName?: unknown
  id?: unknown
  getAttribute?: (name: string) => string | null
} {
  if (!value || typeof value !== 'object') return false
  if (typeof Element !== 'undefined' && value instanceof Element) return true
  const record = value as { nodeType?: unknown; nodeName?: unknown }
  return typeof record.nodeType === 'number' && typeof record.nodeName === 'string'
}

function isEventLike(value: unknown): value is {
  type?: unknown
  target?: unknown
  currentTarget?: unknown
} {
  if (!value || typeof value !== 'object') return false
  if (typeof Event !== 'undefined' && value instanceof Event) return true
  const record = value as { type?: unknown; target?: unknown; currentTarget?: unknown }
  return typeof record.type === 'string' && ('target' in record || 'currentTarget' in record)
}

function summarizeElementLike(value: {
  tagName?: unknown
  nodeName?: unknown
  id?: unknown
  getAttribute?: (name: string) => string | null
}): SafeJsonValue {
  const tagName =
    typeof value.tagName === 'string'
      ? value.tagName.toLowerCase()
      : typeof value.nodeName === 'string'
        ? value.nodeName.toLowerCase()
        : null
  const role = typeof value.getAttribute === 'function' ? value.getAttribute('role') : null
  const ariaLabel = typeof value.getAttribute === 'function' ? value.getAttribute('aria-label') : null
  const result: Record<string, SafeJsonValue> = {
    __type: 'Element',
  }
  if (tagName) result.tag = tagName
  if (typeof value.id === 'string' && value.id.trim()) result.id = value.id
  if (role) result.role = role
  if (ariaLabel) result.ariaLabel = ariaLabel
  return result
}

function summarizeEventLike(value: {
  type?: unknown
  target?: unknown
  currentTarget?: unknown
}): SafeJsonValue {
  const result: Record<string, SafeJsonValue> = {
    __type: 'Event',
    eventType: typeof value.type === 'string' && value.type.trim() ? value.type : 'unknown',
  }
  if (isElementLike(value.target)) {
    result.target = summarizeElementLike(value.target)
  } else {
    const targetCtor = constructorNameOf(value.target)
    if (targetCtor) result.target = { __type: targetCtor }
  }
  if (isElementLike(value.currentTarget)) {
    result.currentTarget = summarizeElementLike(value.currentTarget)
  } else {
    const currentTargetCtor = constructorNameOf(value.currentTarget)
    if (currentTargetCtor) result.currentTarget = { __type: currentTargetCtor }
  }
  return result
}

function summarizeSpecialObject(value: unknown): SafeJsonValue | undefined {
  if (value instanceof Error) {
    const result: Record<string, SafeJsonValue> = {
      __type: value.name || 'Error',
      message: value.message || '',
    }
    if (value.stack) result.stack = value.stack
    return result
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (value instanceof URL) {
    return value.toString()
  }
  if (value instanceof RegExp) {
    return String(value)
  }
  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return {
      __type: 'ArrayBuffer',
      byteLength: value.byteLength,
    }
  }
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value)) {
    const length =
      typeof (value as { length?: unknown }).length === 'number'
        ? Number((value as { length: number }).length)
        : null
    return {
      __type: constructorNameOf(value) || 'TypedArray',
      ...(length != null ? { length } : {}),
    }
  }
  if (isElementLike(value)) {
    return summarizeElementLike(value)
  }
  if (isEventLike(value)) {
    return summarizeEventLike(value)
  }
  return undefined
}

function normalizeForJson(
  value: unknown,
  seen: WeakSet<object>,
  depth: number
): SafeJsonValue | undefined {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'bigint') return String(value)
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'undefined') {
    return undefined
  }

  const special = summarizeSpecialObject(value)
  if (special !== undefined) {
    return special
  }

  if (typeof value !== 'object') {
    return String(value)
  }

  if (seen.has(value)) {
    return {
      __type: 'CircularRef',
      ...(constructorNameOf(value) ? { constructor: constructorNameOf(value) as string } : {}),
    }
  }

  if (depth >= MAX_NORMALIZE_DEPTH) {
    return {
      __type: constructorNameOf(value) || 'Object',
    }
  }

  seen.add(value)
  try {
    if (Array.isArray(value)) {
      return value.map((item) => {
        const normalized = normalizeForJson(item, seen, depth + 1)
        return normalized === undefined ? null : normalized
      })
    }

    if (value instanceof Map) {
      const entries: SafeJsonValue[] = []
      for (const [key, item] of value.entries()) {
        const normalizedKey = normalizeForJson(key, seen, depth + 1)
        const normalizedValue = normalizeForJson(item, seen, depth + 1)
        entries.push([
          normalizedKey === undefined ? null : normalizedKey,
          normalizedValue === undefined ? null : normalizedValue,
        ])
      }
      return {
        __type: 'Map',
        entries,
      }
    }

    if (value instanceof Set) {
      const values: SafeJsonValue[] = []
      for (const item of value.values()) {
        const normalized = normalizeForJson(item, seen, depth + 1)
        values.push(normalized === undefined ? null : normalized)
      }
      return {
        __type: 'Set',
        values,
      }
    }

    const result: Record<string, SafeJsonValue> = {}
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort((left, right) => left.localeCompare(right))
    for (const key of keys) {
      const normalized = normalizeForJson(record[key], seen, depth + 1)
      if (normalized !== undefined) {
        result[key] = normalized
      }
    }
    if (!isPlainObject(value)) {
      const constructorName = constructorNameOf(value)
      if (constructorName && constructorName !== 'Object' && !('__type' in result)) {
        result.__type = constructorName
      }
    }
    return result
  } finally {
    seen.delete(value)
  }
}

export function toSafeJsonValue(value: unknown): SafeJsonValue | null {
  const normalized = normalizeForJson(value, new WeakSet<object>(), 0)
  return normalized === undefined ? null : normalized
}

export function safeJsonStringify(value: unknown, space?: number | string): string {
  return JSON.stringify(toSafeJsonValue(value), null, space)
}

export function safeStableStringify(value: unknown): string {
  return JSON.stringify(toSafeJsonValue(value))
}

export function sanitizeJsonRecord(value: unknown): Record<string, SafeJsonValue> {
  const normalized = toSafeJsonValue(value)
  if (normalized && typeof normalized === 'object' && !Array.isArray(normalized)) {
    return normalized as Record<string, SafeJsonValue>
  }
  return {}
}
