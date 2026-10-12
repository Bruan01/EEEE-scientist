/**
 * AnnotationTip Component
 *
 * Floating tooltip shown after text selection for creating annotations.
 * Includes color picker, comment input, and tag management.
 *
 * @module plugins/pdf-viewer/components/AnnotationTip
 */

"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/useI18n";
import { ColorPicker } from "./ColorPicker";
import { TagInput } from "./TagInput";
import { ANNOTATION_COLORS, type AnnotationColor, type AnnotationTipProps } from "../types";

/**
 * Textarea component for annotation comments
 */
function CommentTextarea({
  value,
  onChange,
  placeholder = "Add a note...",
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full px-3 py-2 rounded-soft-md border transition-all duration-200",
        "bg-soft-bg-elevated text-soft-text-primary placeholder-soft-text-tertiary",
        "border-soft-border hover:border-soft-accent/50",
        "focus:outline-none focus:ring-2 focus:ring-soft-accent focus:border-transparent",
        "resize-none min-h-[80px] text-sm"
      )}
      rows={3}
    />
  );
}

/**
 * AnnotationTip component
 *
 * Floating popup displayed after text selection for creating annotations.
 */
export function AnnotationTip({
  position,
  selectedText,
  onConfirm,
  onCancel,
}: AnnotationTipProps) {
  const { t } = useI18n("pdf_viewer");
  const [color, setColor] = useState<AnnotationColor>("yellow");
  const [comment, setComment] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [showTagInput, setShowTagInput] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Define handleSubmit first
  const handleSubmit = useCallback(() => {
    onConfirm(comment, color, tags);
  }, [comment, color, tags, onConfirm]);

  // Handle click outside to cancel
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        onCancel();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onCancel]);

  // Handle keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      } else if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        handleSubmit();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, handleSubmit]);

  const handleAddTag = useCallback((tag: string) => {
    if (!tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setShowTagInput(false);
  }, [tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  }, [tags]);

  // Calculate position to keep tip within viewport
  const tipStyle: React.CSSProperties = {
    position: "fixed",
    left: position.x,
    top: position.y,
    zIndex: 9999,
    // Ensure it doesn't go off-screen
    transform: "translateX(-50%)",
    maxWidth: "min(320px, calc(100vw - 32px))",
  };

  return (
    <div style={tipStyle}>
      <Card
        ref={cardRef}
        className={cn(
          "w-80 shadow-soft-lg",
          "animate-in fade-in-0 zoom-in-95 duration-200"
        )}
      >
        <CardContent className="p-4 space-y-4">
          {/* Selected text preview */}
          <div className="bg-soft-bg-elevated rounded-soft-sm p-2 border border-soft-border">
            <p className="text-xs text-soft-text-tertiary mb-1">{t("selected_text")}</p>
            <p className="text-sm text-soft-text-primary line-clamp-2">
              &quot;{selectedText}&quot;
            </p>
          </div>

          {/* Color selection */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-soft-text-secondary">{t("color")}:</span>
            <ColorPicker value={color} onChange={setColor} size="md" />
          </div>

          {/* Comment input */}
          <div>
            <CommentTextarea
              value={comment}
              onChange={setComment}
              placeholder={t("add_note_optional")}
              autoFocus
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-soft-text-secondary">{t("tags")}:</span>
              {!showTagInput && (
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 text-xs rounded-full",
                    "text-soft-text-tertiary hover:text-soft-accent",
                    "border border-dashed border-soft-border hover:border-soft-accent",
                    "transition-colors duration-150"
                  )}
                  onClick={() => setShowTagInput(true)}
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  {t("add")}
                </button>
              )}
            </div>

            {/* Tag list */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs pr-1">
                    <span>{tag}</span>
                    <button
                      type="button"
                      className="ml-1 hover:text-red-500 transition-colors"
                      onClick={() => handleRemoveTag(tag)}
                      aria-label={t("remove_tag", { tag })}
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Tag input */}
            {showTagInput && (
              <TagInput
                onAdd={handleAddTag}
                onCancel={() => setShowTagInput(false)}
              />
            )}
          </div>

          {/* Action buttons */}
          <div className="flex justify-between items-center pt-2 border-t border-soft-border">
            <span className="text-xs text-soft-text-tertiary">{t("save_shortcut")}</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onCancel}>
                {t("cancel")}
              </Button>
              <Button size="sm" onClick={handleSubmit}>
                {t("save")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Compact annotation tip for quick highlighting
 * (Single-click highlight without expanded options)
 */
export function QuickAnnotationTip({
  position,
  onColorSelect,
  onExpand,
  onCancel,
}: {
  position: { x: number; y: number };
  onColorSelect: (color: AnnotationColor) => void;
  onExpand: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n("pdf_viewer");
  const tipRef = useRef<HTMLDivElement>(null);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tipRef.current && !tipRef.current.contains(event.target as Node)) {
        onCancel();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onCancel]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const tipStyle: React.CSSProperties = {
    position: "fixed",
    left: position.x,
    top: position.y,
    zIndex: 9999,
    transform: "translateX(-50%)",
  };

  return (
    <div ref={tipRef} style={tipStyle}>
      <Card
        className={cn(
          "shadow-soft-md",
          "animate-in fade-in-0 zoom-in-95 duration-150"
        )}
      >
        <CardContent className="p-2 flex items-center gap-2">
          {/* Quick color selection */}
          {(Object.keys(ANNOTATION_COLORS) as AnnotationColor[]).map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                "w-6 h-6 rounded-full transition-transform",
                "hover:scale-110 active:scale-95",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-soft-accent"
              )}
              style={{ backgroundColor: ANNOTATION_COLORS[color].border }}
              title={ANNOTATION_COLORS[color].label}
              onClick={() => onColorSelect(color)}
            />
          ))}

          {/* Expand button */}
          <div className="w-px h-5 bg-soft-border mx-1" />
          <button
            type="button"
            className={cn(
              "p-1 rounded-soft-sm text-soft-text-secondary",
              "hover:bg-soft-bg-elevated hover:text-soft-text-primary",
              "transition-colors"
            )}
            title={t("add_comment")}
            onClick={onExpand}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

export default AnnotationTip;
