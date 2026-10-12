import {
  DEFAULT_USER_AVATAR_SRC,
  DEFAULT_USER_AVATAR_SRC_INVERTED,
} from '@/lib/constants/assets'
import { useThemeStore } from '@/lib/stores/theme'

type AvatarSourceUser = {
  avatar_url?: string | null
  google_picture?: string | null
}

export function getUserAvatarSrc(
  user?: AvatarSourceUser | null,
  fallback: string = DEFAULT_USER_AVATAR_SRC
) {
  if (!user) return fallback
  return user.avatar_url || user.google_picture || fallback
}

export function useUserAvatarSrc(user?: AvatarSourceUser | null, fallback?: string) {
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme)
  const themeFallback =
    resolvedTheme === 'dark' ? DEFAULT_USER_AVATAR_SRC_INVERTED : DEFAULT_USER_AVATAR_SRC

  return getUserAvatarSrc(user, fallback ?? themeFallback)
}
