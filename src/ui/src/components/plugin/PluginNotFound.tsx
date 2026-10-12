"use client";

/**
 * PluginNotFound Component
 *
 * Displayed when a requested plugin is not registered.
 *
 * @module components/plugin/PluginNotFound
 */

import { AlertCircle, Package, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TabContext } from "@/lib/types/tab";
import { PngIcon } from "@/components/ui/png-icon";

/**
 * PluginNotFound Props
 */
export interface PluginNotFoundProps {
  /** Plugin ID that was not found */
  pluginId: string;

  /** Tab context (for additional info) */
  context?: TabContext;

  /** Additional CSS classes */
  className?: string;
}

/**
 * PluginNotFound Component
 *
 * Shows a user-friendly message when a plugin is not available.
 * Provides suggestions for troubleshooting.
 *
 * @example
 * ```tsx
 * <PluginNotFound
 *   pluginId="@ds/plugin-pdf-viewer"
 *   context={{ type: 'file', resourceName: 'document.pdf' }}
 * />
 * ```
 */
export function PluginNotFound({
  pluginId,
  context,
  className,
}: PluginNotFoundProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full p-8",
        "bg-soft-bg-base text-soft-text-secondary",
        className
      )}
    >
      <div className="flex flex-col items-center max-w-md text-center space-y-4">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-soft-bg-elevated flex items-center justify-center">
          <PngIcon
            name="Package"
            size={32}
            className="w-8 h-8"
            fallback={<Package className="w-8 h-8 text-soft-accent" />}
          />
        </div>

        {/* Title */}
        <h3 className="text-lg font-medium text-soft-text-primary">
          Plugin Not Found
        </h3>

        {/* Description */}
        <p className="text-sm">
          The plugin{" "}
          <code className="px-1.5 py-0.5 bg-soft-bg-elevated rounded text-xs font-mono">
            {pluginId}
          </code>{" "}
          is not registered or not available.
        </p>

        {/* Resource info */}
        {context?.resourceName && (
          <div className="flex items-center gap-2 text-sm">
            <PngIcon
              name="AlertCircle"
              size={16}
              className="w-4 h-4"
              fallback={<AlertCircle className="w-4 h-4" />}
            />
            <span>
              Cannot open: <strong>{context.resourceName}</strong>
            </span>
          </div>
        )}

        {/* Suggestions */}
        <div className="mt-4 p-4 bg-soft-bg-elevated rounded-lg w-full">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="w-4 h-4" />
            <span className="font-medium text-soft-text-primary">
              Possible solutions:
            </span>
          </div>
          <ul className="text-left text-sm space-y-1 list-disc list-inside">
            <li>This plugin may be coming soon</li>
            <li>Check if the plugin is properly installed</li>
            <li>The file type may not be supported yet</li>
            <li>Try refreshing the page</li>
          </ul>
        </div>

        {/* Plugin ID for debugging */}
        <div className="text-xs text-soft-text-secondary mt-2">
          Plugin ID: {pluginId}
        </div>
      </div>
    </div>
  );
}

export default PluginNotFound;
