import React from 'react'
import { Box, Text } from 'ink'

import { useTerminalSize } from '../hooks/useTerminalSize.js'
import { theme } from '../semantic-colors.js'
import { shortenPath, tildeifyPath } from '../utils/paths.js'
import type { ConnectorSnapshot } from '../types.js'

export type ConfigScreenItem = {
  id: string
  scope: 'global' | 'quest'
  name: string
  title: string
  path: string
  writable: boolean
  configName?: string
  documentId?: string
}

export type ConfigRootEntry = {
  id: 'connectors' | 'global-files' | 'quest-files'
  title: string
  description: string
}

export type ConnectorMenuEntry = {
  name: string
  label: string
  subtitle: string
  enabled: boolean
  connectionState?: string | null
  bindingCount?: number
  targetCount?: number
  supportMode: 'guided' | 'raw'
}

export type ConnectorFieldKind = 'text' | 'password' | 'url' | 'boolean'

export type ConnectorGuideSection = {
  id: string
  title: string
  lines: string[]
  tone?: 'info' | 'warning' | 'success'
}

export type ConnectorDetailItem =
  | {
      type: 'action'
      id: string
      label: string
      description: string
      disabled?: boolean
      disabledReason?: string
    }
  | {
      type: 'field'
      key: string
      label: string
      value: string
      description: string
      fieldKind: ConnectorFieldKind
      editable?: boolean
      dirty?: boolean
    }
  | {
      type: 'info'
      id: string
      label: string
      value: string
      description?: string
      multiline?: boolean
    }

export type ConfigPanel =
  | {
      kind: 'root'
      items: ConfigRootEntry[]
      selectedIndex: number
      selectedQuestId?: string | null
    }
  | {
      kind: 'files'
      title: string
      description: string
      items: ConfigScreenItem[]
      selectedIndex: number
      selectedQuestId?: string | null
    }
  | {
      kind: 'connector-list'
      items: ConnectorMenuEntry[]
      selectedIndex: number
    }
  | {
      kind: 'connector-detail'
      connectorName: string
      connectorLabel: string
      selectedIndex: number
      items: ConnectorDetailItem[]
      dirty?: boolean
      snapshot?: ConnectorSnapshot | null
      warning?: string | null
      contextLine?: string | null
      guideSections?: ConnectorGuideSection[]
    }
  | {
      kind: 'weixin-qr'
      status: string
      sessionKey?: string | null
      qrAscii?: string | null
      qrContent?: string | null
      qrUrl?: string | null
      message?: string | null
    }
  | {
      kind: 'document-editor'
      item: ConfigScreenItem
      content: string
    }
  | {
      kind: 'connector-field-editor'
      connectorName: string
      fieldLabel: string
      content: string
      description?: string
      masked?: boolean
    }

type ConfigScreenProps = {
  panel: ConfigPanel
  availableHeight?: number
}

const renderListItems = (
  items: Array<{ id: string; title: string; description?: string; secondary?: string; disabled?: boolean }>,
  selectedIndex: number,
  columns: number
) => {
  return items.map((item, index) => {
    const isSelected = index === selectedIndex
    const titleColor = item.disabled ? theme.text.secondary : isSelected ? theme.status.success : theme.text.primary
    return (
      <Box key={item.id} flexDirection="column" marginBottom={1}>
        <Text color={titleColor}>
          {isSelected ? '> ' : '  '}
          {index + 1}. {item.title}
        </Text>
        {item.description ? (
          <Text color={theme.text.secondary}>{shortenPath(item.description, Math.max(24, columns - 4))}</Text>
        ) : null}
        {item.secondary ? <Text color={theme.text.secondary}>{shortenPath(item.secondary, Math.max(24, columns - 4))}</Text> : null}
      </Box>
    )
  })
}

const renderMultilineValue = (value: string) =>
  value.split('\n').map((line, index) => (
    <Text key={`multiline:${index}`} color={theme.text.primary}>
      {line || ' '}
    </Text>
  ))

