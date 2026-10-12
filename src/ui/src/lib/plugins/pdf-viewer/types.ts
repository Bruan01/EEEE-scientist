/**
 * PDF Viewer Plugin Type Definitions
 *
 * Types for PDF annotations and highlighting functionality.
 *
 * @module plugins/pdf-viewer/types
 */

// ============================================================
// Annotation Types
// ============================================================

/**
 * Bounding rectangle (percentage coordinates)
 *
 * Coordinate system:
 * - Origin (0, 0) is at the top-left corner of the PDF page
 * - x-axis extends right (positive), y-axis extends down (positive)
 * - All values are percentages of page dimensions (0-100)
 * - Scale-independent: coordinates remain constant regardless of zoom level
 * - Calculation: pixelValue / pageSize * 100
 */
export interface BoundingRect {
  /** Left margin percentage (0-100), relative to page width */
  x1: number;
  /** Top margin percentage (0-100), relative to page height */
  y1: number;
  /** Right margin percentage (0-100), relative to page width */
  x2: number;
  /** Bottom margin percentage (0-100), relative to page height */
  y2: number;
  /** Normalization width (react-pdf-highlighter Scaled); optional for legacy callers */
  width?: number;
  /** Normalization height (react-pdf-highlighter Scaled); optional for legacy callers */
  height?: number;
  /** Optional per-rect page number */
  pageNumber?: number;
}

export type AnnotationKind = "note" | "question" | "task";

export interface AnnotationAuthor {
  id: string;
  handle: string;
  color: string; // hex
}

/**
 * Highlight position in the PDF
 */
export interface HighlightPosition {
  /** Overall bounding box (percentage coordinates) */
  boundingRect: BoundingRect;
  /** Individual line rectangles (for precise highlight rendering) */
  rects: BoundingRect[];
  /** Page number (1-indexed) */
  pageNumber: number;
}

/**
 * Annotation content
 */
export interface AnnotationContent {
  /** Selected text */
  text?: string;
  /** Area screenshot (Base64, for image annotations) */
  image?: string;
}

// ============================================================
// Legacy Color Presets (backwards compatibility)
// ============================================================

export type AnnotationColor = string;

export interface AnnotationColorConfig {
  bg: string;
  border: string;
  label: string;
  description: string;
}

