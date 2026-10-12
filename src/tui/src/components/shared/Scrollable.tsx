import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Box, getInnerHeight, getScrollHeight, type DOMElement } from 'ink'
import { theme } from '../../semantic-colors.js'

export type ScrollState = {
  scrollTop: number
  scrollHeight: number
  innerHeight: number
}

export type ScrollableHandle = {
  scrollBy: (delta: number) => void
  scrollTo: (scrollTop: number) => void
  getScrollState: () => ScrollState
}

type ScrollableProps = {
  children?: React.ReactNode
  width?: number
  height?: number | string
  maxWidth?: number
  maxHeight?: number
  scrollToBottom?: boolean
  onScrollState?: (state: ScrollState) => void
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export const Scrollable = forwardRef<ScrollableHandle, ScrollableProps>(
  (
    {
      children,
      width,
      height,
      maxWidth,
      maxHeight,
      scrollToBottom = false,
      onScrollState,
    },
    ref
  ) => {
    const boxRef = useRef<DOMElement>(null)
    const [scrollTop, setScrollTop] = useState(0)
    const scrollTopRef = useRef(0)
    const [size, setSize] = useState({ innerHeight: 0, scrollHeight: 0 })
    const sizeRef = useRef(size)
    const childrenCountRef = useRef(0)

    const getScrollState = useCallback(
      (): ScrollState => ({
        scrollTop: scrollTopRef.current,
        scrollHeight: sizeRef.current.scrollHeight,
        innerHeight: sizeRef.current.innerHeight,
      }),
      []
    )

    const emitScrollState = useCallback(
      (state?: ScrollState) => {
        if (!onScrollState) return
        onScrollState(state ?? getScrollState())
      },
      [getScrollState, onScrollState]
    )

    const setScrollTopSafe = useCallback(
      (next: number) => {
        const { innerHeight, scrollHeight } = sizeRef.current
        const maxScroll = Math.max(0, scrollHeight - innerHeight)
        const clamped = clamp(next, 0, maxScroll)
        scrollTopRef.current = clamped
        setScrollTop(clamped)
        emitScrollState({
          scrollTop: clamped,
          scrollHeight,
          innerHeight,
        })
      },
      [emitScrollState]
    )

    const scrollBy = useCallback(
      (delta: number) => {
        setScrollTopSafe(scrollTopRef.current + delta)
      },
      [setScrollTopSafe]
    )

    const scrollTo = useCallback(
      (value: number) => {
        setScrollTopSafe(value)
      },
      [setScrollTopSafe]
    )

    useImperativeHandle(
      ref,
      () => ({
        scrollBy,
        scrollTo,
        getScrollState,
      }),
      [getScrollState, scrollBy, scrollTo]
    )

    useLayoutEffect(() => {
      if (!boxRef.current) return
      const innerHeight = Math.round(getInnerHeight(boxRef.current))
      const scrollHeight = Math.round(getScrollHeight(boxRef.current))
      if (!Number.isFinite(innerHeight) || !Number.isFinite(scrollHeight)) return
      const prevSize = sizeRef.current
      const isAtBottom =
        scrollTopRef.current >= prevSize.scrollHeight - prevSize.innerHeight - 1
      const childCountCurrent = React.Children.count(children)
      const childrenChanged = childrenCountRef.current !== childCountCurrent
      const heightChanged = scrollHeight !== prevSize.scrollHeight || innerHeight !== prevSize.innerHeight

      if (heightChanged) {
        setSize({ innerHeight, scrollHeight })
        sizeRef.current = { innerHeight, scrollHeight }
      }

      const maxScroll = Math.max(0, scrollHeight - innerHeight)
      const shouldFollow = scrollToBottom && (childrenChanged || scrollHeight > prevSize.scrollHeight)

      if ((shouldFollow || (isAtBottom && scrollTopRef.current !== maxScroll)) && scrollTopRef.current !== maxScroll) {
        scrollTopRef.current = maxScroll
        setScrollTop(maxScroll)
        emitScrollState({
          scrollTop: maxScroll,
          scrollHeight,
          innerHeight,
        })
      } else if (scrollTopRef.current > maxScroll) {
        scrollTopRef.current = maxScroll
        setScrollTop(maxScroll)
        emitScrollState({
          scrollTop: maxScroll,
          scrollHeight,
          innerHeight,
        })
      } else {
        emitScrollState({
          scrollTop: scrollTopRef.current,
          scrollHeight,
          innerHeight,
        })
      }

      childrenCountRef.current = childCountCurrent
    }, [children, scrollToBottom, emitScrollState])

    useEffect(() => {
      scrollTopRef.current = scrollTop
    }, [scrollTop])

    useEffect(() => {
      sizeRef.current = size
    }, [size])

    return (
      <Box
        ref={boxRef}
        maxHeight={maxHeight}
        width={width ?? maxWidth}
        height={height}
        flexDirection="column"
        overflowY="scroll"
        overflowX="hidden"
        scrollTop={scrollTop}
        scrollbarThumbColor={theme.ui.dark}
      >
        <Box flexShrink={0} paddingRight={1} flexDirection="column">
          {children}
        </Box>
      </Box>
    )
  }
)

Scrollable.displayName = 'Scrollable'
