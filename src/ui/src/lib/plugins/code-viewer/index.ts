/**
 * Code Viewer Plugin Entry Point
 *
 * @ds/plugin-code-viewer
 *
 * Exports the code viewer plugin for syntax-highlighted code display.
 */

// Default export: Main plugin component
export { default } from "./CodeViewerPlugin";

// Named exports
export { codeViewerManifest as manifest, codeViewerManifest } from "./manifest";
