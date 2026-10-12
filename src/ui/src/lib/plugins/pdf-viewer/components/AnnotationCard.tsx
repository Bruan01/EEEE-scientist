/**
 * AnnotationCard Component
 *
 * Single annotation display card with edit/delete functionality.
 *
 * @module plugins/pdf-viewer/components/AnnotationCard
 */

"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/useI18n";
import type { UILanguage } from "@/lib/i18n/types";
import { ColorPicker } from "./ColorPicker";
import { TagManager } from "./TagInput";
import { resolveAnnotationColor, type AnnotationCardProps, type AnnotationColor } from "../types";

/**
 * Format relative time
 */
function formatRelativeTime(
  dateString: string,
  language: UILanguage,
  t: (key: string, variables?: Record<string, string | number>) => string
): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return t("just_now");
  } else if (diffMins < 60) {
    return t("minutes_ago", { count: diffMins });
  } else if (diffHours < 24) {
    return t("hours_ago", { count: diffHours });
  } else if (diffDays < 7) {
    return t("days_ago", { count: diffDays });
  } else {
    return date.toLocaleDateString(language === "zh-CN" ? "zh-CN" : "en-US", {
      month: "short",
      day: "numeric",
    });
  }
}

/**
 * Inline comment editor
 */
function CommentEditor({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n("pdf_viewer");
  const [draft, setDraft] = useState(value);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        onSave(draft);
      }
    },
    [draft, onSave, onCancel]
  );

  return (
    <div className="space-y-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full px-3 py-2 rounded-soft-sm border text-sm",
          "bg-soft-bg-elevated text-soft-text-primary",
          "border-soft-border focus:border-soft-accent",
          "focus:outline-none focus:ring-1 focus:ring-soft-accent",
          "resize-none min-h-[60px]"
        )}
        autoFocus
        rows={3}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button size="sm" onClick={() => onSave(draft)}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Delete confirmation dialog
 */
function DeleteConfirmation({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n("pdf_viewer");

  return (
    <div className="space-y-3 p-3 bg-soft-bg-elevated rounded-soft-sm border border-red-200">
      <div className="text-sm text-soft-text-primary">
        {t("delete_confirm_title")}
      </div>
      <p className="text-xs text-soft-text-secondary">
        {t("delete_confirm_desc")}
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button variant="destructive" size="sm" onClick={onConfirm}>
          {t("delete")}
        </Button>
      </div>
    </div>
  );
}

/**
 * AnnotationCard component
 */
export function AnnotationCard({
  annotation,
  onClick,
  onDelete,
  onUpdate,
  isSelected = false,
}: AnnotationCardProps) {
  const { t, language } = useI18n("pdf_viewer");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      // Don't trigger click when interacting with buttons
      if ((e.target as HTMLElement).closest("button")) {
        return;
      }
      onClick();
    },
    [onClick]
  );

  const handleCommentSave = useCallback(
    (comment: string) => {
      onUpdate({ comment });
      setIsEditingComment(false);
    },
    [onUpdate]
  );

  const handleColorChange = useCallback(
    (color: AnnotationColor) => {
      onUpdate({ color });
    },
    [onUpdate]
  );

  const handleTagsChange = useCallback(
    (tags: string[]) => {
      onUpdate({ tags });
    },
    [onUpdate]
  );

  const handleDelete = useCallback(() => {
    onDelete();
    setShowDeleteConfirm(false);
  }, [onDelete]);

  const colorConfig = resolveAnnotationColor(annotation.color);

  return (
    <Card
      className={cn(
        "relative cursor-pointer transition-all duration-200",
        "hover:shadow-soft-md",
        isSelected && "ring-2 ring-soft-accent shadow-soft-md"
      )}
      onClick={handleCardClick}
    >
      {/* Color indicator bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-soft-lg"
        style={{ backgroundColor: colorConfig.border }}
      />

      <CardContent className="p-3 pl-4">
        {/* Delete confirmation overlay */}
        {showDeleteConfirm && (
          <DeleteConfirmation
            onConfirm={handleDelete}
            onCancel={() => setShowDeleteConfirm(false)}
          />
        )}

        {!showDeleteConfirm && (
          <>
            {/* Selected text */}
            <p className="text-sm text-soft-text-primary line-clamp-2 mb-2">
              &quot;{annotation.content.text}&quot;
            </p>

            {/* Comment */}
            {!isEditingComment && annotation.comment && (
              <p className="text-xs text-soft-text-secondary line-clamp-2 mb-2 italic">
                {annotation.comment}
              </p>
            )}

            {/* Comment editor */}
            {isEditingComment && (
              <div className="mb-3" onClick={(e) => e.stopPropagation()}>
                <CommentEditor
                  value={annotation.comment}
                  onSave={handleCommentSave}
                  onCancel={() => setIsEditingComment(false)}
                />
              </div>
            )}

            {/* Tags */}
            {annotation.tags.length > 0 && !isExpanded && (
              <div className="flex flex-wrap gap-1 mb-2">
                {annotation.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {annotation.tags.length > 3 && (
                  <span className="text-xs text-soft-text-tertiary">
                    +{annotation.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Metadata and actions */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-soft-text-tertiary">
                {formatRelativeTime(annotation.createdAt, language, t)}
              </span>

              <div
                className="flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Edit button */}
                <button
                  type="button"
                  className={cn(
                    "p-1 rounded-soft-sm text-soft-text-tertiary",
                    "hover:bg-soft-bg-elevated hover:text-soft-text-primary",
                    "transition-colors"
                  )}
                  title={t("edit")}
                  onClick={() => setIsExpanded(!isExpanded)}
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
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>

                {/* Delete button */}
                <button
                  type="button"
                  className={cn(
                    "p-1 rounded-soft-sm text-soft-text-tertiary",
                    "hover:bg-red-50 hover:text-red-500",
                    "transition-colors"
                  )}
                  title={t("delete")}
                  onClick={() => setShowDeleteConfirm(true)}
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Expanded edit panel */}
            {isExpanded && (
              <div
                className="mt-3 pt-3 border-t border-soft-border space-y-3"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Comment edit */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-soft-text-secondary">
                      {t("comment")}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-soft-accent hover:underline"
                      onClick={() => setIsEditingComment(true)}
                    >
                      {t("edit")}
                    </button>
                  </div>
                  <p className="text-sm text-soft-text-primary">
                    {annotation.comment || (
                      <span className="italic text-soft-text-tertiary">
                        {t("no_comment")}
                      </span>
                    )}
                  </p>
                </div>

                {/* Color picker */}
                <div>
                  <span className="text-xs text-soft-text-secondary block mb-2">
                    {t("color")}
                  </span>
                  <ColorPicker
                    value={annotation.color}
                    onChange={handleColorChange}
                    size="sm"
                  />
                </div>

                {/* Tag manager */}
                <div>
                  <span className="text-xs text-soft-text-secondary block mb-2">
                    {t("tags")}
                  </span>
                  <TagManager
                    tags={annotation.tags}
                    onChange={handleTagsChange}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton loading card
 */
export function AnnotationCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-3 pl-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-soft-bg-elevated rounded w-3/4" />
          <div className="h-4 bg-soft-bg-elevated rounded w-1/2" />
          <div className="h-3 bg-soft-bg-elevated rounded w-1/4 mt-3" />
        </div>
      </CardContent>
    </Card>
  );
}

export default AnnotationCard;
