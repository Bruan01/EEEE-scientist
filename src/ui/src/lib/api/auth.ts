import { apiClient } from '@/lib/api/client'
import type { UILanguage } from '@/lib/i18n/types'
import { useAuthStore } from '@/lib/stores/auth'

type AuthUser = {
  id: string
  email: string
  username: string
  role: string
  user_type: string
  ui_language?: UILanguage
  nationality?: string | null
  google_picture?: string | null
  avatar_url?: string | null
}

type TokenRefreshResponse = {
  access_token: string
  token_type: string
  user: AuthUser
}

type RotateTokenResponse = {
  api_token: string
  access_token: string
  token_type: string
  user: AuthUser
  created_at?: string | null
  last_used_at?: string | null
  message?: string | null
}

export type MyTokenResponse = {
  api_token: string
  created_at?: string | null
  last_used_at?: string | null
  message?: string | null
}

let refreshPromise: Promise<string | null> | null = null

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const response = await apiClient.post('/api/v1/auth/refresh')
      const data = response.data as TokenRefreshResponse
      if (!data?.access_token) return null

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('ds_access_token', data.access_token)
        window.dispatchEvent(new CustomEvent('auth:token-refreshed'))
      }

      if (data.user) {
        useAuthStore.getState().setAuth(data.user, data.access_token)
      }

      return data.access_token
    } catch (error) {
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export async function getMyToken(): Promise<MyTokenResponse> {
  const response = await apiClient.get('/api/v1/auth/my-token')
  return response.data as MyTokenResponse
}

export async function rotateMyToken(currentToken: string): Promise<RotateTokenResponse> {
  const response = await apiClient.post('/api/v1/auth/my-token/rotate', {
    current_token: currentToken,
  })
  const data = response.data as RotateTokenResponse

  if (typeof window !== 'undefined' && data?.api_token) {
    window.localStorage.setItem('deepscientist_api_token', data.api_token)
  }

  if (data?.access_token && data?.user) {
    useAuthStore.getState().setAuth(data.user, data.access_token)
  }

  return data
}
