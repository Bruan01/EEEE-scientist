/**
 * PdfHighlighter Component
 *
 * Core component for rendering PDF with virtual scrolling.
 * Only renders visible pages plus a buffer for smooth scrolling.
 *
 * @module plugins/pdf-viewer/components/PdfHighlighter
 */

"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
  memo,
} from "react";
import { cn } from "@/lib/utils";
import type { PDFDocumentProxy } from "./PdfLoader";
import { PageLayer } from "./PageLayer";
import { SelectionHandler } from "./SelectionHandler";
import type {
  Annotation,
  HighlightPosition,
  AnnotationContent,
  SelectionState,
  BoundingRect,
} from "../types";
import {
  PAGE_DIMENSIONS,
  resolveAnnotationColor,
} from "../types";
import { calculateVisiblePages, getCurrentPage, debounce } from "../lib/pdf-utils";

// ============================================================
// Types
// ============================================================

interface PdfHighlighterProps {
  /** PDF document proxy */
  pdfDocument: PDFDocumentProxy;
  /** Scale factor */
  scale: number;
  /** Annotations to display */
  highlights?: Annotation[];
  /** Selection finished callback */
  onSelectionFinished?: (
    position: HighlightPosition,
    content: AnnotationContent,
    hideTip: () => void
  ) => React.ReactNode;
  /** Highlight click callback */
  onHighlightClick?: (highlight: Annotation) => void;
  /** Page change callback */
  onPageChange?: (page: number) => void;
  /** Scroll event callback */
  onScroll?: (scrollTop: number) => void;
  /** Buffer pages around visible area */
  bufferPages?: number;
  /** Selected annotation ID */
  selectedAnnotationId?: string | null;
}

// ============================================================
// Highlight Overlay Component
// ============================================================

interface HighlightOverlayProps {
  annotation: Annotation;
  pageWidth: number;
  pageHeight: number;
  isSelected: boolean;
  onClick: () => void;
}

