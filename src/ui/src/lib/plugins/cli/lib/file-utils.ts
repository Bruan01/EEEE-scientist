export function formatFileSize(size?: number | null): string {
  if (size == null || Number.isNaN(size)) return 'n/a'
  if (size < 1024) return `${size} B`
  const kb = size / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(1)} GB`
}

export function normalizePath(path: string): string {
  if (!path) return '/'
  const normalized = path.replace(/\\/g, '/')
  let withLeading = normalized.startsWith('/') ? normalized : `/${normalized}`
  withLeading = withLeading.replace(/\/{2,}/g, '/')
  if (withLeading.length > 1 && withLeading.endsWith('/')) {
    withLeading = withLeading.replace(/\/+$/, '')
  }
  return withLeading
}

export function splitPath(path: string): string[] {
  const normalized = normalizePath(path)
  return normalized === '/' ? [] : normalized.split('/').filter(Boolean)
}

export function joinPath(segments: string[]): string {
  if (segments.length === 0) return '/'
  return `/${segments.join('/')}`
}

export function isImageMime(mimeType?: string | null): boolean {
  if (!mimeType) return false
  return mimeType.startsWith('image/')
}

export function isTextMime(mimeType?: string | null): boolean {
  if (!mimeType) return false
  return mimeType.startsWith('text/') || mimeType === 'application/json'
}

export function isVideoMime(mimeType?: string | null): boolean {
  if (!mimeType) return false
  return mimeType.startsWith('video/')
}

export const TEXT_PREVIEW_MAX_BYTES = 1024 * 1024
export const IMAGE_PREVIEW_MAX_BYTES = 1024 * 1024
export const VIDEO_PREVIEW_MAX_BYTES = 1024 * 1024
export const DOWNLOAD_MAX_BYTES = 50 * 1024 * 1024
export const TEXT_TAIL_BYTES = 64 * 1024

const SENSITIVE_PATH_MARKERS = [
  '/.env',
  '/.env.',
  '/.ssh/',
  '/credentials.json',
  '/secrets.yaml',
  '/secrets.yml',
  '/id_rsa',
  '/id_ed25519',
  '/.aws/credentials',
  '/.docker/config.json',
  '/etc/passwd',
  '/etc/shadow',
  '/etc/gshadow',
  '/proc/',
  '/sys/kernel/',
  '/dev/mem',
  '/dev/kmem',
]

export function findSensitiveMarker(path: string): string | null {
  const normalized = normalizePath(path).toLowerCase()
  for (const marker of SENSITIVE_PATH_MARKERS) {
    if (normalized.includes(marker)) return marker
  }
  return null
}
