/**
 * PDF Markdown Viewer Plugin Manifest
 *
 * @ds/plugin-pdf-markdown
 *
 * Renders MinerU Markdown output for PDFs using Novel (read-only).
 */

import type { UnifiedPluginManifest } from '@/lib/types/plugin'

export const pdfMarkdownManifest: UnifiedPluginManifest = {
  id: '@ds/plugin-pdf-markdown',
  name: 'PDF Markdown',
  description: 'View MinerU Markdown output for PDFs',
  version: '1.0.0',
  type: 'builtin',
  author: 'DeepScientist Team',
  icon: 'FileText',
  frontend: {
    entry: './PdfMarkdownPlugin',
    renderMode: 'react',
  },
  permissions: {
    frontend: ['file:read'],
  },
  contributes: {
    tabIcon: 'FileText',
  },
  backend: undefined,
}

export default pdfMarkdownManifest
