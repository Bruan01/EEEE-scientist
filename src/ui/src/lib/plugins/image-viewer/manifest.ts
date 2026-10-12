/**
 * Image Viewer Plugin Manifest
 *
 * @ds/plugin-image-viewer
 *
 * Built-in plugin for viewing images with:
 * - Zoom and pan functionality
 * - Image information display
 * - Rotation controls
 * - Fit-to-screen options
 */

import type { UnifiedPluginManifest } from "@/lib/types/plugin";

/**
 * Image Viewer Plugin Manifest Definition
 */
export const imageViewerManifest: UnifiedPluginManifest = {
  // ============================================================
  // Basic Information
  // ============================================================
  id: "@ds/plugin-image-viewer",
  name: "Image Viewer",
  description: "View images with zoom, pan, and rotation support",
  version: "1.0.0",
  type: "builtin",
  author: "DeepScientist Team",
  icon: "Image",

  // ============================================================
  // Frontend Configuration
  // ============================================================
  frontend: {
    entry: "./ImageViewerPlugin",
    renderMode: "react",
    fileAssociations: [
      {
        extensions: [
          ".png",
          ".jpg",
          ".jpeg",
          ".gif",
          ".webp",
          ".svg",
          ".bmp",
          ".ico",
          ".tiff",
          ".tif",
        ],
        mimeTypes: [
          "image/png",
          "image/jpeg",
          "image/gif",
          "image/webp",
          "image/svg+xml",
          "image/bmp",
          "image/x-icon",
          "image/tiff",
        ],
        priority: 100,
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
    tabIcon: "Image",
  },

  // Backend: Image viewer doesn't need backend tools
  backend: undefined,
};

export default imageViewerManifest;
