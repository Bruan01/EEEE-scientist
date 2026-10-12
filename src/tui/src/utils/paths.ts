import os from 'node:os'

export const tildeifyPath = (input: string): string => {
  const home = os.homedir().replace(/\\/g, '/')
  const normalized = input.replace(/\\/g, '/')
  if (normalized.startsWith(home)) {
    return `~${normalized.slice(home.length)}`
  }
  return input
}

export const shortenPath = (input: string, maxLength: number): string => {
  if (input.length <= maxLength) return input
  if (maxLength <= 5) return input.slice(0, maxLength)
  const keepStart = Math.max(1, Math.floor((maxLength - 3) * 0.6))
  const keepEnd = Math.max(1, maxLength - 3 - keepStart)
  return `${input.slice(0, keepStart)}...${input.slice(-keepEnd)}`
}