export const ANNOTATION_COLORS: Record<string, AnnotationColorConfig> = {
  morandi_blue: {
    bg: "rgba(63, 90, 107, 0.32)",
    border: "#3F5A6B",
    label: "Morandi Blue",
    description: "Calm focus",
  },
  morandi_green: {
    bg: "rgba(107, 125, 109, 0.32)",
    border: "#6B7D6D",
    label: "Morandi Green",
    description: "Subtle emphasis",
  },
  morandi_sand: {
    bg: "rgba(201, 183, 161, 0.32)",
    border: "#C9B7A1",
    label: "Morandi Sand",
    description: "Warm neutral",
  },
  morandi_rose: {
    bg: "rgba(181, 139, 138, 0.32)",
    border: "#B58B8A",
    label: "Morandi Rose",
    description: "Soft highlight",
  },
  morandi_gray: {
    bg: "rgba(141, 143, 147, 0.32)",
    border: "#8D8F93",
    label: "Morandi Gray",
    description: "Quiet contrast",
  },
  yellow: {
    bg: "rgba(241, 233, 208, 0.62)",
    border: "#F1E9D0",
    label: "Yellow",
    description: "Soft highlight",
  },
  green: {
    bg: "rgba(217, 234, 211, 0.45)",
    border: "#D9EAD3",
    label: "Green",
    description: "Important",
  },
  blue: {
    bg: "rgba(221, 231, 242, 0.45)",
    border: "#DDE7F2",
    label: "Blue",
    description: "Reference",
  },
  pink: {
    bg: "rgba(244, 221, 227, 0.45)",
    border: "#F4DDE3",
    label: "Pink",
    description: "Key point",
  },
  orange: {
    bg: "rgba(247, 225, 198, 0.45)",
    border: "#F7E1C6",
    label: "Orange",
    description: "To-do",
  },
  purple: {
    bg: "rgba(217, 210, 233, 0.45)",
    border: "#D9D2E9",
    label: "Purple",
    description: "Context",
  },
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = Number.parseInt(match[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function resolveAnnotationColor(color?: string): AnnotationColorConfig {
  if (!color) return ANNOTATION_COLORS.yellow;
  const key = color.trim();
  const preset = ANNOTATION_COLORS[key];
  if (preset) return preset;

  const rgb = hexToRgb(key);
  if (!rgb) return ANNOTATION_COLORS.yellow;

  return {
    bg: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.32)`,
    border: key.toUpperCase(),
    label: "Custom",
    description: "Custom color",
  };
}

/**
 * Full annotation data structure
 */
export interface Annotation {
  /** Unique annotation ID */
  id: string;

  /** Position information */
  position: HighlightPosition;

  /** Annotation content */
  content: AnnotationContent;

  /** User comment/note */
  comment: string;

  /** Annotation kind/category */
  kind: AnnotationKind;

  /** Highlight color */
  color: string; // hex (always equals author color)

  /** Tag list */
  tags: string[];

  /** Creator user ID */
  createdBy: string;

  /** Author metadata (handle + color) */
  author?: AnnotationAuthor | null;

  /** Creation timestamp (ISO format) */
  createdAt: string;

  /** Last update timestamp (ISO format) */
  updatedAt: string;

  /** Associated file ID */
  fileId: string;

  /** Associated project ID */
  projectId: string;
}

// ============================================================
// API Request/Response Types
// ============================================================

/**
 * Create annotation request
 */
export interface CreateAnnotationRequest {
  fileId: string;
  position: HighlightPosition;
  content: AnnotationContent;
  comment?: string;
  kind?: AnnotationKind;
  color?: string; // backwards-compatible; ignored by server
  tags?: string[];
}

/**
 * Update annotation request
 */
export interface UpdateAnnotationRequest {
  comment?: string;
  kind?: AnnotationKind;
  position?: HighlightPosition;
  content?: AnnotationContent;
  color?: string; // ignored by server
  tags?: string[];
}

/**
 * Annotation list response
 */
export interface AnnotationListResponse {
  items: Annotation[];
  total: number;
  page?: number;
  limit?: number;
}

// ============================================================
// AI Event Types
// ============================================================

/**
 * AI event types for UI synchronization
 */
export type AIEventType =
  | "annotation:created"
  | "annotation:updated"
  | "annotation:deleted"
  | "pdf:jump";

/**
 * Annotation created event data
 */
export interface AnnotationCreatedEvent {
  fileId: string;
  annotationId: string;
  page: number;
  fileName?: string;
  color?: string;
  colorName?: string;
  position?: HighlightPosition;
  tags?: string[];
  source?: string;
  text?: string;
  comment?: string;
}

/**
 * PDF jump event data
 */
export interface PdfJumpEvent {
  fileId: string;
  page: number;
  fileName?: string;
  position?: {
    x: number;
    y: number;
  };
  rects?: BoundingRect[];
  boundingRect?: BoundingRect;
  color?: string;
  colorName?: string;
  mode?: "guide" | "annotate";
  durationMs?: number;
  text?: string;
  startLine?: number;
  endLine?: number;
  annotationId?: string;
}

/**
 * AI event payload
 */
export interface AIEvent {
  type: AIEventType;
  data: AnnotationCreatedEvent | PdfJumpEvent | Record<string, unknown>;
}

// ============================================================
// Component Props Types
// ============================================================

/**
 * Highlight layer props
 */
export interface HighlightLayerProps {
  /** List of annotations to render */
  annotations: Annotation[];
  /** Current page number */
  pageNumber: number;
  /** Page dimensions */
  pageDimensions: {
    width: number;
    height: number;
  };
  /** Callback when an annotation is clicked */
  onAnnotationClick?: (annotation: Annotation) => void;
  /** Currently selected annotation ID */
  selectedAnnotationId?: string;
}

/**
 * Annotation tip props
 */
export interface AnnotationTipProps {
  /** Position to display the tip */
  position: { x: number; y: number };
  /** Selected text content */
  selectedText: string;
  /** Callback when annotation is confirmed */
  onConfirm: (comment: string, color: AnnotationColor, tags: string[]) => void;
  /** Callback when annotation is cancelled */
  onCancel: () => void;
}

/**
 * Color picker props
 */
export interface ColorPickerProps {
  /** Current selected color */
  value: AnnotationColor;
  /** Callback when color changes */
  onChange: (color: AnnotationColor) => void;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

/**
 * Tag input props
 */
export interface TagInputProps {
  /** Callback when a tag is added */
  onAdd: (tag: string) => void;
  /** Callback when cancelled */
  onCancel: () => void;
  /** Suggested tags */
  suggestions?: string[];
}

/**
 * Annotation card props
 */
export interface AnnotationCardProps {
  /** Annotation data */
  annotation: Annotation;
  /** Click callback */
  onClick: () => void;
  /** Delete callback */
  onDelete: () => void;
  /** Update callback */
  onUpdate: (updates: UpdateAnnotationRequest) => void;
  /** Whether the card is selected */
  isSelected?: boolean;
}

/**
 * Annotation sidebar props
 */
export interface AnnotationSidebarProps {
  /** List of annotations */
  annotations: Annotation[];
  /** Loading state */
  isLoading: boolean;
  /** Callback when an annotation is selected */
  onSelect: (id: string) => void;
  /** Callback when an annotation is deleted */
  onDelete: (id: string) => void;
  /** Callback when an annotation is updated */
  onUpdate: (id: string, updates: UpdateAnnotationRequest) => void;
  /** Currently selected annotation ID */
  selectedAnnotationId?: string;
}

// ============================================================
// PDF Viewer State Types
// ============================================================

/**
 * Zoom fit mode
 */
export type ZoomFitMode = "page-width" | "page-fit" | "actual-size" | "custom";

/**
 * Search result item
 */
export interface SearchResult {
  pageNumber: number;
  text: string;
  position: BoundingRect;
}

/**
 * PDF Viewer state interface
 */
export interface ViewerState {
  /** Current scale/zoom level (1.0 = 100%) */
  scale: number;
  /** Zoom fit mode */
  fitMode: ZoomFitMode;
  /** Current visible page number */
  currentPage: number;
  /** Total pages in document */
  totalPages: number;
  /** Scroll position */
  scrollTop: number;
  /** Search query */
  searchQuery: string;
  /** Search results */
  searchResults: SearchResult[];
  /** Current search result index */
  currentSearchIndex: number;
  /** Whether sidebar is visible */
  sidebarVisible: boolean;
  /** Selected annotation ID */
  selectedAnnotationId: string | null;
}

/**
 * Viewer state actions interface
 */
export interface ViewerStateActions {
  /** Set scale/zoom level */
  setScale: (scale: number) => void;
  /** Set fit mode */
  setFitMode: (mode: ZoomFitMode) => void;
  /** Set current page */
  setCurrentPage: (page: number) => void;
  /** Set total pages */
  setTotalPages: (total: number) => void;
  /** Set scroll position */
  setScrollTop: (scrollTop: number) => void;
  /** Scroll to specific page */
  scrollToPage: (page: number) => void;
  /** Set search query */
  setSearchQuery: (query: string) => void;
  /** Set search results */
  setSearchResults: (results: SearchResult[]) => void;
  /** Go to next search result */
  nextSearchResult: () => void;
  /** Go to previous search result */
  prevSearchResult: () => void;
  /** Toggle sidebar visibility */
  toggleSidebar: () => void;
  /** Select annotation */
  selectAnnotation: (id: string | null) => void;
  /** Scroll to annotation */
  scrollToAnnotation: (id: string) => void;
  /** Reset state */
  reset: () => void;
}

// ============================================================
// Selection Types
// ============================================================

/**
 * Current text selection state
 */
export interface SelectionState {
  /** Position of the selection */
  position: HighlightPosition;
  /** Content of the selection */
  content: AnnotationContent;
  /** Screen position for tooltip */
  tipPosition: { x: number; y: number };
  /** Rendered tip content */
  tipContent?: React.ReactNode;
}

// ============================================================
// Page Dimensions
// ============================================================

/**
 * Standard page dimensions in points (A4)
 */
export const PAGE_DIMENSIONS = {
  /** A4 width in points */
  A4_WIDTH: 595,
  /** A4 height in points */
  A4_HEIGHT: 842,
  /** Gap between pages in pixels */
  PAGE_GAP: 16,
} as const;

/**
 * Zoom level presets
 */
export const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as const;

// ============================================================
// Toolbar Props Types
// ============================================================

/**
 * Toolbar component props
 */
export interface ToolbarProps {
  /** Current scale */
  scale: number;
  /** Scale change callback */
  onScaleChange: (scale: number) => void;
  /** Current page number */
  currentPage: number;
  /** Total pages */
  totalPages: number;
  /** Page change callback */
  onPageChange: (page: number) => void;
  /** Sidebar visibility */
  sidebarVisible: boolean;
  /** Sidebar toggle callback */
  onSidebarToggle: () => void;
  /** Search query */
  searchQuery?: string;
  /** Search query change callback */
  onSearchChange?: (query: string) => void;
  /** Download callback */
  onDownload?: () => void;
  /** Paper info callback */
  onInfo?: () => void;
  /** Paper info disabled */
  infoDisabled?: boolean;
  /** Markdown view active */
  markdownActive?: boolean;
  /** Markdown toggle callback */
  onMarkdownToggle?: () => void;
  /** Markdown/summary button label */
  markdownLabel?: string;
  /** Markdown/summary button title */
  markdownTitle?: string;
  /** Review opinion view active */
  reviewOpinionActive?: boolean;
  /** Review opinion toggle callback */
  onReviewOpinionToggle?: () => void;
  /** Review opinion button label */
  reviewOpinionLabel?: string;
  /** Review opinion button title */
  reviewOpinionTitle?: string;
}
