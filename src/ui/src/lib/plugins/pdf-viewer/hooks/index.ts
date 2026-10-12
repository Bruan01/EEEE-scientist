/**
 * PDF Viewer Hooks Index
 *
 * Central export point for all PDF viewer hooks.
 *
 * @module plugins/pdf-viewer/hooks
 */

// Annotation data management
export {
  useAnnotations,
  useAnnotation,
  annotationKeys,
} from "./useAnnotations";

// AI events listener
export { useAIEvents } from "./useAIEvents";

export type {
  AIEventHandlers,
  UseAIEventsOptions,
  UseAIEventsReturn,
} from "./useAIEvents";
