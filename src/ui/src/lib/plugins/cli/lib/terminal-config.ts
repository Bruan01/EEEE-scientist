import type { ITerminalOptions } from '@xterm/xterm'
import { terminalTheme } from './terminal-theme'

export type TerminalAppearance = 'terminal' | 'ui'

export const terminalConfig: ITerminalOptions = {
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  fontSize: 14,
  lineHeight: 1.4,
  cursorBlink: true,
  cursorStyle: 'block',
  scrollback: 10000,
  theme: terminalTheme,
  allowTransparency: true,
  convertEol: true,
  allowProposedApi: true,
}

export const terminalUiConfig: ITerminalOptions = {
  ...terminalConfig,
  fontSize: 13,
  lineHeight: 1.1,
  letterSpacing: 0,
}

export const getTerminalConfig = (appearance: TerminalAppearance = 'terminal') =>
  appearance === 'ui' ? terminalUiConfig : terminalConfig
