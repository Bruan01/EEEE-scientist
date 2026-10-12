/**
 * Image Viewer Plugin Component
 *
 * @ds/plugin-image-viewer
 *
 * Displays images with:
 * - Zoom and pan functionality (mouse wheel + drag)
 * - Rotation controls
 * - Fit-to-screen options
 * - Image information display (dimensions, size)
 * - Download functionality
 */

"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import type { PluginComponentProps } from "@/lib/types/plugin";
import { cn } from "@/lib/utils";
import {
  Image,
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCw,
  RotateCcw,
  Download,
  AlertCircle,
  Loader2,
  ImageOff,
  Info,
} from "lucide-react";
import ImageCanvas, { type ImageInfo } from "./components/ImageCanvas";

// ============================================================
// Demo Image URL
// ============================================================

const DEMO_IMAGE_URL = "https://via.placeholder.com/1920x1080?text=DeepScientist+Image+Viewer";

// ============================================================
// Helper Functions
// ============================================================

function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getImageExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return ext.toUpperCase();
}

// ============================================================
// Main Component
// ============================================================

export default function ImageViewerPlugin({
  context,
  tabId,
  setDirty,
  setTitle,
}: PluginComponentProps) {
  // State
  const [imageUrl, setImageUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const [rotation, setRotation] = useState(0);
  const [showInfo, setShowInfo] = useState(false);

  // Refs for zoom controls
  const canvasRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    resetTransform: () => void;
    fitToScreen: () => void;
  }>(null);

  // Get file name
  const fileName = context.resourceName || context.resourcePath || "Image";

  // Set tab title
  useEffect(() => {
    setTitle(fileName);
  }, [fileName, setTitle]);

  // Build image URL
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setLoading(true);
    setError(null);

    if (!context.resourceId) {
      // No file selected: show demo image
      setImageUrl(DEMO_IMAGE_URL);
      return () => {
        cancelled = true;
      };
    }

    // Load image URL from API
    const loadImageUrl = async () => {
      try {
        const { createFileObjectUrl } = await import("@/lib/api/files");
        objectUrl = await createFileObjectUrl(context.resourceId!);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setImageUrl(objectUrl);
      } catch (err) {
        console.error("Failed to get image URL:", err);
        setError("Failed to load image");
        setLoading(false);
      }
    };
    loadImageUrl();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [context.resourceId]);

  // Handle image load
  const handleImageLoad = useCallback((info: ImageInfo) => {
    setLoading(false);
    setImageInfo(info);
  }, []);

  // Handle image error
  const handleImageError = useCallback(() => {
    setLoading(false);
    setError("Failed to load image");
  }, []);

  // Rotation controls
  const rotateLeft = useCallback(() => {
    setRotation((prev) => (prev - 90) % 360);
  }, []);

  const rotateRight = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  // Reset rotation
  const resetRotation = useCallback(() => {
    setRotation(0);
  }, []);

  // Download image
  const handleDownload = useCallback(() => {
    if (!imageUrl) return;

    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = fileName;
    link.click();
  }, [imageUrl, fileName]);

  // File size from context
  const fileSize = context.customData?.size as number | undefined;

  // Error state
  if (error && !loading) {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Toolbar */}
        <div className="flex items-center px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <Image className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">{fileName}</span>
          </div>
        </div>

        {/* Error content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <ImageOff className="w-16 h-16 text-muted-foreground" />
            <div>
              <p className="text-lg font-medium text-foreground">Failed to load image</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <button
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background">
        <div className="flex items-center gap-3">
          <Image className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-foreground">{fileName}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
            {getImageExtension(fileName)}
          </span>
          {imageInfo && (
            <span className="text-xs text-muted-foreground">
              {imageInfo.naturalWidth} x {imageInfo.naturalHeight}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          <button
            onClick={() => canvasRef.current?.zoomOut?.()}
            className="p-2 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => canvasRef.current?.resetTransform?.()}
            className="p-2 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title="Reset zoom (double-click image)"
          >
            <Maximize className="w-4 h-4" />
          </button>
          <button
            onClick={() => canvasRef.current?.zoomIn?.()}
            className="p-2 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* Separator */}
          <div className="w-px h-6 bg-border mx-1" />

          {/* Rotation controls */}
          <button
            onClick={rotateLeft}
            className="p-2 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title="Rotate left"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={rotateRight}
            className="p-2 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title="Rotate right"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Separator */}
          <div className="w-px h-6 bg-border mx-1" />

          {/* Info toggle */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={cn(
              "p-2 rounded transition-colors",
              showInfo
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent text-muted-foreground hover:text-foreground"
            )}
            title="Image info"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            className="p-2 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title="Download image"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image container */}
      <div className="flex-1 relative overflow-hidden bg-[#1a1a1a]">
        {/* Checkerboard background for transparent images */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(45deg, #808080 25%, transparent 25%),
              linear-gradient(-45deg, #808080 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #808080 75%),
              linear-gradient(-45deg, transparent 75%, #808080 75%)
            `,
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          }}
        />

        {/* Loading indicator */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Image canvas */}
        {imageUrl && (
          <ImageCanvas
            src={imageUrl}
            alt={fileName}
            rotation={rotation}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}

        {/* Info panel */}
        {showInfo && imageInfo && (
          <div className="absolute top-4 right-4 p-4 bg-background/90 backdrop-blur rounded-lg shadow-lg border border-border">
            <h3 className="font-medium text-foreground mb-3">Image Information</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-8">
                <dt className="text-muted-foreground">Filename</dt>
                <dd className="text-foreground font-mono">{fileName}</dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt className="text-muted-foreground">Dimensions</dt>
                <dd className="text-foreground font-mono">
                  {imageInfo.naturalWidth} x {imageInfo.naturalHeight}
                </dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt className="text-muted-foreground">Format</dt>
                <dd className="text-foreground font-mono">{getImageExtension(fileName)}</dd>
              </div>
              {fileSize && (
                <div className="flex justify-between gap-8">
                  <dt className="text-muted-foreground">Size</dt>
                  <dd className="text-foreground font-mono">{formatFileSize(fileSize)}</dd>
                </div>
              )}
              {rotation !== 0 && (
                <div className="flex justify-between gap-8">
                  <dt className="text-muted-foreground">Rotation</dt>
                  <dd className="text-foreground font-mono">{rotation}deg</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>

      {/* Bottom controls bar */}
      <div className="flex items-center justify-center gap-2 px-4 py-2 border-t border-border bg-background">
        <span className="text-xs text-muted-foreground">
          Scroll to zoom | Drag to pan | Double-click to reset
        </span>
      </div>
    </div>
  );
}
