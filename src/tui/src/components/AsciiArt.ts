/**
 * ASCII Art for EEEE Scientist CLI
 * Inspired by Gemini CLI style with segmented colors:
 * - DEEP: Blue
 * - SCI: Red
 * - ENTIST: Purple gradient
 *
 * Features 3D shadow effect using ░ characters
 */

export const PROMPT_SYMBOL: string[] = [
  '█░    ',
  '██░   ',
  '███░  ',
  '████░ ',
  '███░  ',
  '██░   ',
  '█░    ',
]

export const LETTERS: Record<string, string[]> = {
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

export const COLOR_SEGMENTS = [
  { start: 0, end: 3, type: 'blue' as const },
  { start: 4, end: 6, type: 'red' as const },
  { start: 7, end: 12, type: 'gradient' as const },
]

export const WORD = 'DEEPSCIENTIST'

export const buildSegmentedAscii = (
  letters: string[],
  gap: string
): { lines: string[]; segments: { start: number; end: number; type: string }[][] } => {
  const letterArrays = letters.map((char) => LETTERS[char] || LETTERS.I)
  const numLines = letterArrays[0].length
  const lines: string[] = []
  const allSegments: { start: number; end: number; type: string }[][] = []

  for (let lineIdx = 0; lineIdx < numLines; lineIdx++) {
    let currentPos = 0
    const lineSegments: { start: number; end: number; type: string }[] = []
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

      const colorSegment = COLOR_SEGMENTS.find((segment) => letterIdx >= segment.start && letterIdx <= segment.end)
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

type SegmentType = 'blue' | 'red' | 'gradient'
type SegmentToken = { text: string; type?: SegmentType }

const buildSegmentedBlock = (
  rows: SegmentToken[][]
): { lines: string[]; segments: { start: number; end: number; type: string }[][] } => {
  const lines: string[] = []
  const allSegments: { start: number; end: number; type: string }[][] = []

  rows.forEach((row) => {
    let currentPos = 0
    let line = ''
    const lineSegments: { start: number; end: number; type: string }[] = []

    row.forEach((token) => {
      const { text, type } = token
      if (!text) return
      if (type) {
        const start = currentPos
        const end = currentPos + text.length
        const lastSeg = lineSegments[lineSegments.length - 1]
        if (lastSeg && lastSeg.type === type && lastSeg.end === start) {
          lastSeg.end = end
        } else {
          lineSegments.push({ start, end, type })
        }
      }
      line += text
      currentPos += text.length
    })

    lines.push(line)
    allSegments.push(lineSegments)
  })

  return { lines, segments: allSegments }
}

export const scientistAsciiData = buildSegmentedBlock([
  [
    { text: ' *  ' },
    { text: '▐▛███▜▌', type: 'gradient' },
    { text: '  *' },
  ],
  [
    { text: '*  ' },
    { text: '▝▜█████▛▘', type: 'gradient' },
    { text: '  ' },
  ],
  [
    { text: '  ' },
    { text: ' ▐', type: 'blue' },
    { text: '█', type: 'gradient' },
    { text: '⚗', type: 'red' },
    { text: '█', type: 'gradient' },
    { text: '▌', type: 'blue' },
    { text: ' *' },
  ],
  [
    { text: ' *  ' },
    { text: '▘▘', type: 'gradient' },
    { text: ' ' },
    { text: '▝▝', type: 'gradient' },
    { text: '  ' },
  ],
])

export const scientistDetailedData = buildSegmentedBlock([
  [
    { text: '  *  ' },
    { text: '┌─────┐', type: 'blue' },
    { text: '   *' },
  ],
  [
    { text: ' *   ' },
    { text: '│', type: 'blue' },
    { text: '◠', type: 'gradient' },
    { text: ' _ ', type: 'blue' },
    { text: '◠', type: 'gradient' },
    { text: '│', type: 'blue' },
    { text: '   ' },
  ],
  [
    { text: '     ' },
    { text: '│', type: 'blue' },
    { text: '  ◡  ', type: 'gradient' },
    { text: '│', type: 'blue' },
    { text: '  *' },
  ],
  [
    { text: '   ' },
    { text: '┌─┴─────┴─┐', type: 'blue' },
    { text: '  ' },
  ],
  [
    { text: ' * ' },
    { text: '│', type: 'blue' },
    { text: '  ', type: 'gradient' },
    { text: '⚗', type: 'red' },
    { text: '  ', type: 'gradient' },
    { text: '│', type: 'blue' },
    { text: '📊', type: 'gradient' },
    { text: ' ' },
  ],
  [
    { text: '   ' },
    { text: '└────┬────┘', type: 'blue' },
    { text: '  ' },
  ],
  [
    { text: '  *    ' },
    { text: '┴', type: 'gradient' },
    { text: '    *' },
  ],
])

export const robotAsciiData = buildSegmentedBlock([
  [
    { text: '  *  ' },
    { text: '╭─┬─╮', type: 'blue' },
    { text: '  *' },
  ],
  [
    { text: ' *   ' },
    { text: '│', type: 'blue' },
    { text: '◉ ◉', type: 'gradient' },
    { text: '│', type: 'blue' },
    { text: '   ' },
  ],
  [
    { text: '     ' },
    { text: '│', type: 'blue' },
    { text: ' ▔ ', type: 'red' },
    { text: '│', type: 'blue' },
    { text: ' * ' },
  ],
  [
    { text: '   ' },
    { text: '╰┬───┬╯', type: 'blue' },
    { text: '  ' },
  ],
  [
    { text: ' *  ' },
    { text: '│', type: 'gradient' },
    { text: '   ' },
    { text: '│', type: 'gradient' },
    { text: ' * ' },
  ],
])

export const longAsciiData = buildSegmentedAscii(WORD.split(''), ' ')
export const shortAsciiData = buildSegmentedAscii(['D', 'S'], ' ')
export const longAsciiLogo = longAsciiData.lines.join('\n')
export const shortAsciiLogo = shortAsciiData.lines.join('\n')
export const tinyAsciiLogo = WORD
