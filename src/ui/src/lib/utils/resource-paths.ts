const FILES_ROOT = '/FILES'
const CLI_ROOT = '/CLIFILES'

function normalizeAbsolutePath(input: string): string {
  if (!input) return ''
  const normalized = input.replace(/\\/g, '/')
  return normalized.replace(/\/{2,}/g, '/')
}

function normalizeRootPath(input: string): string {
  const normalized = normalizeAbsolutePath(input)
  if (!normalized) return ''
  if (normalized === '/') return '/'
  return normalized.replace(/\/+$/, '')
}

function stripSlashes(input: string): string {
  return input.replace(/^\/+/, '').replace(/\/+$/, '')
}

export function toFilesResourcePath(path?: string | null): string {
  const cleaned = normalizeAbsolutePath((path ?? '').trim())
  if (!cleaned) return FILES_ROOT
  if (cleaned.startsWith(FILES_ROOT)) {
    return cleaned.replace(/\/+$/, '')
  }
  const stripped = stripSlashes(cleaned)
  return stripped ? `${FILES_ROOT}/${stripped}` : FILES_ROOT
}

export function toCliResourcePath(args: {
  serverId: string
  path: string
  serverRoot?: string | null
}): string {
  const normalizedPath = normalizeAbsolutePath(args.path)
  const normalizedRoot = args.serverRoot ? normalizeRootPath(args.serverRoot) : ''
  let relative = normalizedPath

  if (normalizedRoot) {
    if (normalizedPath === normalizedRoot) {
      relative = ''
    } else if (normalizedPath.startsWith(`${normalizedRoot}/`)) {
      relative = normalizedPath.slice(normalizedRoot.length)
    }
  }

  relative = stripSlashes(relative || normalizedPath)
  const safeRelative = relative
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/')

  return safeRelative ? `${CLI_ROOT}/${args.serverId}/${safeRelative}` : `${CLI_ROOT}/${args.serverId}`
}

export { FILES_ROOT, CLI_ROOT }
