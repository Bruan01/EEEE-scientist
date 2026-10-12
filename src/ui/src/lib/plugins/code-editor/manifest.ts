/**
 * Code Editor Plugin Manifest
 *
 * @ds/plugin-code-editor
 *
 * Built-in plugin for editing code/text files with Monaco editor.
 */

import type { UnifiedPluginManifest } from "@/lib/types/plugin";

export const codeEditorManifest: UnifiedPluginManifest = {
  id: "@ds/plugin-code-editor",
  name: "Code Editor",
  description: "VSCode-like code editor (Monaco) with autosave",
  version: "1.0.0",
  type: "builtin",
  author: "DeepScientist Team",
  icon: "Code",
  frontend: {
    entry: "./CodeEditorPlugin",
    renderMode: "react",
    fileAssociations: [
      // High priority for code-like text
      {
        mimeTypes: ["text/x-python", "application/x-python"],
        extensions: [".py", ".pyw", ".pyi"],
        priority: 220,
        isEditor: true,
      },
      {
        mimeTypes: ["application/json", "text/json"],
        extensions: [".json", ".jsonc", ".json5"],
        priority: 220,
        isEditor: true,
      },
      {
        mimeTypes: [
          "text/javascript",
          "application/javascript",
          "text/typescript",
          "application/typescript",
        ],
        extensions: [".js", ".jsx", ".mjs", ".ts", ".tsx", ".mts"],
        priority: 200,
        isEditor: true,
      },
      {
        mimeTypes: ["text/html", "text/css"],
        extensions: [".html", ".htm", ".css", ".scss", ".sass", ".less", ".vue", ".svelte"],
        priority: 190,
        isEditor: true,
      },
      {
        mimeTypes: ["text/x-sh", "application/x-sh", "text/x-sql", "application/sql"],
        extensions: [".sh", ".bash", ".zsh", ".fish", ".ps1", ".sql"],
        priority: 190,
        isEditor: true,
      },
      {
        mimeTypes: ["text/plain", "text/yaml", "application/x-yaml", "text/x-toml", "text/*"],
        extensions: [
          ".txt",
          ".log",
          ".text",
          ".readme",
          ".csv",
          ".yaml",
          ".yml",
          ".toml",
          ".ini",
          ".cfg",
          ".conf",
          ".env",
          ".graphql",
        ],
        priority: 180,
        isEditor: true,
      },
      {
        extensions: [
          ".java",
          ".c",
          ".cc",
          ".cpp",
          ".cxx",
          ".h",
          ".hpp",
          ".hxx",
          ".cs",
          ".go",
          ".rs",
          ".rb",
          ".php",
          ".swift",
          ".kt",
          ".kts",
          ".scala",
          ".r",
          ".m",
          ".mm",
          ".tex",
          ".bib",
          ".xml",
          ".xsl",
          ".xslt",
        ],
        priority: 180,
        isEditor: true,
      },
      {
        mimeTypes: ["text/markdown", "text/x-markdown"],
        extensions: [".md", ".markdown", ".mdx"],
        priority: 60,
        isEditor: true,
      },
    ],
  },
};
