'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n/useI18n'

export function TerminalSearchBar({
  onSearch,
  onClose,
}: {
  onSearch: (query: string) => void
  onClose: () => void
}) {
  const { t } = useI18n('cli')
  const [query, setQuery] = useState('')

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-3 py-1.5 text-sm">
      <Search className="h-4 w-4 text-[var(--cli-muted-1)]" />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSearch(query)
        }}
        placeholder={t('search_output')}
        aria-label={t('search_terminal_output')}
        className="cli-focus-ring flex-1 bg-transparent text-[var(--cli-ink-1)] outline-none"
      />
      <button
        type="button"
        onClick={() => {
          setQuery('')
          onClose()
        }}
        className="cli-focus-ring text-[var(--cli-muted-1)] hover:text-[var(--cli-ink-1)]"
        aria-label={t('close_search')}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
