import type { UnifiedPluginManifest } from '@/lib/types/plugin'

export const labPluginManifest: UnifiedPluginManifest = {
  id: '@ds/plugin-lab',
  name: 'Lab',
  version: '1.0.0',
  type: 'builtin',
  author: 'DeepScientist Team',
  description: 'Lab home surface for team, quests, assets, and copilot modes',
  icon: 'Home',
  frontend: {
    entry: './LabPlugin',
    renderMode: 'react',
    fileAssociations: [],
  },
  contributes: {
    tabIcon: 'home',
    sidebarMenus: [
      {
        id: 'lab-home',
        title: 'Home',
        icon: 'home',
        order: 95,
        command: 'lab.openHome',
      },
    ],
  },
  permissions: {
    frontend: ['network', 'project:read', 'project:write'],
    backend: ['database:read', 'database:write'],
  },
  lifecycle: {
    onActivate: 'onPluginActivate',
    onDeactivate: 'onPluginDeactivate',
  },
}

export default labPluginManifest
