import { Gauge, Zap } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useInterfacePreferencesStore } from '@/lib/stores/interface-preferences'
import type { Locale } from '@/types'

const copy = {
  en: {
    title: 'Compact mode',
    description: 'Disable decorative page animations and transitions to make project pages feel more responsive.',
    enabled: 'On',
    disabled: 'Off',
    activeHint: 'Animations are skipped globally. Task logic, data, and layout are unchanged.',
    inactiveHint: 'The default visual effects are enabled.',
  },
  zh: {
    title: '精简模式',
    description: '关闭项目页面的装饰性动画与过渡，让操作更流畅、响应更直接。',
    enabled: '已开启',
    disabled: '未开启',
    activeHint: '全局跳过动画；任务逻辑、数据和页面布局不受影响。',
    inactiveHint: '当前使用默认视觉效果。',
  },
} satisfies Record<Locale, Record<string, string>>

export function CompactModeSettingsPanel({ locale }: { locale: Locale }) {
  const t = copy[locale]
  const compactMode = useInterfacePreferencesStore((state) => state.compactMode)
  const setCompactMode = useInterfacePreferencesStore((state) => state.setCompactMode)

  return (
    <section className="rounded-[24px] border border-black/[0.08] bg-white/[0.48] p-5 shadow-[0_18px_44px_-34px_rgba(45,42,38,0.3)] backdrop-blur-xl dark:border-white/[0.10] dark:bg-white/[0.04]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--ds-brand-subtle)] text-[var(--ds-brand)]">
            <Gauge className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{t.title}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{t.description}</p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={compactMode}
          aria-label={t.title}
          data-testid="compact-mode-toggle"
          onClick={() => setCompactMode(!compactMode)}
          className={cn(
            'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            compactMode
              ? 'border-[var(--ds-brand)] bg-[var(--ds-brand)]'
              : 'border-black/[0.12] bg-black/[0.08] dark:border-white/[0.16] dark:bg-white/[0.12]'
          )}
        >
          <span
            className={cn(
              'block h-5 w-5 rounded-full bg-white shadow-sm transition-transform dark:bg-slate-100',
              compactMode ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-black/[0.06] pt-3 text-xs text-muted-foreground dark:border-white/[0.08]">
        <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{compactMode ? t.activeHint : t.inactiveHint}</span>
        <span className="ml-auto shrink-0 font-medium text-foreground/70">{compactMode ? t.enabled : t.disabled}</span>
      </div>
    </section>
  )
}
