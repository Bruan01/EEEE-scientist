import React from 'react'
import { Text, Box } from 'ink'
import { theme } from '../semantic-colors.js'
import { colorizeCode } from './CodeColorizer.js'
import { TableRenderer } from './TableRenderer.js'
import { RenderInline } from './InlineMarkdownRenderer.js'

interface MarkdownDisplayProps {
  text: string
  isPending: boolean
  availableTerminalHeight?: number
  terminalWidth: number
  renderMarkdown?: boolean
  overrideColor?: string
}

const EMPTY_LINE_HEIGHT = 1
const CODE_BLOCK_PREFIX_PADDING = 1
const LIST_ITEM_PREFIX_PADDING = 1
const LIST_ITEM_TEXT_FLEX_GROW = 1

export const MarkdownDisplay: React.FC<MarkdownDisplayProps> = ({
  text,
  isPending,
  availableTerminalHeight,
  terminalWidth,
  renderMarkdown = true,
  overrideColor,
}) => {
  const responseColor = overrideColor ?? theme.text.response ?? theme.text.primary

  if (!text) return <></>

  if (!renderMarkdown) {
    if (!overrideColor) {
      const colorizedMarkdown = colorizeCode({
        code: text,
        language: 'markdown',
        availableHeight: availableTerminalHeight,
        maxWidth: terminalWidth - CODE_BLOCK_PREFIX_PADDING,
        hideLineNumbers: true,
      })
      return (
        <Box
          paddingLeft={CODE_BLOCK_PREFIX_PADDING}
          flexDirection="column"
          width={terminalWidth}
        >
          {colorizedMarkdown}
        </Box>
      )
    }
    return (
      <Box paddingLeft={CODE_BLOCK_PREFIX_PADDING} flexDirection="column" width={terminalWidth}>
        {text.split(/\r?\n/).map((line, index) => (
          <Text key={`plain-${index}`} color={responseColor}>
            {line}
          </Text>
        ))}
      </Box>
    )
  }

  const lines = text.split(/\r?\n/)
  const headerRegex = /^ *(#{1,4}) +(.*)/
  const codeFenceRegex = /^ *(`{3,}|~{3,}) *(\w*?) *$/
  const ulItemRegex = /^([ \t]*)([-*+]) +(.*)/
  const olItemRegex = /^([ \t]*)(\d+)\. +(.*)/
  const hrRegex = /^ *([-*_] *){3,} *$/
  const tableRowRegex = /^\s*\|(.+)\|\s*$/
  const tableSeparatorRegex = /^\s*\|?\s*(:?-+:?)\s*(\|\s*(:?-+:?)\s*)+\|?\s*$/

  const contentBlocks: React.ReactNode[] = []
  let inCodeBlock = false
  let lastLineEmpty = true
  let codeBlockContent: string[] = []
  let codeBlockLang: string | null = null
  let codeBlockFence = ''
  let inTable = false
  let tableRows: string[][] = []
  let tableHeaders: string[] = []

  const addContentBlock = (block: React.ReactNode) => {
    if (block) {
      contentBlocks.push(block)
      lastLineEmpty = false
    }
  }

  const renderCodeBlock = (
    content: string[],
    lang: string | null,
    key: string,
    height?: number
  ) => {
    if (overrideColor) {
      return (
        <Box
          key={key}
          flexDirection="column"
          paddingLeft={CODE_BLOCK_PREFIX_PADDING}
          width={terminalWidth}
        >
          {content.map((line, index) => (
            <Text key={`${key}-${index}`} color={responseColor}>
              {line}
            </Text>
          ))}
        </Box>
      )
    }
    return (
      <Box key={key} flexDirection="column" paddingLeft={CODE_BLOCK_PREFIX_PADDING} width={terminalWidth}>
        {colorizeCode({
          code: content.join('\n'),
          language: lang,
          availableHeight: height,
          maxWidth: terminalWidth - CODE_BLOCK_PREFIX_PADDING,
          hideLineNumbers: true,
        })}
      </Box>
    )
  }

  const renderListItem = (indent: string, bullet: string, content: string, key: string) => {
    const indentLength = indent.length
    return (
      <Box key={key} paddingLeft={indentLength + LIST_ITEM_PREFIX_PADDING}>
        <Text color={responseColor}>{`${bullet} `}</Text>
        <Box flexGrow={LIST_ITEM_TEXT_FLEX_GROW}>
          <Text wrap="wrap" color={responseColor}>
            <RenderInline text={content} defaultColor={responseColor} overrideColor={overrideColor} />
          </Text>
        </Box>
      </Box>
    )
  }

  lines.forEach((line, index) => {
    const key = `line-${index}`

    if (inCodeBlock) {
      const fenceMatch = line.match(codeFenceRegex)
      if (fenceMatch && fenceMatch[1].startsWith(codeBlockFence[0]) && fenceMatch[1].length >= codeBlockFence.length) {
        addContentBlock(
          renderCodeBlock(codeBlockContent, codeBlockLang, key, availableTerminalHeight)
        )
        inCodeBlock = false
        codeBlockContent = []
        codeBlockLang = null
        codeBlockFence = ''
      } else {
        codeBlockContent.push(line)
      }
      return
    }

    const codeFenceMatch = line.match(codeFenceRegex)
    const headerMatch = line.match(headerRegex)
    const ulMatch = line.match(ulItemRegex)
    const olMatch = line.match(olItemRegex)
    const hrMatch = line.match(hrRegex)
    const tableRowMatch = line.match(tableRowRegex)
    const tableSeparatorMatch = line.match(tableSeparatorRegex)

    if (codeFenceMatch) {
      inCodeBlock = true
      codeBlockFence = codeFenceMatch[1]
      codeBlockLang = codeFenceMatch[2] || null
    } else if (tableRowMatch && !inTable) {
      if (index + 1 < lines.length && lines[index + 1].match(tableSeparatorRegex)) {
        inTable = true
        tableHeaders = tableRowMatch[1].split('|').map((cell) => cell.trim())
        tableRows = []
      } else {
        addContentBlock(
          <Box key={key}>
            <Text wrap="wrap" color={responseColor}>
              <RenderInline text={line} defaultColor={responseColor} overrideColor={overrideColor} />
            </Text>
          </Box>
        )
      }
    } else if (inTable && tableSeparatorMatch) {
      return
    } else if (inTable && tableRowMatch) {
      const cells = tableRowMatch[1].split('|').map((cell) => cell.trim())
      while (cells.length < tableHeaders.length) {
        cells.push('')
      }
      if (cells.length > tableHeaders.length) {
        cells.length = tableHeaders.length
      }
      tableRows.push(cells)
    } else if (inTable && !tableRowMatch) {
      if (tableHeaders.length > 0 && tableRows.length > 0) {
        addContentBlock(
          <TableRenderer
            key={`table-${contentBlocks.length}`}
            headers={tableHeaders}
            rows={tableRows}
            terminalWidth={terminalWidth}
            overrideColor={overrideColor}
          />
        )
      }
      inTable = false
      tableRows = []
      tableHeaders = []
      if (line.trim().length > 0) {
        addContentBlock(
          <Box key={key}>
            <Text wrap="wrap" color={responseColor}>
              <RenderInline text={line} defaultColor={responseColor} />
            </Text>
          </Box>
        )
      }
    } else if (hrMatch) {
      addContentBlock(
        <Box key={key}>
          <Text color={overrideColor ? responseColor : undefined} dimColor={!overrideColor}>
            ---
          </Text>
        </Box>
      )
    } else if (headerMatch) {
      const level = headerMatch[1].length
      const headerText = headerMatch[2]
      const headerColor = overrideColor
        ? responseColor
        : level <= 2
          ? theme.text.link
          : responseColor
      let headerNode: React.ReactNode = null
      if (level <= 2) {
        headerNode = (
          <Text bold color={headerColor}>
            <RenderInline text={headerText} defaultColor={headerColor} overrideColor={overrideColor} />
          </Text>
        )
      } else {
        headerNode = (
          <Text bold color={headerColor}>
            <RenderInline text={headerText} defaultColor={headerColor} overrideColor={overrideColor} />
          </Text>
        )
      }
      addContentBlock(<Box key={key}>{headerNode}</Box>)
    } else if (ulMatch) {
      addContentBlock(renderListItem(ulMatch[1], ulMatch[2], ulMatch[3], key))
    } else if (olMatch) {
      addContentBlock(renderListItem(olMatch[1], `${olMatch[2]}.`, olMatch[3], key))
    } else if (line.trim().length === 0) {
      if (!lastLineEmpty) {
        addContentBlock(<Box key={key} height={EMPTY_LINE_HEIGHT} />)
        lastLineEmpty = true
      }
    } else {
      addContentBlock(
        <Box key={key}>
          <Text wrap="wrap" color={responseColor}>
            <RenderInline text={line} defaultColor={responseColor} overrideColor={overrideColor} />
          </Text>
        </Box>
      )
    }
  })

  if (inTable && tableHeaders.length > 0 && tableRows.length > 0) {
    addContentBlock(
      <TableRenderer
        key={`table-${contentBlocks.length}`}
        headers={tableHeaders}
        rows={tableRows}
        terminalWidth={terminalWidth}
        overrideColor={overrideColor}
      />
    )
  }

  return (
    <Box flexDirection="column" width={terminalWidth}>
      {contentBlocks}
    </Box>
  )
}
