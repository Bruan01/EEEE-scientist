'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Terminal, type ITerminalOptions } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { ImageAddon } from '@xterm/addon-image'
import {
  ClipboardAddon,
  type IClipboardProvider,
} from '@xterm/addon-clipboard'
import { SerializeAddon } from '@xterm/addon-serialize'
import { ProgressAddon, type IProgressState } from '@xterm/addon-progress'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { AttachAddon } from '@xterm/addon-attach'
import { getTerminalConfig, type TerminalAppearance } from '../lib/terminal-config'
import { SocketTerminalTransport } from '../lib/socket-terminal-transport'

const SAFE_LINK_PATTERN = /https?:\/\/[^\s'"<>]+/i

const openSafeLink = (event: MouseEvent, uri: string) => {
  if (!SAFE_LINK_PATTERN.test(uri)) return
  event.preventDefault()
  window.open(uri, '_blank', 'noopener,noreferrer')
}

const clipboardProvider: IClipboardProvider = {
  readText: async (selection) => {
    if (selection !== 'c') return ''
    if (!navigator.clipboard?.readText) return ''
    try {
      return await navigator.clipboard.readText()
    } catch {
      return ''
    }
  },
  writeText: async (selection, text) => {
    if (selection !== 'c') return
    if (!navigator.clipboard?.writeText) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Ignore clipboard write errors.
    }
  },
}

const applyTerminalOptions = (terminal: Terminal, config: ITerminalOptions) => {
  if (config.fontFamily) {
    terminal.options.fontFamily = config.fontFamily
  }
  if (typeof config.fontSize === 'number') {
    terminal.options.fontSize = config.fontSize
  }
  if (typeof config.lineHeight === 'number') {
    terminal.options.lineHeight = config.lineHeight
  }
  if (typeof config.letterSpacing === 'number') {
    terminal.options.letterSpacing = config.letterSpacing
  }
  if (config.theme) {
    terminal.options.theme = config.theme
  }
  if (typeof config.cursorBlink === 'boolean') {
    terminal.options.cursorBlink = config.cursorBlink
  }
  if (config.cursorStyle) {
    terminal.options.cursorStyle = config.cursorStyle
  }
  if (typeof config.scrollback === 'number') {
    terminal.options.scrollback = config.scrollback
  }
  if (typeof config.allowTransparency === 'boolean') {
    terminal.options.allowTransparency = config.allowTransparency
  }
  if (typeof config.convertEol === 'boolean') {
    terminal.options.convertEol = config.convertEol
  }
  if (typeof config.allowProposedApi === 'boolean') {
    terminal.options.allowProposedApi = config.allowProposedApi
  }
}

