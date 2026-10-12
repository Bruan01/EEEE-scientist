export function isMdxDocument(fileName?: string | null) {
  if (!fileName) return false
  return /\.mdx$/i.test(fileName.trim())
}

function stripFrontmatter(content: string) {
  if (!content.startsWith('---')) return content
  const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n?/)
  return match ? content.slice(match[0].length) : content
}

export function preprocessMarkdownDocument(
  content: string,
  options: { isMdx?: boolean } = {}
) {
  if (!options.isMdx) return content

  const withoutFrontmatter = stripFrontmatter(content)
  const lines = withoutFrontmatter.split(/\r?\n/)
  const nextLines: string[] = []
  let inFence = false
  let contentStarted = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (/^(```|~~~)/.test(trimmed)) {
      inFence = !inFence
      contentStarted = true
      nextLines.push(line)
      continue
    }

    if (inFence) {
      nextLines.push(line)
      continue
    }

    if (!contentStarted) {
      if (!trimmed) {
        continue
      }
      if (/^(import|export)\s/.test(trimmed)) {
        continue
      }
      if (/^\{\/\*.*\*\/\}$/.test(trimmed)) {
        continue
      }
      contentStarted = true
    }

    if (/^\{\/\*.*\*\/\}$/.test(trimmed)) {
      continue
    }

    nextLines.push(line)
  }

  return nextLines.join('\n')
}

