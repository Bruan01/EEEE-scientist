"use client";

/**
 * PluginError Component
 *
 * Displayed when a plugin crashes or throws an error.
 *
 * @module components/plugin/PluginError
 */

import { AlertTriangle, RefreshCw, Bug, Copy, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PngIcon } from "@/components/ui/png-icon";
import { copyToClipboard } from "@/lib/clipboard";

/**
 * PluginError Props
 */
export interface PluginErrorProps {
  /** Plugin ID that crashed */
  pluginId: string;

  /** The error that was thrown */
  error?: Error | null;

  /** Called when user wants to retry */
  onRetry?: () => void;

  /** Additional CSS classes */
  className?: string;
}

/**
 * PluginError Component
 *
 * Shows a user-friendly error message when a plugin crashes.
 * Provides options to retry or report the error.
 *
 * @example
 * ```tsx
 * <PluginError
 *   pluginId="@ds/plugin-pdf-viewer"
 *   error={new Error("Failed to load PDF")}
 *   onRetry={() => reloadPlugin()}
 * />
 * ```
 */
export function PluginError({
  pluginId,
  error,
  onRetry,
  className,
}: PluginErrorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const errorMessage = error?.message || "An unknown error occurred";
  const errorStack = error?.stack || "No stack trace available";

  /**
   * Copy error details to clipboard
   */
  const handleCopyError = async () => {
    const errorDetails = `Plugin: ${pluginId}\nError: ${errorMessage}\n\nStack Trace:\n${errorStack}`;
    const ok = await copyToClipboard(errorDetails);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full p-8",
        "bg-soft-bg-base text-soft-text-secondary",
        className
      )}
    >
      <div className="flex flex-col items-center max-w-lg text-center space-y-4">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
          <PngIcon
            name="AlertTriangle"
            size={32}
            className="w-8 h-8"
            fallback={<AlertTriangle className="w-8 h-8 text-red-500" />}
          />
        </div>

        {/* Title */}
        <h3 className="text-lg font-medium text-soft-text-primary">
          Plugin Error
        </h3>

        {/* Description */}
        <p className="text-sm">
          The plugin{" "}
          <code className="px-1.5 py-0.5 bg-soft-bg-elevated rounded text-xs font-mono">
            {pluginId}
          </code>{" "}
          encountered an error and could not render.
        </p>

        {/* Error message */}
        <div className="w-full p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <PngIcon
              name="Bug"
              size={16}
              className="w-4 h-4 mt-0.5 flex-shrink-0"
              fallback={<Bug className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
            />
            <p className="text-sm text-red-700 dark:text-red-300 text-left break-all">
              {errorMessage}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-soft-accent text-white",
                "hover:bg-soft-accent/90 transition-colors"
              )}
            >
              <PngIcon
                name="RefreshCw"
                size={16}
                className="w-4 h-4"
                fallback={<RefreshCw className="w-4 h-4" />}
              />
              <span>Try Again</span>
            </button>
          )}

          <button
            onClick={() => setShowDetails(!showDetails)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg",
              "bg-soft-bg-elevated text-soft-text-primary",
              "hover:bg-soft-border transition-colors"
            )}
          >
            <PngIcon
              name="Bug"
              size={16}
              className="w-4 h-4"
              fallback={<Bug className="w-4 h-4" />}
            />
            <span>{showDetails ? "Hide Details" : "Show Details"}</span>
          </button>
        </div>

        {/* Error details */}
        {showDetails && (
          <div className="w-full mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-soft-text-secondary">
                Stack Trace
              </span>
              <button
                onClick={handleCopyError}
                className="flex items-center gap-1 text-xs text-soft-text-secondary hover:text-soft-text-primary"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <PngIcon
                      name="Copy"
                      size={12}
                      className="w-3 h-3"
                      fallback={<Copy className="w-3 h-3" />}
                    />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre
              className={cn(
                "w-full p-3 bg-soft-bg-elevated rounded-lg",
                "text-xs text-left overflow-x-auto",
                "max-h-48 overflow-y-auto"
              )}
            >
              {errorStack}
            </pre>
          </div>
        )}

        {/* Help text */}
        <p className="text-xs text-soft-text-secondary mt-4">
          If this error persists, please report it to the developers.
        </p>
      </div>
    </div>
  );
}

export default PluginError;
