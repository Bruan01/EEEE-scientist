/**
 * PDF Utility Functions
 *
 * Helper functions for PDF rendering and manipulation.
 *
 * @module plugins/pdf-viewer/lib/pdf-utils
 */

import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { BoundingRect, PAGE_DIMENSIONS } from "../types";

// ============================================================
// Worker Configuration
// ============================================================

/**
 * PDF.js worker source URL
 *
 * Import the worker as a Vite asset so the final URL is emitted under `/ui/assets/...`
 * instead of falling through the SPA router at the site root.
 */
export const PDF_WORKER_SRC = pdfWorkerUrl;

/**
 * CMap URL for PDF.js (for non-standard character encodings)
 */
export const PDF_CMAP_URL: string | undefined = undefined;

/**
 * Whether PDF.js should treat CMap assets as packed.
 */
export const PDF_CMAP_PACKED = false;

// ============================================================
// Coordinate Conversion
// ============================================================

/**
 * Convert pixel coordinates to percentage coordinates
 *
 * @param rect - Pixel-based rectangle
 * @param pageWidth - Page width in pixels
 * @param pageHeight - Page height in pixels
 * @returns Percentage-based rectangle (0-100)
 */
export function pixelToPercent(
  rect: { x: number; y: number; width: number; height: number },
  pageWidth: number,
  pageHeight: number
): BoundingRect {
  return {
    x1: (rect.x / pageWidth) * 100,
    y1: (rect.y / pageHeight) * 100,
    x2: ((rect.x + rect.width) / pageWidth) * 100,
    y2: ((rect.y + rect.height) / pageHeight) * 100,
  };
}

/**
 * Convert percentage coordinates to pixel coordinates
 *
 * @param rect - Percentage-based rectangle (0-100)
 * @param pageWidth - Page width in pixels
 * @param pageHeight - Page height in pixels
 * @returns Pixel-based rectangle
 */
export function percentToPixel(
  rect: BoundingRect,
  pageWidth: number,
  pageHeight: number
): { x: number; y: number; width: number; height: number } {
  const x1 = (rect.x1 / 100) * pageWidth;
  const y1 = (rect.y1 / 100) * pageHeight;
  const x2 = (rect.x2 / 100) * pageWidth;
  const y2 = (rect.y2 / 100) * pageHeight;

  return {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
  };
}

/**
 * Get bounding rectangle from multiple rectangles
 *
 * @param rects - Array of rectangles
 * @returns Bounding rectangle encompassing all input rectangles
 */
export function getBoundingRect(rects: BoundingRect[]): BoundingRect {
  if (rects.length === 0) {
    return { x1: 0, y1: 0, x2: 0, y2: 0 };
  }

  return {
    x1: Math.min(...rects.map((r) => r.x1)),
    y1: Math.min(...rects.map((r) => r.y1)),
    x2: Math.max(...rects.map((r) => r.x2)),
    y2: Math.max(...rects.map((r) => r.y2)),
  };
}

// ============================================================
// Page Calculation
// ============================================================

/**
 * Calculate visible pages based on scroll position
 *
 * @param scrollTop - Current scroll position
 * @param clientHeight - Viewport height
 * @param pageHeight - Height of a single page (including gap)
 * @param totalPages - Total number of pages
 * @param buffer - Number of pages to buffer around visible area
 * @returns Array of visible page numbers (1-indexed)
 */
export function calculateVisiblePages(
  scrollTop: number,
  clientHeight: number,
  pageHeight: number,
  totalPages: number,
  buffer: number = 2
): number[] {
  const startPage = Math.floor(scrollTop / pageHeight) + 1;
  const endPage = Math.ceil((scrollTop + clientHeight) / pageHeight);

  const visible: number[] = [];
  for (
    let i = Math.max(1, startPage - buffer);
    i <= Math.min(totalPages, endPage + buffer);
    i++
  ) {
    visible.push(i);
  }

  return visible;
}

/**
 * Calculate current page number from scroll position
 *
 * @param scrollTop - Current scroll position
 * @param pageHeight - Height of a single page (including gap)
 * @param totalPages - Total number of pages
 * @returns Current page number (1-indexed)
 */
export function getCurrentPage(
  scrollTop: number,
  pageHeight: number,
  totalPages: number
): number {
  const page = Math.floor(scrollTop / pageHeight) + 1;
  return Math.min(Math.max(1, page), totalPages);
}

/**
 * Calculate scroll position for a specific page
 *
 * @param pageNumber - Target page number (1-indexed)
 * @param pageHeight - Height of a single page (including gap)
 * @returns Scroll position in pixels
 */
export function getScrollPositionForPage(
  pageNumber: number,
  pageHeight: number
): number {
  return (pageNumber - 1) * pageHeight;
}

