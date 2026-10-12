import React from 'react'
import { Text, Box } from 'ink'
import { theme } from '../semantic-colors.js'
import { RenderInline, getPlainTextLength } from './InlineMarkdownRenderer.js'

interface TableRendererProps {
  headers: string[]
  rows: string[][]
  terminalWidth: number
  overrideColor?: string
}

export const TableRenderer: React.FC<TableRendererProps> = ({
  headers,
  rows,
  terminalWidth,
  overrideColor,
}) => {
  const textColor = overrideColor ?? theme.text.primary
  const headerColor = overrideColor ?? theme.text.link
  const borderColor = overrideColor ?? theme.border.default
  const columnWidths = headers.map((header, index) => {
    const headerWidth = getPlainTextLength(header)
    const maxRowWidth = Math.max(...rows.map((row) => getPlainTextLength(row[index] || '')))
    return Math.max(headerWidth, maxRowWidth) + 2
  })

  const totalWidth = columnWidths.reduce((sum, width) => sum + width + 1, 1)
  const scaleFactor = totalWidth > terminalWidth ? terminalWidth / totalWidth : 1
  const adjustedWidths = columnWidths.map((width) => Math.floor(width * scaleFactor))

  const renderCell = (content: string, width: number, isHeader = false): React.ReactNode => {
    const contentWidth = Math.max(0, width - 2)
    const displayWidth = getPlainTextLength(content)

    let cellContent = content
    if (displayWidth > contentWidth) {
      if (contentWidth <= 3) {
        cellContent = content.substring(0, Math.min(content.length, contentWidth))
      } else {
        let left = 0
        let right = content.length
        let bestTruncated = content

        while (left <= right) {
          const mid = Math.floor((left + right) / 2)
          const candidate = content.substring(0, mid)
          const candidateWidth = getPlainTextLength(candidate)

          if (candidateWidth <= contentWidth - 3) {
            bestTruncated = candidate
            left = mid + 1
          } else {
            right = mid - 1
          }
        }

        cellContent = bestTruncated + '...'
      }
    }

    const actualDisplayWidth = getPlainTextLength(cellContent)
    const paddingNeeded = Math.max(0, contentWidth - actualDisplayWidth)

    return (
      <Text>
        {isHeader ? (
          <Text bold color={headerColor}>
            <RenderInline text={cellContent} overrideColor={overrideColor} />
          </Text>
        ) : (
          <RenderInline text={cellContent} defaultColor={textColor} overrideColor={overrideColor} />
        )}
        {' '.repeat(paddingNeeded)}
      </Text>
    )
  }

  const renderBorder = (type: 'top' | 'middle' | 'bottom'): React.ReactNode => {
    const chars = {
      top: { left: '┌', middle: '┬', right: '┐', horizontal: '─' },
      middle: { left: '├', middle: '┼', right: '┤', horizontal: '─' },
      bottom: { left: '└', middle: '┴', right: '┘', horizontal: '─' },
    }

    const char = chars[type]
    const borderParts = adjustedWidths.map((w) => char.horizontal.repeat(w))
    const border = char.left + borderParts.join(char.middle) + char.right
    return <Text color={borderColor}>{border}</Text>
  }

  const renderRow = (cells: string[], isHeader = false): React.ReactNode => {
    const renderedCells = cells.map((cell, index) => {
      const width = adjustedWidths[index] || 0
      return renderCell(cell || '', width, isHeader)
    })

    return (
      <Text color={textColor}>
        │{' '}
        {renderedCells.map((cell, index) => (
          <React.Fragment key={index}>
            {cell}
            {index < renderedCells.length - 1 ? ' │ ' : ''}
          </React.Fragment>
        ))}{' '}
        │
      </Text>
    )
  }

  return (
    <Box flexDirection="column" marginY={1}>
      {renderBorder('top')}
      {renderRow(headers, true)}
      {renderBorder('middle')}
      {rows.map((row, index) => (
        <React.Fragment key={index}>{renderRow(row)}</React.Fragment>
      ))}
      {renderBorder('bottom')}
    </Box>
  )
}
