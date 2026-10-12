import React from 'react'
import { Box, Text } from 'ink'
import { theme } from '../../semantic-colors.js'

export type SelectionItem<T> = {
  key: string
  label: string
  value: T
  disabled?: boolean
  description?: string
}

type SelectionListProps<T> = {
  items: Array<SelectionItem<T>>
  activeIndex: number
  scrollOffset: number
  maxItemsToShow: number
  showNumbers?: boolean
  showScrollArrows?: boolean
  renderValue?: (item: SelectionItem<T>) => React.ReactNode
}

export function SelectionList<T>({
  items,
  activeIndex,
  scrollOffset,
  maxItemsToShow,
  showNumbers = true,
  showScrollArrows = true,
  renderValue,
}: SelectionListProps<T>): React.JSX.Element {
  const visibleItems = items.slice(scrollOffset, scrollOffset + maxItemsToShow)
  const numberWidth = String(items.length).length
  const canScrollUp = showScrollArrows && scrollOffset > 0
  const canScrollDown =
    showScrollArrows && scrollOffset + maxItemsToShow < items.length

  return (
    <Box flexDirection="column">
      {showScrollArrows && (
        <Text color={canScrollUp ? theme.text.primary : theme.text.secondary}>^</Text>
      )}
      {visibleItems.map((item, index) => {
        const itemIndex = scrollOffset + index
        const isSelected = itemIndex === activeIndex
        const titleColor = item.disabled
          ? theme.text.secondary
          : isSelected
            ? theme.status.success
            : theme.text.primary
        const numberColor = isSelected ? theme.status.success : theme.text.secondary
        const itemNumber = `${String(itemIndex + 1).padStart(numberWidth, ' ')}.`

        return (
          <Box key={item.key} alignItems="center">
            <Box minWidth={2} flexShrink={0}>
              <Text color={isSelected ? theme.status.success : theme.text.primary}>
                {isSelected ? '>' : ' '}
              </Text>
            </Box>
            {showNumbers && (
              <Box minWidth={itemNumber.length} marginRight={1}>
                <Text color={numberColor}>{itemNumber}</Text>
              </Box>
            )}
            <Box flexGrow={1} flexDirection="row" justifyContent="space-between">
              <Text color={titleColor} wrap="truncate">
                {item.label}
              </Text>
              {renderValue ? <Box>{renderValue(item)}</Box> : null}
            </Box>
          </Box>
        )
      })}
      {showScrollArrows && (
        <Text color={canScrollDown ? theme.text.primary : theme.text.secondary}>v</Text>
      )}
    </Box>
  )
}
