'use client'

import { Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeContent, SpotlightCard } from '@/components/react-bits'
import { useI18n } from '@/lib/i18n/useI18n'

export function EmptyState({ onBind }: { onBind?: () => void }) {
  const { t } = useI18n('cli')

  return (
    <FadeContent duration={0.45} y={12}>
      <SpotlightCard
        className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-2xl border border-white/40 bg-white/60 p-8 text-center shadow-[0_8px_30px_rgba(32,32,32,0.08)] transition-all duration-300 motion-safe:hover:-translate-y-0.5"
        spotlightColor="rgba(143, 163, 184, 0.18)"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--cli-bg-2)] text-[var(--cli-ink-1)]">
          <Terminal className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[var(--cli-ink-1)]">{t('empty_title')}</h3>
          <p className="mt-1 text-sm text-[var(--cli-muted-1)]">
            {t('empty_desc')}
          </p>
        </div>
        <div className="w-full max-w-md space-y-2 rounded-xl border border-white/40 bg-white/70 px-4 py-3 text-left text-xs text-[var(--cli-muted-1)]">
          <div className="font-semibold text-[var(--cli-ink-1)]">{t('quick_start')}</div>
          <div>{t('quick_step_1')}</div>
          <div>{t('quick_step_2')}</div>
          <div>{t('quick_step_3')}</div>
        </div>
        {onBind ? (
          <Button onClick={onBind} className="rounded-full px-5">
            {t('bind_server')}
          </Button>
        ) : null}
      </SpotlightCard>
    </FadeContent>
  )
}
