'use client'

export function LoadingIndicator({ text, compact }: { text?: string; compact?: boolean }) {
  const isCompact = Boolean(compact)
  return (
    <div
      className={
        isCompact
          ? 'flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]'
          : 'flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]'
      }
    >
      {text ? <span>{text}</span> : null}
      <span className="relative top-[4px] flex gap-1">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-[3px] w-[3px] rounded bg-[var(--icon-tertiary)] animate-bounce-dot"
            style={{ animationDelay: `${index * 200}ms` }}
          />
        ))}
      </span>
    </div>
  )
}

export default LoadingIndicator