// ============================================================
// Scale Calculation
// ============================================================

/**
 * Calculate scale to fit page width in container
 *
 * @param containerWidth - Container width in pixels
 * @param pageWidth - Original page width in points
 * @param padding - Horizontal padding in pixels
 * @returns Scale factor
 */
export function calculateFitWidthScale(
  containerWidth: number,
  pageWidth: number,
  padding: number = 32
): number {
  return (containerWidth - padding) / pageWidth;
}

/**
 * Calculate scale to fit entire page in container
 *
 * @param containerWidth - Container width in pixels
 * @param containerHeight - Container height in pixels
 * @param pageWidth - Original page width in points
 * @param pageHeight - Original page height in points
 * @param padding - Padding in pixels
 * @returns Scale factor
 */
export function calculateFitPageScale(
  containerWidth: number,
  containerHeight: number,
  pageWidth: number,
  pageHeight: number,
  padding: number = 32
): number {
  const widthScale = (containerWidth - padding) / pageWidth;
  const heightScale = (containerHeight - padding) / pageHeight;
  return Math.min(widthScale, heightScale);
}

// ============================================================
// Text Layer Utilities
// ============================================================

/**
 * Find the page element containing a DOM node
 *
 * @param node - DOM node to search from
 * @returns Page element or null if not found
 */
export function findPageElement(node: Node): HTMLElement | null {
  let current: Node | null = node;
  while (current) {
    if (
      current instanceof HTMLElement &&
      current.dataset.pageNumber !== undefined
    ) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

/**
 * Get text content from a selection range within PDF text layer
 *
 * @param range - Selection range
 * @returns Selected text content
 */
export function getTextFromRange(range: Range): string {
  return range.toString().trim();
}

/**
 * Convert client rects to percentage coordinates relative to page
 *
 * @param rects - Array of DOMRect objects
 * @param pageElement - Page container element
 * @returns Array of percentage-based rectangles
 */
export function clientRectsToPercent(
  rects: DOMRect[],
  pageElement: HTMLElement
): BoundingRect[] {
  const pageRect = pageElement.getBoundingClientRect();

  return rects.map((rect) => ({
    x1: ((rect.left - pageRect.left) / pageRect.width) * 100,
    y1: ((rect.top - pageRect.top) / pageRect.height) * 100,
    x2: ((rect.right - pageRect.left) / pageRect.width) * 100,
    y2: ((rect.bottom - pageRect.top) / pageRect.height) * 100,
  }));
}

// ============================================================
// Canvas Caching
// ============================================================

/**
 * Page cache for rendered canvases
 */
const pageCache = new Map<string, HTMLCanvasElement>();
const MAX_CACHE_SIZE = 20;

/**
 * Generate cache key for a page render
 *
 * @param pageNumber - Page number
 * @param scale - Scale factor
 * @returns Cache key string
 */
export function getCacheKey(pageNumber: number, scale: number): string {
  return `${pageNumber}-${scale.toFixed(2)}`;
}

/**
 * Get cached canvas for a page
 *
 * @param pageNumber - Page number
 * @param scale - Scale factor
 * @returns Cached canvas or undefined
 */
export function getCachedCanvas(
  pageNumber: number,
  scale: number
): HTMLCanvasElement | undefined {
  return pageCache.get(getCacheKey(pageNumber, scale));
}

/**
 * Store canvas in cache
 *
 * @param pageNumber - Page number
 * @param scale - Scale factor
 * @param canvas - Canvas element to cache
 */
export function setCachedCanvas(
  pageNumber: number,
  scale: number,
  canvas: HTMLCanvasElement
): void {
  const key = getCacheKey(pageNumber, scale);

  // Remove oldest entry if cache is full
  if (pageCache.size >= MAX_CACHE_SIZE) {
    const firstKey = pageCache.keys().next().value;
    if (firstKey !== undefined) {
      pageCache.delete(firstKey);
    }
  }

  pageCache.set(key, canvas);
}

/**
 * Clear the page cache
 */
export function clearPageCache(): void {
  pageCache.clear();
}

// ============================================================
// Debounce Utility
// ============================================================

/**
 * Debounce a function
 *
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// ============================================================
// PDF Document Info
// ============================================================

/**
 * Get PDF document metadata
 *
 * @param pdfDocument - PDF document proxy
 * @returns Document metadata
 */
export async function getPdfMetadata(pdfDocument: {
  getMetadata: () => Promise<{
    info?: Record<string, unknown>;
    metadata?: unknown;
  }>;
}): Promise<Record<string, unknown>> {
  try {
    const { info } = await pdfDocument.getMetadata();
    return info || {};
  } catch {
    return {};
  }
}
