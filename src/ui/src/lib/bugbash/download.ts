export function buildExportFilename(prefix: string, suffix?: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const normalizedSuffix = suffix ? `-${suffix}` : ''
  return `${prefix}${normalizedSuffix}-${stamp}.json`
}

export function downloadJsonFile(data: unknown, filename: string): void {
  if (typeof document === 'undefined') return
  const text = JSON.stringify(data, null, 2)
  const blob = new Blob([text], { type: 'application/json' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(url), 500)
}
