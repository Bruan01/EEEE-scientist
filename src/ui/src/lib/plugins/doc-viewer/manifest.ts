/**
 * Document Viewer Plugin Manifest
 *
 * @ds/plugin-doc-viewer
 *
 * Built-in plugin for viewing Office documents:
 * - Word documents (.docx, .doc)
 * - Excel spreadsheets (.xlsx, .xls)
 * - PowerPoint presentations (.pptx, .ppt)
 * - OpenDocument formats (.odt, .ods, .odp)
 */

import type { UnifiedPluginManifest } from "@/lib/types/plugin";

/**
 * Document Viewer Plugin Manifest Definition
 */
export const docViewerManifest: UnifiedPluginManifest = {
  // ============================================================
  // Basic Information
  // ============================================================
  id: "@ds/plugin-doc-viewer",
  name: "Document Viewer",
  description: "View Office documents including Word, Excel, and PowerPoint",
  version: "1.0.0",
  type: "builtin",
  author: "DeepScientist Team",
  icon: "FileSpreadsheet",

  // ============================================================
  // Frontend Configuration
  // ============================================================
  frontend: {
    entry: "./DocViewerPlugin",
    renderMode: "react",
    fileAssociations: [
      // Microsoft Office formats
      {
        extensions: [".docx", ".doc"],
        mimeTypes: [
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/msword",
        ],
        priority: 70,
      },
      {
        extensions: [".xlsx", ".xls"],
        mimeTypes: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
        ],
        priority: 70,
      },
      {
        extensions: [".pptx", ".ppt"],
        mimeTypes: [
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "application/vnd.ms-powerpoint",
        ],
        priority: 70,
      },
      // OpenDocument formats
      {
        extensions: [".odt", ".ods", ".odp"],
        mimeTypes: [
          "application/vnd.oasis.opendocument.text",
          "application/vnd.oasis.opendocument.spreadsheet",
          "application/vnd.oasis.opendocument.presentation",
        ],
        priority: 70,
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
    tabIcon: "FileSpreadsheet",
  },

  // Backend: Doc viewer doesn't need backend tools
  backend: undefined,
};

export default docViewerManifest;
