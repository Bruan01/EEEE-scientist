/**
 * Text Viewer Plugin Manifest
 *
 * @ds/plugin-text-viewer
 *
 * Built-in plugin for viewing plain text files.
 * Acts as a fallback viewer for text files without syntax highlighting.
 * Lower priority than code-viewer to allow specialized viewers to take precedence.
 */

import type { UnifiedPluginManifest } from "@/lib/types/plugin";

/**
 * Text Viewer Plugin Manifest Definition
 */
export const textViewerManifest: UnifiedPluginManifest = {
  // ============================================================
  // Basic Information
  // ============================================================
  id: "@ds/plugin-text-viewer",
  name: "Text Viewer",
  description: "Plain text file viewer with line numbers and search support",
  version: "1.0.0",
  type: "builtin",
  author: "DeepScientist Team",
  icon: "FileText",

  // ============================================================
  // Frontend Configuration
  // ============================================================
  frontend: {
    entry: "./TextViewerPlugin",
    renderMode: "react",
    fileAssociations: [
      // Plain text files - lower priority to serve as fallback
      {
        mimeTypes: ["text/plain"],
        extensions: [".txt", ".text"],
        priority: 30, // Low priority - fallback viewer
      },
      // Log files
      {
        mimeTypes: ["text/x-log", "application/x-log"],
        extensions: [".log", ".logs"],
        priority: 50,
      },
      // CSV files (basic text view)
      {
        mimeTypes: ["text/csv", "application/csv"],
        extensions: [".csv"],
        priority: 30, // Low priority - CSV editor should take precedence
      },
      // Markdown as plain text fallback
      {
        mimeTypes: ["text/markdown"],
        extensions: [".md", ".markdown", ".mdown"],
        priority: 20, // Very low - Markdown viewer should take precedence
      },
      // README and similar files
      {
        mimeTypes: ["text/plain"],
        extensions: [".readme", ".license", ".authors", ".changelog"],
        priority: 40,
      },
      // Environment files
      {
        mimeTypes: ["text/plain"],
        extensions: [".env", ".env.local", ".env.development", ".env.production"],
        priority: 50,
      },
      // Gitignore and similar
      {
        mimeTypes: ["text/plain"],
        extensions: [".gitignore", ".dockerignore", ".npmignore", ".eslintignore"],
        priority: 50,
      },
    ],
  },

  // Backend: Text viewer doesn't need backend tools
  backend: undefined,
};

export default textViewerManifest;
