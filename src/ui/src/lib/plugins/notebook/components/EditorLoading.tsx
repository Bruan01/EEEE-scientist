"use client";

/**
 * EditorLoading Component
 *
 * @ds/plugin-notebook
 *
 * Loading state component for the notebook editor.
 * Displays a skeleton UI while the editor is initializing.
 */

import React from "react";
import { useI18n } from "@/lib/i18n/useI18n";

/**
 * EditorLoading Props
 */
interface EditorLoadingProps {
  /** Loading message */
  message?: string;
}

/**
 * Skeleton line component for loading animation
 */
function SkeletonLine({
  width,
  className = "",
}: {
  width: string;
  className?: string;
}) {
  return (
    <div
      className={`h-4 bg-muted rounded animate-pulse ${className}`}
      style={{ width }}
    />
  );
}

/**
 * Skeleton block for loading animation
 */
function SkeletonBlock() {
  return (
    <div className="space-y-2">
      <SkeletonLine width="85%" />
      <SkeletonLine width="70%" />
      <SkeletonLine width="90%" />
    </div>
  );
}

/**
 * EditorLoading Component
 *
 * Shows a skeleton loading state that resembles the editor layout.
 */
export function EditorLoading({ message = "Loading..." }: EditorLoadingProps) {
  const { t } = useI18n("notebook");
  const resolvedMessage = message === "Loading..." ? t("loading") : message;

  return (
    <div className="editor-loading h-full flex flex-col bg-background">
      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-3">
          <div className="w-32 h-7 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-muted rounded animate-pulse" />
          <div className="w-8 h-8 bg-muted rounded animate-pulse" />
          <div className="w-8 h-8 bg-muted rounded animate-pulse" />
        </div>
      </div>

      {/* Editor content skeleton */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-[900px] mx-auto px-16 py-12 space-y-8">
          {/* Title skeleton */}
          <div className="h-10 bg-muted rounded animate-pulse w-2/3" />

          {/* Content blocks skeleton */}
          <div className="space-y-6">
            <SkeletonBlock />
            <SkeletonBlock />

            {/* Heading skeleton */}
            <div className="pt-4">
              <div className="h-6 bg-muted rounded animate-pulse w-1/2" />
            </div>

            <SkeletonBlock />

            {/* Code block skeleton */}
            <div className="bg-muted/50 rounded-md p-4 space-y-2">
              <SkeletonLine width="60%" className="h-3" />
              <SkeletonLine width="80%" className="h-3" />
              <SkeletonLine width="45%" className="h-3" />
              <SkeletonLine width="70%" className="h-3" />
            </div>

            <SkeletonBlock />
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="flex flex-col items-center gap-3 bg-background/80 px-6 py-4 rounded-lg shadow-lg backdrop-blur-sm">
          {/* Spinner */}
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 border-2 border-muted rounded-full" />
            <div className="absolute inset-0 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>

          {/* Message */}
          <span className="text-sm text-muted-foreground">{resolvedMessage}</span>
        </div>
      </div>
    </div>
  );
}

export default EditorLoading;
