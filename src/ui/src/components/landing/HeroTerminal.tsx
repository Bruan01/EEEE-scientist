'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { Locale } from '@/types'
import { getHeroBundle } from './hero-content'

type SegmentType = 'blue' | 'red' | 'gradient'
type Segment = { start: number; end: number; type: SegmentType }

const WORD = 'DEEPSCIENTIST'

const LETTERS: Record<string, string[]> = {
  D: [
    '██████▓░ ',
    '██░░░▒█░ ',
    '██    █░ ',
    '██    █░ ',
    '██░░░▒█░ ',
    '██████▓░ ',
    '░░░░░░░░ ',
  ],
  E: [
    '██████▓░',
    '██░░░░░ ',
    '█████▓  ',
    '██░░░░  ',
    '██      ',
    '██████▓░',
    '░░░░░░░░',
  ],
  P: [
    '█████▓░ ',
    '██░░██░ ',
    '█████▓░ ',
    '██░░░   ',
    '██      ',
    '██      ',
    '░░      ',
  ],
  S: [
    '░█████▓░',
    '██░░░░░ ',
    '░████▓░ ',
    ' ░░░░██░',
    '     ██░',
    '█████▓░ ',
    '░░░░░░░ ',
  ],
  C: [
    '░█████▓░',
    '██░░░░░ ',
    '██      ',
    '██      ',
    '██░░░░  ',
    '░█████▓░',
    ' ░░░░░░░',
  ],
  I: [
    '██▓░',
    '██░ ',
    '██░ ',
    '██░ ',
    '██░ ',
    '██▓░',
    '░░░ ',
  ],
  N: [
    '██▓░  ██▓░',
    '███░  ██░ ',
    '██▓█░ ██░ ',
    '██░▓█░██░ ',
    '██░ ▓███░ ',
    '██░  ▓██▓░',
    '░░░  ░░░░ ',
  ],
  T: [
    '███████▓░',
    '░░░██░░░ ',
    '   ██░   ',
    '   ██░   ',
    '   ██░   ',
    '   ██▓░  ',
    '   ░░░   ',
  ],
}

const COLOR_SEGMENTS = [
  { start: 0, end: 3, type: 'blue' as const },
  { start: 4, end: 6, type: 'red' as const },
  { start: 7, end: 12, type: 'gradient' as const },
]

const buildSegmentedAscii = (
  letters: string[],
  gap: string
): { lines: string[]; segments: Segment[][] } => {
  const letterArrays = letters.map((char) => LETTERS[char] || LETTERS['I'])
  const numLines = letterArrays[0].length
  const lines: string[] = []
  const allSegments: Segment[][] = []

  for (let lineIdx = 0; lineIdx < numLines; lineIdx += 1) {
    let currentPos = 0
    const lineSegments: Segment[] = []
    const lineParts: string[] = []

    letterArrays.forEach((arr, letterIdx) => {
      const letterLine = arr[lineIdx]
      const letterStart = currentPos

      lineParts.push(letterLine)
      currentPos += letterLine.length

      if (letterIdx < letterArrays.length - 1) {
        lineParts.push(gap)
        currentPos += gap.length
      }

      const colorSegment = COLOR_SEGMENTS.find(
        (segment) => letterIdx >= segment.start && letterIdx <= segment.end
      )
      if (colorSegment) {
        const lastSeg = lineSegments[lineSegments.length - 1]
        if (lastSeg && lastSeg.type === colorSegment.type && lastSeg.end === letterStart) {
          lastSeg.end = currentPos
        } else {
          lineSegments.push({
            start: letterStart,
            end: letterStart + letterLine.length,
            type: colorSegment.type,
          })
        }
      }
    })

    lines.push(lineParts.join(''))
    allSegments.push(lineSegments)
  }

  return { lines, segments: allSegments }
}

const ASCII_LOGO = buildSegmentedAscii(WORD.split(''), '')

const renderSegmentedLine = (line: string, segments: Segment[]) => {
  const parts: ReactNode[] = []
  const sortedSegments = [...segments].sort((a, b) => a.start - b.start)
  let lastEnd = 0

  sortedSegments.forEach((segment, index) => {
    if (segment.start > lastEnd) {
      parts.push(
        <span key={`gap-${index}`}>{line.slice(lastEnd, segment.start)}</span>
      )
    }
    const text = line.slice(segment.start, segment.end)
    const className =
      segment.type === 'blue'
        ? 'text-[#2B5B7E]'
        : segment.type === 'red'
          ? 'text-[#7A2E2E]'
          : 'text-[#2D2A26]'
    parts.push(
      <span key={`seg-${index}`} className={className}>
        {text}
      </span>
    )
    lastEnd = segment.end
  })

  if (lastEnd < line.length) {
    parts.push(<span key="tail">{line.slice(lastEnd)}</span>)
  }

  return <span>{parts}</span>
}

type HeroTerminalProps = {
  className?: string
  activeIndex?: number
  locale: Locale
}

export default function HeroTerminal({ className, activeIndex = 0, locale }: HeroTerminalProps) {
  const hero = getHeroBundle(locale)
  const safeIndex = Math.min(Math.max(activeIndex, 0), hero.researchSteps.length - 1)
  const activeStep = hero.researchSteps[safeIndex] ?? hero.researchSteps[0]
  const lines = [...hero.terminalIntro, ...activeStep.terminal]
  const statusLine = locale === 'zh' ? '模式   remote    同步   connected    用户   guest' : 'MODE   remote    SYNC   connected    USER   guest'
  const focusLine = locale === 'zh' ? `聚焦   ${activeStep.title}` : `FOCUS  ${activeStep.title.toUpperCase()}`

  return (
    <div
      className={cn(
        'rounded-2xl border border-black/10 bg-white/60 shadow-[0_20px_50px_-30px_rgba(45,42,38,0.35)]',
        'backdrop-blur-lg',
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-black/10 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-[#7E8B97]">
        <span>DeepScientist CLI</span>
        <span>{locale === 'zh' ? '会话 01' : 'Session 01'}</span>
      </div>
      <div className="rounded-b-2xl bg-[#FBF8F2]/95 px-3 py-3 font-mono text-[11px] leading-relaxed text-[#2D2A26]">
        <div className="ds-terminal-ascii space-y-0.5 overflow-hidden text-[8px]">
          {ASCII_LOGO.lines.map((line, idx) => (
            <div key={`ascii-${idx}`} className="whitespace-pre leading-[0.9]">
              {renderSegmentedLine(line, ASCII_LOGO.segments[idx])}
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-0.5 text-[10px] text-[#6F6B66]">
          <div className="whitespace-pre">{statusLine}</div>
          <div className="whitespace-pre text-[#7E8B97]">{focusLine}</div>
        </div>
        <div key={activeStep.id} className="ds-terminal-block mt-3 space-y-1">
          {lines.map((line, index) => {
            const trimmed = line.trim()
            const isCommand = trimmed.startsWith('>')
            const isComment = trimmed.startsWith('#') || trimmed.startsWith('//')
            const lineClass = cn(
              'ds-terminal-line',
              isCommand && 'text-[#7A5B22]',
              isComment && 'text-[#9FB1C2]'
            )

            return (
              <div key={`${line}-${index}`} className={lineClass}>
                {line || <span className="opacity-40">&nbsp;</span>}
              </div>
            )
          })}
          <div className="flex items-center gap-1 text-[#7A5B22]">
            <span>&gt;</span>
            <span className="ds-terminal-cursor">|</span>
          </div>
        </div>
      </div>
    </div>
  )
}
