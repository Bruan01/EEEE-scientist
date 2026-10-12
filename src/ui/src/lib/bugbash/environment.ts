import { getApiBaseUrl } from '@/lib/api/client'

const COMMIT_KEYS = [
  'NEXT_PUBLIC_COMMIT_HASH',
  'NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA',
  'NEXT_PUBLIC_GIT_COMMIT_SHA',
  'NEXT_PUBLIC_GIT_SHA',
]

export type FrontendEnvInfo = {
  exported_at: string
  app_version: string
  commit_hash: string
  api_base_url: string
  node_env: string
  origin?: string
  user_agent?: string
}

export function buildFrontendEnvInfo(): FrontendEnvInfo {
  const env = process.env
  const commit_hash = COMMIT_KEYS.map((key) => env[key]).find((value) => value) || 'unknown'
  return {
    exported_at: new Date().toISOString(),
    app_version: env.NEXT_PUBLIC_APP_VERSION || 'unknown',
    commit_hash,
    api_base_url: getApiBaseUrl(),
    node_env: env.NODE_ENV || 'unknown',
    origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  }
}
