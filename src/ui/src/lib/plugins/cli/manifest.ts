import type { UnifiedPluginManifest } from '@/lib/types/plugin'

export const cliPluginManifest: UnifiedPluginManifest = {
  id: '@ds/plugin-cli',
  name: 'CLI Remote Server',
  version: '1.0.0',
  type: 'builtin',
  author: 'DeepScientist Team',
  description: 'Remote CLI server management with terminal emulation',
  icon: 'Terminal',
  frontend: {
    entry: './CliPlugin',
    renderMode: 'react',
    fileAssociations: [],
  },
  contributes: {
    sidebarMenus: [
      {
        id: 'cli-servers',
        title: 'CLI Servers',
        icon: 'Terminal',
        order: 50,
        command: 'cli.openTab',
      },
    ],
    toolbar: [
      {
        id: 'cli-quick-access',
        title: 'Terminal',
        icon: 'Terminal',
        command: 'cli.openTab',
        position: 'right',
      },
    ],
  },
  permissions: {
    frontend: ['network', 'clipboard'],
    backend: ['database:read', 'database:write', 'file:read', 'file:write', 'network:outbound'],
  },
  lifecycle: {
    onActivate: 'onPluginActivate',
    onDeactivate: 'onPluginDeactivate',
  },
}

export default cliPluginManifest
