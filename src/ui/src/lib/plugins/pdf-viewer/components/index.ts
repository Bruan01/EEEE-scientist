/**
 * PDF Viewer Components Index
 *
 * Central export point for all PDF annotation components.
 *
 * @module plugins/pdf-viewer/components
 */

// Highlight layer for rendering annotations
export {
  HighlightLayer,
  HighlightPreview,
  getRectsFromSelection,
  getTipPosition,
  mergeRects,
} from "./HighlightLayer";

// Annotation creation tip
export { AnnotationTip, QuickAnnotationTip } from "./AnnotationTip";

// Color picker
export { ColorPicker, ColorPickerDropdown, ColorIndicator } from "./ColorPicker";

// Tag input
export { TagInput, TagList, TagManager } from "./TagInput";

// Annotation sidebar
export { AnnotationSidebar } from "./AnnotationSidebar";

// Annotation card
export { AnnotationCard, AnnotationCardSkeleton } from "./AnnotationCard";
