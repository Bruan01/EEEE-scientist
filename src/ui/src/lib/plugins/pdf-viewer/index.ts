/**
 * PDF Viewer Plugin Entry Point
 *
 * @ds/plugin-pdf-viewer
 *
 * Exports the main plugin component and manifest.
 *
 * @module plugins/pdf-viewer
 */

// Main plugin component
export { default, default as PdfViewerPlugin } from "./PdfViewerPlugin";

// Plugin manifest
export { pdfViewerManifest, default as manifest } from "./manifest";

// ============================================================
// Type Exports
// ============================================================

export type {
  // Core types
  Annotation,
  AnnotationContent,
  AnnotationColor,
  AnnotationColorConfig,
  BoundingRect,
  HighlightPosition,

  // Request/Response types
  CreateAnnotationRequest,
  UpdateAnnotationRequest,
  AnnotationListResponse,

  // AI Event types
  AIEvent,
  AIEventType,
  AnnotationCreatedEvent,
  PdfJumpEvent,

  // Viewer state types
  ViewerState,
  ViewerStateActions,
  SelectionState,
  SearchResult,
  ZoomFitMode,

  // Component prop types
  ToolbarProps,
  AnnotationSidebarProps,
  AnnotationCardProps,
  HighlightLayerProps,
  AnnotationTipProps,
  ColorPickerProps,
  TagInputProps,
} from "./types";

// ============================================================
// Constants Exports
// ============================================================

export { ANNOTATION_COLORS, PAGE_DIMENSIONS, ZOOM_LEVELS } from "./types";

// ============================================================
// Component Exports
// ============================================================

// PDF rendering components
export { PdfLoader } from "./components/PdfLoader";
export { PageLayer } from "./components/PageLayer";
export { PdfHighlighter } from "./components/PdfHighlighter";
export { SelectionHandler } from "./components/SelectionHandler";
export { Toolbar } from "./components/Toolbar";

// Annotation components (ANN-001 ~ ANN-008)
export {
  // Highlight rendering
  HighlightLayer,
  HighlightPreview,
  getRectsFromSelection,
  getTipPosition,
  mergeRects,

  // Annotation creation
  AnnotationTip,
  QuickAnnotationTip,

  // Color picker
  ColorPicker,
  ColorPickerDropdown,
  ColorIndicator,

  // Tag input
  TagInput,
  TagList,
  TagManager,

  // Sidebar
  AnnotationSidebar,

  // Card
  AnnotationCard,
  AnnotationCardSkeleton,
} from "./components";

// ============================================================
// Hook Exports
// ============================================================

// Viewer state hooks
export { useViewerState, useScaleActions, usePageNavigation, useSearch } from "./hooks/useViewerState";

// Annotation hooks (ANN-001 ~ ANN-008)
export {
  // Annotation management
  useAnnotations,
  useAnnotation,
  annotationKeys,

  // AI events
  useAIEvents,
} from "./hooks";

export type {
  AIEventHandlers,
  UseAIEventsOptions,
  UseAIEventsReturn,
} from "./hooks";

// ============================================================
// API Exports
// ============================================================

export {
  annotationsApi,
  listAnnotations,
  createAnnotation,
  getAnnotation,
  updateAnnotation,
  deleteAnnotation,
  searchAnnotations,
} from "./api";

// ============================================================
// Utils
// ============================================================

export * from "./lib/pdf-utils";

// ============================================================
// Lifecycle hooks
// ============================================================

export { onPdfViewerActivate, onPdfViewerDeactivate } from "./PdfViewerPlugin";
