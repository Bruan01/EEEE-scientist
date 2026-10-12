const KEY_VALUE_PATTERN =
  /(\b(?:api[_-]?key|token|secret|password|passwd|pwd|authorization)\b\s*[:=]\s*)(['"]?)[^'"\s]+(\2)/gi

const DIRECT_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  { regex: /\bsk-[A-Za-z0-9_-]{12,}\b/g, replacement: '[redacted]' },
  { regex: /\bghp_[A-Za-z0-9]{20,}\b/g, replacement: '[redacted]' },
  { regex: /\bAIza[0-9A-Za-z-_]{20,}\b/g, replacement: '[redacted]' },
  { regex: /\bAKIA[0-9A-Z]{12,}\b/g, replacement: '[redacted]' },
  { regex: /\bASIA[0-9A-Z]{12,}\b/g, replacement: '[redacted]' },
  { regex: /\bBearer\s+[A-Za-z0-9._-]+\b/gi, replacement: 'Bearer [redacted]' },
]

export function redactSensitive(value: string): string {
  if (!value) return value
  let output = value
  output = output.replace(KEY_VALUE_PATTERN, (_match, prefix: string, quote: string) => {
    return `${prefix}${quote}[redacted]${quote}`
  })
  for (const pattern of DIRECT_PATTERNS) {
    output = output.replace(pattern.regex, pattern.replacement)
  }
  return output
}

export function truncateText(value: string, maxLength = 2000): string {
  if (!value || value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}...`
}

export function sanitizeUrl(raw: string, baseOrigin?: string): string {
  if (!raw) return ''
  const fallbackBase =
    baseOrigin ||
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost')
  try {
    const parsed = new URL(raw, fallbackBase)
    const keys = Array.from(parsed.searchParams.keys()).filter(Boolean)
    const query = keys.length ? `?${keys.join('&')}` : ''
    let baseOriginNormalized = ''
    try {
      baseOriginNormalized = new URL(fallbackBase).origin
    } catch {
      baseOriginNormalized = ''
    }
    const includeOrigin =
      parsed.origin && baseOriginNormalized && parsed.origin !== baseOriginNormalized
    return `${includeOrigin ? parsed.origin : ''}${parsed.pathname}${query}`
  } catch {
    const [path, query] = raw.split('?')
    if (!query) return path
    const keys = query
      .split('&')
      .map((pair) => pair.split('=')[0])
      .filter(Boolean)
    return keys.length ? `${path}?${keys.join('&')}` : path
  }
}
