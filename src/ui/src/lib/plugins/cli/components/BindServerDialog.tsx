'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { copyToClipboard } from '@/lib/clipboard'
import { apiClient } from '@/lib/api/client'
import { getMyToken } from '@/lib/api/auth'
import { useI18n } from '@/lib/i18n/useI18n'

export function BindServerDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useI18n('cli')
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'install' | 'login' | null>(null)
  const apiBaseUrl = (apiClient.defaults.baseURL || '').replace(/\/$/, '')
  const serverUrl =
    apiBaseUrl ||
    (process.env.NEXT_PUBLIC_API_URL || 'http://deepscientist.cc:8080')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    setToken(null)
    setCopied(null)
    getMyToken()
      .then((data: { api_token: string }) => {
        if (cancelled) return
        setToken(data.api_token)
      })
      .catch(() => {
        if (cancelled) return
        setError(t('token_load_error'))
      })
      .finally(() => {
        if (cancelled) return
        setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, t])

  const handleCopy = async (variant: 'install' | 'login', command: string) => {
    if (!token) return
    await copyToClipboard(command)
    setCopied(variant)
    window.setTimeout(() => setCopied(null), 1500)
  }

  const installCommand = token ? `bash install.sh --token ${token} --server ${serverUrl}` : ''
  const loginCommand = token
    ? `ds-cli login --token ${token} --server ${serverUrl}\n` + `ds-cli start --ws-url ${serverUrl}`
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cli-root max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('bind_remote_server_title')}</DialogTitle>
          <DialogDescription>{t('bind_remote_server_desc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {error ? (
            <div className="rounded-xl border border-black/5 bg-[var(--cli-bg-1)] p-3 text-sm text-[var(--cli-ink-1)]">
              {error}
            </div>
          ) : null}

          <div className="rounded-xl border border-black/5 bg-white/70 p-3 text-sm text-[var(--cli-ink-1)]">
            <div className="font-semibold">{t('bind_option_install_title')}</div>
            <code className="mt-2 block rounded-lg bg-black/90 px-3 py-2 text-xs text-white break-all">
              {isLoading ? t('loading_token') : installCommand || t('token_unavailable')}
            </code>
            <p className="mt-2 text-xs text-[var(--cli-muted-1)]">
              {t('bind_option_install_desc')}
            </p>
            <p className="mt-2 text-xs text-[var(--cli-muted-1)]">
              {t('bind_option_custom_dir', {
                example: 'bash install.sh --dir ~/.deepscientist --token ...',
              })}
            </p>
            <p className="mt-2 text-xs text-[var(--cli-muted-1)]">
              {t('bind_option_local_codeagent')}
            </p>
            <Button
              className="mt-3"
              size="sm"
              variant="secondary"
              onClick={() => handleCopy('install', installCommand)}
              disabled={!token}
            >
              {copied === 'install' ? t('copied') : t('copy_install_command')}
            </Button>
          </div>

          <div className="rounded-xl border border-black/5 bg-white/70 p-3 text-sm text-[var(--cli-ink-1)]">
            <div className="font-semibold">{t('bind_option_login_title')}</div>
            <code className="mt-2 block rounded-lg bg-black/90 px-3 py-2 text-xs text-white whitespace-pre-line break-all">
              {isLoading ? t('loading_token') : loginCommand || t('token_unavailable')}
            </code>
            <p className="mt-2 text-xs text-[var(--cli-muted-1)]">
              {t('bind_option_login_desc')}
            </p>
            <Button
              className="mt-3"
              size="sm"
              variant="secondary"
              onClick={() => handleCopy('login', loginCommand)}
              disabled={!token}
            >
              {copied === 'login' ? t('copied') : t('copy_login_command')}
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button onClick={() => onOpenChange(false)}>{t('done')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