export function useTerminal(options: {
  onInput?: (data: string) => void
  onBinary?: (data: string) => void
  onReady?: (terminal: Terminal, fitAddon: FitAddon, searchAddon: SearchAddon) => void
  onProgress?: (state: IProgressState) => void
  enableAttach?: boolean
  enabled?: boolean
  autoFocus?: boolean
  appearance?: TerminalAppearance
  scrollback?: number
  convertEol?: boolean
}) {
  const {
    onInput,
    onBinary,
    onReady,
    onProgress,
    enableAttach = false,
    enabled = true,
    autoFocus = true,
    appearance,
    scrollback,
    convertEol,
  } = options
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const serializeAddonRef = useRef<SerializeAddon | null>(null)
  const progressAddonRef = useRef<ProgressAddon | null>(null)
  const transportRef = useRef<SocketTerminalTransport | null>(null)
  const attachAddonRef = useRef<AttachAddon | null>(null)
  const isReadyRef = useRef(false)
  const appearanceRef = useRef<TerminalAppearance>(appearance ?? 'terminal')
  const scrollbackRef = useRef<number | null>(
    typeof scrollback === 'number' ? scrollback : null
  )
  const onInputRef = useRef(onInput)
  const onBinaryRef = useRef(onBinary)
  const onReadyRef = useRef(onReady)
  const onProgressRef = useRef(onProgress)

  const allowAttach = useMemo(() => enableAttach && typeof onInput === 'function', [enableAttach, onInput])

  useEffect(() => {
    onInputRef.current = onInput
  }, [onInput])

  useEffect(() => {
    onBinaryRef.current = onBinary
  }, [onBinary])

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    onProgressRef.current = onProgress
  }, [onProgress])

  useEffect(() => {
    scrollbackRef.current = typeof scrollback === 'number' ? scrollback : null
    if (!terminalRef.current || !isReadyRef.current) return
    if (scrollbackRef.current != null) {
      terminalRef.current.options.scrollback = scrollbackRef.current
    }
  }, [scrollback])

  useEffect(() => {
    if (!enabled) return
    const container = containerRef.current
    if (!container || terminalRef.current) return

    let terminal: Terminal | null = null
    let fitAddon: FitAddon | null = null
    let searchAddon: SearchAddon | null = null
    let serializeAddon: SerializeAddon | null = null
    let progressAddon: ProgressAddon | null = null
    let rafId: number | null = null
    let resizeObserver: ResizeObserver | null = null
    let progressDisposable: { dispose: () => void } | null = null
    let initialized = false

    const setupTerminal = () => {
      if (initialized) return
      initialized = true

      const baseConfig = getTerminalConfig(appearanceRef.current)
      const config =
        scrollbackRef.current != null
          ? { ...baseConfig, scrollback: scrollbackRef.current, ...(typeof convertEol === 'boolean' ? { convertEol } : {}) }
          : typeof convertEol === 'boolean'
            ? { ...baseConfig, convertEol }
          : baseConfig
      terminal = new Terminal(config)
      fitAddon = new FitAddon()
      searchAddon = new SearchAddon()
      const webLinksAddon = new WebLinksAddon(openSafeLink, { urlRegex: SAFE_LINK_PATTERN })
      const imageAddon = new ImageAddon({
        enableSizeReports: true,
        pixelLimit: 8_388_608,
        sixelSupport: true,
        sixelScrolling: true,
        sixelPaletteLimit: 256,
        sixelSizeLimit: 10_000_000,
        storageLimit: 64,
        showPlaceholder: true,
        iipSupport: true,
        iipSizeLimit: 10_000_000,
      })
      progressAddon = new ProgressAddon()
      serializeAddon = new SerializeAddon()
      const clipboardAddon = new ClipboardAddon(undefined, clipboardProvider)
      const unicodeAddon = new Unicode11Addon()

      terminal.loadAddon(fitAddon)
      terminal.loadAddon(searchAddon)
      terminal.loadAddon(webLinksAddon)
      terminal.loadAddon(imageAddon)
      terminal.loadAddon(progressAddon)
      terminal.loadAddon(serializeAddon)
      terminal.loadAddon(clipboardAddon)
      terminal.loadAddon(unicodeAddon)

      terminal.open(container)
      const webglAddon = new WebglAddon()
      try {
        terminal.loadAddon(webglAddon)
        webglAddon.onContextLoss(() => {
          try {
            webglAddon.dispose()
          } catch {
            // Ignore dispose errors on context loss.
          }
        })
      } catch {
        // WebGL not available; fall back to canvas renderer.
      }
      terminal.unicode.activeVersion = '11'
      isReadyRef.current = true

      const fitAndRefresh = () => {
        if (!terminal || !fitAddon) return
        try {
          fitAddon.fit()
          terminal.refresh(0, Math.max(0, terminal.rows - 1))
        } catch {
          // Ignore fit errors during initial layout.
        }
      }
      fitAndRefresh()
      if (autoFocus) {
        rafId = window.requestAnimationFrame(() => {
          rafId = null
          if (!terminal?.element) return
          fitAndRefresh()
          try {
            terminal.focus()
          } catch {
            // Ignore focus errors on init.
          }
        })
        try {
          terminal.focus()
        } catch {
          // Ignore focus errors on init.
        }
      }

      progressDisposable = progressAddon.onChange((state) => {
        onProgressRef.current?.(state)
      })

      if (allowAttach) {
        const transport = new SocketTerminalTransport((data) => onInputRef.current?.(data))
        const attachAddon = new AttachAddon(transport as unknown as WebSocket)
        transportRef.current = transport
        attachAddonRef.current = attachAddon
        terminal.loadAddon(attachAddon)
      } else {
        terminal.onData((data) => {
          onInputRef.current?.(data)
        })
        terminal.onBinary((data) => {
          onBinaryRef.current?.(data)
        })
      }

      terminalRef.current = terminal
      fitAddonRef.current = fitAddon
      searchAddonRef.current = searchAddon
      serializeAddonRef.current = serializeAddon
      progressAddonRef.current = progressAddon
      onReadyRef.current?.(terminal, fitAddon, searchAddon)
    }

    const shouldInit = () => container.clientHeight > 0 && container.clientWidth > 0

    if (shouldInit()) {
      setupTerminal()
    } else {
      resizeObserver = new ResizeObserver(() => {
        if (initialized || terminalRef.current) return
        if (shouldInit()) {
          setupTerminal()
        }
      })
      resizeObserver.observe(container)
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      if (!initialized) return
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
      progressDisposable?.dispose()
      transportRef.current?.close()
      isReadyRef.current = false
      terminalRef.current = null
      fitAddonRef.current = null
      searchAddonRef.current = null
      serializeAddonRef.current = null
      progressAddonRef.current = null
      transportRef.current = null
      attachAddonRef.current = null
      try {
        terminal?.dispose()
      } catch {
        // Ignore dispose errors triggered after unmount.
      }
    }
  }, [enabled, allowAttach, autoFocus, convertEol])

  useEffect(() => {
    const nextAppearance = appearance ?? 'terminal'
    appearanceRef.current = nextAppearance
    if (!terminalRef.current || !isReadyRef.current) return
    const baseConfig = getTerminalConfig(nextAppearance)
    const config =
      scrollbackRef.current != null
        ? { ...baseConfig, scrollback: scrollbackRef.current, ...(typeof convertEol === 'boolean' ? { convertEol } : {}) }
        : typeof convertEol === 'boolean'
          ? { ...baseConfig, convertEol }
        : baseConfig
    applyTerminalOptions(terminalRef.current, config)
    try {
      fitAddonRef.current?.fit()
      terminalRef.current.refresh(0, Math.max(0, terminalRef.current.rows - 1))
    } catch {
      // Ignore refresh errors after unmount/dispose.
    }
  }, [appearance, convertEol])

  const withTerminal = useCallback((action: (terminal: Terminal) => void) => {
    if (!isReadyRef.current) return
    const terminal = terminalRef.current
    if (!terminal || !terminal.element) return
    try {
      action(terminal)
    } catch {
      // Ignore terminal errors after unmount/dispose.
    }
  }, [])

  const write = useCallback(
    (data: string, onComplete?: () => void) => {
      if (!data) {
        onComplete?.()
        return
      }
      if (transportRef.current) {
        transportRef.current.emitMessage(data)
        onComplete?.()
        return
      }
      withTerminal((terminal) => {
        terminal.write(data, () => {
          onComplete?.()
        })
      })
    },
    [withTerminal]
  )

  const clear = useCallback(() => {
    withTerminal((terminal) => {
      try {
        terminal.reset()
      } catch {
        terminal.clear()
      }
    })
  }, [withTerminal])

  const focus = useCallback(() => {
    withTerminal((terminal) => {
      terminal.focus()
    })
  }, [withTerminal])

  const fit = useCallback(() => {
    if (!isReadyRef.current || !terminalRef.current?.element) return
    try {
      fitAddonRef.current?.fit()
    } catch {
      // Ignore fit errors after unmount/dispose.
    }
  }, [])

  const search = useCallback((query: string) => {
    if (!query || !isReadyRef.current) return false
    try {
      return searchAddonRef.current?.findNext(query) ?? false
    } catch {
      return false
    }
  }, [])

  const serialize = useCallback((options?: Parameters<SerializeAddon['serialize']>[0]) => {
    if (!isReadyRef.current) return ''
    try {
      return serializeAddonRef.current?.serialize(options) ?? ''
    } catch {
      return ''
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    withTerminal((terminal) => {
      terminal.scrollToBottom()
    })
  }, [withTerminal])

  const resetProgress = useCallback(() => {
    if (!progressAddonRef.current) return
    progressAddonRef.current.progress = { state: 0, value: 0 }
  }, [])

  return {
    containerRef,
    terminalRef,
    fitAddonRef,
    searchAddonRef,
    isReadyRef,
    write,
    clear,
    focus,
    fit,
    search,
    serialize,
    scrollToBottom,
    resetProgress,
  }
}
