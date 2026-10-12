export type PatchFileEntry = {
  path: string
  changeType: 'create' | 'update' | 'delete' | 'move'
  diffLines: string[]
  moveTo?: string
}

type ParseState = {
  index: number
  lines: string[]
}

const BEGIN_MARKER = '*** Begin Patch'
const END_MARKER = '*** End Patch'
const ADD_MARKER = '*** Add File: '
const DELETE_MARKER = '*** Delete File: '
const UPDATE_MARKER = '*** Update File: '
const MOVE_MARKER = '*** Move to: '
const EOF_MARKER = '*** End of File'

const isSectionHeader = (line: string) => line.startsWith('*** ')

const takeWhile = (state: ParseState, predicate: (line: string) => boolean) => {
  const collected: string[] = []
  while (state.index < state.lines.length) {
    const line = state.lines[state.index]
    if (!predicate(line)) break
    collected.push(line)
    state.index += 1
  }
  return collected
}

const normalizePath = (value: string) => value.trim().replace(/^\/+/, '')

const extractChangeLines = (rawLines: string[]) =>
  rawLines.filter((line) => {
    if (!line) return true
    const head = line[0]
    return head === '@' || head === '+' || head === '-' || head === ' '
  })

export function mergeApplyPatchChanges(changes: Array<{ patch: string }>): string {
  if (!Array.isArray(changes) || changes.length === 0) return ''
  const mergedLines: string[] = []
  changes.forEach((change) => {
    const rawPatch = typeof change?.patch === 'string' ? change.patch : ''
    if (!rawPatch.trim()) return
    rawPatch.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim()
      if (trimmed === BEGIN_MARKER || trimmed === END_MARKER) return
      mergedLines.push(line)
    })
  })
  if (mergedLines.length === 0) return ''
  return [BEGIN_MARKER, ...mergedLines, END_MARKER].join('\n')
}

export function parseApplyPatchFiles(patch: string): PatchFileEntry[] {
  const lines = patch ? patch.split(/\r?\n/) : []
  const state: ParseState = { index: 0, lines }
  if (state.lines.length === 0) return []

  const files: PatchFileEntry[] = []

  while (state.index < state.lines.length) {
    const line = state.lines[state.index]
    if (!line) {
      state.index += 1
      continue
    }
    const trimmed = line.trim()
    if (trimmed === BEGIN_MARKER || trimmed === END_MARKER) {
      state.index += 1
      continue
    }

    if (line.startsWith(ADD_MARKER)) {
      const path = normalizePath(line.slice(ADD_MARKER.length))
      state.index += 1
      const rawLines = takeWhile(state, (entry) => !isSectionHeader(entry))
      const diffLines = extractChangeLines(
        rawLines.map((entry) => (entry.startsWith('+') ? entry : `+${entry}`))
      )
      files.push({ path, changeType: 'create', diffLines })
      continue
    }

    if (line.startsWith(DELETE_MARKER)) {
      const path = normalizePath(line.slice(DELETE_MARKER.length))
      state.index += 1
      files.push({ path, changeType: 'delete', diffLines: [] })
      continue
    }

    if (line.startsWith(UPDATE_MARKER)) {
      const path = normalizePath(line.slice(UPDATE_MARKER.length))
      state.index += 1
      let moveTo: string | undefined
      if (state.lines[state.index]?.startsWith(MOVE_MARKER)) {
        moveTo = normalizePath(state.lines[state.index].slice(MOVE_MARKER.length))
        state.index += 1
      }
      const rawLines = takeWhile(state, (entry) => !isSectionHeader(entry))
      const diffLines = extractChangeLines(
        rawLines.filter((entry) => entry !== EOF_MARKER)
      )
      files.push({
        path,
        changeType: moveTo ? 'move' : 'update',
        diffLines,
        moveTo,
      })
      continue
    }

    state.index += 1
  }

  return files
}
