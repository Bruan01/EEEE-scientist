/**
 * Code Viewer Plugin Manifest
 *
 * @ds/plugin-code-viewer
 *
 * Built-in plugin for viewing code files with syntax highlighting.
 * Supports a wide range of programming languages and file formats.
 */

import type { UnifiedPluginManifest } from "@/lib/types/plugin";

/**
 * Code Viewer Plugin Manifest Definition
 */
export const codeViewerManifest: UnifiedPluginManifest = {
  // ============================================================
  // Basic Information
  // ============================================================
  id: "@ds/plugin-code-viewer",
  name: "Code Viewer",
  description: "Syntax-highlighted code viewer with line numbers and copy support",
  version: "1.0.0",
  type: "builtin",
  author: "DeepScientist Team",
  icon: "Code",

  // ============================================================
  // Frontend Configuration
  // ============================================================
  frontend: {
    entry: "./CodeViewerPlugin",
    renderMode: "react",
    fileAssociations: [
      // JavaScript / TypeScript
      {
        mimeTypes: [
          "text/javascript",
          "application/javascript",
          "text/typescript",
          "application/typescript",
        ],
        extensions: [".js", ".jsx", ".mjs", ".ts", ".tsx", ".mts"],
        priority: 100,
      },
      // Python
      {
        mimeTypes: ["text/x-python", "application/x-python"],
        extensions: [".py", ".pyw", ".pyi"],
        priority: 100,
      },
      // JSON
      {
        mimeTypes: ["application/json", "text/json"],
        extensions: [".json", ".jsonc", ".json5"],
        priority: 100,
      },
      // Web (HTML, CSS)
      {
        mimeTypes: ["text/html", "text/css"],
        extensions: [".html", ".htm", ".css", ".scss", ".sass", ".less"],
        priority: 80,
      },
      // Configuration files
      {
        mimeTypes: ["text/yaml", "application/x-yaml", "text/x-toml"],
        extensions: [".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf"],
        priority: 90,
      },
      // Shell scripts
      {
        mimeTypes: ["text/x-sh", "application/x-sh"],
        extensions: [".sh", ".bash", ".zsh", ".fish"],
        priority: 100,
      },
      // SQL
      {
        mimeTypes: ["text/x-sql", "application/sql"],
        extensions: [".sql"],
        priority: 100,
      },
      // XML
      {
        mimeTypes: ["text/xml", "application/xml"],
        extensions: [".xml", ".xsl", ".xslt", ".svg"],
        priority: 70,
      },
      // Go
      {
        mimeTypes: ["text/x-go"],
        extensions: [".go"],
        priority: 100,
      },
      // Rust
      {
        mimeTypes: ["text/x-rust"],
        extensions: [".rs"],
        priority: 100,
      },
      // C/C++
      {
        mimeTypes: ["text/x-c", "text/x-c++"],
        extensions: [".c", ".h", ".cpp", ".cc", ".cxx", ".hpp", ".hxx"],
        priority: 100,
      },
      // Java
      {
        mimeTypes: ["text/x-java"],
        extensions: [".java"],
        priority: 100,
      },
      // C#
      {
        mimeTypes: ["text/x-csharp"],
        extensions: [".cs"],
        priority: 100,
      },
      // PHP
      {
        mimeTypes: ["text/x-php", "application/x-php"],
        extensions: [".php"],
        priority: 100,
      },
      // Ruby
      {
        mimeTypes: ["text/x-ruby"],
        extensions: [".rb"],
        priority: 100,
      },
      // Swift
      {
        mimeTypes: ["text/x-swift"],
        extensions: [".swift"],
        priority: 100,
      },
      // Kotlin
      {
        mimeTypes: ["text/x-kotlin"],
        extensions: [".kt", ".kts"],
        priority: 100,
      },
      // Dockerfile
      {
        mimeTypes: ["text/x-dockerfile"],
        extensions: ["Dockerfile", ".dockerfile"],
        priority: 100,
      },
      // Makefile
      {
        mimeTypes: ["text/x-makefile"],
        extensions: ["Makefile", "makefile", ".mk"],
        priority: 100,
      },
    ],
  },

  // Backend: Code viewer doesn't need backend tools
  backend: undefined,
};

export default codeViewerManifest;
