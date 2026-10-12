/**
 * Image Canvas Component
 *
 * Provides zoom, pan, and rotation functionality for images.
 * Implements custom zoom/pan logic without external dependencies.
 */

"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  type MouseEvent,
  type WheelEvent,
  type TouchEvent,
} from "react";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface ImageCanvasProps {
  src: string;
  alt: string;
  onLoad?: (info: ImageInfo) => void;
  onError?: () => void;
  rotation: number;
  className?: string;
}

export interface ImageInfo {
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
}

interface TransformState {
  scale: number;
  translateX: number;
  translateY: number;
}

// ============================================================
// Constants
// ============================================================

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const ZOOM_STEP = 0.1;

// ============================================================
// Image Canvas Component
// ============================================================

export default function ImageCanvas({
  src,
  alt,
  onLoad,
  onError,
  rotation,
  className,
}: ImageCanvasProps) {
  // State
  const [loading, setLoading] = useState(true);
  const [transform, setTransform] = useState<TransformState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset transform when image changes
  useEffect(() => {
    setTransform({ scale: 1, translateX: 0, translateY: 0 });
    setLoading(true);
  }, [src]);

  // Handle image load
  const handleLoad = useCallback(() => {
    setLoading(false);
    if (imageRef.current && onLoad) {
      onLoad({
        width: imageRef.current.width,
        height: imageRef.current.height,
        naturalWidth: imageRef.current.naturalWidth,
        naturalHeight: imageRef.current.naturalHeight,
      });
    }
  }, [onLoad]);

  // Handle image error
  const handleError = useCallback(() => {
    setLoading(false);
    onError?.();
  }, [onError]);

  // Zoom functions
  const zoomIn = useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      scale: Math.min(prev.scale + ZOOM_STEP, MAX_SCALE),
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(prev.scale - ZOOM_STEP, MIN_SCALE),
    }));
  }, []);

  const resetTransform = useCallback(() => {
    setTransform({ scale: 1, translateX: 0, translateY: 0 });
  }, []);

  const fitToScreen = useCallback(() => {
    if (!containerRef.current || !imageRef.current) return;

    const container = containerRef.current.getBoundingClientRect();
    const img = imageRef.current;
    const imageWidth = img.naturalWidth;
    const imageHeight = img.naturalHeight;

    const scaleX = (container.width - 40) / imageWidth;
    const scaleY = (container.height - 40) / imageHeight;
    const scale = Math.min(scaleX, scaleY, 1);

    setTransform({ scale, translateX: 0, translateY: 0 });
  }, []);

  // Handle wheel zoom
  const handleWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();

    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, transform.scale + delta));

    // Zoom towards cursor position
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      const scaleDiff = newScale / transform.scale;
      const newTranslateX = x - scaleDiff * (x - transform.translateX);
      const newTranslateY = y - scaleDiff * (y - transform.translateY);

      setTransform({
        scale: newScale,
        translateX: newTranslateX,
        translateY: newTranslateY,
      });
    } else {
      setTransform((prev) => ({ ...prev, scale: newScale }));
    }
  }, [transform]);

  // Handle mouse drag
  const handleMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.translateX, y: e.clientY - transform.translateY });
  }, [transform.translateX, transform.translateY]);

  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    setTransform((prev) => ({
      ...prev,
      translateX: e.clientX - dragStart.x,
      translateY: e.clientY - dragStart.y,
    }));
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle touch events
  const handleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({
        x: touch.clientX - transform.translateX,
        y: touch.clientY - transform.translateY,
      });
    }
  }, [transform.translateX, transform.translateY]);

  const handleTouchMove = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setTransform((prev) => ({
      ...prev,
      translateX: touch.clientX - dragStart.x,
      translateY: touch.clientY - dragStart.y,
    }));
  }, [isDragging, dragStart]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Double click to reset
  const handleDoubleClick = useCallback(() => {
    resetTransform();
  }, [resetTransform]);

  // Build transform string
  const transformStyle = `
    translate(${transform.translateX}px, ${transform.translateY}px)
    scale(${transform.scale})
    rotate(${rotation}deg)
  `;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-full overflow-hidden select-none",
        isDragging ? "cursor-grabbing" : "cursor-grab",
        className
      )}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
    >
      {/* Loading placeholder */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Image container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          className={cn(
            "max-w-none transition-transform duration-100",
            loading && "opacity-0"
          )}
          style={{
            transform: transformStyle,
            transformOrigin: "center center",
          }}
          onLoad={handleLoad}
          onError={handleError}
          draggable={false}
        />
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-4 left-4 px-2 py-1 bg-background/80 backdrop-blur rounded text-xs text-muted-foreground">
        {Math.round(transform.scale * 100)}%
      </div>
    </div>
  );
}

// Export additional functions for parent component
export { MIN_SCALE, MAX_SCALE, ZOOM_STEP };
