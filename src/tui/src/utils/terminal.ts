const readFlag = (...names: string[]) => {
  for (const name of names) {
    const value = process.env[name]
    if (value !== undefined) {
      return String(value).toLowerCase()
    }
  }
  return ''
}

export const isAlternateBufferEnabled = (): boolean => {
  if (!process.stdout.isTTY) return false
  const raw = readFlag('DEEPSCIENTIST_ALT_BUFFER', 'RESEAR_ALT_BUFFER')
  if (raw === '1' || raw === 'true' || raw === 'yes') return true
  if (raw === '0' || raw === 'false' || raw === 'no') return false
  return true
}

export const isIncrementalRenderingEnabled = (): boolean => {
  if (!process.stdout.isTTY) return false
  const raw = readFlag('DEEPSCIENTIST_INCREMENTAL_RENDER', 'RESEAR_INCREMENTAL_RENDER')
  if (raw === '0' || raw === 'false' || raw === 'no') return false
  if (raw === '1' || raw === 'true' || raw === 'yes') return true
  return true
}
