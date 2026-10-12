/**
 * ColorPicker Component
 *
 * Color selection component for PDF annotations with 6 preset colors.
 *
 * @module plugins/pdf-viewer/components/ColorPicker
 */

"use client";

import React, { useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n/useI18n";
import { cn } from "@/lib/utils";
import { ANNOTATION_COLORS, type AnnotationColor, type ColorPickerProps } from "../types";

/**
 * Color button size variants
 */
const SIZE_CLASSES = {
  sm: "w-5 h-5",
  md: "w-6 h-6",
  lg: "w-8 h-8",
} as const;

/**
 * Inline color picker (no popover)
 */
export function ColorPicker({ value, onChange, size = "md" }: ColorPickerProps) {
  const { t } = useI18n("pdf_viewer");

  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label={t("select_highlight_color")}>
      {(Object.keys(ANNOTATION_COLORS) as AnnotationColor[]).map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={ANNOTATION_COLORS[color].label}
          title={`${ANNOTATION_COLORS[color].label} - ${ANNOTATION_COLORS[color].description}`}
          className={cn(
            "rounded-full border-2 transition-all duration-150",
            SIZE_CLASSES[size],
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-soft-accent",
            "hover:scale-110 active:scale-95",
            value === color
              ? "border-soft-text-primary scale-110 shadow-md"
              : "border-transparent hover:border-soft-border"
          )}
          style={{ backgroundColor: ANNOTATION_COLORS[color].border }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}

/**
 * Dropdown color picker with label
 */
export function ColorPickerDropdown({
  value,
  onChange,
  size = "md",
}: ColorPickerProps) {
  const { t } = useI18n("pdf_viewer");
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = useCallback(
    (color: AnnotationColor) => {
      onChange(color);
      setIsOpen(false);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      } else if (e.key === "Enter" || e.key === " ") {
        setIsOpen((prev) => !prev);
      }
    },
    []
  );

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-soft-md",
          "bg-soft-bg-elevated border border-soft-border",
          "hover:border-soft-accent/50 transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-soft-accent"
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div
          className={cn("rounded-full", SIZE_CLASSES[size])}
          style={{ backgroundColor: ANNOTATION_COLORS[value].border }}
        />
        <span className="text-sm text-soft-text-primary">
          {ANNOTATION_COLORS[value].label}
        </span>
        <svg
          className={cn(
            "w-4 h-4 text-soft-text-secondary transition-transform",
            isOpen && "rotate-180"
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Color options */}
          <div
            className={cn(
              "absolute top-full left-0 mt-1 z-20",
              "bg-soft-bg-surface rounded-soft-md shadow-soft-lg",
              "border border-soft-border p-2 min-w-[160px]",
              "animate-in fade-in-0 zoom-in-95 duration-150"
            )}
            role="listbox"
            aria-label={t("select_highlight_color")}
          >
            {(Object.keys(ANNOTATION_COLORS) as AnnotationColor[]).map((color) => (
              <button
                key={color}
                type="button"
                role="option"
                aria-selected={value === color}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2 rounded-soft-sm",
                  "text-left transition-colors",
                  "hover:bg-soft-bg-elevated",
                  "focus:outline-none focus-visible:bg-soft-bg-elevated",
                  value === color && "bg-soft-bg-elevated"
                )}
                onClick={() => handleSelect(color)}
              >
                <div
                  className="w-5 h-5 rounded-full border border-soft-border"
                  style={{ backgroundColor: ANNOTATION_COLORS[color].border }}
                />
                <div className="flex-1">
                  <div className="text-sm text-soft-text-primary">
                    {ANNOTATION_COLORS[color].label}
                  </div>
                  <div className="text-xs text-soft-text-tertiary">
                    {ANNOTATION_COLORS[color].description}
                  </div>
                </div>
                {value === color && (
                  <svg
                    className="w-4 h-4 text-soft-accent"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Compact color indicator (read-only)
 */
export function ColorIndicator({
  color,
  size = "sm",
  showLabel = false,
}: {
  color: AnnotationColor;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}) {
  const config = ANNOTATION_COLORS[color];

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn("rounded-full", SIZE_CLASSES[size])}
        style={{ backgroundColor: config.border }}
        title={`${config.label} - ${config.description}`}
      />
      {showLabel && (
        <span className="text-xs text-soft-text-secondary">{config.label}</span>
      )}
    </div>
  );
}

export default ColorPicker;
