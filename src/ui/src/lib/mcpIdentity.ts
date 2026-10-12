export function deriveMcpIdentity(
  toolName?: string,
  mcpServer?: string,
  mcpTool?: string
): { server?: string; tool?: string } {
  const server = typeof mcpServer === 'string' && mcpServer.trim() ? mcpServer.trim() : ''
  const tool = typeof mcpTool === 'string' && mcpTool.trim() ? mcpTool.trim() : ''
  if (server || tool) {
    return {
      ...(server ? { server } : {}),
      ...(tool ? { tool } : {}),
    }
  }

  const normalized = (toolName || '').trim().toLowerCase()
  for (const prefix of ['memory', 'artifact', 'bash_exec']) {
    if (normalized.startsWith(`${prefix}.`)) {
      return {
        server: prefix,
        tool: normalized.slice(prefix.length + 1),
      }
    }
  }

  return {}
}
