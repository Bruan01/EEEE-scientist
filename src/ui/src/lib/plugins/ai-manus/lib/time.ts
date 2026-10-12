export function formatRelativeTime(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return ''
  const time = timestamp < 1e12 ? timestamp * 1000 : timestamp
  const now = Date.now()
  const diff = Math.max(0, now - time)
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)

  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`

  return new Date(time).toLocaleDateString()
}

function padTime(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatSessionTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return ''
  const time = timestamp < 1e12 ? timestamp * 1000 : timestamp
  const date = new Date(time)
  const now = new Date()
  const sameYear = date.getFullYear() === now.getFullYear()
  const sameDay = sameYear && date.toDateString() === now.toDateString()

  if (!sameYear) {
    return String(date.getFullYear())
  }
  if (!sameDay) {
    return `${padTime(date.getMonth() + 1)}-${padTime(date.getDate())}`
  }
  return `${padTime(date.getHours())}:${padTime(date.getMinutes())}`
}
