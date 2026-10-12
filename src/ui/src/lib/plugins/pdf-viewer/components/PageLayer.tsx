/**
 * PageLayer Component
 *
 * Renders a single PDF page with canvas and text layer.
 * Supports zooming and text selection.
 *
 * @module plugins/pdf-viewer/components/PageLayer
 */

"use client";

import React, { useRef, useEffect, useState, useCallback, memo } from "react";
import { cn } from "@/lib/utils";
import type { PDFDocumentProxy, PDFPageProxy, PDFViewport } from "./PdfLoader";

// ============================================================
// Types
// ============================================================

interface PageLayerProps {
  /** PDF document proxy */
  pdfDocument: PDFDocumentProxy;
  /** Page number to render (1-indexed) */
  pageNumber: number;
  /** Scale factor */
  scale: number;
  /** Whether to render text layer for selection */
  renderTextLayer?: boolean;
  /** Page render complete callback */
  onRenderComplete?: () => void;
  /** Additional class name */
  className?: string;
}

interface TextItem {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
  fontName?: string;
}

// ============================================================
// Canvas Layer Component
// ============================================================

interface CanvasLayerProps {
  page: PDFPageProxy;
  viewport: PDFViewport;
  onRenderComplete?: () => void;
}

const CanvasLayer = memo(function CanvasLayer({
  page,
  viewport,
  onRenderComplete,
}: CanvasLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    // Cancel any existing render
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // Ignore cancel errors
      }
    }

    // Set canvas dimensions
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Create render task
    const renderTask = page.render({
      canvasContext: context,
      viewport,
    });

    renderTaskRef.current = renderTask;

    // Wait for render to complete
    renderTask.promise
      .then(() => {
        onRenderComplete?.();
      })
      .catch((err: Error) => {
        // Ignore cancellation errors
        if (err.name !== "RenderingCancelledException") {
          console.error("Canvas render error:", err);
        }
      });

    return () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore cancel errors
        }
      }
    };
  }, [page, viewport, onRenderComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0"
      style={{
        width: viewport.width,
        height: viewport.height,
      }}
    />
  );
});

// ============================================================
// Text Layer Component
// ============================================================

interface TextLayerProps {
  page: PDFPageProxy;
  viewport: PDFViewport;
}

const TextLayer = memo(function TextLayer({ page, viewport }: TextLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [textItems, setTextItems] = useState<TextItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadTextContent() {
      try {
        const textContent = await page.getTextContent();
        if (!cancelled) {
          setTextItems(textContent.items as TextItem[]);
        }
      } catch (err) {
        console.error("Text content load error:", err);
      }
    }

    loadTextContent();

    return () => {
      cancelled = true;
    };
  }, [page]);

  // Render text items
  return (
    <div
      ref={containerRef}
      className="absolute top-0 left-0 text-transparent pointer-events-auto select-text"
      style={{
        width: viewport.width,
        height: viewport.height,
        lineHeight: 1,
      }}
    >
      {textItems.map((item, index) => {
        // Calculate position from transform matrix
        // transform = [scaleX, skewX, skewY, scaleY, translateX, translateY]
        const transform = item.transform;
        const fontSize = Math.sqrt(
          transform[2] * transform[2] + transform[3] * transform[3]
        );
        const x = transform[4] * viewport.scale;
        const y = viewport.height - transform[5] * viewport.scale;

        return (
          <span
            key={index}
            style={{
              position: "absolute",
              left: x,
              top: y - fontSize * viewport.scale,
              fontSize: `${fontSize * viewport.scale}px`,
              fontFamily: item.fontName || "sans-serif",
              whiteSpace: "pre",
              transformOrigin: "left bottom",
            }}
          >
            {item.str}
          </span>
        );
      })}
    </div>
  );
});

// ============================================================
// PageLayer Component
// ============================================================

/**
 * PageLayer Component
 *
 * Renders a single PDF page with canvas for display and
 * transparent text layer for selection.
 *
 * @example
 * ```tsx
 * <PageLayer
 *   pdfDocument={pdfDocument}
 *   pageNumber={1}
 *   scale={1.5}
 *   renderTextLayer
 * />
 * ```
 */
export const PageLayer = memo(function PageLayer({
  pdfDocument,
  pageNumber,
  scale,
  renderTextLayer = true,
  onRenderComplete,
  className,
}: PageLayerProps) {
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [viewport, setViewport] = useState<PDFViewport | null>(null);
  const [loading, setLoading] = useState(true);

  // Load page
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function loadPage() {
      try {
        const loadedPage = await pdfDocument.getPage(pageNumber);
        if (!cancelled) {
          setPage(loadedPage);
          setLoading(false);
        }
      } catch (err) {
        console.error(`Failed to load page ${pageNumber}:`, err);
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      cancelled = true;
    };
  }, [pdfDocument, pageNumber]);

  // Update viewport when scale changes
  useEffect(() => {
    if (page) {
      setViewport(page.getViewport({ scale }));
    }
  }, [page, scale]);

  // Loading placeholder
  if (loading || !page || !viewport) {
    return (
      <div
        className={cn(
          "bg-muted/50 animate-pulse rounded",
          className
        )}
        style={{
          width: 595 * scale,
          height: 842 * scale,
        }}
      />
    );
  }

  return (
    <div
      className={cn("relative bg-white shadow-md pdf-page", className)}
      style={{
        width: viewport.width,
        height: viewport.height,
      }}
      data-page-number={pageNumber}
    >
      {/* Canvas layer for rendering PDF */}
      <CanvasLayer
        page={page}
        viewport={viewport}
        onRenderComplete={onRenderComplete}
      />

      {/* Text layer for selection */}
      {renderTextLayer && <TextLayer page={page} viewport={viewport} />}
    </div>
  );
});

export default PageLayer;
