/**
 * SelectionHandler Component
 *
 * Handles text selection in PDF documents and converts
 * selection coordinates to percentage-based positions.
 *
 * @module plugins/pdf-viewer/components/SelectionHandler
 */

"use client";

import React, { useEffect, useCallback, useRef } from "react";
import type {
  HighlightPosition,
  AnnotationContent,
  SelectionState,
  BoundingRect,
} from "../types";
import { findPageElement, clientRectsToPercent, getBoundingRect } from "../lib/pdf-utils";

// ============================================================
// Types
// ============================================================

interface SelectionHandlerProps {
  /** Container ref to attach event handlers */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Scale factor for coordinate calculation */
  scale: number;
  /** Selection change callback */
  onSelectionChange: (selection: SelectionState | null) => void;
  /** Selection finished callback (returns tip content) */
  onSelectionFinished: (
    position: HighlightPosition,
    content: AnnotationContent
  ) => React.ReactNode | void;
  /** Enabled state */
  enabled?: boolean;
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get non-overlapping client rects from a range
 */
function getClientRects(range: Range): DOMRect[] {
  const rects = Array.from(range.getClientRects());

  // Filter out zero-size rects
  return rects.filter((rect) => rect.width > 0 && rect.height > 0);
}

/**
 * Calculate tip position from selection rects
 */
function calculateTipPosition(
  rects: DOMRect[],
  containerRect: DOMRect
): { x: number; y: number } {
  if (rects.length === 0) {
    return { x: 0, y: 0 };
  }

  // Get the last rect (end of selection)
  const lastRect = rects[rects.length - 1];

  // Position tip at the bottom-right of selection
  return {
    x: lastRect.right - containerRect.left + 8,
    y: lastRect.bottom - containerRect.top + 8,
  };
}

// ============================================================
// SelectionHandler Component
// ============================================================

/**
 * SelectionHandler Component
 *
 * Invisible component that monitors text selection in PDF pages
 * and converts them to percentage-based coordinates for annotations.
 *
 * @example
 * ```tsx
 * <SelectionHandler
 *   containerRef={containerRef}
 *   scale={1.0}
 *   onSelectionChange={setSelection}
 *   onSelectionFinished={(pos, content) => (
 *     <AnnotationTip position={pos} content={content} />
 *   )}
 * />
 * ```
 */
export function SelectionHandler({
  containerRef,
  scale,
  onSelectionChange,
  onSelectionFinished,
  enabled = true,
}: SelectionHandlerProps) {
  const isSelectingRef = useRef(false);

  // Handle mouseup to capture selection
  const handleMouseUp = useCallback(() => {
    if (!enabled) return;

    // Small delay to ensure selection is complete
    requestAnimationFrame(() => {
      const selection = window.getSelection();

      // No selection or collapsed (just a click)
      if (!selection || selection.isCollapsed) {
        onSelectionChange(null);
        return;
      }

      const selectedText = selection.toString().trim();

      // No text selected
      if (!selectedText) {
        onSelectionChange(null);
        return;
      }

      // Get the selection range
      const range = selection.getRangeAt(0);
      const rects = getClientRects(range);

      if (rects.length === 0) {
        onSelectionChange(null);
        return;
      }

      // Find the page element containing the selection
      const pageElement = findPageElement(range.startContainer);
      if (!pageElement) {
        console.warn("Selection not within a PDF page");
        onSelectionChange(null);
        return;
      }

      // Get page number from data attribute
      const pageNumber = parseInt(
        pageElement.dataset.pageNumber || "1",
        10
      );

      // Convert rects to percentage coordinates
      const percentRects = clientRectsToPercent(rects, pageElement);
      const boundingRect = getBoundingRect(percentRects);

      // Create highlight position
      const position: HighlightPosition = {
        boundingRect,
        rects: percentRects,
        pageNumber,
      };

      // Create content
      const content: AnnotationContent = {
        text: selectedText,
      };

      // Calculate tip position relative to container
      const container = containerRef.current;
      if (!container) {
        onSelectionChange(null);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const tipPosition = calculateTipPosition(rects, containerRect);

      // Call the selection finished callback to get tip content
      const tipContent = onSelectionFinished(position, content);

      // Update selection state
      onSelectionChange({
        position,
        content,
        tipPosition,
        tipContent: tipContent || undefined,
      });
    });
  }, [enabled, containerRef, onSelectionChange, onSelectionFinished]);

  // Handle mousedown to track selection start
  const handleMouseDown = useCallback(() => {
    if (!enabled) return;
    isSelectingRef.current = true;

    // Clear any existing selection state when starting new selection
    onSelectionChange(null);
  }, [enabled, onSelectionChange]);

  // Handle click outside to clear selection
  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (!enabled) return;

      const container = containerRef.current;
      if (!container) return;

      // Check if click is outside the container
      if (!container.contains(event.target as Node)) {
        window.getSelection()?.removeAllRanges();
        onSelectionChange(null);
      }
    },
    [enabled, containerRef, onSelectionChange]
  );

  // Handle keydown for escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      if (event.key === "Escape") {
        window.getSelection()?.removeAllRanges();
        onSelectionChange(null);
      }
    },
    [enabled, onSelectionChange]
  );

  // Attach event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    container.addEventListener("mousedown", handleMouseDown);
    container.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      container.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    containerRef,
    enabled,
    handleMouseDown,
    handleMouseUp,
    handleClickOutside,
    handleKeyDown,
  ]);

  // This component doesn't render anything visible
  return null;
}

export default SelectionHandler;
