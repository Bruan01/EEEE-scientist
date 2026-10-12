/**
 * PDF Viewer Plugin Manifest
 *
 * @ds/plugin-pdf-viewer
 *
 * Built-in plugin for viewing and annotating PDF documents.
 * Features:
 * - PDF.js-based rendering
 * - Virtual scrolling for large documents
 * - Text selection and copying
 * - AI-powered annotation tools
 */

import type { UnifiedPluginManifest } from "@/lib/types/plugin";

/**
 * PDF Viewer Plugin Manifest Definition
 */
export const pdfViewerManifest: UnifiedPluginManifest = {
  // ============================================================
  // Basic Information
  // ============================================================
  id: "@ds/plugin-pdf-viewer",
  name: "PDF Viewer",
  description: "View and annotate PDF documents with AI assistance",
  version: "1.0.0",
  type: "builtin",
  author: "DeepScientist Team",
  icon: "FileText",

  // ============================================================
  // Frontend Configuration
  // ============================================================
  frontend: {
    entry: "./PdfViewerPlugin",
    renderMode: "react",
    fileAssociations: [
      {
        extensions: [".pdf", ".PDF"],
        mimeTypes: ["application/pdf"],
        priority: 100, // Highest priority for PDF files
      },
    ],
  },

  // ============================================================
  // Backend Configuration
  // ============================================================
  backend: {
    entry: "app.tools.pdf_tools",
    tools: [
      "pdf_read",
      "pdf_read_lines",
      "pdf_search",
      "pdf_guide",
      "pdf_annotate",
      "pdf_jump",
    ],
  },

  // ============================================================
  // Permissions
  // ============================================================
  permissions: {
    frontend: ["file:read", "annotation:read", "annotation:write", "clipboard"],
    backend: ["file:read", "database:read", "database:write", "ai:tool"],
  },

  // ============================================================
  // UI Contributions
  // ============================================================
  contributes: {
    tabIcon: "FileText",
    tabTitle: {
      dynamic: "resourceName",
    },
    slashCommands: [
      {
        name: "annotate",
        description: "Create annotation on current PDF",
        command: "pdf_annotate",
        icon: "Highlighter",
      },
      {
        name: "summarize-pdf",
        description: "Summarize the current PDF document",
        command: "pdf_summarize",
        icon: "FileText",
      },
    ],
    contextMenus: [
      {
        id: "highlight-selection",
        title: "Highlight Selection",
        command: "pdf.highlightSelection",
        context: "editor",
        group: "annotation",
        order: 1,
      },
      {
        id: "ask-ai-about-selection",
        title: "Ask AI About Selection",
        command: "pdf.askAI",
        context: "editor",
        group: "ai",
        order: 2,
      },
    ],
  },

  // ============================================================
  // Configuration Schema
  // ============================================================
  configSchema: {
    type: "object",
    properties: {
      defaultZoom: {
        type: "number",
        default: 1.0,
        minimum: 0.5,
        maximum: 3.0,
        description: "Default zoom level",
      },
      highlightColor: {
        type: "string",
        default: "morandi_blue",
        enum: [
          "morandi_blue",
          "morandi_green",
          "morandi_sand",
          "morandi_rose",
          "morandi_gray",
          "yellow",
          "green",
          "blue",
          "pink",
          "purple",
          "orange",
        ],
        description: "Default highlight color",
      },
      sidebarVisible: {
        type: "boolean",
        default: false,
        description: "Show annotation sidebar by default",
      },
      virtualScrolling: {
        type: "boolean",
        default: true,
        description: "Enable virtual scrolling for performance",
      },
      bufferPages: {
        type: "number",
        default: 2,
        minimum: 1,
        maximum: 5,
        description: "Number of pages to buffer around visible area",
      },
    },
  },

  // ============================================================
  // Default Configuration
  // ============================================================
  defaultConfig: {
    defaultZoom: 1.0,
    highlightColor: "yellow",
    sidebarVisible: false,
    virtualScrolling: true,
    bufferPages: 2,
  },

  // ============================================================
  // Lifecycle Hooks
  // ============================================================
  lifecycle: {
    activationEvents: ["onFile:.pdf"],
    onActivate: "onPdfViewerActivate",
    onDeactivate: "onPdfViewerDeactivate",
  },
};

export default pdfViewerManifest;
