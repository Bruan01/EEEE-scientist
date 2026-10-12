/**
 * Markdown Viewer Plugin Manifest
 *
 * @ds/plugin-markdown-viewer
 *
 * Built-in plugin for viewing Markdown documents with:
 * - GFM (GitHub Flavored Markdown) support
 * - Math formula rendering (KaTeX)
 * - Syntax highlighted code blocks
 * - Tables, task lists, and more
 */

import type { UnifiedPluginManifest } from "@/lib/types/plugin";

/**
 * Markdown Viewer Plugin Manifest Definition
 */
export const markdownViewerManifest: UnifiedPluginManifest = {
  // ============================================================
  // Basic Information
  // ============================================================
  id: "@ds/plugin-markdown-viewer",
  name: "Markdown Viewer",
  description: "View Markdown documents with GFM support and math formulas",
  version: "1.0.0",
  type: "builtin",
  author: "DeepScientist Team",
  icon: "FileText",

  // ============================================================
  // Frontend Configuration
  // ============================================================
  frontend: {
    entry: "./MarkdownViewerPlugin",
    renderMode: "react",
    fileAssociations: [
      {
        extensions: [".mdx"],
        mimeTypes: ["text/markdown", "text/x-markdown"],
        priority: 98,
      },
      {
        extensions: [".md", ".markdown"],
        mimeTypes: ["text/markdown", "text/x-markdown"],
        priority: 90,
      },
    ],
  },

  // ============================================================
  // Permissions
  // ============================================================
  permissions: {
    frontend: ["file:read"],
  },

  // ============================================================
  // Contributes
  // ============================================================
  contributes: {
    tabIcon: "FileText",
  },

  // Backend: Markdown viewer doesn't need backend tools
  backend: undefined,
};

export default markdownViewerManifest;
