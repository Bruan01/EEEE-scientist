'use client'

import type { MarkdownHeading } from './types'

export function slugifyHeading(text: string): string {
  const base = text
    .toLowerCase()
    .trim()
    // Keep unicode letters/numbers (incl. 中文); drop punctuation/symbols.
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
  return base || 'section'
}

export function normalizeHeadingText(raw: string): string {
  return raw
    .replace(/\s+#+\s*$/, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = []
  const seen = new Map<string, number>()

  const lines = markdown.split('\n')
  let inCode = false

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (line.trim().startsWith('```')) {
      inCode = !inCode
      continue
    }
    if (inCode) continue

    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line)
    if (!match) continue

    const level = match[1].length
    const text = normalizeHeadingText(match[2])
    if (!text) continue

    const base = slugifyHeading(text)
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    const id = count === 1 ? base : `${base}-${count}`

    headings.push({ id, text, level })
  }

  return headings
}

export function resolveRelativePosixPath(baseFilePath: string, relativePath: string): string {
  const normalizedRelative = relativePath.replace(/\\/g, '/')
  if (!baseFilePath) return normalizedRelative.replace(/^\/+/, '')

  const baseDir = baseFilePath.includes('/')
    ? baseFilePath.split('/').slice(0, -1).join('/')
    : ''

  const fromRoot = normalizedRelative.startsWith('/')
  const baseParts = fromRoot ? [] : baseDir.split('/').filter(Boolean)
  const relParts = normalizedRelative.replace(/^\/+/, '').split('/').filter(Boolean)

  const out: string[] = [...baseParts]
  for (const part of relParts) {
    if (part === '.') continue
    if (part === '..') {
      out.pop()
      continue
    }
    out.push(part)
  }
  return out.join('/')
}
