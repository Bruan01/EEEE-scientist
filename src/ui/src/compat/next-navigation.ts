import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate, useParams as useRouteParams } from 'react-router-dom'

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>() {
  return useRouteParams() as T
}

export function usePathname() {
  const location = useLocation()
  return location.pathname
}

export function useSearchParams() {
  const location = useLocation()
  return useMemo(() => new URLSearchParams(location.search), [location.search])
}

export function useRouter() {
  const navigate = useNavigate()

  return useMemo(
    () => ({
      push: (to: string) => navigate(to),
      replace: (to: string) => navigate(to, { replace: true }),
      back: () => navigate(-1),
      forward: () => navigate(1),
      refresh: () => window.location.reload(),
      prefetch: async () => undefined,
    }),
    [navigate]
  )
}

export function redirect(to: string): never {
  window.location.assign(to)
  throw new Error(`Redirected to ${to}`)
}

export function notFound(): never {
  throw new Error('Not Found')
}

export function useSelectedLayoutSegment() {
  const pathname = usePathname()
  const parts = pathname.split('/').filter(Boolean)
  return parts[parts.length - 1] || null
}

export function useSelectedLayoutSegments() {
  const pathname = usePathname()
  return useMemo(() => pathname.split('/').filter(Boolean), [pathname])
}

export function useServerInsertedHTML(callback: () => void) {
  useCallback(callback, [callback])
}
