/**
 * HighlightLayer Component
 *
 * SVG overlay layer for rendering PDF annotation highlights.
 * Renders highlights at percentage-based coordinates.
 *
 * @module plugins/pdf-viewer/components/HighlightLayer
 */

"use client";

import React, { useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  resolveAnnotationColor,
  type HighlightLayerProps,
  type Annotation,
  type BoundingRect,
} from "../types";

/**
 * Convert percentage coordinates to pixel values
 */
function percentToPixel(
  rect: BoundingRect,
  pageWidth: number,
  pageHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: (rect.x1 / 100) * pageWidth,
    y: (rect.y1 / 100) * pageHeight,
    width: ((rect.x2 - rect.x1) / 100) * pageWidth,
    height: ((rect.y2 - rect.y1) / 100) * pageHeight,
  };
}

/**
 * Individual highlight rectangle
 */
function HighlightRect({
  rect,
  pageWidth,
  pageHeight,
  color,
  isSelected,
  onClick,
}: {
  rect: BoundingRect;
  pageWidth: number;
  pageHeight: number;
  color: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { x, y, width, height } = percentToPixel(rect, pageWidth, pageHeight);

  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={color}
      stroke={isSelected ? "#000" : "transparent"}
      strokeWidth={isSelected ? 2 : 0}
      strokeDasharray={isSelected ? "4 2" : "none"}
      rx={2}
      ry={2}
      style={{ cursor: "pointer" }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="transition-opacity duration-150 hover:opacity-80"
    />
  );
}

/**
 * Single annotation highlight (may contain multiple rects)
 */
function AnnotationHighlight({
  annotation,
  pageWidth,
  pageHeight,
  isSelected,
  onClick,
}: {
  annotation: Annotation;
  pageWidth: number;
  pageHeight: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const colorConfig = resolveAnnotationColor(annotation.color);

  // Use individual line rects if available, otherwise use bounding rect
  const rects = annotation.position.rects.length > 0
    ? annotation.position.rects
    : [annotation.position.boundingRect];

  return (
    <g
      data-annotation-id={annotation.id}
      className={cn(
        "annotation-highlight",
        isSelected && "annotation-highlight--selected"
      )}
    >
      {rects.map((rect, index) => (
        <HighlightRect
          key={`${annotation.id}-rect-${index}`}
          rect={rect}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          color={colorConfig.bg}
          isSelected={isSelected}
          onClick={onClick}
        />
      ))}
    </g>
  );
}

/**
 * HighlightLayer component
 *
 * Renders all annotations as SVG overlays on a PDF page.
 */
export function HighlightLayer({
  annotations,
  pageNumber,
  pageDimensions,
  onAnnotationClick,
  selectedAnnotationId,
}: HighlightLayerProps) {
  // Filter annotations for current page
  const pageAnnotations = useMemo(
    () => annotations.filter((a) => a.position.pageNumber === pageNumber),
    [annotations, pageNumber]
  );

  // Handle annotation click
  const handleClick = useCallback(
    (annotation: Annotation) => {
      onAnnotationClick?.(annotation);
    },
    [onAnnotationClick]
  );

  if (pageAnnotations.length === 0) {
    return null;
  }

  return (
    <svg
      className="highlight-layer absolute inset-0 pointer-events-none"
      width={pageDimensions.width}
      height={pageDimensions.height}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
    >
      {/* Enable pointer events only on the highlights */}
      <g style={{ pointerEvents: "auto" }}>
        {pageAnnotations.map((annotation) => (
          <AnnotationHighlight
            key={annotation.id}
            annotation={annotation}
            pageWidth={pageDimensions.width}
            pageHeight={pageDimensions.height}
            isSelected={annotation.id === selectedAnnotationId}
            onClick={() => handleClick(annotation)}
          />
        ))}
      </g>
    </svg>
  );
}

/**
 * HighlightPreview component
 *
 * Shows a preview of a highlight before it's created.
 */
export function HighlightPreview({
  rects,
  pageWidth,
  pageHeight,
  color = "yellow",
}: {
  rects: BoundingRect[];
  pageWidth: number;
  pageHeight: number;
  color?: string;
}) {
  const colorConfig = resolveAnnotationColor(color);

  return (
    <svg
      className="highlight-preview absolute inset-0 pointer-events-none"
      width={pageWidth}
      height={pageHeight}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
    >
      {rects.map((rect, index) => {
        const { x, y, width, height } = percentToPixel(rect, pageWidth, pageHeight);
        return (
          <rect
            key={index}
            x={x}
            y={y}
            width={width}
            height={height}
            fill={colorConfig.bg}
            stroke={colorConfig.border}
            strokeWidth={1}
            strokeDasharray="4 2"
            rx={2}
            ry={2}
            className="animate-pulse"
          />
        );
      })}
    </svg>
  );
}

/**
 * Calculate bounding rects from text selection ranges
 *
 * Helper utility for converting browser selection to annotation rects.
 */
export function getRectsFromSelection(
  selection: Selection,
  containerElement: HTMLElement
): { rects: BoundingRect[]; boundingRect: BoundingRect } | null {
  if (!selection.rangeCount) return null;

  const range = selection.getRangeAt(0);
  const containerRect = containerElement.getBoundingClientRect();
  const clientRects = range.getClientRects();

  if (clientRects.length === 0) return null;

  // Convert client rects to percentage coordinates
  const rects: BoundingRect[] = Array.from(clientRects).map((rect) => ({
    x1: ((rect.left - containerRect.left) / containerRect.width) * 100,
    y1: ((rect.top - containerRect.top) / containerRect.height) * 100,
    x2: ((rect.right - containerRect.left) / containerRect.width) * 100,
    y2: ((rect.bottom - containerRect.top) / containerRect.height) * 100,
  }));

  // Calculate overall bounding rect
  const boundingRect: BoundingRect = {
    x1: Math.min(...rects.map((r) => r.x1)),
    y1: Math.min(...rects.map((r) => r.y1)),
    x2: Math.max(...rects.map((r) => r.x2)),
    y2: Math.max(...rects.map((r) => r.y2)),
  };

  return { rects, boundingRect };
}

/**
 * Get screen position for annotation tip placement
 */
export function getTipPosition(
  boundingRect: BoundingRect,
  containerElement: HTMLElement
): { x: number; y: number } {
  const containerRect = containerElement.getBoundingClientRect();

  // Position at bottom-center of the bounding rect
  const x = containerRect.left + (boundingRect.x1 + boundingRect.x2) / 2 / 100 * containerRect.width;
  const y = containerRect.top + (boundingRect.y2 / 100) * containerRect.height + 8;

  return { x, y };
}

/**
 * Merge overlapping or adjacent rects
 *
 * Optimization for reducing the number of SVG elements.
 */
export function mergeRects(rects: BoundingRect[]): BoundingRect[] {
  if (rects.length <= 1) return rects;

  // Sort by y1, then by x1
  const sorted = [...rects].sort((a, b) => {
    if (Math.abs(a.y1 - b.y1) < 1) {
      return a.x1 - b.x1;
    }
    return a.y1 - b.y1;
  });

  const merged: BoundingRect[] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Check if on same line (similar y values) and overlapping/adjacent
    const sameLine = Math.abs(current.y1 - next.y1) < 1 && Math.abs(current.y2 - next.y2) < 1;
    const overlapping = current.x2 >= next.x1 - 1;

    if (sameLine && overlapping) {
      // Merge
      current = {
        x1: Math.min(current.x1, next.x1),
        y1: Math.min(current.y1, next.y1),
        x2: Math.max(current.x2, next.x2),
        y2: Math.max(current.y2, next.y2),
      };
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  return merged;
}

export default HighlightLayer;
