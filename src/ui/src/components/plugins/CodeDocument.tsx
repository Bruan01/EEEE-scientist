function languageFromPath(path?: string) {
  const suffix = path?.split('.').pop()?.toLowerCase()
  if (!suffix) {
    return 'text'
  }
  if (suffix === 'py') return 'python'
  if (suffix === 'ts' || suffix === 'tsx') return 'typescript'
  if (suffix === 'js' || suffix === 'jsx') return 'javascript'
  if (suffix === 'md') return 'markdown'
  if (suffix === 'yml' || suffix === 'yaml') return 'yaml'
  if (suffix === 'json') return 'json'
  if (suffix === 'sh') return 'bash'
  return suffix
}

export function CodeDocument({
  content,
  path,
  highlightLine,
  highlightQuery,
}: {
  content: string
  path?: string
  highlightLine?: number
  highlightQuery?: string
}) {
  const lines = content.split('\n')
  const language = languageFromPath(path)
  const normalizedQuery = highlightQuery?.trim().toLowerCase() ?? ''

  const renderHighlightedLine = (line: string) => {
    if (!normalizedQuery) {
      return line || ' '
    }
    const lower = line.toLowerCase()
    const parts: Array<{ text: string; highlighted: boolean }> = []
    let cursor = 0
    while (cursor < line.length) {
      const found = lower.indexOf(normalizedQuery, cursor)
      if (found < 0) {
        parts.push({ text: line.slice(cursor), highlighted: false })
        break
      }
      if (found > cursor) {
        parts.push({ text: line.slice(cursor, found), highlighted: false })
      }
      parts.push({
        text: line.slice(found, found + normalizedQuery.length),
        highlighted: true,
      })
      cursor = found + normalizedQuery.length
    }
    if (parts.length === 0) {
      return line || ' '
    }
    return parts.map((part, index) =>
      part.highlighted ? (
        <mark
          key={`${index}-${part.text}`}
          className="rounded bg-[#f2d8a7] px-0.5 text-[#241c10]"
        >
          {part.text}
        </mark>
      ) : (
        <span key={`${index}-${part.text}`}>{part.text}</span>
      )
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between rounded-[22px] border border-black/10 bg-black/[0.03] px-4 py-2 text-xs text-muted-foreground dark:border-white/[0.12] dark:bg-white/[0.04]">
        <span>{path || 'untitled'}</span>
        <span>{language}</span>
      </div>
      <div className="feed-scrollbar min-h-0 flex-1 overflow-auto rounded-[28px] bg-[#13151a] px-0 py-4 text-[13px] leading-6 text-[#e7e2d9] shadow-card">
        {lines.map((line, index) => (
          <div
            key={`${index}-${line}`}
            className={`grid grid-cols-[56px_minmax(0,1fr)] gap-0 px-4 ${
              highlightLine === index + 1 ? 'bg-[#f2d8a7]/12' : ''
            }`}
          >
            <div
              className={`select-none pr-4 text-right ${
                highlightLine === index + 1 ? 'text-[#f2d8a7]' : 'text-[#6d7480]'
              }`}
            >
              {index + 1}
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono">
              {renderHighlightedLine(line)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}
