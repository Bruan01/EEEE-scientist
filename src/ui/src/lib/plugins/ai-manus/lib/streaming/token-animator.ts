export type TokenizeOptions = {
  segmenter?: Intl.Segmenter
  skipTags?: Set<string>
  skipClassNames?: string[]
}

export type TokenizeResult = {
  tokens: HTMLSpanElement[]
  text: string
}

const DEFAULT_SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT'])
const DEFAULT_SKIP_CLASSES = [
  'ai-manus-code-actions',
  'ai-manus-code-copy',
  'ai-manus-code-toggle',
  'ds-token',
]

const hasAncestorTag = (node: Element | null, tags: Set<string>) => {
  let current = node
  while (current) {
    if (tags.has(current.tagName)) return true
    current = current.parentElement
  }
  return false
}

const hasSkipAncestor = (node: Node | null, skipTags: Set<string>, skipClasses: string[]) => {
  let current = node
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const element = current as Element
    if (skipTags.has(element.tagName)) return true
    if (element.getAttribute('data-no-tokenize') === 'true') return true
    if (skipClasses.length > 0) {
      for (const name of skipClasses) {
        if (element.classList.contains(name)) return true
      }
    }
    current = element.parentElement
  }
  return false
}

export const countTokensByTextLength = (tokens: HTMLSpanElement[], prefixLength: number) => {
  if (prefixLength <= 0) return 0
  let total = 0
  let count = 0
  for (const token of tokens) {
    const text = token.textContent ?? ''
    total += text.length
    count += 1
    if (total >= prefixLength) break
  }
  return count
}

export const tokenizeElement = (root: HTMLElement, options: TokenizeOptions = {}): TokenizeResult => {
  const segmenter =
    options.segmenter ??
    new Intl.Segmenter(undefined, {
      granularity: 'grapheme',
    })
  const skipTags = options.skipTags ?? DEFAULT_SKIP_TAGS
  const skipClasses = options.skipClassNames ?? DEFAULT_SKIP_CLASSES
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT
      if (!node.parentElement) return NodeFilter.FILTER_REJECT
      if (hasSkipAncestor(node.parentElement, skipTags, skipClasses)) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const textNodes: Text[] = []
  let current = walker.nextNode()
  while (current) {
    textNodes.push(current as Text)
    current = walker.nextNode()
  }

  const codeTags = new Set(['CODE', 'PRE'])
  const tableTags = new Set(['TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD'])

  for (const node of textNodes) {
    const value = node.nodeValue ?? ''
    if (!value) continue
    const parent = node.parentElement
    const inCode = parent ? hasAncestorTag(parent, codeTags) : false
    const inTable = parent ? hasAncestorTag(parent, tableTags) : false
    const fragment = document.createDocumentFragment()
    for (const segment of segmenter.segment(value)) {
      const span = document.createElement('span')
      span.className = inCode
        ? 'ds-token ds-token-code'
        : inTable
          ? 'ds-token ds-token-table'
          : 'ds-token'
      span.textContent = segment.segment
      fragment.appendChild(span)
    }
    node.parentNode?.replaceChild(fragment, node)
  }

  const tokens = Array.from(root.querySelectorAll<HTMLSpanElement>('span.ds-token'))
  tokens.forEach((token, index) => {
    token.dataset.tokenIndex = String(index)
  })

  return { tokens, text: root.textContent ?? '' }
}

export const revealTokens = (
  tokens: HTMLSpanElement[],
  startIndex: number,
  endIndex: number,
  options: { instant?: boolean } = {}
) => {
  const clampedEnd = Math.min(tokens.length, endIndex)
  for (let i = startIndex; i < clampedEnd; i += 1) {
    const token = tokens[i]
    if (!token) continue
    if (token.dataset.revealed === '1') continue
    token.dataset.revealed = '1'
    if (options.instant) {
      token.classList.add('ds-token-visible')
    } else {
      token.classList.add('ds-token-reveal')
    }
  }
  return clampedEnd
}
