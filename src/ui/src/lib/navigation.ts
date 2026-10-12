export function getAppBasePath(): string {
  const base = import.meta.env.BASE_URL || '/'
  if (!base || base === '/') {
    return ''
  }
  return base.endsWith('/') ? base.slice(0, -1) : base
}

export function buildAppPath(path: string = '/'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const basePath = getAppBasePath()
  return basePath ? `${basePath}${normalizedPath}` : normalizedPath
}

export function redirectToLanding(error?: string): void {
  if (typeof window === 'undefined') {
    return
  }

  const target = new URL(buildAppPath('/'), window.location.origin)
  if (error) {
    target.searchParams.set('error', error)
  }
  window.location.href = `${target.pathname}${target.search}`
}