const HighlightOverlay = memo(function HighlightOverlay({
  annotation,
  pageWidth,
  pageHeight,
  isSelected,
  onClick,
}: HighlightOverlayProps) {
  const colorConfig = resolveAnnotationColor(annotation.color);

  return (
    <>
      {annotation.position.rects.map((rect, index) => {
        const style = {
          left: `${rect.x1}%`,
          top: `${rect.y1}%`,
          width: `${rect.x2 - rect.x1}%`,
          height: `${rect.y2 - rect.y1}%`,
        };

        return (
          <div
            key={`${annotation.id}-${index}`}
            className={cn(
              "absolute cursor-pointer transition-all duration-150",
              isSelected && "ring-2 ring-primary ring-offset-1"
            )}
            style={{
              ...style,
              backgroundColor: colorConfig?.bg || "rgba(255, 255, 0, 0.4)",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            title={annotation.comment || annotation.content.text}
          />
        );
      })}
    </>
  );
});

// ============================================================
// Page Container Component
// ============================================================

interface PageContainerProps {
  pdfDocument: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  isVisible: boolean;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  onHighlightClick?: (highlight: Annotation) => void;
}

const PageContainer = memo(function PageContainer({
  pdfDocument,
  pageNumber,
  scale,
  isVisible,
  annotations,
  selectedAnnotationId,
  onHighlightClick,
}: PageContainerProps) {
  const pageWidth = PAGE_DIMENSIONS.A4_WIDTH * scale;
  const pageHeight = PAGE_DIMENSIONS.A4_HEIGHT * scale;

  // Filter annotations for this page
  const pageAnnotations = useMemo(
    () => annotations.filter((a) => a.position.pageNumber === pageNumber),
    [annotations, pageNumber]
  );

  return (
    <div
      className="pdf-page-wrapper relative"
      style={{
        width: pageWidth,
        height: pageHeight,
        marginBottom: PAGE_DIMENSIONS.PAGE_GAP,
      }}
    >
      {isVisible ? (
        <>
          {/* PDF Page */}
          <PageLayer
            pdfDocument={pdfDocument}
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer
          />

          {/* Highlight Overlay Layer */}
          {pageAnnotations.length > 0 && (
            <div className="absolute inset-0 pointer-events-none">
              {pageAnnotations.map((annotation) => (
                <HighlightOverlay
                  key={annotation.id}
                  annotation={annotation}
                  pageWidth={pageWidth}
                  pageHeight={pageHeight}
                  isSelected={annotation.id === selectedAnnotationId}
                  onClick={() => onHighlightClick?.(annotation)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        /* Placeholder for non-visible pages */
        <div className="w-full h-full bg-muted/30 animate-pulse rounded" />
      )}
    </div>
  );
});

// ============================================================
// Selection Tip Component
// ============================================================

interface SelectionTipProps {
  selection: SelectionState;
}

function SelectionTip({ selection }: SelectionTipProps) {
  return (
    <div
      className="absolute z-50 pointer-events-auto"
      style={{
        left: selection.tipPosition.x,
        top: selection.tipPosition.y,
      }}
    >
      {selection.tipContent}
    </div>
  );
}

// ============================================================
// PdfHighlighter Component
// ============================================================

/**
 * PdfHighlighter Component
 *
 * Renders PDF pages with virtual scrolling for performance.
 * Supports text selection and highlight annotations.
 *
 * @example
 * ```tsx
 * <PdfHighlighter
 *   pdfDocument={pdfDocument}
 *   scale={1.0}
 *   highlights={annotations}
 *   onSelectionFinished={(pos, content, hide) => (
 *     <AnnotationTip onConfirm={...} onCancel={hide} />
 *   )}
 *   onPageChange={setCurrentPage}
 * />
 * ```
 */
export const PdfHighlighter = memo(function PdfHighlighter({
  pdfDocument,
  scale,
  highlights = [],
  onSelectionFinished,
  onHighlightClick,
  onPageChange,
  onScroll,
  bufferPages = 2,
  selectedAnnotationId = null,
}: PdfHighlighterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visiblePages, setVisiblePages] = useState<number[]>([1]);
  const [selection, setSelection] = useState<SelectionState | null>(null);

  const numPages = pdfDocument.numPages;
  const pageHeight =
    PAGE_DIMENSIONS.A4_HEIGHT * scale + PAGE_DIMENSIONS.PAGE_GAP;

  // Handle scroll
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, clientHeight } = container;

    // Calculate visible pages
    const visible = calculateVisiblePages(
      scrollTop,
      clientHeight,
      pageHeight,
      numPages,
      bufferPages
    );
    setVisiblePages(visible);

    // Calculate current page
    const currentPage = getCurrentPage(scrollTop, pageHeight, numPages);
    onPageChange?.(currentPage);

    // Notify scroll position
    onScroll?.(scrollTop);
  }, [pageHeight, numPages, bufferPages, onPageChange, onScroll]);

  // Debounced scroll handler for performance
  const debouncedHandleScroll = useMemo(
    () => debounce(handleScroll, 50),
    [handleScroll]
  );

  // Attach scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial calculation
    handleScroll();

    // Add scroll listener
    container.addEventListener("scroll", debouncedHandleScroll);

    return () => {
      container.removeEventListener("scroll", debouncedHandleScroll);
    };
  }, [handleScroll, debouncedHandleScroll]);

  // Recalculate on scale change
  useEffect(() => {
    handleScroll();
  }, [scale, handleScroll]);

  // Handle selection change
  const handleSelectionChange = useCallback(
    (newSelection: SelectionState | null) => {
      setSelection(newSelection);
    },
    []
  );

  // Handle selection finished
  const handleSelectionFinished = useCallback(
    (
      position: HighlightPosition,
      content: AnnotationContent
    ): React.ReactNode | void => {
      if (!onSelectionFinished) return;

      const hideTip = () => setSelection(null);
      return onSelectionFinished(position, content, hideTip);
    },
    [onSelectionFinished]
  );

  // Clear selection when clicking on empty area
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Only clear if clicking directly on container (not on highlights or text)
    if (e.target === e.currentTarget) {
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "pdf-highlighter relative h-full overflow-auto",
        "bg-muted/20"
      )}
      onClick={handleContainerClick}
    >
      {/* Selection Handler */}
      <SelectionHandler
        containerRef={containerRef}
        scale={scale}
        onSelectionChange={handleSelectionChange}
        onSelectionFinished={handleSelectionFinished}
        enabled={!!onSelectionFinished}
      />

      {/* Pages Container */}
      <div
        className="pdf-pages flex flex-col items-center py-4"
        style={{
          minHeight: numPages * pageHeight,
        }}
      >
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
          <PageContainer
            key={pageNum}
            pdfDocument={pdfDocument}
            pageNumber={pageNum}
            scale={scale}
            isVisible={visiblePages.includes(pageNum)}
            annotations={highlights}
            selectedAnnotationId={selectedAnnotationId}
            onHighlightClick={onHighlightClick}
          />
        ))}
      </div>

      {/* Selection Tip */}
      {selection && <SelectionTip selection={selection} />}
    </div>
  );
});

export default PdfHighlighter;