const connectorStateLine = (snapshot?: ConnectorSnapshot | null) => {
  if (!snapshot) {
    return 'No runtime snapshot yet.'
  }
  const parts = [
    snapshot.enabled === false ? 'disabled' : snapshot.enabled ? 'enabled' : 'unknown',
    snapshot.connection_state || null,
    snapshot.auth_state || null,
    typeof snapshot.binding_count === 'number' ? `bindings ${snapshot.binding_count}` : null,
    typeof snapshot.target_count === 'number' ? `targets ${snapshot.target_count}` : null,
  ].filter(Boolean)
  return parts.join(' · ') || 'No runtime snapshot yet.'
}

export const ConfigScreen: React.FC<ConfigScreenProps> = ({ panel, availableHeight }) => {
  const { rows, columns } = useTerminalSize()
  const safeRows = availableHeight ?? rows

  if (panel.kind === 'document-editor') {
    const previewLines = panel.content.split('\n')
    const maxPreviewLines = Math.max(8, (safeRows || 24) - 8)
    const visibleLines = previewLines.slice(0, maxPreviewLines)

    return (
      <Box flexDirection="column" width={columns}>
        <Text color={theme.text.primary}>Config Editor</Text>
        <Text color={theme.text.link}>
          {panel.item.scope === 'global' ? 'Global' : 'Quest'} · {panel.item.title}
        </Text>
        <Text color={theme.text.secondary}>{tildeifyPath(panel.item.path)}</Text>
        <Text color={theme.text.secondary}>Enter save · Ctrl+J newline · Esc cancel</Text>
        <Box marginTop={1} flexDirection="column">
          {visibleLines.map((line, index) => (
            <Box key={`${panel.item.id}-line-${index}`} flexDirection="row">
              <Box minWidth={5}>
                <Text color={theme.text.secondary}>{String(index + 1).padStart(4, ' ')}</Text>
              </Box>
              <Text color={theme.text.primary}>{line || ' '}</Text>
            </Box>
          ))}
          {previewLines.length > visibleLines.length ? (
            <Text color={theme.text.secondary}>
              … {previewLines.length - visibleLines.length} more line(s) in buffer
            </Text>
          ) : null}
        </Box>
      </Box>
    )
  }

  if (panel.kind === 'connector-field-editor') {
    const previewLines = panel.content.split('\n')
    const maxPreviewLines = Math.max(8, (safeRows || 24) - 8)
    const visibleLines = previewLines.slice(0, maxPreviewLines)
    return (
      <Box flexDirection="column" width={columns}>
        <Text color={theme.text.primary}>Connector Field Editor</Text>
        <Text color={theme.text.link}>
          {panel.connectorName} · {panel.fieldLabel}
        </Text>
        {panel.description ? <Text color={theme.text.secondary}>{panel.description}</Text> : null}
        <Text color={theme.text.secondary}>Enter apply · Ctrl+J newline · Esc cancel</Text>
        <Box marginTop={1} flexDirection="column">
          {visibleLines.map((line, index) => (
            <Box key={`${panel.connectorName}:${panel.fieldLabel}:${index}`} flexDirection="row">
              <Box minWidth={5}>
                <Text color={theme.text.secondary}>{String(index + 1).padStart(4, ' ')}</Text>
              </Box>
              <Text color={theme.text.primary}>
                {panel.masked && line ? '*'.repeat(line.length) : line || ' '}
              </Text>
            </Box>
          ))}
          {previewLines.length > visibleLines.length ? (
            <Text color={theme.text.secondary}>
              … {previewLines.length - visibleLines.length} more line(s) in buffer
            </Text>
          ) : null}
        </Box>
      </Box>
    )
  }

  if (panel.kind === 'root') {
    const entries = panel.items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
    }))
    return (
      <Box flexDirection="column" width={columns}>
        <Text color={theme.text.primary}>Config</Text>
        <Text color={theme.text.secondary}>Choose a config area with arrows, then press Enter.</Text>
        <Text color={theme.text.secondary}>Esc close · Enter open · PgUp/PgDn scroll</Text>
        <Box marginTop={1} flexDirection="column">
          {renderListItems(entries, panel.selectedIndex, columns)}
        </Box>
        {panel.selectedQuestId ? (
          <Text color={theme.text.secondary}>Current quest: {panel.selectedQuestId}</Text>
        ) : (
          <Text color={theme.text.secondary}>No quest currently selected.</Text>
        )}
      </Box>
    )
  }

  if (panel.kind === 'files') {
    const entries = panel.items.map((item) => ({
      id: item.id,
      title: item.title,
      description: shortenPath(tildeifyPath(item.path), Math.max(28, columns - 10)),
    }))
    const selected = panel.items[Math.max(0, Math.min(panel.selectedIndex, panel.items.length - 1))] ?? null
    return (
      <Box flexDirection="column" width={columns}>
        <Text color={theme.text.primary}>{panel.title}</Text>
        <Text color={theme.text.secondary}>{panel.description}</Text>
        <Text color={theme.text.secondary}>↑/↓ choose · Enter edit · PgUp/PgDn scroll · Esc back</Text>
        <Box marginTop={1} flexDirection="column">
          {entries.length > 0 ? (
            renderListItems(entries, panel.selectedIndex, columns)
          ) : (
            <Text color={theme.text.secondary}>No config files available in this section.</Text>
          )}
        </Box>
        {selected ? (
          <Box flexDirection="column" marginTop={1}>
            <Text color={theme.text.link}>Selected</Text>
            <Text color={theme.text.primary}>{selected.title}</Text>
            <Text color={theme.text.secondary}>{tildeifyPath(selected.path)}</Text>
          </Box>
        ) : null}
      </Box>
    )
  }

  if (panel.kind === 'connector-list') {
    const entries = panel.items.map((item) => ({
      id: item.name,
      title: `${item.label} · ${item.enabled ? 'enabled' : 'disabled'}`,
      description: item.subtitle,
      secondary: [
        item.connectionState || 'unknown',
        typeof item.bindingCount === 'number' ? `bindings ${item.bindingCount}` : null,
        typeof item.targetCount === 'number' ? `targets ${item.targetCount}` : null,
        item.supportMode === 'guided' ? 'guided setup' : 'raw config only',
      ]
        .filter(Boolean)
        .join(' · '),
    }))
    return (
      <Box flexDirection="column" width={columns}>
        <Text color={theme.text.primary}>Connectors</Text>
        <Text color={theme.text.secondary}>Choose a connector, then press Enter.</Text>
        <Text color={theme.text.secondary}>↑/↓ choose · Enter open · PgUp/PgDn scroll · Esc back</Text>
        <Box marginTop={1} flexDirection="column">
          {entries.length > 0 ? renderListItems(entries, panel.selectedIndex, columns) : <Text color={theme.text.secondary}>No connectors available.</Text>}
        </Box>
      </Box>
    )
  }

  if (panel.kind === 'connector-detail') {
    const selected = panel.items[Math.max(0, Math.min(panel.selectedIndex, panel.items.length - 1))] ?? null
    return (
      <Box flexDirection="column" width={columns}>
        <Text color={theme.text.primary}>{panel.connectorLabel}</Text>
        <Text color={theme.text.secondary}>{connectorStateLine(panel.snapshot)}</Text>
        {panel.contextLine ? <Text color={theme.text.link}>{panel.contextLine}</Text> : null}
        <Text color={theme.text.secondary}>
          ↑/↓ choose · Enter action/edit · PgUp/PgDn scroll · Esc back{panel.dirty ? ' · unsaved changes' : ''}
        </Text>
        {panel.warning ? <Text color={theme.status.warning}>{panel.warning}</Text> : null}
        {panel.guideSections && panel.guideSections.length > 0 ? (
          <Box marginTop={1} flexDirection="column">
            {panel.guideSections.map((section) => {
              const titleColor =
                section.tone === 'warning'
                  ? theme.status.warning
                  : section.tone === 'success'
                    ? theme.status.success
                    : theme.text.link
              const lineColor =
                section.tone === 'warning'
                  ? theme.status.warning
                  : section.tone === 'success'
                    ? theme.text.primary
                    : theme.text.secondary
              return (
                <Box key={`guide:${section.id}`} flexDirection="column" marginBottom={1}>
                  <Text color={titleColor}>{section.title}</Text>
                  {section.lines.map((line, index) => (
                    <Text key={`guide:${section.id}:${index}`} color={lineColor}>
                      {line}
                    </Text>
                  ))}
                </Box>
              )
            })}
          </Box>
        ) : null}
        <Box marginTop={1} flexDirection="column">
          {panel.items.map((item, index) => {
            const isSelected = index === panel.selectedIndex
            if (item.type === 'action') {
              return (
                <Box key={`action:${item.id}`} flexDirection="column" marginBottom={1}>
                  <Text color={item.disabled ? theme.text.secondary : isSelected ? theme.status.success : theme.text.primary}>
                    {isSelected ? '> ' : '  '}
                    {index + 1}. [Action] {item.label}
                  </Text>
                  <Text color={theme.text.secondary}>{item.description}</Text>
                  {item.disabled && item.disabledReason ? (
                    <Text color={theme.status.warning}>{item.disabledReason}</Text>
                  ) : null}
                </Box>
              )
            }
            if (item.type === 'field') {
              return (
                <Box key={`field:${item.key}`} flexDirection="column" marginBottom={1}>
                  <Text color={isSelected ? theme.status.success : theme.text.primary}>
                    {isSelected ? '> ' : '  '}
                    {index + 1}. {item.label}: {item.value || '—'}
                    {item.dirty ? ' *' : ''}
                  </Text>
                  <Text color={theme.text.secondary}>{item.description}</Text>
                </Box>
              )
            }
            return (
              <Box key={`info:${item.id}`} flexDirection="column" marginBottom={1}>
                <Text color={isSelected ? theme.status.success : theme.text.primary}>
                  {isSelected ? '> ' : '  '}
                  {index + 1}. {item.label}: {item.multiline ? '' : item.value || '—'}
                </Text>
                {item.multiline ? <Box flexDirection="column">{renderMultilineValue(item.value)}</Box> : null}
                {item.description ? <Text color={theme.text.secondary}>{item.description}</Text> : null}
              </Box>
            )
          })}
        </Box>
        {selected && selected.type === 'info' && !selected.multiline ? (
          <Box flexDirection="column" marginTop={1}>
            <Text color={theme.text.link}>Selected</Text>
            <Text color={theme.text.primary}>{selected.value || '—'}</Text>
          </Box>
        ) : null}
      </Box>
    )
  }

  const qrLines = String(panel.qrAscii || '')
    .split('\n')
    .filter((line) => line.length > 0)
  return (
    <Box flexDirection="column" width={columns}>
      <Text color={theme.text.primary}>Weixin QR Login</Text>
      <Text color={theme.text.secondary}>
        Status: {panel.status || 'waiting'}{panel.sessionKey ? ` · ${panel.sessionKey}` : ''}
      </Text>
      <Text color={theme.text.secondary}>Esc back · QR refreshes automatically while waiting</Text>
      {panel.message ? <Text color={theme.text.secondary}>{panel.message}</Text> : null}
      <Box marginTop={1} flexDirection="column">
        {qrLines.length > 0 ? (
          qrLines.map((line, index) => (
            <Text key={`qr:${index}`} color={theme.text.primary}>
              {line}
            </Text>
          ))
        ) : panel.qrContent ? (
          <Text color={theme.text.secondary}>{panel.qrContent}</Text>
        ) : (
          <Text color={theme.text.secondary}>QR code is loading…</Text>
        )}
      </Box>
      {panel.qrUrl ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.link}>QR Source</Text>
          <Text color={theme.text.secondary}>{shortenPath(panel.qrUrl, Math.max(24, columns - 4))}</Text>
        </Box>
      ) : null}
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>Scan this QR code with WeChat, then confirm the login on the phone.</Text>
        <Text color={theme.text.secondary}>DeepScientist will save the connector automatically after confirmation.</Text>
      </Box>
    </Box>
  )
}
