import type { UnifiedPluginManifest } from '@/lib/types/plugin'

export const aiManusManifest: UnifiedPluginManifest = {
  id: '@ds/plugin-ai-manus',
  name: 'AiManus UI',
  description: 'Shared ai-manus chat UI layer for Agent and Copilot',
  version: '1.0.0',
  type: 'builtin',
  author: 'DeepScientist Team',
  icon: 'MessageSquare',
  frontend: {
    entry: './AiManusChatView',
    renderMode: 'react',
    fileAssociations: [],
  },
  contributes: {},
}

export default aiManusManifest
